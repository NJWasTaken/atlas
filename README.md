# Atlas — Sprint 1

A dark, curiosity-first learning workspace. Sprint 1 includes a Next.js dashboard, subject management, FastAPI API, JWT auth, and Dockerized PostgreSQL.

## Prerequisites
- Node.js 20+
- Python 3.11+
- Docker Desktop with Compose

## 1. Configure
Copy `.env.example` to `.env` in the repository root. Change `JWT_SECRET` before using this beyond local development.

## 2. Start PostgreSQL
```bash
docker compose up -d db
```

## 3. Start the backend
```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

## 4. Start the frontend
In another terminal:
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:3000.

## 5. First run
Register with an email/password on the sign-in screen. Then add a subject from Academics. Subjects are stored in PostgreSQL and scoped to the signed-in user.

## Notes
- This is a development scaffold, not a production-hardened deployment.
- The API currently creates tables on startup to keep the first run frictionless. Add Alembic migrations before evolving the schema.
- Keep `.env` private. Never commit secrets.
- The starter uses a local JWT auth flow. Later, add email verification, password reset, rate limiting, refresh-token rotation, and stricter deployment settings.
