# Backend APIs Needed for Team CRUD

## Current Status

Team **member management** is fully functional via MySQL APIs:
- ✅ `GET /api/teams/:teamId/members` - List members
- ✅ `POST /api/teams/:teamId/members` - Add member
- ✅ `PUT /api/teams/:teamId/members/:memberId` - Update role
- ✅ `DELETE /api/teams/:teamId/members/:memberId` - Remove member
- ✅ `GET /api/teams/:teamId/stats` - Team statistics

## Missing APIs for Full Team CRUD

### 1. Create Team
```
POST /api/teams
Body: {
  name: string
  description?: string
  color?: string
  leaderId: string
  companyId?: string
}
Response: { success: boolean, data: { id: string, ... } }
```

### 2. Get Team by ID
```
GET /api/teams/:teamId
Response: { success: boolean, data: Team }
```

### 3. Update Team
```
PUT /api/teams/:teamId
Body: {
  name?: string
  description?: string
  color?: string
  leaderId?: string
}
Response: { success: boolean, message?: string }
```

### 4. Delete/Archive Team
```
DELETE /api/teams/:teamId
Response: { success: boolean, message?: string }
```

### 5. Get User's Teams
```
GET /api/users/:userId/teams
Response: { success: boolean, data: Team[], count: number }
```

## Frontend Impact

Currently these functions in `teamService.ts` throw errors:
- `createTeam()` - Cannot create new teams
- `getTeamById()` - Always returns null
- `updateTeam()` - Cannot edit team details
- `deleteTeam()` - Cannot delete teams
- `getUserTeams()` - Cannot list user's teams

## Priority

**Medium** - Team member management works, but team creation/editing is blocked.

## Files to Update After Backend is Ready

1. `/src/services/teamService.ts` - Remove TODOs and implement actual API calls
2. `/src/pages/Teams.tsx` - May need updates for team creation UI
3. `/src/components/teams/TeamModal.tsx` - Enable team editing features
