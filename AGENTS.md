# AGENTS.md

Technical reference for AI coding agents working on this codebase. Human-facing setup and
deployment instructions live in [README.md](./README.md).

---

## Project shape

A monorepo with three independently deployable packages:

| Package | Runs on | Responsibility |
|---|---|---|
| `agent/` | Vertex AI Agent Engine | Google ADK agent. Reasoning only |
| `backend/` | Cloud Run | FastAPI gateway. Auth, allow-list, session mapping |
| `frontend/` | Firebase Hosting | React 19 + Vite SPA |

Request path: browser → Google Sign-In → gateway verifies the ID token → gateway calls
Agent Engine → response buffered and returned as one JSON body.

**No concrete project IDs, regions or engine IDs are committed to source.** Everything
environment-specific is read from `.env` (local) or environment variables (Cloud Run).
`backend/app/config.py` carries fallback defaults for convenience — treat them as
placeholders belonging to one deployment, not as values to rely on or copy.

---

## Layout

```text
agent-0/
├── agent/
│   ├── agent.py            # Agent definition, AGENT_INSTRUCTION, create_agent()
│   ├── deploy.py           # CLI: --action deploy | test | list
│   └── requirements.txt    # Baked into the remote Agent Engine container
├── backend/
│   ├── app/
│   │   ├── main.py         # FastAPI routes + pydantic models
│   │   ├── auth.py         # ID token verification, ALLOWED_USERS allow-list
│   │   ├── engine.py       # Agent Engine client, session mapping, local fallback
│   │   └── config.py       # Environment loading
│   └── requirements.txt
├── frontend/
│   ├── src/{components,context,services}/
│   ├── vite.config.js      # Injects __APP_VERSION__ / __BUILD_SHA__
│   └── package.json        # `version` drives the login-page badge
├── Dockerfile              # Gateway image. MUST stay at repo root — see Invariants
├── .dockerignore           # MUST stay at repo root — Docker reads it only from the context root
├── firebase.json           # Hosting config → frontend/dist
├── Makefile                # Developer commands (hard-codes project/region for deploys)
└── .github/workflows/      # Three path-filtered pipelines
```

---

## Invariants

Break these and something fails, often silently.

1. **`Dockerfile` and `.dockerignore` stay at the repository root.**
   `gcloud run deploy --source .` builds only a Dockerfile at the root of the source
   directory; there is no `--dockerfile` flag on any gcloud surface. The `COPY` paths
   (`COPY backend/`, `COPY agent/`) assume a root build context.

2. **The gateway container bundles `agent/`.** `engine.py`'s fallback imports
   `agent.agent`, so `deploy-backend.yml` triggers on `agent/**` as well as `backend/**`.
   Do not narrow those path filters.

3. **Agent Engine allocates session IDs; caller-supplied ones are rejected.** Map a client
   key onto an engine session via the session `state` tag — see Sessions below.

4. **Never await `async_stream_query` directly on the event loop.** It is `async def` but
   drives a synchronous client (see Async below).

5. **`VITE_*` variables are build-time.** Changing one requires a rebuild and redeploy;
   never put a secret in them, as they are inlined into shipped JavaScript.

6. **Workflows only fire on `push` to `main`.** Branch pushes and pull requests deploy
   nothing.

---

## Sessions (`backend/app/engine.py`)

Multi-turn memory depends on reusing one engine-side session per conversation.

Agent Engine generates numeric session IDs and rejects caller-supplied ones
(`Exception: Failed to create session`). The gateway therefore records the client's key
in the session state and resolves it in three tiers:

1. In-process LRU cache, `(user_id, client_session_id) → engine_session_id`, bounded at
   `_SESSION_CACHE_MAX`.
2. On miss, `async_list_sessions(user_id)` scanning for
   `state["client_session_id"] == client_session_id`.
3. Otherwise `async_create_session(user_id, state={...})`.

Tier 2 is what makes this correct on Cloud Run: the cache dies with the instance, the
state tag does not, so a replacement instance rejoins the same conversation rather than
silently starting a new one.

`resolve_remote_session` returns `None` when no session key was supplied or the session
could not be established; the turn then runs statelessly rather than failing. If a
mapped session has disappeared engine-side, `execute_agent_query` drops the mapping,
re-resolves once and retries.

**Endpoint semantics:** `/chat` passes its `session_id` through. `/summarize` and `/math`
are one-shot and pass the caller's `session_id` only if one was explicitly supplied —
they must not fabricate one, or every call permanently creates an engine session.

