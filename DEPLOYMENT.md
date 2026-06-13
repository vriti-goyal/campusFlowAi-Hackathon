# CampusFlow AI Deployment Guide

This guide provides step-by-step instructions for deploying the CampusFlow AI platform using AWS Elastic Beanstalk for the Node.js backend and AWS Amplify for the React/Vite frontend.

## 1. Backend Deployment (AWS Elastic Beanstalk)

### Prerequisites
- Install the [EB CLI](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb-cli3-install.html).
- Configure your AWS credentials.

### Steps
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Initialize Elastic Beanstalk (if not already done):
   ```bash
   eb init
   ```
   *Select your preferred region and choose "Node.js" as the platform.*

3. Create an environment and deploy:
   ```bash
   eb create campusflow-backend-env
   ```

4. Set the required environment variables in the Elastic Beanstalk console (Configuration -> Software -> Environment properties) or via EB CLI:
   ```bash
   eb setenv PORT=8080 FRONTEND_URL=https://<your-amplify-app-domain> MONGO_URI=<your-mongo-uri> ...
   ```

### Required Environment Variables
- `PORT`: 8080 (Required for EB)
- `FRONTEND_URL`: The deployed URL of your Amplify frontend application.
- `MONGO_URI`: Your MongoDB connection string.
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`: Firebase Admin credentials.
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: AWS credentials for S3/Bedrock/Textract.
- `S3_BUCKET_NAME`: Name of the S3 bucket for uploads.

---

## 2. Frontend Deployment (AWS Amplify)

### Prerequisites
- A GitHub repository hosting your CampusFlow AI code.

### Steps
1. Go to the **AWS Amplify Console**.
2. Click **New app** -> **Host web app**.
3. Connect your repository (e.g., GitHub) and select the branch you want to deploy.
4. On the Build settings page, ensure the App build specification matches the `amplify.yml` file located in the `frontend` folder. Make sure to point the base directory to `frontend` if deploying a monorepo, or simply specify the build commands correctly if the Amplify app is rooted in `frontend`.
5. Under **Advanced settings**, add the required environment variables.
6. Click **Save and deploy**.

### Required Environment Variables
- `VITE_API_BASE_URL`: The URL of your deployed Elastic Beanstalk backend (e.g., `http://campusflow-backend-env.eba-xxxx.us-east-1.elasticbeanstalk.com`).
- Firebase client configuration variables:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`

---

## 3. Post-Deployment Steps
1. **Firebase Authorized Domains**: Add your Amplify frontend domain to the authorized domains in the Firebase Authentication console.
2. **S3 CORS Configuration**: Ensure your S3 bucket has a CORS policy allowing PUT and GET requests from your Amplify frontend domain.
