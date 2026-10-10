# Build the React/Vite application.
FROM node:22-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Runtime: FastAPI serves the API and the compiled SPA from one Cloud Run container.
FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8080
WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/main.py ./main.py
COPY --from=frontend-build /frontend/dist ./static
# Mount static last so /api routes retain precedence.
RUN printf '\nfrom fastapi.staticfiles import StaticFiles\napp.mount("/", StaticFiles(directory="static", html=True), name="spa")\n' >> main.py
EXPOSE 8080
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
