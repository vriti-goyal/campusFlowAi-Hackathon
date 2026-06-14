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
   > [!WARNING]
   > **Important AWS Change**: AWS no longer creates the default IAM Instance Profile automatically. If your environment shows **"No Data"** or instances fail to launch:
   > 1. Go to the IAM Console -> Roles -> Create Role.
   > 2. Select **AWS Service** -> **EC2**.
   > 3. Attach the **`AWSElasticBeanstalkWebTier`** policy.
   > 4. Name the role `aws-elasticbeanstalk-ec2-role`.
   > 5. Go to your Elastic Beanstalk Environment -> Configuration -> Security -> IAM instance profile, and select the role you just created. Apply the changes.

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
- `GEMINI_API_KEY`: Your Google Gemini API Key.
- `BEDROCK_MODEL_ID`: (Optional) AWS Bedrock model ID if switching back to Bedrock.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`: Google OAuth credentials for Gmail integration.
- `GMAIL_TOKEN_ENCRYPTION_KEY`: A 32-byte hex string for AES-256-GCM encryption of tokens.

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
- `VITE_API_BASE_URL`: If you set up the Amplify Rewrite (recommended, see below), set this to your Amplify domain (e.g., `https://main.dxxxxxxxx.amplifyapp.com`). If you have a custom HTTPS domain for Elastic Beanstalk, use that instead. Do **NOT** use the `http://` Elastic Beanstalk URL directly or your browser will block it due to Mixed Content.
- Firebase client configuration variables:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`

---

## 3. Fixing Mixed Content Errors (Crucial for Production)
Because AWS Elastic Beanstalk provides an `http://` URL by default, and Amplify serves your site over `https://`, browsers will block API calls with a **Mixed Content** error. AWS Amplify also blocks proxying to `http://` URLs directly. 

To fix this quickly (without buying a custom domain for an SSL certificate), you can use a free **AWS API Gateway** to automatically wrap your backend in `https://`:

1. Go to the **API Gateway** console in AWS.
2. Click **Create API** and choose **HTTP API** (click Build).
3. **Step 1:** Click **Add integration**, choose **HTTP URI**. 
   - HTTP method: **ANY**
   - URI: `http://<your-elastic-beanstalk-url>.us-east-1.elasticbeanstalk.com/{proxy}`
4. **Step 2:** For **Routes**, set:
   - Method: **ANY**
   - Resource path: `/{proxy+}`
   - Integration target: select the HTTP URI you just made.
5. Click **Next** until you create the API.
6. You will instantly get an Invoke URL that starts with `https://`. (e.g., `https://xyz123.execute-api.us-east-1.amazonaws.com/`)
7. Go to your frontend Amplify Environment Variables and set your `VITE_API_BASE_URL` to this new HTTPS API Gateway URL!

---

## 3. Post-Deployment Steps
1. **Firebase Authorized Domains**: Add your Amplify frontend domain to the authorized domains in the Firebase Authentication console.
2. **S3 CORS Configuration**: Ensure your S3 bucket has a CORS policy allowing PUT and GET requests from your Amplify frontend domain.
