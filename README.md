# Agent-0 — Building & Deploying an AI Agent on Google Cloud

A complete, working reference for developers deploying their **first** AI agent to Google Cloud.

Most agent tutorials stop at "it runs on my laptop." This one goes all the way to a
signed-in web app on a public URL: a Google ADK agent running on **Vertex AI Agent
Engine**, a **FastAPI** gateway on **Cloud Run** that handles authentication, a **React**
front end on **Firebase Hosting**, and **GitHub Actions** that deploy each piece
independently.

Clone it, substitute your own project, and you have a deployable template. The sharp
edges in [Things that will trip you up](#things-that-will-trip-you-up) are ones this
project actually hit, not hypotheticals.

> **Conventions used throughout.** Placeholders are written as `<angle-brackets>` or as
> shell variables you export once. Nothing in this guide is specific to one Google Cloud
> project — replace the placeholders and every command works as written.
>
> ```bash
> export PROJECT_ID=<your-gcp-project-id>       # e.g. my-agent-project
> export REGION=<your-region>                   # e.g. europe-west3, us-central1
> export SERVICE_NAME=agent-backend             # Cloud Run service name
> export STAGING_BUCKET=gs://$PROJECT_ID-staging
> ```

---

## What you are building

```text
   Browser
      │  Google Sign-In → ID token
      ▼
┌──────────────────────┐
│  React SPA           │   Firebase Hosting
│  (frontend/)         │   https://<your-site>.web.app
└──────────┬───────────┘
           │  HTTPS + Authorization: Bearer <Google ID token>
           ▼
┌──────────────────────┐
│  FastAPI Gateway     │   Cloud Run  (<your-region>)
│  (backend/)          │   Verifies the token, checks an email allow-list,
└──────────┬───────────┘   then calls the agent. Holds no model logic.
           │  Vertex AI SDK  (stream_query + session management)
           ▼
┌──────────────────────┐
│  Reasoning Agent     │   Vertex AI Agent Engine
│  (agent/)            │   Google ADK · Gemini · managed sessions
└──────────────────────┘
```

**Why three pieces?** The agent holds the reasoning. The gateway holds the *security* —
Agent Engine has no concept of "your users", so something must authenticate callers
before they can spend your model quota. The front end is a static bundle that talks only
to the gateway, never to Agent Engine directly.

Each piece deploys, scales and fails independently, which is why the CI pipeline treats
them separately.

---

## Prerequisites

| | |
|---|---|
| Python | 3.10+ (3.11 matches the deployed container) |
| Node.js | 20+ |
| `gcloud` CLI | [install](https://cloud.google.com/sdk/docs/install) |
| A GCP project | With **billing enabled** — Vertex AI will not run without it |
| A GitHub repository | Only if you want the CI pipelines |

---

## Part 1 — One-time Google Cloud setup

Done once per project. Export the variables from the box above first.

### 1.1 Authenticate

```bash
gcloud auth login                        # authenticates the CLI (you)
gcloud auth application-default login    # authenticates your code (the SDKs)
gcloud config set project $PROJECT_ID
```

> These two `auth` commands are **not** interchangeable and you need both. The first lets
> `gcloud` act as you. The second writes Application Default Credentials that the Python
> SDKs read. Skipping the second is the most common cause of
> `Your default credentials were not found` when running a script that worked fine in the
> shell.

### 1.2 Enable the APIs

```bash
gcloud services enable \
  aiplatform.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  storage.googleapis.com \
  firebasehosting.googleapis.com \
  iam.googleapis.com \
  --project=$PROJECT_ID
```

| API | Needed for |
|---|---|
| `aiplatform` | Vertex AI Agent Engine — the agent itself |
| `run` | The gateway service |
| `cloudbuild` + `artifactregistry` | Building and storing the gateway's container image |
| `storage` | The staging bucket Agent Engine deploys through |
| `firebasehosting` | The front end |
| `iam` | Service accounts for CI |

Verify: `gcloud services list --enabled --project=$PROJECT_ID | grep aiplatform`

### 1.3 Create the staging bucket

Agent Engine packages your code and uploads it here during deployment. It must be in the
**same region** as the agent.

```bash
gcloud storage buckets create $STAGING_BUCKET --location=$REGION --project=$PROJECT_ID
```

### 1.4 Create the OAuth client ID

This is what makes "Sign in with Google" work.

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**
2. If prompted, configure the **OAuth consent screen** first. *External* + *Testing* is
   fine for a private tool; add yourself under **Test users**.
3. Application type: **Web application**
4. **Authorised JavaScript origins** — add every origin the app is served from:
   - `http://localhost:5173` (local dev)
   - `https://<your-site>.web.app` (Firebase Hosting)
   - `https://<your-site>.firebaseapp.com` (Firebase's second default domain)
5. Copy the client ID: `<numbers>-<hash>.apps.googleusercontent.com`

> The client ID is **not** a secret — it ships inside the front-end bundle by design. The
> client *secret* is not used anywhere in this project: the browser performs sign-in, and
> the backend only *verifies* the resulting token. Leave the secret unused.
>
> Origins must match exactly, including scheme and port. `http://localhost:5173` does not
> cover `http://127.0.0.1:5173`.

### 1.5 Initialise Firebase Hosting

```bash
npx firebase-tools login
npx firebase-tools projects:addfirebase $PROJECT_ID   # if not already a Firebase project
npx firebase-tools hosting:sites:list --project $PROJECT_ID
```

Set your site name in `.firebaserc` and `firebase.json`:

```jsonc
// .firebaserc
{ "projects": { "default": "<your-gcp-project-id>" } }
```
```jsonc
// firebase.json  →  "hosting": { "site": "<your-site-name>", ... }
```

The `rewrites` rule already present sends every path to `index.html`, which a
single-page app needs so deep links do not 404.

### 1.6 Create the deploy service account (CI only)

Skip if you only deploy from your laptop.

```bash
gcloud iam service-accounts create github-actions-deployer \
  --display-name="GitHub Actions Deployer" --project=$PROJECT_ID

SA=github-actions-deployer@$PROJECT_ID.iam.gserviceaccount.com

for ROLE in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/cloudbuild.builds.editor \
  roles/storage.admin \
  roles/iam.serviceAccountUser \
  roles/aiplatform.admin \
  roles/firebasehosting.admin
do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA" --role="$ROLE"
done

gcloud iam service-accounts keys create key.json --iam-account=$SA
```

Add the **contents of `key.json`** as the repository secret `GCP_SA_KEY`
(*Settings → Secrets and variables → Actions → New repository secret*), then delete the
local file: `rm key.json`.

| Role | Why |
|---|---|
| `run.admin` | Create and update the Cloud Run service |
| `artifactregistry.writer` | Push the built image |
| `cloudbuild.builds.editor` | Run the build that produces it |
| `storage.admin` | Build staging + the Agent Engine bucket |
| `iam.serviceAccountUser` | Let the deploy act as the runtime service account |
| `aiplatform.admin` | Deploy and query Agent Engine |
| `firebasehosting.admin` | Deploy the front end |

> **All seven are required.** `run.admin` alone is not enough, because deploying *from
> source* also builds and stores a container — see
> [gotcha #4](#4-runadmin-is-not-enough-to-deploy-from-source).

Verify:

```bash
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" --filter="bindings.members:$SA" \
  --format="value(bindings.role)" | sort
```

---

## Part 2 — Configuration reference

Configuration lives in **three** places. Knowing which is which prevents most setup
confusion.

### 2.1 `.env` — repository root (backend + agent, git-ignored)

```env
# --- Google Cloud ---------------------------------------------------------
GOOGLE_CLOUD_PROJECT=<your-gcp-project-id>
GOOGLE_CLOUD_REGION=<your-region>
GCS_STAGING_BUCKET=gs://<your-project-id>-staging

# --- Model ----------------------------------------------------------------
MODEL_NAME=gemini-2.5-flash

# --- Access control -------------------------------------------------------
ALLOWED_USERS=you@example.com,teammate@example.com
GOOGLE_CLIENT_ID=<numbers>-<hash>.apps.googleusercontent.com

# --- Deployed agent (fill in after Part 3.1) ------------------------------
REASONING_ENGINE_ID=

# --- Local server ---------------------------------------------------------
PORT=8083

# --- Optional: local-fallback only ----------------------------------------
GEMINI_API_KEY=
```

| Variable | Required | Consumed by | Notes |
|---|---|---|---|
| `GOOGLE_CLOUD_PROJECT` | yes | `config.py`, `deploy.py` | Project **ID**, not the number |
| `GOOGLE_CLOUD_REGION` | yes | both | Must match the bucket and engine region |
| `GCS_STAGING_BUCKET` | agent deploy | `deploy.py` | `gs://` prefix included |
| `MODEL_NAME` | no | `agent.py` | Defaults to `gemini-2.5-flash` |
| `ALLOWED_USERS` | yes | `auth.py` | Comma-separated; anyone else gets `403` |
| `GOOGLE_CLIENT_ID` | yes | `auth.py` | The token's expected audience |
| `REASONING_ENGINE_ID` | after 3.1 | `engine.py` | Full resource name. Empty ⇒ local fallback |
| `PORT` | no | `main.py` | Local only; Cloud Run injects its own |
| `GEMINI_API_KEY` | no | `agent.py` | Only for the in-process fallback |

### 2.2 `frontend/.env` — build-time only (git-ignored)

```env
VITE_GOOGLE_CLIENT_ID=<numbers>-<hash>.apps.googleusercontent.com
VITE_API_URL=http://localhost:8083
```

> Vite inlines `VITE_*` variables into the bundle **at build time**. They are not read at
> runtime, and they are publicly visible in the shipped JavaScript. Never put a secret
> here. Changing `VITE_API_URL` requires a rebuild and redeploy.

### 2.3 GitHub repository secrets (CI)

| Secret | Required | Falls back to |
|---|---|---|
| `GCP_SA_KEY` | **yes** | — (the workflow cannot authenticate without it) |
| `REASONING_ENGINE_ID` | no | value committed in the workflow |
| `ALLOWED_USERS` | no | value committed in the workflow |
| `GOOGLE_CLIENT_ID` | no | value committed in the workflow |
| `VITE_GOOGLE_CLIENT_ID` | no | value committed in the workflow |
| `VITE_API_URL` | no | value committed in the workflow |

The committed fallbacks let a fresh clone deploy with only `GCP_SA_KEY` set. When you
fork this repository, either set the secrets or edit the defaults in
`.github/workflows/*.yml` to your own values.

---

## Part 3 — Running locally

```bash
git clone <this-repo> && cd agent-0

python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt -r agent/requirements.txt

cp .env.example .env          # fill in per Part 2.1
cd frontend && npm install && cd ..
# create frontend/.env per Part 2.2
```

Then, in two terminals:

```bash
make dev-backend     # FastAPI on http://localhost:8083  (docs at /docs)
make dev-frontend    # React on   http://localhost:5173
```

Check it is alive:

```bash
curl -s http://localhost:8083/health
# {"status":"ok", ..., "agent_engine_connected":false, ...}
```

> `agent_engine_connected: false` is expected before Part 4. With no reachable engine the
> gateway falls back to running the ADK agent **in-process**, logging
> `[!] Warning: Could not connect to remote Agent Engine ... Local fallback enabled.`
> This is deliberate — you can build the whole stack before deploying anything. The
> fallback needs `GEMINI_API_KEY`
> ([get one here](https://aistudio.google.com/app/apikey)).

---

## Part 4 — Deploying

Deploy bottom-up the first time: each layer needs the one below it.

### 4.1 Agent → Vertex AI Agent Engine

```bash
make deploy-agent
```

Equivalent to `python agent/deploy.py --action deploy`, which reads `GOOGLE_CLOUD_PROJECT`,
`GOOGLE_CLOUD_REGION` and `GCS_STAGING_BUCKET` from `.env`. Override ad hoc if you like:

```bash
python agent/deploy.py --action deploy \
  --project $PROJECT_ID --location $REGION --bucket $STAGING_BUCKET \
  --name my-reasoning-agent
```

Takes **3–8 minutes** while Vertex provisions a managed container. On success:

```text
[✓] Successfully deployed agent to Vertex AI Agent Engine!
    Resource Name : projects/<number>/locations/<region>/reasoningEngines/<id>
```

**Copy that resource name into `REASONING_ENGINE_ID` in `.env`.** Then verify:

```bash
make test-agent                         # sends a real prompt to the deployed agent
python agent/deploy.py --action list    # every engine in the project
```

> Redeploying creates a **new** engine rather than replacing the old one. Use
> `--action list` periodically and delete engines you no longer need, so you are not
> paying for abandoned ones.

### 4.2 Gateway → Cloud Run

```bash
make deploy-backend
```

which runs:

```bash
gcloud run deploy $SERVICE_NAME \
  --source . \
  --project $PROJECT_ID \
  --region $REGION \
  --allow-unauthenticated
```

Three details worth understanding:

- **`--source .` builds `./Dockerfile`** — the one at the repository root. Cloud Run only
  looks at the root of the source directory, which is why the gateway's Dockerfile lives
  there rather than in `backend/` (see [gotcha #3](#3-gcloud-run-deploy-has-no---dockerfile-flag)).
- **`--allow-unauthenticated` is correct here.** It refers to *Cloud Run's own* IAM layer.
  The service must be publicly reachable so browsers can call it; your application-level
  Google Sign-In and allow-list do the actual access control.
- **Runtime configuration comes from environment variables.** Locally these come from
  `.env`; on Cloud Run pass them explicitly:

```bash
gcloud run deploy $SERVICE_NAME --source . --project $PROJECT_ID --region $REGION \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_REGION=$REGION,\
REASONING_ENGINE_ID=<resource-name>,ALLOWED_USERS=you@example.com,\
GOOGLE_CLIENT_ID=<client-id>"
```

Note the service URL it prints, then verify:

```bash
curl -s https://<your-service-url>/health
# expect "agent_engine_connected": true
```

`true` confirms the Cloud Run service account reached Agent Engine. If it is `false` in
production, `REASONING_ENGINE_ID` is wrong or the runtime service account lacks Vertex AI
access.

### 4.3 Front end → Firebase Hosting

Point `frontend/.env`'s `VITE_API_URL` at the Cloud Run URL from the previous step, then:

```bash
make deploy-frontend        # builds, then deploys frontend/dist
```

Verify by loading the site, opening the browser console, and signing in. A `403` means
your address is not in `ALLOWED_USERS`; a silent button means the origin is missing from
the OAuth client.

### 4.4 Rollback

```bash
# Cloud Run: list revisions and send all traffic back to a known-good one
gcloud run revisions list --service=$SERVICE_NAME --region=$REGION --project=$PROJECT_ID
gcloud run services update-traffic $SERVICE_NAME \
  --to-revisions=<revision-name>=100 --region=$REGION --project=$PROJECT_ID

# Firebase Hosting: roll back from the console's release history, or redeploy an
# earlier commit
```

---

## Part 5 — CI/CD

Three workflows in `.github/workflows/`, each triggered only by changes to the part of
the monorepo it owns, so a front-end tweak never redeploys your agent.

| Workflow | Triggers on | Deploys to |
|---|---|---|
| `deploy-agent.yml` | `agent/**` | Vertex AI Agent Engine |
| `deploy-backend.yml` | `backend/**`, `agent/**`, `Dockerfile`, `.dockerignore` | Cloud Run |
| `deploy-frontend.yml` | `frontend/**`, `firebase.json`, `.firebaserc` | Firebase Hosting |

`agent/**` deliberately triggers **both** the agent and the backend: the gateway's
container bundles the agent package for its local-fallback path, so an agent change that
skipped the backend would leave Cloud Run running stale code.

**To adapt these to your project**, edit the `env:` block at the top of each workflow:

```yaml
env:
  PROJECT_ID: <your-gcp-project-id>
  REGION: <your-region>
  SERVICE_NAME: agent-backend
```

All three also accept a manual run (`workflow_dispatch`) from the Actions tab — useful
for re-running a deploy that failed for reasons outside the code, such as missing IAM.

> Because the workflows are gated on `push: branches: [main]`, **pushing a branch or
> opening a pull request deploys nothing.** Only a merge to `main` deploys. That is a
> deliberate safety property, but it does mean the pipeline is first exercised at merge
> time — expect to iterate on it once.

---

## Things that will trip you up

Five failures this project actually hit. Each cost real debugging time.

### 1. Agent Engine assigns its own session IDs

The intuitive way to get multi-turn memory is to pass your own conversation ID:

```python
remote_agent.stream_query(message=prompt, user_id=user, session_id="my-chat-123")  # ✗
```

Agent Engine rejects it — `Exception: Failed to create session` — because it allocates
its own numeric IDs (e.g. `1721779683760013312`). You must create a session, keep the ID
it returns, and pass *that* back on later turns.

To map your own key onto Agent Engine's, store yours in the session **state** and search
for it later. `backend/app/engine.py` does exactly this:

```python
created = await remote_agent.async_create_session(
    user_id=user_id,
    state={"client_session_id": client_session_id},   # your key, stored engine-side
)
```

An in-process dictionary is not enough on Cloud Run, which starts and stops instances
freely; the state tag survives, so any instance can rejoin an existing conversation.

**And the failure is silent.** Omitting `session_id` does not error — every turn simply
starts a fresh session and the agent quietly has amnesia. Test memory explicitly: state a
fact, then ask for it back in a second request.

### 2. `async_stream_query` is not actually async

The Vertex SDK exposes async variants, but on the remote agent proxy they are not all
equal:

| Method | Genuinely async? |
|---|---|
| `async_create_session`, `async_get_session`, `async_list_sessions` | **Yes** — awaits an async client |
| `async_stream_query` | **No** — `async def`, but iterates the *synchronous* client with a plain `for` |

Awaiting `async_stream_query` inside a FastAPI handler blocks the entire event loop for
the whole generation — measured here at **7.9 seconds**, during which the server answers
nothing else. Run it on a worker thread instead:

```python
return await asyncio.to_thread(_collect_stream_sync, query_kwargs)
```

Worst stall after the change: 51 ms. Verify this sort of fix by holding a heartbeat
coroutine alongside the request and measuring its gaps, not by timing the request itself.

### 3. `gcloud run deploy` has no `--dockerfile` flag

It looks like it should, and the resulting error is easy to misread. There is no such
flag on any surface — GA, alpha or beta. Deploying from source builds whatever
`Dockerfile` sits at the **root of `--source`**:

```bash
gcloud run deploy my-service --source .    # builds ./Dockerfile
```

That is why `Dockerfile` lives at the repository root here, even though it is the
backend's container: its `COPY` paths (`COPY backend/`, `COPY agent/`) are written for a
root build context, so the build can include both packages.

The same applies to `.dockerignore` — Docker only reads it from the context root. A
`.dockerignore` inside a subdirectory is silently ignored.

### 4. `run.admin` is not enough to deploy from source

Deploying from source is really *build a container, push it, then deploy it*, so the
service account needs Cloud Build and Artifact Registry rights too. Missing them
produces:

```text
ERROR: Permission 'artifactregistry.repositories.get' denied on resource
'.../repositories/cloud-run-source-deploy' (or it may not exist)
```

The "or it may not exist" is a red herring — the repository is created automatically on
first deploy. Add `roles/artifactregistry.writer` and `roles/cloudbuild.builds.editor`
(see [1.6](#16-create-the-deploy-service-account-ci-only)).

### 5. Credentials differ in every environment

| Where | How credentials arrive |
|---|---|
| Your laptop | `gcloud auth application-default login` |
| GitHub Actions | The `GCP_SA_KEY` secret, via `google-github-actions/auth` |
| Cloud Run | The service's attached service account, automatically |
| A local container | **Nothing** unless you mount credentials |

This is why `/health` reports `agent_engine_connected: true` in production but `false` in
a container you run locally. Both are correct.

---

## API reference

`/health` and `/` are open; everything else requires
`Authorization: Bearer <Google ID token>`.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/auth/google` | Exchange a Google ID token for a verified profile (enforces the allow-list) |
| `GET` | `/auth/me` | Validate the current token |
| `POST` | `/chat` | Multi-turn conversation. Pass `session_id` to keep memory |
| `POST` | `/summarize` | One-shot summary; optional `style` |
| `POST` | `/math` | One-shot problem solving; optional `show_steps` |
| `GET` | `/health` | Status, and whether Agent Engine is reachable |

```bash
curl -X POST http://localhost:8083/chat \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "My favourite number is 42.", "session_id": "demo-1"}'

# Same session_id → the agent remembers.
curl -X POST http://localhost:8083/chat \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is my favourite number?", "session_id": "demo-1"}'
```

Interactive docs: <http://localhost:8083/docs>

---

## Command reference

```bash
make dev-backend      # FastAPI gateway on :8083
make dev-frontend     # Vite dev server on :5173
make test-agent       # Send a real prompt to the deployed agent
make deploy-agent     # Agent  → Vertex AI Agent Engine
make deploy-backend   # Gateway → Cloud Run
make deploy-frontend  # Front end → Firebase Hosting
make build-frontend   # Production build, no deploy
```

`Makefile` hard-codes the project and region for the deploy targets. Update those lines
when you fork.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Your default credentials were not found` | Run `gcloud auth application-default login` |
| `403 Access Denied: Account ... not in the authorized users list` | Add the address to `ALLOWED_USERS`, then restart or redeploy the gateway |
| Sign-in button does nothing | The current origin is missing from **Authorised JavaScript origins** on the OAuth client |
| `agent_engine_connected: false` locally | Expected without credentials — the local fallback handles the request |
| `agent_engine_connected: false` in production | Wrong `REASONING_ENGINE_ID`, or the runtime service account lacks Vertex AI access |
| Agent forgets the previous message | Sessions not being reused — see [gotcha #1](#1-agent-engine-assigns-its-own-session-ids) |
| `PERMISSION_DENIED ... artifactregistry` | Missing CI roles — see [gotcha #4](#4-runadmin-is-not-enough-to-deploy-from-source) |
| `unrecognized arguments: --dockerfile` | See [gotcha #3](#3-gcloud-run-deploy-has-no---dockerfile-flag) |
| Agent deploy hangs past ~10 minutes | Check the Cloud Build logs in the console; a bad dependency in `agent/requirements.txt` is the usual cause |
| `[Errno 48] Address already in use` | Change `PORT` in `.env` or stop the process already on `:8083` |
| Front end talks to the wrong backend | `VITE_API_URL` is baked in at build time — rebuild and redeploy |
| CI deployed nothing after a push | Path filters — the changed files match no workflow, or you pushed a branch rather than merging to `main` |

---

## Repository layout

```text
agent-0/
├── agent/              # The ADK agent + its deployment CLI
│   ├── agent.py        #   Agent definition, instructions, create_agent()
│   ├── deploy.py       #   deploy | test | list against Agent Engine
│   └── requirements.txt#   Dependencies baked into the remote container
├── backend/            # FastAPI gateway
│   ├── app/
│   │   ├── main.py     #   Routes and request models
│   │   ├── auth.py     #   Google ID token verification + allow-list
│   │   ├── engine.py   #   Agent Engine client, sessions, local fallback
│   │   └── config.py   #   Environment loading
│   └── requirements.txt
├── frontend/           # React 19 + Vite SPA
│   └── src/
│       ├── components/ #   Header, LoginView, ChatView, SummarizeView, MathView
│       ├── context/    #   AuthContext (Google session state)
│       └── services/   #   api.js REST client
├── Dockerfile          # Gateway image — MUST stay at the root (gotcha #3)
├── .dockerignore       # Only read from the context root (gotcha #3)
├── firebase.json       # Hosting config → frontend/dist
├── .firebaserc         # Firebase project target
├── .env.example        # Template for the root .env
├── Makefile            # Every command above
├── AGENTS.md           # Technical reference for AI coding agents
└── .github/workflows/  # Three path-filtered deployment pipelines
```

---

## Where to go next

- Give the agent **tools** — `agent/agent.py` passes `tools=[]`; ADK function tools let it
  call APIs, run code or query databases.
- Swap the model with `MODEL_NAME` in `.env`.
- Stream responses to the browser. The gateway buffers each reply into a single JSON
  body; server-sent events would surface tokens as they arrive.
- Harden auth before real users: Google ID tokens expire after about an hour and this
  project uses them directly as bearer credentials with no refresh.
- Read the [ADK docs](https://google.github.io/adk-docs/) and the
  [Agent Engine docs](https://cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/overview).
