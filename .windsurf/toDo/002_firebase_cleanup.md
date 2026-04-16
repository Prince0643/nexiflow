# Firebase Cleanup TODO List

## ✅ Completed

### Services Cleaned (Firebase Removed)
- [x] `taskService.ts` - Now uses `taskApiService`
- [x] `timeEntryService.ts` - Now uses `timeEntryApiService`
- [x] `projectService.ts` - Now uses `projectApiService`
- [x] `companyService.ts` - Now uses HTTP APIs
- [x] `teamService.ts` - Now uses `teamApiService`

### Files Deleted
- [x] `mysqlProjectService.ts` - Legacy direct MySQL connection
- [x] `mysqlCompanyService.ts` - Legacy direct MySQL connection
- [x] `mysqlTaskService.ts` - Legacy direct MySQL connection
- [x] `mysqlTimeEntryService.ts` - Legacy direct MySQL connection
- [x] `mysqlUserService.ts` - Legacy direct MySQL connection
- [x] `loggingService.ts` - Unused Firebase service
- [x] `projectManagementService.ts` - Unused Firebase service

## ⏳ Remaining Tasks

### High Priority
- [ ] Delete `Settings_temp.tsx` if it's a temp/backup file
- [ ] Delete `src/config/firebase.ts` - Only after ALL imports removed
- [ ] Remove Firebase imports from `NotificationContext.tsx`

### Low Priority
- [ ] Delete `functions/` directory (Firebase Functions)
- [ ] Remove Firebase dependencies from `package.json`:
  - `firebase`
  - `@firebase/auth`
  - `@firebase/database`
  - `@firebase/firestore`
  - `@firebase/storage`

## Verification Commands

Check for remaining Firebase imports:
```bash
grep -r "from.*firebase\|import.*firebase" src/ --include="*.ts" --include="*.tsx"
```

Check for config/firebase imports:
```bash
grep -r "from.*config/firebase\|import.*config/firebase" src/ --include="*.ts" --include="*.tsx"
```

## Notes

- `mysqlLoggingService.ts` and `mysqlTeamService.ts` are still used
- `reportsService.ts` is already commented out (inactive)
- All main CRUD services now use HTTP APIs instead of Firebase
