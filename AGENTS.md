# AGENTS.md

Instructions and technical reference for AI coding agents working on this codebase.

---

## 🎯 Project Overview

- **Name**: `agent-0`
- **Architecture**: Monorepo with strict package separation for **Agent**, **Backend Gateway**, and **Frontend**.
- **Reasoning Engine**: **Google Cloud Vertex AI Agent Engine** in `europe-west3` running Google ADK 2.x agent with `gemini-2.5-flash`.
- **Backend**: FastAPI Gateway validating **Google Sign-In** with `ALLOWED_USERS` email whitelist, streaming to Vertex AI Agent Engine.
- **Frontend**: React 18 SPA (Vite + Google Identity + Lucide Icons) deployed to Firebase Hosting.

---

## 📁 Monorepo Package Structure

```text
agent-0/
├── agent/                  # 🧠 Vertex AI Agent Engine package
│   ├── __init__.py
│   ├── agent.py            # ADK Agent definition, prompts, create_agent()
│   ├── deploy.py           # Packaging, deployment, & testing CLI for Agent Engine
│   └── requirements.txt    # Dependencies packaged into remote Agent Engine container
│
├── backend/                # 🛡️ FastAPI Gateway & Auth service
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py         # FastAPI REST server & routes
│   │   ├── auth.py         # Google OAuth ID token verification & whitelist
│   │   ├── engine.py       # Vertex AI Agent Engine streaming client
│   │   └── config.py       # Configuration & environment variable loader
│   ├── Dockerfile          # Production container for Google Cloud Run
│   ├── .dockerignore
│   └── requirements.txt    # Gateway server dependencies
│
├── frontend/               # 🌐 React 18 SPA
│   ├── src/
│   │   ├── components/     # Header, LoginView, ChatView, SummarizeView, MathView
│   │   ├── context/        # AuthContext (Google OAuth session state)
│   │   ├── services/       # api.js REST client
│   │   ├── App.jsx         # App shell & GoogleOAuthProvider
│   │   └── index.css       # Vanilla CSS Design System with theme variables
│   ├── package.json
│   ├── vite.config.js
│   └── .env                # VITE_GOOGLE_CLIENT_ID & VITE_API_URL
│
├── firebase.json           # Firebase Hosting configuration (points to frontend/dist)
├── .firebaserc             # Firebase GCP project target
├── .env.example            # Monorepo environment variable template
├── .env                    # Shared local environment secrets (git-ignored)
├── Makefile                # Unified developer CLI commands
├── README.md               # Human-facing project guide
└── AGENTS.md               # Agent-facing instructions & constraints
```

---

## ⚙️ Environment Configuration (`.env`)

- `GOOGLE_CLOUD_PROJECT`: GCP Project ID (`learn-agent-deployment`).
- `GOOGLE_CLOUD_REGION`: GCP Region (`europe-west3`).
- `GCS_STAGING_BUCKET`: GCS bucket (`gs://learn-agent-deployment-staging`).
- `REASONING_ENGINE_ID`: Active Vertex AI Reasoning Engine resource name (`projects/537728611405/locations/europe-west3/reasoningEngines/8179953094281396224`).
- `ALLOWED_USERS`: Comma-separated whitelist of authorized Google emails (e.g. `iman.rahmani@gmail.com`).
- `GOOGLE_CLIENT_ID`: Web OAuth 2.0 Client ID for Google Identity Services.
- `PORT`: Gateway server port (default: `8083`).

---

## 🚀 Unified Developer Commands (`make`)

```bash
# Start local FastAPI Gateway
make dev-backend

# Start local React Vite dev server
make dev-frontend

# Test live Vertex AI Agent Engine
make test-agent

# Deploy ADK Agent to Vertex AI Agent Engine
make deploy-agent

# Deploy FastAPI Gateway to Google Cloud Run
make deploy-backend

# Build & Deploy React Frontend to Firebase Hosting
make deploy-frontend
```
