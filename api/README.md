# Clockistry API Documentation

A comprehensive REST API for the Clockistry time tracking system built with Express.js and Firebase.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Firebase project with Realtime Database
- Firebase service account key

### Installation

1. **Install dependencies:**
   ```bash
   cd api
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your Firebase configuration
   ```

3. **Add Firebase service account key:**
   ```bash
   # Download serviceAccountKey.json from Firebase Console
   # Place it in the api/ directory
   ```

4. **Run the server:**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 📚 API Endpoints

### Authentication
All endpoints require a valid Firebase ID token in the Authorization header:
```
Authorization: Bearer <firebase-id-token>
```

### Base URL
```
http://localhost:3001/api
```

## 🕐 Time Entries

### GET /api/time-entries
Get all time entries for the authenticated user.

**Query Parameters:**
- `startDate` (optional): Filter entries from this date (ISO string)
- `endDate` (optional): Filter entries to this date (ISO string)
- `projectId` (optional): Filter by project ID
- `billableOnly` (optional): Show only billable entries (true/false)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "entry-id",
      "userId": "user-id",
      "projectId": "project-id",
      "projectName": "Project Name",
      "description": "Working on feature",
      "startTime": "2024-01-15T09:00:00.000Z",
      "endTime": "2024-01-15T17:00:00.000Z",
      "duration": 28800,
      "isRunning": false,
      "isBillable": true,
      "tags": ["development", "frontend"],
      "createdAt": "2024-01-15T09:00:00.000Z",
      "updatedAt": "2024-01-15T17:00:00.000Z"
    }
  ],
  "count": 1
}
```

### POST /api/time-entries
Create a new time entry.

**Request Body:**
```json
{
  "projectId": "project-id",
  "description": "Working on feature",
  "startTime": "2024-01-15T09:00:00.000Z",
  "endTime": "2024-01-15T17:00:00.000Z",
  "duration": 28800,
  "isBillable": true,
  "tags": ["development", "frontend"]
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* created time entry */ },
  "message": "Time entry created successfully"
}
```

### PUT /api/time-entries/:id
Update an existing time entry.

**Request Body:** Same as POST

**Response:**
```json
{
  "success": true,
  "message": "Time entry updated successfully"
}
```

### DELETE /api/time-entries/:id
Delete a time entry.

**Response:**
```json
{
  "success": true,
  "message": "Time entry deleted successfully"
}
```

## 📁 Projects

### GET /api/projects
Get all active projects.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "project-id",
      "name": "Project Name",
      "description": "Project description",
      "color": "#3B82F6",
      "status": "active",
      "priority": "medium",
      "clientId": "client-id",
      "isArchived": false,
      "createdBy": "user-id",
      "createdAt": "2024-01-15T09:00:00.000Z",
      "updatedAt": "2024-01-15T09:00:00.000Z"
    }
  ],
  "count": 1
}
```

### POST /api/projects
Create a new project.

**Request Body:**
```json
{
  "name": "Project Name",
  "description": "Project description",
  "color": "#3B82F6",
  "status": "active",
  "priority": "medium",
  "clientId": "client-id"
}
```

## 📊 Time Summary

### GET /api/time-summary
Get time tracking summary for a specific period.

**Query Parameters:**
- `period` (optional): Summary period - "today", "week", or "month" (default: "month")

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-01-31T23:59:59.000Z",
    "totalDuration": 144000,
    "billableDuration": 120000,
    "nonBillableDuration": 24000,
    "totalEntries": 20,
    "billableEntries": 16,
    "formattedTotal": "40:00:00",
    "formattedBillable": "33:20:00",
    "formattedNonBillable": "06:40:00"
  }
}
```

## 📅 Calendar

### GET /api/calendar
Get calendar data for a specific month.

**Query Parameters:**
- `year` (optional): Year (default: current year)
- `month` (optional): Month 0-11 (default: current month)
- `projectId` (optional): Filter by project ID
- `billableOnly` (optional): Show only billable entries

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "Mon Jan 15 2024",
      "events": [ /* time entries for this date */ ],
      "totalDuration": 28800,
      "billableDuration": 28800
    }
  ],
  "month": 0,
  "year": 2024
}
```

## 🔧 Health Check

### GET /api/health
Check API health status.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "version": "1.0.0"
}
```

## 🛡️ Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS Protection**: Configurable allowed origins
- **Helmet Security**: Security headers
- **Input Validation**: Joi schema validation
- **Authentication**: Firebase ID token verification
- **Authorization**: Role-based access control

## 📝 Error Handling

All errors follow this format:
```json
{
  "error": "Error message",
  "message": "Detailed error description (development only)"
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation error)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (access denied)
- `404`: Not Found
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error

## 🚀 Deployment

### Firebase Functions (Recommended)
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Deploy to Firebase Functions
firebase deploy --only functions
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Environment Variables
```env
PORT=3001
NODE_ENV=production
FIREBASE_DATABASE_URL=your-database-url
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

## 📊 Monitoring

The API includes:
- Request logging with Morgan
- Error tracking
- Health check endpoint
- Rate limiting metrics

## 🔄 Integration Examples

### JavaScript/React
```javascript
const API_BASE = 'http://localhost:3001/api';

// Get time entries
const getTimeEntries = async (token) => {
  const response = await fetch(`${API_BASE}/time-entries`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
};

// Create time entry
const createTimeEntry = async (token, entryData) => {
  const response = await fetch(`${API_BASE}/time-entries`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(entryData)
  });
  return response.json();
};
```

### Python
```python
import requests

API_BASE = 'http://localhost:3001/api'

def get_time_entries(token):
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.get(f'{API_BASE}/time-entries', headers=headers)
    return response.json()

def create_time_entry(token, entry_data):
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    response = requests.post(f'{API_BASE}/time-entries', 
                           json=entry_data, headers=headers)
    return response.json()
```

## 📈 Performance

- **Compression**: Gzip compression enabled
- **Caching**: Appropriate cache headers
- **Rate Limiting**: Prevents abuse
- **Database Indexing**: Optimized Firebase queries
- **Connection Pooling**: Efficient database connections

## 🔧 Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests (when implemented)
npm test

# Lint code
npm run lint
```
