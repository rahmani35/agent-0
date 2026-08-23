"""Authentication Module for Google Sign-In & Email Whitelist.
"""

from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from google.oauth2 import id_token
from google.auth.transport import requests
from pydantic import BaseModel
from .config import GOOGLE_CLIENT_ID, ALLOWED_USERS

security = HTTPBearer(auto_error=False)
google_request_adapter = requests.Request()


def get_allowed_users() -> List[str]:
    """Parse comma-separated list of allowed email addresses."""
    return [email.strip().lower() for email in ALLOWED_USERS.split(",") if email.strip()]


class GoogleAuthRequest(BaseModel):
    id_token: str


class UserProfile(BaseModel):
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None
    is_authenticated: bool = True


class AuthResponse(BaseModel):
    token: str
    user: UserProfile


def verify_google_id_token(token: str) -> UserProfile:
    """Verify Google OAuth ID Token and check against whitelist."""
    try:
        id_info = id_token.verify_oauth2_token(
            token,
            google_request_adapter,
            audience=GOOGLE_CLIENT_ID if GOOGLE_CLIENT_ID else None,
            clock_skew_in_seconds=10,
        )

        email = id_info.get("email", "").lower().strip()
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google token does not contain a valid email address.",
            )

        allowed_list = get_allowed_users()
        if email not in allowed_list:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: Account '{email}' is not in the authorized users list.",
            )

        return UserProfile(
            email=email,
            name=id_info.get("name", email.split("@")[0]),
            picture=id_info.get("picture"),
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google ID Token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication verification failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> UserProfile:
    """FastAPI dependency to validate incoming Google ID Token."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in with Google.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    return verify_google_id_token(token)
