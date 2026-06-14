# Gmail OAuth Setup for CampusFlow AI

1. Go to https://console.cloud.google.com
2. Create project or select existing
3. APIs & Services → Enable APIs:
   - Gmail API
   - Google People API
4. APIs & Services → OAuth Consent Screen:
   - User Type: External
   - App name: CampusFlow AI
   - Scopes: add gmail.readonly, userinfo.email, userinfo.profile
   - Test users: add your college email addresses
5. APIs & Services → Credentials → Create OAuth 2.0 Client ID:
   - Type: Web application
   - Authorized JavaScript origins:
       http://localhost:3000
       http://localhost:5173
       https://your-app.amplifyapp.com
   - Authorized redirect URIs:
       http://localhost:5000/api/gmail/callback
       http://your-eb-url.elasticbeanstalk.com/api/gmail/callback
6. Copy Client ID and Secret to .env
7. Add GOOGLE_REDIRECT_URI to EB environment properties
