"""Configuration loader for the Backend Gateway.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Search for .env in current folder, backend folder, and root folder
current_dir = Path(__file__).resolve().parent
backend_dir = current_dir.parent
root_dir = backend_dir.parent

load_dotenv(root_dir / ".env")
load_dotenv(backend_dir / ".env")
load_dotenv()

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "learn-agent-deployment")
LOCATION = os.getenv("GOOGLE_CLOUD_REGION", "europe-west3")
REASONING_ENGINE_ID = os.getenv(
    "REASONING_ENGINE_ID",
    "projects/537728611405/locations/europe-west3/reasoningEngines/8179953094281396224",
)
ALLOWED_USERS = os.getenv("ALLOWED_USERS", "iman.rahmani@gmail.com")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
PORT = int(os.getenv("PORT", "8083"))
