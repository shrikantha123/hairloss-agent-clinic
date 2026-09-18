# Anarva Clinic — Project Root

## Structure

```
+-- clinic-website/          # Static clinic landing page (open in browser directly)
¦   +-- index.html
¦   +-- style.css
¦   +-- script.js
¦   +-- assets/images/       # All clinic images
¦
+-- hair-loss-agent/         # Hair Loss AI Agent (FastAPI backend + frontend)
¦   +-- backend/src/         # Python FastAPI application
¦   +-- frontend/            # AI agent web UI (served by FastAPI)
¦   +-- data/                # SQLite databases
¦   +-- logs/                # Application logs
¦   +-- tests/               # API tests
¦   +-- .env                 # Environment variables (API key etc.)
¦   +-- requirements.txt
¦
+-- scripts/                 # Utility scripts
+-- .venv/                   # Python virtual environment
```

## Running the Hair Loss Agent

```powershell
# From the project root:
.venv\Scripts\python.exe -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload --app-dir hair-loss-agent\backend
```

## Viewing the Clinic Website
Open `clinic-website/index.html` directly in your browser.
