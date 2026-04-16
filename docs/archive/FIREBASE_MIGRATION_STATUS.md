# Firebase Migration Status

**Last Updated:** April 16, 2026  
**Status:** ⚠️ Partial Migration - Hybrid Architecture Active

## Executive Summary

The application is currently in a **hybrid state** with a feature-flagged dual-mode architecture. Firebase can be disabled by omitting the `VITE_FIREBASE_API_KEY` environment variable, which causes services to fall back to REST API calls (MySQL backend). However, several services and the Firebase Functions backend still depend entirely on Firebase.

---

## Migration Architecture

### How the Dual-Mode Works

1. **Firebase Config** (`src/config/firebase.ts`) checks for `VITE_FIREBASE_API_KEY`
2. If **NOT set**: All Firebase exports become `null`, services use API fallbacks
3. If **set**: Firebase initializes and services use Realtime Database with live listeners

```typescript
const isFirebaseEnabled = Boolean(firebaseConfig.apiKey)
export const database = isFirebaseEnabled ? getDatabase(app) : null
```

---

## Service-by-Service Status

### Fully Migrated to MySQL API ✅

| Service | Auth Method | Notes |
|---------|-------------|-------|
| `userService.ts` | MySQL API | Complete migration - no Firebase imports |

### Dual-Mode (Firebase + API Fallback) ⚠️

| Service | Firebase Usage | API Fallback | Notes |
|---------|----------------|--------------|-------|
| `companyService.ts` | Realtime Database | ✅ Yes | Admin-only operations |
| `projectService.ts` | Realtime Database + listeners | ✅ Yes | Projects & clients |
| `timeEntryService.ts` | Realtime Database + listeners | ✅ Yes | Real-time timer sync |
| `teamService.ts` | Realtime Database | ✅ Yes | Team management |

### Firebase Only (No API Fallback) ❌

| Service | Firebase Dependency | Notes |
|---------|---------------------|-------|
| `taskService.ts` | Realtime Database | No migration yet |
| `loggingService.ts` | Realtime Database | No migration yet |
| `projectManagementService.ts` | Realtime Database | No migration yet |
| `reportsService.ts` | Realtime Database | No migration yet |
| `NotificationContext.tsx` | Firebase Cloud Messaging | Push notifications |

---

## Backend Status

### Firebase Functions (`functions/src/index.ts`)

**Status:** ❌ Entirely Firebase-dependent

- Uses `firebase-functions` and `firebase-admin`
- Uses Realtime Database for all data operations
- Handles: Time entries, projects, user deletion, authentication
- **No MySQL fallback exists**

**Key Functions:**
- `api` - Express API hosted on Firebase Functions
- `deleteUser` - Callable function for user deletion
- `helloWorld` - Test function

---

## Database Usage Summary

### Firebase Realtime Database Collections

| Collection | Used By | Migration Priority |
|------------|---------|-------------------|
| `tasks` | taskService | High |
| `timeEntries` | timeEntryService, functions | High |
| `projects` | projectService, functions | Medium |
| `clients` | projectService | Medium |
| `teams` | teamService, functions | Medium |
| `teamMembers` | teamService | Medium |
| `companies` | companyService, functions | Low |
| `users` | functions (legacy) | Low |

---

## Environment Configuration

### To Run WITHOUT Firebase (MySQL Only)

```bash
# Do NOT set these in .env
# VITE_FIREBASE_API_KEY=
# VITE_FIREBASE_AUTH_DOMAIN=
# VITE_FIREBASE_DATABASE_URL=
# etc.
```

### To Run WITH Firebase (Hybrid Mode)

```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

---

## Migration Recommendations

### High Priority (Complete First)

1. **Task Service Migration**
   - File: `src/services/taskService.ts`
   - Create: `src/services/taskApiService.ts`
   - Pattern: Follow `projectApiService.ts` implementation

2. **Firebase Functions Replacement**
   - Options:
     a. Migrate to MySQL-only Express server
     b. Create Firebase Functions that proxy to MySQL API
     c. Disable functions entirely and rely on frontend API calls

### Medium Priority (Next Phase)

3. **Notification System**
   - Replace FCM with custom push notification service
   - Or use MySQL-based notification polling

4. **Logging Service**
   - Simple migration to MySQL logging table

### Low Priority (Final Cleanup)

5. **Remove Firebase Config**
   - Delete `src/config/firebase.ts`
   - Remove Firebase SDK from dependencies
   - Clean up all `if (!database)` conditional branches

---

## Testing the Migration

### Verify MySQL-Only Mode

1. Remove Firebase env vars from `.env`
2. Check browser console for warning:
   ```
   [firebase] Firebase is disabled (missing VITE_FIREBASE_API_KEY).
   ```
3. Verify all CRUD operations work via Network tab (should see `/api/*` requests)

### Verify Firebase Mode Still Works

1. Add Firebase env vars back
2. Check that real-time features work (time tracking, team updates)
3. Verify listeners are active in Application tab

---

## Files to Review for Migration

### Frontend Services Needing Migration
```
src/services/taskService.ts
src/services/loggingService.ts
src/services/projectManagementService.ts
src/services/reportsService.ts
src/contexts/NotificationContext.tsx
```

### Backend Functions Needing Replacement
```
functions/src/index.ts
functions/src/index.ts (lines 92-313) - Time entries API
functions/src/index.ts (lines 315-480) - Projects & calendar API
functions/src/index.ts (lines 486-598) - User deletion
```

---

## Migration Pattern Example

### Before (Firebase Only)
```typescript
import { ref, get } from 'firebase/database'
import { database } from '../config/firebase'

async getTasks(): Promise<Task[]> {
  const tasksRef = ref(database, 'tasks')
  const snapshot = await get(tasksRef)
  // ...
}
```

### After (Dual-Mode)
```typescript
import { ref, get } from 'firebase/database'
import { database } from '../config/firebase'
import { taskApiService } from './taskApiService'

async getTasks(): Promise<Task[]> {
  if (!database) {
    return taskApiService.getTasks() // API fallback
  }
  const tasksRef = ref(database, 'tasks')
  const snapshot = await get(tasksRef)
  // ...
}
```

---

## Related Documentation

- `MIGRATION_GUIDE.md` - General MySQL migration steps
- `MYSQL_MIGRATION_STATUS.md` - Detailed migration progress
- `ARCHITECTURE_FIX_SUMMARY.md` - Previous architecture decisions
