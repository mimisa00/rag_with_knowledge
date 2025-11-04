# Vertex AI Credentials Directory

This directory is for storing Google Cloud Service Account credentials.

## Setup Instructions

1. Create a Service Account in Google Cloud Console or using gcloud CLI:
```bash
# Replace YOUR_PROJECT_ID with your actual GCP project ID
export PROJECT_ID=YOUR_PROJECT_ID

# Create service account
gcloud iam service-accounts create rag-vertex-ai \
    --display-name="RAG Vertex AI Service Account" \
    --project=${PROJECT_ID}

# Grant necessary permissions
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:rag-vertex-ai@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"

# Create and download the key
gcloud iam service-accounts keys create ./vertex-ai-key.json \
    --iam-account=rag-vertex-ai@${PROJECT_ID}.iam.gserviceaccount.com
```

2. Place the downloaded key file in this directory with the name `vertex-ai-key.json`

3. Ensure proper file permissions:
```bash
chmod 644 vertex-ai-key.json
```

4. Restart the backend service:
```bash
docker compose restart backend
```

## Important Security Notes

- **NEVER** commit credential files to version control
- The `.gitignore` file is configured to exclude all `.json` files in this directory
- Rotate keys regularly (recommended every 90 days)
- Use different service accounts for development and production environments

## File Structure

```
credentials/
├── README.md          (this file)
├── .gitkeep          (ensures directory exists in git)
└── vertex-ai-key.json (your service account key - DO NOT COMMIT)
```

## Troubleshooting

If you encounter authentication errors:

1. Verify the key file exists and has correct permissions
2. Check that the service account has the required permissions
3. Ensure the PROJECT_ID in the key file matches your configuration
4. Check Docker logs: `docker compose logs backend`