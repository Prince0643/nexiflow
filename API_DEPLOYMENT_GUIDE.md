# Clockistry API Deployment Guide

This guide covers multiple deployment options for the Clockistry API.

## 🚀 Deployment Options

### Option 1: Firebase Functions (Recommended)
Deploy as Firebase Cloud Functions for serverless, scalable API.

### Option 2: Standalone Express Server
Deploy as a traditional Express.js server on any hosting platform.

### Option 3: Docker Container
Containerize the API for deployment on any container platform.

---

## 🔥 Option 1: Firebase Functions Deployment

### Prerequisites
- Firebase CLI installed (`npm install -g firebase-tools`)
- Firebase project with Functions enabled
- Node.js 18+

### Steps

1. **Initialize Firebase Functions:**
   ```bash
   cd functions
   npm install
   ```

2. **Build the functions:**
   ```bash
   npm run build
   ```

3. **Deploy to Firebase:**
   ```bash
   firebase deploy --only functions
   ```

4. **Your API will be available at:**
   ```
   https://us-central1-your-project-id.cloudfunctions.net/api
   ```

### Environment Configuration
Set environment variables in Firebase Console:
```bash
firebase functions:config:set app.database_url="your-database-url"
firebase functions:config:set app.allowed_origins="https://yourdomain.com"
```

---

## 🖥️ Option 2: Standalone Express Server

### Prerequisites
- Node.js 18+
- Firebase service account key
- Server with PM2 or similar process manager

### Steps

1. **Set up the API server:**
   ```bash
   cd api
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Add Firebase service account:**
   - Download `serviceAccountKey.json` from Firebase Console
   - Place it in the `api/` directory

4. **Start the server:**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

### Production Deployment with PM2

1. **Install PM2:**
   ```bash
   npm install -g pm2
   ```

2. **Create PM2 ecosystem file:**
   ```javascript
   // ecosystem.config.js
   module.exports = {
     apps: [{
       name: 'clockistry-api',
       script: 'index.js',
       instances: 'max',
       exec_mode: 'cluster',
       env: {
         NODE_ENV: 'production',
         PORT: 3001
       }
     }]
   }
   ```

3. **Start with PM2:**
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

---

## 🐳 Option 3: Docker Deployment

### Create Dockerfile
```dockerfile
# api/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

# Start the application
CMD ["npm", "start"]
```

### Build and Deploy
```bash
# Build the image
docker build -t clockistry-api .

# Run the container
docker run -p 3001:3001 \
  -e FIREBASE_DATABASE_URL="your-database-url" \
  -e ALLOWED_ORIGINS="https://yourdomain.com" \
  clockistry-api
```

### Docker Compose
```yaml
# docker-compose.yml
version: '3.8'
services:
  clockistry-api:
    build: ./api
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - FIREBASE_DATABASE_URL=${FIREBASE_DATABASE_URL}
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## 🌐 Frontend Integration

### Update Environment Variables
Add to your `.env.local`:
```env
VITE_API_BASE_URL=https://your-api-domain.com/api
```

### Update API Service
The `src/services/apiService.ts` is already configured to work with the API.

### Test the Integration
```javascript
// Test API connection
import { api } from './services/apiService'

// Check health
const health = await api.health.checkHealth()
console.log('API Status:', health)

// Get time entries
const timeEntries = await api.timeEntries.getTimeEntries()
console.log('Time Entries:', timeEntries)
```

---

## 🔒 Security Considerations

### 1. CORS Configuration
Update allowed origins in your API configuration:
```javascript
// For production
const allowedOrigins = [
  'https://yourdomain.com',
  'https://www.yourdomain.com'
]
```

### 2. Rate Limiting
The API includes rate limiting (100 requests per 15 minutes per IP).

### 3. Firebase Security Rules
Ensure your Firebase security rules are properly configured (already done in your `firebase-rules.json`).

### 4. Environment Variables
Never commit sensitive environment variables to version control.

---

## 📊 Monitoring and Logging

### 1. Health Check Endpoint
Monitor API health:
```bash
curl https://your-api-domain.com/api/health
```

### 2. Logging
The API includes comprehensive logging with Morgan.

### 3. Error Tracking
Consider integrating with services like:
- Sentry for error tracking
- LogRocket for session replay
- New Relic for performance monitoring

---

## 🚀 Scaling Considerations

### Firebase Functions
- Automatically scales based on demand
- Pay per execution
- Cold start latency for infrequent requests

### Standalone Server
- Use load balancers for multiple instances
- Consider Redis for session storage
- Implement database connection pooling

### Docker
- Use container orchestration (Kubernetes, Docker Swarm)
- Implement health checks and auto-restart
- Use reverse proxy (Nginx) for load balancing

---

## 🔧 Development vs Production

### Development
```bash
# Local development
npm run dev

# API available at http://localhost:3001/api
```

### Production
```bash
# Build and deploy
npm run build
firebase deploy --only functions

# Or for standalone
pm2 start ecosystem.config.js
```

---

## 📝 API Documentation

Once deployed, your API will be available with full documentation at:
- Health Check: `GET /api/health`
- Time Entries: `GET /api/time-entries`
- Projects: `GET /api/projects`
- Calendar: `GET /api/calendar`
- Time Summary: `GET /api/time-summary`

All endpoints require Firebase authentication via the `Authorization: Bearer <token>` header.

---

## 🆘 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check `ALLOWED_ORIGINS` environment variable
   - Ensure frontend domain is included

2. **Authentication Errors**
   - Verify Firebase ID token is valid
   - Check token expiration

3. **Database Connection Issues**
   - Verify Firebase service account key
   - Check database URL configuration

4. **Rate Limiting**
   - Implement exponential backoff
   - Consider increasing rate limits for production

### Debug Mode
Enable debug logging:
```bash
NODE_ENV=development npm start
```

---

## 📈 Performance Optimization

1. **Database Indexing**
   - Ensure Firebase indexes are optimized
   - Use compound indexes for complex queries

2. **Caching**
   - Implement Redis for frequently accessed data
   - Use CDN for static assets

3. **Compression**
   - Enable gzip compression (already included)
   - Optimize JSON responses

4. **Connection Pooling**
   - Use connection pooling for database connections
   - Implement request queuing for high traffic

This API implementation provides a robust, scalable foundation for your Clockistry time tracking system!