**Testing memory requires two turns.** A single request cannot reveal this class of bug:
state a fact, then ask for it back.

---

## Async behaviour

The remote proxy's async methods are not uniformly async:

| Method | Genuinely async | Use |
|---|---|---|
| `async_create_session`, `async_get_session`, `async_list_sessions` | yes — awaits an async client | `await` directly |
| `async_stream_query` | **no** — `async def` iterating the sync client with a plain `for` | never await on the loop |

The stream is drained with `asyncio.to_thread(_collect_stream_sync, ...)`. Buffering in a
thread is free here because the endpoint returns one JSON body regardless.

Measured: awaiting `async_stream_query` stalled the loop for **7.9 s** (9 of ~214 expected
heartbeat ticks); via `to_thread` the worst stall is **51 ms**.

Consequence: concurrency per instance is bounded by the default thread-pool executor
(~`min(32, cpu+4)`), not by the event loop.

---

## Auth (`backend/app/auth.py`)

- The Google **ID token is the bearer credential** — the gateway issues no token of its
  own.
- `verify_google_id_token` checks the signature and audience (`GOOGLE_CLIENT_ID`), then
  the lower-cased email against `ALLOWED_USERS`. Not on the list ⇒ `403`.
- `get_current_user` is the FastAPI dependency guarding `/chat`, `/summarize`, `/math`
  and `/auth/me`. `/health` and `/` are open.

Known limitations, deliberately unaddressed — do not "fix" silently:

- ID tokens expire in ~1 hour with no refresh path; the SPA validates only at mount.
- `main.py` sets `allow_origins=["*"]` with `allow_credentials=True`, a spec-invalid
  combination that works only because auth rides in a header rather than a cookie.
- `/health` exposes the engine resource name unauthenticated.

---

## Frontend notes

- Version badge: `vite.config.js` injects `__APP_VERSION__` (from `package.json`) and
  `__BUILD_SHA__` (`GITHUB_SHA` in CI → local `git rev-parse` → `'dev'`). Rendered in
  `LoginView.jsx`; read through `typeof` guards so the component survives an undefined
  build constant.
- Dev server is **5173** (`vite.config.js`).
- `api.js` reads the token from `localStorage` and attaches `Authorization: Bearer`.
- Styling is vanilla CSS with theme variables in `index.css`; both light and dark must
  stay legible.

---

## CI (`.github/workflows/`)

| Workflow | Paths | Target |
|---|---|---|
| `deploy-agent.yml` | `agent/**` | Agent Engine |
| `deploy-backend.yml` | `backend/**`, `agent/**`, `Dockerfile`, `.dockerignore` | Cloud Run |
| `deploy-frontend.yml` | `frontend/**`, `firebase.json`, `.firebaserc` | Firebase Hosting |

Per-project values live in each workflow's `env:` block plus optional repository secrets;
`GCP_SA_KEY` is the only mandatory secret. All three support `workflow_dispatch`.

The deploy service account needs seven roles — `run.admin`, `artifactregistry.writer`,
`cloudbuild.builds.editor`, `storage.admin`, `iam.serviceAccountUser`, `aiplatform.admin`,
`firebasehosting.admin`. `run.admin` alone fails a source deploy at the Artifact Registry
step.

---

## Commands

```bash
make dev-backend      # uvicorn backend.app.main:app --port 8083 --reload
make dev-frontend     # vite dev server, :5173
make test-agent       # real prompt against the deployed engine
make deploy-agent     # python agent/deploy.py --action deploy
make deploy-backend   # gcloud run deploy --source .
make deploy-frontend  # build + firebase deploy
make build-frontend   # build only

cd frontend && npm run lint        # oxlint; 7 pre-existing warnings
.venv/bin/python -m py_compile backend/app/*.py
```

---

## Verification expectations

There are no automated tests. When changing behaviour, verify against reality and report
what was actually observed:

| Change | How to verify |
|---|---|
| Session / memory | Two turns sharing a `session_id`; assert the second recalls the first. Also clear the cache mid-test to prove cold-instance recovery |
| Event-loop blocking | Heartbeat coroutine measuring gaps, recorded *after* each `await` so a stall spanning the final sleep is not dropped |
| Container / Dockerfile | `docker build -t x .` from the repo root, run it, hit `/health` |
| Path filters | Parse each workflow's `paths:` with a YAML parser and match candidate file sets |
| Frontend | `npm run build`, confirm injected constants are inlined, load the bundle and check both themes |

Clean up anything created against real infrastructure — test sessions on the engine,
local containers and images.
