# Backend (FastAPI) scaffold

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
docker build -t projects-api .
docker run -p 8000:8000 --env DATABASE_URL=sqlite:///./dev.db projects-api
```

Endpoints: `GET /projects`, `POST /projects`, `GET /projects/{id}`, `PUT /projects/{id}`, `DELETE /projects/{id}`
