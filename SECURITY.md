# Security Guidelines

## 🔒 Environment Variables

This project uses environment variables to store sensitive configuration data like API keys and database credentials. **Never commit these files to version control.**

### Required Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project_id-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### Security Best Practices

1. **Never commit `.env.local`** - This file is already included in `.gitignore`
2. **Use `.env.example`** - Create example files with placeholder values
3. **Rotate keys regularly** - Change API keys periodically
4. **Use different keys for different environments** - Development, staging, production
5. **Restrict API key permissions** - Only grant necessary permissions
6. **Monitor key usage** - Set up alerts for unusual activity

### Files to Never Commit

- `.env`
- `.env.local`
- `.env.development.local`
- `.env.test.local`
- `.env.production.local`
- Any file containing actual API keys or secrets

### If Secrets Are Accidentally Committed

1. **Immediately rotate the exposed keys** in your service provider's dashboard
2. **Remove the secrets from git history** using `git filter-branch` or BFG Repo-Cleaner
3. **Force push** the cleaned history to remote repository
4. **Notify team members** to pull the updated history
5. **Review access logs** for any unauthorized usage

## 🛡️ Firebase Security Rules

Ensure your Firebase project has proper security rules configured:

### Realtime Database Rules
```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

### Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 🔍 Security Checklist

Before deploying or sharing code:

- [ ] No hardcoded API keys or secrets
- [ ] All sensitive data in environment variables
- [ ] `.env.local` in `.gitignore`
- [ ] API keys have minimal required permissions
- [ ] Firebase security rules are configured
- [ ] No sensitive data in console logs
- [ ] HTTPS enabled for production
- [ ] Regular security audits scheduled

## 📞 Reporting Security Issues

If you discover a security vulnerability, please:

1. **Do not** create a public GitHub issue
2. Contact the development team directly
3. Provide detailed information about the vulnerability
4. Allow reasonable time for the issue to be resolved before public disclosure

## 🔄 Regular Security Maintenance

- Review and rotate API keys quarterly
- Update dependencies regularly
- Monitor access logs for unusual activity
- Conduct security audits annually
- Keep security documentation updated
