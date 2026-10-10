# Tanglaw MVP

Forecast-to-action prototype for barangay-level typhoon planning. The API creates a schema-constrained Gemini draft, writes it to Firestore, and requires a separate coordinator approval call.

## Run locally

1. Authenticate: `gcloud auth application-default login`
2. Copy `.env.example` values into your shell.
3. Backend: `pip install -r backend/requirements.txt && uvicorn backend.main:app --reload --port 8080`
4. Frontend: `cd frontend && npm install && npm run dev`

## Container

```bash
docker build -t tanglaw .
docker run --rm -p 8080:8080 \
  -e GOOGLE_CLOUD_PROJECT=YOUR_PROJECT \
  -e GOOGLE_CLOUD_LOCATION=us-central1 tanglaw
```

## Cloud Run

```bash
gcloud run deploy tanglaw \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=YOUR_PROJECT,GOOGLE_CLOUD_LOCATION=us-central1,GEMINI_MODEL=gemini-2.5-flash
```

Grant the Cloud Run service account Firestore access and Vertex AI User. For production, add Firebase ID-token verification before exposing write and approval endpoints.
