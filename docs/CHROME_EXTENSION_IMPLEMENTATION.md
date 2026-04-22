# Chrome Extension Implementation Guide

## Overview
A Chrome extension for NexiFlow that provides manual time tracking via popup and optional auto-screenshot functionality with Google Drive storage for super admins.

---

## Features

### 1. Simple Popup Timer
- Start/Stop button in extension popup
- Shows current timer status and duration
- Syncs time entries to NexiFlow API
- Works with existing authentication system

### 2. Auto Screenshot (Optional)
- Captures screenshots every 5 minutes when timer is running
- User must grant screen recording permission
- Screenshots stored in super admin's Google Drive folder
- Can capture entire screen (including VS Code, other apps)

---

## Architecture

### Extension Structure
```
chrome-extension/
├── manifest.json           # Extension config v3
├── popup.html             # Timer UI
├── popup.js               # Popup logic (React compatible)
├── background.js          # Service worker - timer + screenshots
├── content.js             # Page interaction (optional)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── utils/
    ├── api.js             # NexiFlow API calls
    ├── auth.js            # Token management
    └── gdrive.js          # Google Drive upload
```

### Data Flow
```
[User clicks Start] → [Background Timer] → [5min Alarm] → [Capture Screenshot]
                                                           ↓
[NexiFlow API] ← [Save Time Entry] ← [Stop Clicked]
                                                           ↓
                                        [Upload to Google Drive]
```

---

## Implementation Steps

### Phase 1: Basic Extension Setup

#### 1.1 Create `manifest.json`
```json
{
  "manifest_version": 3,
  "name": "NexiFlow Time Tracker",
  "version": "1.0.0",
  "description": "Track time and capture work proof",
  "permissions": [
    "storage",
    "alarms",
    "activeTab",
    "desktopCapture",
    "identity"
  ],
  "host_permissions": [
    "http://localhost:3000/*",
    "https://your-domain.com/*",
    "https://www.googleapis.com/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "oauth2": {
    "client_id": "YOUR_GOOGLE_CLIENT_ID",
    "scopes": [
      "https://www.googleapis.com/auth/drive.file"
    ]
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

#### 1.2 Build Popup UI (`popup.html`)
- React component rendered into popup
- Display: Timer status, elapsed time, Start/Stop buttons
- Settings: Screenshot toggle (only for super admins)

#### 1.3 Background Service Worker (`background.js`)
Handles:
- Timer state (start time, elapsed)
- `chrome.alarms` for 5-minute intervals
- Screenshot capture using `desktopCapture`
- API calls to NexiFlow backend
- Google Drive uploads

---

### Phase 2: Timer Functionality

#### 2.1 Timer Logic
```javascript
// background.js
let timerState = {
  isRunning: false,
  startTime: null,
  elapsedSeconds: 0,
  screenshotsEnabled: false,
  projectId: null
};

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'screenshot-capture') {
    captureAndUpload();
  }
  if (alarm.name === 'sync-timer') {
    syncElapsedTime();
  }
});
```

#### 2.2 API Integration
Reuse patterns from `src/services/timeEntryApiService.ts`:
```javascript
// utils/api.js
const API_BASE = process.env.API_URL || 'http://localhost:3000';

