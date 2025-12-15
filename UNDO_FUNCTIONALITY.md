# Undo Functionality in Admin Dashboard

## Workflow Diagram

```mermaid
graph TD
    A[User Action] --> B{Action Type}
    B -->|Delete User| C[Show Confirmation]
    B -->|Edit User| D[Save Changes]
    B -->|Delete Time Entry| E[Remove Entry]
    B -->|Edit Time Entry| F[Update Entry]
    
    C -->|Confirmed| G[Delete User from DB]
    G --> H[Add to Undo Queue]
    H --> I[Show Undo Notification<br/>30s timeout]
    
    D --> J[Update User in DB]
    J --> K[Store Original Data<br/>Add to Undo Queue]
    K --> I
    
    E --> L[Delete Entry from DB]
    L --> M[Store Deleted Data<br/>Add to Undo Queue]
    M --> I
    
    F --> N[Update Entry in DB]
    N --> O[Store Original Data<br/>Add to Undo Queue]
    O --> I
    
    I -->|User Clicks Undo| P[Restore Original Data]
    I -->|Timeout/Dismiss| Q[Remove from Undo Queue]
    
    P --> R[Execute Restore Action]
    R -->|User Edit| S[Update User in DB]
    R -->|Time Entry Edit| T[Update Entry in DB]
    R -->|User Delete| U[Show Error - Not Supported]
    R -->|Time Entry Delete| V[Recreate Entry in DB]
```

## Implementation Details

### 1. Undo Action Structure
```typescript
interface UndoAction {
  id: string;
  type: 'delete-user' | 'delete-time-entry' | 'edit-user' | 'edit-time-entry';
  data: any;
  timeoutId: NodeJS.Timeout;
}
```

### 2. State Management
- `undoActions`: Array of pending undo actions
- `showUndoNotification`: Boolean to show/hide notification
- `currentUndoAction`: Currently displayed undo action

### 3. Supported Undo Operations
- ✅ Edit User: Reverts user information changes
- ✅ Edit Time Entry: Reverts time entry changes
- ✅ Delete Time Entry: Recreates deleted time entries
- ❌ Delete User: Not supported due to password requirements

### 4. Timeout Handling
- Each undo action has a 30-second timeout
- After timeout, action is automatically removed from queue
- Manual dismissal also removes the action

## User Experience
1. User performs a delete/edit action
2. System shows success notification with undo option
3. User has 30 seconds to click "Undo" or notification disappears
4. If undone, system restores previous state
5. If not undone within 30 seconds, action becomes permanent