"""FastAPI Gateway Application connecting Google Sign-In & Vertex AI Agent Engine.
"""

import os
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .config import PORT, REASONING_ENGINE_ID
from .auth import (
    GoogleAuthRequest,
    AuthResponse,
    UserProfile,
    get_current_user,
    verify_google_id_token,
)
from .engine import execute_agent_query, remote_agent


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("ADK & Vertex AI Agent Engine Gateway started.")
    yield
    print("Shutting down Agent Gateway.")


app = FastAPI(
    title="Agent-0 Gateway | Vertex AI Agent Engine",
    description="Secure Gateway with Google Sign-In connecting to Vertex AI Agent Engine.",
    version="2.0.0",
    lifespan=lifespan,
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request and Response Models
class ChatRequest(BaseModel):
    message: str = Field(..., description="The user prompt or query to process.")
    session_id: str = Field(default="default_session", description="Session identifier for multi-turn conversations.")


class SummarizeRequest(BaseModel):
    text: str = Field(..., description="The text or article to summarize.")
    style: Optional[str] = Field(
        default="bullet points",
        description="Desired style (e.g. 'bullet points', 'one-paragraph', 'executive summary').",
    )
    session_id: Optional[str] = Field(default=None)


class MathRequest(BaseModel):
    problem: str = Field(..., description="The math problem or equation to solve.")
    show_steps: bool = Field(default=True, description="Whether to include step-by-step breakdown.")
    session_id: Optional[str] = Field(default=None)


class AgentResponse(BaseModel):
    response: str
    user_id: str
    session_id: str


# Authentication Endpoints
@app.post("/auth/google", response_model=AuthResponse, tags=["Authentication"])
async def authenticate_with_google(request: GoogleAuthRequest):
    """Authenticate with a Google OAuth ID Token and enforce email whitelist."""
    profile = verify_google_id_token(request.id_token)
    return AuthResponse(token=request.id_token, user=profile)


@app.get("/auth/me", response_model=UserProfile, tags=["Authentication"])
async def get_my_profile(current_user: UserProfile = Depends(get_current_user)):
    """Validate current Google session and return user profile."""
    return current_user


# System Endpoints
@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "agent": "adk-reasoning-agent",
        "agent_engine_connected": remote_agent is not None,
        "engine_id": REASONING_ENGINE_ID,
    }


@app.get("/", tags=["System"])
async def root():
    """Root info endpoint."""
    return {
        "message": "Agent-0 Vertex AI Agent Engine Gateway is running.",
        "docs_url": "/docs",
        "endpoints": ["/auth/google", "/auth/me", "/chat", "/summarize", "/math", "/health"],
    }


# Protected Agent Endpoints (Executed on Vertex AI Agent Engine)
@app.post("/chat", response_model=AgentResponse, tags=["Agent"])
async def chat(
    request: ChatRequest,
    current_user: UserProfile = Depends(get_current_user),
):
    """Chat with the deployed Vertex AI Agent Engine (Authenticated)."""
    try:
        response_text = await execute_agent_query(
            prompt=request.message,
            user_id=current_user.email,
            session_id=request.session_id,
        )
        return AgentResponse(
            response=response_text,
            user_id=current_user.email,
            session_id=request.session_id,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent Engine execution failed: {str(exc)}",
        ) from exc


@app.post("/summarize", response_model=AgentResponse, tags=["Capabilities"])
async def summarize(
    request: SummarizeRequest,
    current_user: UserProfile = Depends(get_current_user),
):
    """Summarize text using Vertex AI Agent Engine (Authenticated)."""
    prompt = (
        f"Please summarize the following text in {request.style}:\n\n"
        f"\"\"\"\n{request.text}\n\"\"\""
    )
    # Summarizing is a one-shot task: without an explicit session_id there is no
    # conversation to continue, so let the Agent Engine run it statelessly.
    session_id = request.session_id or f"summary_{os.urandom(4).hex()}"

    try:
        response_text = await execute_agent_query(
            prompt=prompt,
            user_id=current_user.email,
            session_id=request.session_id,
        )
        return AgentResponse(
            response=response_text,
            user_id=current_user.email,
            session_id=session_id,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Summarization failed: {str(exc)}",
        ) from exc


@app.post("/math", response_model=AgentResponse, tags=["Capabilities"])
async def solve_math(
    request: MathRequest,
    current_user: UserProfile = Depends(get_current_user),
):
    """Solve math problem step-by-step using Vertex AI Agent Engine (Authenticated)."""
    prompt = (
        f"Please solve this math problem: {request.problem}\n"
        f"Instructions: {'Show all steps clearly and state the final answer.' if request.show_steps else 'Provide the final solution directly.'}"
    )
    # One-shot task; only continue a conversation if the caller named a session.
    session_id = request.session_id or f"math_{os.urandom(4).hex()}"

    try:
        response_text = await execute_agent_query(
            prompt=prompt,
            user_id=current_user.email,
            session_id=request.session_id,
        )
        return AgentResponse(
            response=response_text,
            user_id=current_user.email,
            session_id=session_id,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Math calculation failed: {str(exc)}",
        ) from exc


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=PORT, reload=True)