export async function createTimeEntry(entry) {
  const token = await getAuthToken();
  return fetch(`${API_BASE}/api/time-entries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(entry)
  });
}
```

---

### Phase 3: Screenshot Feature

#### 3.1 User Consent Flow
```
1. Super admin enables "Screenshot Tracking" in popup settings
2. Click "Grant Screen Permission"
3. Chrome shows native picker: "Share Entire Screen / Window / Tab"
4. User selects "Entire Screen"
5. Extension stores stream permission
6. Screenshots begin every 5 minutes while timer runs
```

#### 3.2 Screenshot Capture Code
```javascript
async function captureScreenshot() {
  // Request desktop capture
  const sources = ['screen', 'window'];
  const streamId = await new Promise((resolve) => {
    chrome.desktopCapture.chooseDesktopMedia(
      sources,
      (streamId) => resolve(streamId)
    );
  });
  
  // Get media stream
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: streamId
      }
    }
  });
  
  // Capture frame to canvas
  const video = document.createElement('video');
  video.srcObject = stream;
  await video.play();
  
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  
  // Convert to blob
  const blob = await new Promise(resolve => 
    canvas.toBlob(resolve, 'image/jpeg', 0.8)
  );
  
  // Cleanup
  stream.getTracks().forEach(track => track.stop());
  
  return blob;
}
```

#### 3.3 5-Minute Interval Setup
```javascript
// Start timer and screenshots
function startTracking(enableScreenshots) {
  timerState = {
    isRunning: true,
    startTime: Date.now(),
    screenshotsEnabled: enableScreenshots
  };
  
  // Save to storage
  chrome.storage.local.set({ timerState });
  
  // Set 5-minute alarm for screenshots
  if (enableScreenshots) {
    chrome.alarms.create('screenshot-capture', {
      periodInMinutes: 5
    });
  }
  
  // 1-second timer for UI updates
  chrome.alarms.create('sync-timer', {
    periodInMinutes: 1/60
  });
}

// Stop everything
function stopTracking() {
  const elapsed = Date.now() - timerState.startTime;
  
  // Save time entry to API
  saveTimeEntry(elapsed);
  
  // Clear alarms
  chrome.alarms.clear('screenshot-capture');
  chrome.alarms.clear('sync-timer');
  
  timerState.isRunning = false;
  chrome.storage.local.set({ timerState });
}
```

---

### Phase 4: Google Drive Integration

#### 4.1 Setup Requirements
1. **Google Cloud Console**:
   - Create project
   - Enable Google Drive API
   - Create OAuth 2.0 credentials
   - Decide **ownership model** for screenshots (see 4.2)
   - If using extension-direct upload (per-user Drive): add `chrome-extension://<extension-id>` to authorized origins and set the OAuth client in `manifest.json`
   - If using **super admin Drive** (recommended for central storage): set up **backend OAuth** + store a refresh token server-side (do not put client secret in the extension)

2. **OAuth Scopes**:
   - `https://www.googleapis.com/auth/drive.file` (create files only)

#### 4.2 Pick the Ownership Model (Important)
There are **two valid** patterns; choose one and implement Phase 4 accordingly:

**Option A — Per-user Drive upload (extension uploads directly)**
- Each user authenticates Google Drive inside the extension (Chrome profile user).
- Screenshots land in **that user’s** Google Drive (or a shared folder they can write to).
- Best if you want *users to own their own proof* and avoid routing images through your backend.

**Option B — Super-admin Drive upload (central storage)**
- Users run the extension, but screenshots land in the **company’s super admin** Google Drive.
- This cannot be reliably done by uploading directly from each user’s extension, because `chrome.identity.getAuthToken()` returns a token for the **current Chrome profile user**, not a separate “super admin”.
- Recommended implementation: **upload screenshot bytes to your backend**, then the backend uploads to Drive using the company super admin’s **refresh token** (offline access).

This guide assumes **Option B** (Per-company Super-admin Drive).

#### 4.3 Super Admin Google Drive Connection (Backend OAuth, per company)
Goal: obtain and store a **refresh token per company** on the server so it can upload to Drive long-term without re-consent.

Backend env vars (example):
```
GOOGLE_DRIVE_CLIENT_ID=...
GOOGLE_DRIVE_CLIENT_SECRET=...
GOOGLE_DRIVE_REDIRECT_URI=https://nexi-flow.com/api/admin/google-drive/callback
GOOGLE_DRIVE_OAUTH_STATE_SECRET=... # random string
GOOGLE_DRIVE_TOKEN_ENC_KEY=...      # 32-byte key, base64-encoded
GOOGLE_DRIVE_FOLDER_NAME=NexiFlow Screenshots
```

High-level flow:
1. Company super admin clicks “Connect Google Drive” in the NexiFlow **web app** (admin-only page), passing `companyId`.
2. Backend redirects to Google OAuth with `access_type=offline` and `prompt=consent`.
3. Google redirects back to backend callback with an auth `code` and `state` (includes companyId).
4. Backend exchanges `code` for `{ access_token, refresh_token }` and stores the **refresh token encrypted** in MySQL keyed by `companyId`.

> Note: do not put `client_secret` or refresh tokens inside the Chrome extension.

#### 4.4 Folder Management (Backend)
```javascript
// Create or get existing folder for screenshots
async function getOrCreateFolder(token, folderName = 'NexiFlow Screenshots') {
  // Search for existing folder
  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${folderName}'+and+mimeType='application/vnd.google-apps.folder'`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  
  const data = await searchResponse.json();
  
  if (data.files && data.files.length > 0) {
    return data.files[0].id; // Return existing folder ID
  }
  
  // Create new folder
  const createResponse = await fetch(
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      })
    }
  );
  
  const folder = await createResponse.json();
  return folder.id;
}
```

#### 4.5 Upload Screenshot (Backend → Drive)
```javascript
// server-side: uploadScreenshotToAdminDrive(buffer, metadata)
export async function uploadScreenshotToAdminDrive(buffer, metadata) {
  const token = await getAdminDriveAccessToken(); // derived from refresh token
  if (!token) throw new Error('Admin Google Drive not connected');
  
  // Get or create folder
  const folderId = await getOrCreateFolder(token);
  
  // Prepare metadata
  const timestamp = new Date().toISOString();
  const filename = `nexiflow_${metadata.userId}_${timestamp}.jpg`;
  
  const fileMetadata = {
    name: filename,
    parents: [folderId],
    description: `Time entry: ${metadata.projectName || 'No project'} | Duration: ${metadata.duration}`
  };
  
  // Create multipart upload
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;
  
  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(fileMetadata) +
    delimiter +
    'Content-Type: image/jpeg\r\n\r\n';
  
  const body = new Blob([
    multipartRequestBody,
    blob,
    closeDelim
  ]);
  
  // Upload to Drive
  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`
      },
      body
    }
  );
  
  const file = await response.json();
  return {
    fileId: file.id,
    webViewLink: file.webViewLink,
    filename
  };
}
```

---

### Phase 5: Complete Capture Flow

```javascript
// extension-side: upload screenshot bytes to backend
async function blobToBase64(blob) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return String(dataUrl).split(',')[1]; // strip "data:image/jpeg;base64,"
}

async function uploadScreenshotViaBackend(blob, metadata) {
  const token = await getAuthToken(); // your NexiFlow auth token (same as time entry calls)
  const base64 = await blobToBase64(blob);

  const res = await fetch(`${API_BASE}/api/screenshots`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ imageBase64: base64, ...metadata })
  });

  if (!res.ok) throw new Error(`Screenshot upload failed (${res.status})`);
  return res.json();
}

// Full screenshot + upload flow
async function captureAndUpload() {
  try {
    // Capture screenshot
    const screenshotBlob = await captureScreenshot();
    
    // Upload screenshot bytes to NexiFlow backend (recommended for super-admin Drive storage)
    // Backend is responsible for uploading to Google Drive using the super admin credentials.
    const uploadResult = await uploadScreenshotViaBackend(screenshotBlob, {
      userId: timerState.userId,
      companyId: timerState.companyId, // required so backend selects the correct company's Drive
      projectName: timerState.projectName,
      duration: formatDuration(timerState.elapsedSeconds),
      timestamp: new Date().toISOString()
    });
    
    // Store reference in time entry metadata
    timerState.screenshotRefs = timerState.screenshotRefs || [];
    timerState.screenshotRefs.push(uploadResult);
    
    await chrome.storage.local.set({ timerState });
    
    console.log('Screenshot uploaded:', uploadResult.webViewLink);
  } catch (error) {
    console.error('Screenshot failed:', error);
  }
}
```

---

## Security & Privacy

### User Consent
- Screenshots only taken when user explicitly enables feature
- Screen picker shows red recording indicator
- User can stop anytime

### Data Storage
- Screenshots stored in super admin's own Google Drive (not your servers)
- Only screenshot metadata (Drive file IDs) stored in NexiFlow
- OAuth tokens stored in Chrome's secure storage

### Access Control
- Only super admins can enable screenshot feature
- Regular users only see basic timer
- Check admin status via NexiFlow API before showing settings

---

## Build & Deploy

### Vite Configuration
```typescript
// vite.config.ts - add extension build
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        popup: 'chrome-extension/popup.html',
        background: 'chrome-extension/background.js'
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background.js';
          if (chunkInfo.name === 'popup') return 'popup.js';
          return 'assets/[name]-[hash].js';
        }
      }
    }
  }
});
```

### Load Extension Locally
1. Build: `npm run build`
2. Open Chrome: `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `dist/chrome-extension/` folder

### Chrome Web Store Publish (Optional)
1. Zip the `dist/chrome-extension/` folder
2. Pay $5 developer fee
3. Upload to Chrome Web Store Developer Dashboard
4. Add privacy policy explaining screenshot usage

---

## API Endpoints Needed

### Backend Updates Required
```
POST /api/time-entries
{
  "startTime": "2024-01-15T10:00:00Z",
  "endTime": "2024-01-15T10:30:00Z",
  "duration": 1800,
  "projectId": "uuid",
  "screenshots": [
    {
      "driveFileId": "abc123",
      "filename": "nexiflow_user_2024-01-15T10:05:00Z.jpg",
      "timestamp": "2024-01-15T10:05:00Z",
      "url": "https://drive.google.com/file/d/abc123/view"
    }
  ]
}
```

---

## Testing Checklist

- [ ] Timer starts/stops correctly
- [ ] Elapsed time displays in popup
- [ ] Time entry saves to NexiFlow
- [ ] Screenshot toggle only visible to super admins
- [ ] Screen picker opens when enabling screenshots
- [ ] Screenshots capture every 5 minutes while timer running
- [ ] Screenshots upload to Google Drive
- [ ] Drive folder created if doesn't exist
- [ ] Screenshots stop when timer stops
- [ ] Extension works after Chrome restart (persistent state)
- [ ] Token refresh handled for Google Drive

---

## Next Steps

1. Create `chrome-extension/` folder structure
2. Build basic popup timer (Phase 1-2)
3. Test API integration with existing NexiFlow backend
4. Add Google Drive OAuth flow (Phase 4)
5. Integrate screenshot capture (Phase 3)
6. Test end-to-end with super admin account

---

## Notes

- **Extension ID**: Changes during development, stable after Chrome Web Store publish
- **Google Drive Quota**: 15GB free per user, monitor usage
- **Chrome Updates**: Extension auto-updates from Web Store
- **Permissions**: User must accept new permissions on updates
