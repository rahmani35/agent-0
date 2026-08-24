.PHONY: help dev-backend dev-frontend deploy-agent deploy-backend deploy-frontend test-agent build-frontend

help:
	@echo "Agent-0 Monorepo Management Commands:"
	@echo "  make dev-backend     - Run FastAPI Gateway server locally (Port 8083)"
	@echo "  make dev-frontend    - Run React Vite dev server (Port 5174)"
	@echo "  make test-agent      - Test remote Vertex AI Agent Engine with sample prompt"
	@echo "  make deploy-agent    - Deploy ADK Agent to Vertex AI Agent Engine"
	@echo "  make deploy-backend  - Deploy Gateway to Google Cloud Run"
	@echo "  make deploy-frontend - Build and deploy React UI to Firebase Hosting"

dev-backend:
	.venv/bin/uvicorn backend.app.main:app --port 8083 --reload

dev-frontend:
	cd frontend && PATH=/opt/homebrew/bin:$$PATH npm run dev

build-frontend:
	cd frontend && PATH=/opt/homebrew/bin:$$PATH npm run build

test-agent:
	.venv/bin/python agent/deploy.py --action test

deploy-agent:
	.venv/bin/python agent/deploy.py --action deploy

deploy-backend:
	gcloud run deploy agent-backend \
		--source . \
		--project learn-agent-deployment \
		--region europe-west3 \
		--allow-unauthenticated

deploy-frontend: build-frontend
	npx firebase-tools deploy --only hosting
