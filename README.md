# Python ADK Reasoning Agent with FastAPI & Vertex AI Agent Engine

A code-first AI reasoning agent built with **Google ADK** (Agent Development Kit), wrapped with **FastAPI**, and ready for deployment to **Vertex AI Agent Engine**.

The agent performs zero-tool reasoning tasks including **text summarization**, **step-by-step mathematical problem solving**, and multi-turn conversations powered by Gemini models (default: `gemini-3.7-flash`).

---

## 📁 Project Structure

```text
agent-0/
├── agent.py            # ADK Agent definition & instructions
├── main.py             # FastAPI REST API server with session management
├── deploy.py           # Deployment & test script for Vertex AI Agent Engine
├── frontend/           # Modern React frontend web application (Vite + React)
├── requirements.txt    # Python dependencies
├── .env.example        # Environment variable template
├── .env                # Local environment configuration (ignored by git)
└── README.md           # Documentation & instructions
```

---

## 🎨 React Web Frontend

A responsive web application is included in `frontend/` to interact with your agent.

### Starting the Frontend
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to access:
- **Chat Reasoning**: Multi-turn conversation with memory and session resets.
- **Text Summarizer**: Document summarization with style presets.
- **Math Solver**: Formula calculations with step-by-step breakdowns.
- **Live Health Status & Dark/Light Mode**.


---

## 🚀 Getting Started

### 1. Prerequisites

- Python 3.10+
- Google Cloud SDK (`gcloud`) installed and configured
- A Google Cloud project with Vertex AI and Generative Language APIs enabled

### 2. Installation

Clone/navigate to the project directory and set up a virtual environment:

```bash
# 1. Create a virtual environment
python3 -m venv .venv

# 2. Activate the virtual environment
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# 3. Install project dependencies
pip install -r requirements.txt
```

### 3. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure your `.env` settings:
```env
# Google Cloud Project Configuration
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_REGION=europe-west3
GCS_STAGING_BUCKET=gs://your-gcs-staging-bucket-name

# Gemini API Key (for local testing via Google AI Studio / Gemini API)
GEMINI_API_KEY=your-gemini-api-key

# Model Configuration (e.g. gemini-3.7-flash, gemini-2.5-flash, gemini-2.0-flash)
MODEL_NAME=gemini-3.7-flash

# Server Configuration
PORT=8083
```

> **API Key Note**: For local development, ensure your API key allows access to the **Gemini API** (or generate a key from [Google AI Studio](https://aistudio.google.com/app/apikey)).

---

## 💻 Local Execution with FastAPI

Start the local FastAPI development server:

```bash
source .venv/bin/activate
uvicorn main:app --port 8083 --reload
```

- **Interactive Swagger Docs**: [http://localhost:8083/docs](http://localhost:8083/docs)
- **Health Check**: [http://localhost:8083/health](http://localhost:8083/health)
- **OpenAPI Spec**: [http://localhost:8083/openapi.json](http://localhost:8083/openapi.json)

---

## 📡 API Endpoints & Examples

### 1. General Multi-Turn Chat (`POST /chat`)
```bash
curl -X POST http://localhost:8083/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello! What can you help me with?",
    "user_id": "user123",
    "session_id": "session001"
  }'
```

### 2. Text Summarization (`POST /summarize`)
```bash
curl -X POST http://localhost:8083/summarize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Artificial Intelligence is transforming industries by automating repetitive tasks, uncovering deep insights from massive datasets, and enabling intelligent decision support systems across healthcare, finance, and engineering.",
    "style": "bullet points"
  }'
```

### 3. Math Problem Solving (`POST /math`)
```bash
curl -X POST http://localhost:8083/math \
  -H "Content-Type: application/json" \
  -d '{
    "problem": "What is the square root of 144 multiplied by 15?",
    "show_steps": true
  }'
```

---

## ☁️ Deploying to Vertex AI Agent Engine

Vertex AI Agent Engine (Reasoning Engine) provides managed serverless runtime, session management, monitoring, and autoscaling for your ADK agents on Google Cloud.

### Step 1: Authenticate with Google Cloud

```bash
# Authenticate your user account and Application Default Credentials (ADC)
gcloud auth login
gcloud auth application-default login

# Set your active project
gcloud config set project your-gcp-project-id
```

### Step 2: Create a GCS Staging Bucket (if not already existing)

```bash
gcloud storage buckets create gs://your-gcs-staging-bucket-name --location=europe-west3
```

### Step 3: Run the Deployment Script

The script automatically reads project, region, and bucket settings from your `.env` file:

```bash
source .venv/bin/activate
python deploy.py --action deploy
```

*(Optional: You can also pass custom arguments directly)*:
```bash
python deploy.py --action deploy \
  --project your-gcp-project-id \
  --location europe-west3 \
  --bucket gs://your-gcs-staging-bucket-name \
  --name "adk-reasoning-agent"
```

> ⏱️ **Provisioning Time**: Provisioning the managed container and environment in Vertex AI typically takes **3 to 8 minutes**.

Upon completion, the script prints the deployed resource name:
```text
[✓] Successfully deployed agent to Vertex AI Agent Engine!
    Resource Name : projects/537728611405/locations/europe-west3/reasoningEngines/1234567890123456789
    Display Name  : adk-reasoning-agent
```

### Step 4: Test the Deployed Remote Agent

Query your live cloud instance:

```bash
python deploy.py --action test \
  --resource-name "projects/<PROJECT_ID>/locations/<LOCATION>/reasoningEngines/<REASONING_ENGINE_ID>"
```

---

## 🔧 Troubleshooting

- **`API_KEY_SERVICE_BLOCKED` error locally**: Ensure your API key in Google Cloud Console has **Gemini API** allowed under API restrictions, or use a key from [Google AI Studio](https://aistudio.google.com/app/apikey).
- **`[Errno 48] Address already in use`**: If port 8000 or 8080 is used by another application, run with `--port 8083` or update `PORT=8083` in `.env`.
- **Interpreter / Module Import warnings in IDE**: Ensure your editor's Python interpreter is set to `./.venv/bin/python`.

