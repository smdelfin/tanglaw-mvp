# Use the official lightweight Python image.
FROM python:3.11-slim

# Allow statements and log messages to immediately appear in the Knative logs
ENV PYTHONUNBUFFERED True

# Set the working directory in the container
WORKDIR /app

# Copy the dependencies file to the working directory
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the local code to the container
COPY . .

# Run the web service on container startup. 
# Cloud Run expects the server to listen on the port defined by the PORT environment variable.
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}