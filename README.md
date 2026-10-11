# Tanglaw MVP

Tanglaw is an anticipatory disaster response and GIS coordination dashboard for diocesan and LGU disaster coordinators in the Philippines. It combines MapLibre-rendered flood-risk overlays with schema-constrained Google Gemini action planning on Google Cloud Run and Firestore to automate asset pre-positioning and multilingual alert drafts up to 72 hours before typhoon landfall.

---

## Architecture Overview

* **Frontend:** React + Vite, Tailwind CSS, MapLibre GL (`v3.6.2`), `react-map-gl`, deployed on **Firebase Hosting**.
* **Backend:** FastAPI, Pydantic v2 schemas, Google GenAI SDK (Vertex AI), deployed on **Google Cloud Run** (`asia-southeast3`).
* **Persistence & Auditing:** Cloud Firestore (stores plan snapshots, baseline allocations, and coordinator approval logs).
* **AI Model:** `gemini-2.5-flash` running with strict JSON schema constraints and ground-truth validation rules.

### Design Rationale: Why MapLibre?
For this Google-sponsored hackathon, we strategically chose MapLibre over Google Maps Platform to emphasize specific architectural strengths:
* **Highlighting Core Cloud Infrastructure:** Using an open-source map ensures architectural focus remains entirely on our seamless integration of Google Cloud backend services (Cloud Run, Firestore, and Vertex AI).
* **Custom Vector Rendering:** Tanglaw relies heavily on drawing and dynamically updating custom, color-coded flood-risk polygons. MapLibre is specifically optimized for high-performance rendering of custom GeoJSON data layers.
* **Cost-Effective Prototyping:** MapLibre’s free, open-source rendering engine keeps overhead at absolute zero during rapid iteration cycles, proving the financial sustainability of the prototype.

---

## Repository Structure

```text
tanglaw-mvp/
├── backend/
│   ├── Dockerfile
│   ├── main.py              # FastAPI endpoints, Gemini prompting & Firestore models
│   └── requirements.txt
├── frontend/
│   ├── firebase.json        # Hosting routing and .mjs MIME headers
│   ├── package.json
│   ├── src/
│   │   ├── Dashboard.tsx    # Coordinator UI, risk map & approval gate
│   │   └── data/            # Barangay GeoJSON boundary data
│   └── vite.config.ts
└── README.md

```

---

## Local Development Setup

### Prerequisites

* Python 3.11+


* Node.js 18+ & npm


* Google Cloud SDK (`gcloud`)


* Firebase CLI (`firebase-tools`)



### 1. Authenticate with Google Cloud

Ensure your local environment has Application Default Credentials configured:

```bash
gcloud auth application-default login

```

### 2. Backend Service

From the `backend` directory:

```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\Activate.ps1
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Set required environment variables
export GOOGLE_CLOUD_PROJECT="tanglaw-app-2026"
export GOOGLE_CLOUD_LOCATION="asia-southeast3"
export CORS_ORIGINS="http://localhost:5173"

uvicorn main:app --reload --port 8080

```

### 3. Frontend Dashboard

From the `frontend` directory:

```bash
cd frontend
npm install
npm run dev

```

Open `http://localhost:5173` in your browser.

---

## Production Deployment

### 1. Deploy Backend (Cloud Run)

Deploy the containerized FastAPI service to `asia-southeast3` using your Dockerfile:

```powershell
cd C:\Projects\tanglaw-mvp\backend
gcloud run deploy tanglaw-api `
  --source . `
  --region=asia-southeast3 `
  --clear-base-image `
  --allow-unauthenticated `
  --set-env-vars GOOGLE_CLOUD_PROJECT=tanglaw-app-2026,GOOGLE_CLOUD_LOCATION=asia-southeast3,GEMINI_MODEL=gemini-2.5-flash,CORS_ORIGINS="[https://tanglaw-app-2026.web.app](https://tanglaw-app-2026.web.app)"

```

> **IAM Requirement:** Ensure the Cloud Run runtime service account has the **Vertex AI User** and **Cloud Datastore User** roles enabled.
> 
> 

### 2. Deploy Frontend (Firebase Hosting)

Build the Vite production bundle and publish to Firebase Hosting:

```powershell
cd C:\Projects\tanglaw-mvp\frontend
npm run build
firebase deploy --only hosting

```

> **Note on MapLibre & Vite:** `firebase.json` is configured with custom `Content-Type: application/javascript` headers for `**/*.mjs` to satisfy strict browser MIME type enforcement during background Web Worker execution.
> 
> 

---

## Core API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Healthcheck verification. |
| `POST` | `/api/plans` | Evaluates barangay risk levels + diocesan inventory; generates Gemini draft action plan in Firestore. |
| `GET` | `/api/plans` | Lists recent stored plans and review statuses. |
| `PATCH` | `/api/plans/{plan_id}/approve` | Coordinator sign-off gate; marks document as `approved` with audit timestamps and approver name. |
---

## Human-in-the-Loop Governance

Tanglaw enforces a strict human-approval gate. AI-generated disaster plans remain in `draft` status until explicitly authorized by a coordinator via the approval dispatch button. Alert broadcasts and asset movements cannot proceed without a recorded `approved_by` signature in Firestore.

---

