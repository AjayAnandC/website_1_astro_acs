# Astro ACS backend (FastAPI)

Quick start:

1. Create a virtualenv and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

2. Run locally:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

3. Docker:

```bash
docker build -t astro-acs-api .
docker run -p 8000:8000 --env DATABASE_URL=sqlite:///./dev.db astro-acs-api
```

## AI endpoints

Chat history is kept in page memory only; it is sent to OpenAI to answer follow-up messages and is not saved by this app.

- `POST /api/ai/reports` accepts `{ "plan": "daily|weekly|monthly", "zodiac": "..." }`.
- `POST /api/ai/chat` accepts a message, optional zodiac sign, and up to 12 prior chat turns.
- Both endpoints require a Firebase ID token in `Authorization: Bearer <token>`.
- OpenAI credentials are used only on the server. Never put `OPENAI_API_KEY` in frontend files.

Configure the following environment variables on Hostinger (or in a local, untracked `.env`):

- `OPENAI_API_KEY` — secret OpenAI API key.
- `OPENAI_MODEL` — optional model override; defaults to `gpt-4o-mini`.
- `FIREBASE_PROJECT_ID` — Firebase project ID used by the website.
- `FIREBASE_SERVICE_ACCOUNT_JSON` — service-account JSON stored as a secret environment variable, or use `GOOGLE_APPLICATION_CREDENTIALS` with a protected file path.
- `FRONTEND_ORIGINS` — comma-separated allowed website origins; defaults include the Astro ACS website and local development origins.

If the API is hosted on a different origin from the website, set `window.ASTRO_API_BASE_URL` before `js/app.js` loads to the API origin, such as `https://api.example.com`. Leave it empty when `/api` is routed to the backend on the website's origin.

The original `/projects` scaffold endpoints remain available.
