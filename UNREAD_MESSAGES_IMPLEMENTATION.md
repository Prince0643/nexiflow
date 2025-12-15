# Unread Messages Implementation

## Overview

This document describes the implementation of the unread messages functionality for the team messaging system. The implementation provides real-time tracking of unread messages per team and visual indicators in the UI.

## Implementation Details

### 1. Data Structure Changes

#### Added to types/index.ts:
- `unreadCount` field to the [Team](file:///c:/Users/CH/from_Kingston/assist@nexistry/Clockistry/src/types/index.ts#L477-L491) interface
- New [LastReadTimestamp](file:///c:/Users/CH/from_Kingston/assist@nexistry/Clockistry/src/types/index.ts#L494-L498) interface for tracking when users last read messages

### 2. Service Layer (messagingService.ts)

Added three new functions:

#### getUnreadMessageCount(teamId: string, userId: string): Promise<number>
- Retrieves the count of unread messages for a specific team and user
- Compares message timestamps with the user's last read timestamp
- Excludes messages sent by the current user

#### markMessagesAsRead(teamId: string, userId: string): Promise<void>
- Updates the last read timestamp for a user in a specific team
- Called when a user switches to a team chat
- Uses the `userReadTimestamps` path in Firebase which has the correct permissions

#### subscribeToUnreadCounts(teamIds: string[], userId: string, callback: (unreadCounts: {[teamId: string]: number}) => void): () => void
- Real-time listener for unread message counts across all teams
- Updates counts as new messages arrive
- Returns unsubscribe function

### 3. Context Layer (MessagingContext.tsx)

#### Added State:
- `unreadCounts`: Object mapping team IDs to unread message counts

#### Added Functions:
- `markMessagesAsRead`: Wrapper function for the service method
- `refreshUnreadCounts`: Function to manually refresh unread counts

#### Added Effects:
- Subscription to unread counts when teams load

### 4. UI Layer (Messaging.tsx)

#### Visual Indicators:
- Badge with unread count on team avatars in the sidebar
- Additional badge next to team member counts
- Counts capped at 9+ for better UI

#### Behavior:
- Automatically marks messages as read when switching teams
- Automatically marks messages as read when they are displayed to the user
- Real-time updates of unread counts as new messages arrive
- Proper synchronization between marking as read and updating UI

## Firebase Data Structure

### Using Existing Nodes:
```
userReadTimestamps/
  {userId}/
    {teamId}: {
      userId: string,
      teamId: string,
      timestamp: ISOString
    }
```

The implementation uses the existing `userReadTimestamps` path in Firebase which already has the correct permissions set up for users to read and write only their own data.

## Permissions and Security

The implementation respects Firebase security rules by:
1. Using the existing `userReadTimestamps` path which has proper permissions
2. Ensuring users can only read/write their own read timestamps
3. Following the principle of least privilege
4. Gracefully handling permission errors without crashing the application

### Firebase Rules Update

The Firebase rules were updated to ensure proper permissions for the `userReadTimestamps` path:

```json
"userReadTimestamps": {
  "$userId": {
    "$teamId": {
      ".read": "auth != null && $userId === auth.uid",
      ".write": "auth != null && $userId === auth.uid"
    }
  }
}
```

These rules ensure that:
- Only authenticated users can read/write data
- Users can only access their own read timestamps
- Each user can only modify their own data for each team

## Error Handling

The implementation includes proper error handling for permission issues:
- Permission errors are caught and logged rather than thrown
- The application continues to function even if there are permission issues
- Users are not blocked from using the messaging system even if unread count tracking fails

## Read Status Tracking

Messages are marked as read in multiple scenarios:
1. **When switching teams**: When a user selects a different team, messages in the newly selected team are marked as read
2. **When viewing messages**: When messages are loaded and displayed to the user, they are automatically marked as read
3. **When receiving new messages**: If new messages arrive while viewing a team, they can be marked as read

### Synchronization
- After marking messages as read, the unread counts are immediately refreshed
- Proper timing delays ensure messages are rendered before marking as read
- Real-time listeners update unread counts as new messages arrive

## Performance Considerations

1. **Efficient Queries**: Uses Firebase's `orderByChild` and `equalTo` for efficient message filtering
2. **Real-time Updates**: Leverages Firebase listeners for instant updates
3. **Minimal Data Transfer**: Only transfers necessary timestamp data
4. **Client-side Calculation**: Reduces server load by calculating counts on the client
5. **Prevention of Duplicate Operations**: Uses a ref flag to prevent marking messages as read multiple times
6. **Optimized Refresh**: Manual refresh function for immediate updates when needed

## Edge Cases Handled

1. **User's Own Messages**: Messages sent by the current user are not counted as unread
2. **No Previous Reads**: If no last read timestamp exists, all messages are considered unread
3. **Team Switching**: Automatically marks messages as read when switching teams
4. **Real-time Updates**: Updates unread counts in real-time as new messages arrive
5. **Permission Errors**: Gracefully handles permission errors without crashing the application
6. **Duplicate Read Operations**: Prevents marking messages as read multiple times using a ref flag
7. **Timing Issues**: Uses delays and proper synchronization to ensure accurate read status
8. **Network Latency**: Handles potential delays in Firebase operations

## Future Improvements

1. **Local Storage Caching**: Cache last read timestamps in local storage for offline support
2. **Batch Updates**: Batch timestamp updates to reduce Firebase calls
3. **Notification Integration**: Integrate with notification system for unread message alerts
4. **Advanced Filtering**: Add filters for mentions, keywords, etc.
5. **Read Receipts**: Show which users have read specific messages
6. **Message Persistence**: Improve offline message handling and synchronization