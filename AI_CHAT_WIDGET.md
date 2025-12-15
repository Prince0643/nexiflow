# AI-Only Chat Widget

This document explains the new AI-only chat widget that replaces the previous team messaging functionality.

## Features

1. **Pure AI Interaction**: Dedicated widget for interacting with an AI assistant
2. **No Team Messaging**: Removed all team-based messaging features
3. **Persistent Chat History**: Messages are stored in the widget session
4. **Resizable Interface**: Adjust the widget size to your preference
5. **Clear Chat Function**: Easily clear the conversation history

## How to Use

1. **Open the Widget**: Click on the AI icon (🤖) in the bottom right corner
2. **Type Your Question**: Enter your query in the text input at the bottom
3. **Send Message**: Press Enter or click the send button
4. **View Response**: The AI response will appear as a message from "AI Assistant"
5. **Continue Conversation**: Ask follow-up questions or start new topics

## Key Differences from Previous Implementation

### Removed Features
- Team-based messaging
- User mentions (@mentions)
- Message reactions
- Message editing/deletion
- Team selection
- Unread message counts

### Added Features
- Simplified interface focused solely on AI interaction
- Clear chat button to reset conversation
- Improved resizing functionality
- Dedicated AI styling

## Technical Implementation

### Component Structure
- **File**: `src/components/ai/AIChatWidget.tsx`
- **Dependencies**: Uses the existing `openaiService`
- **State Management**: Manages its own message history and UI state

### Data Model
```typescript
interface AIChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}
```

### Key Functions
1. `callOpenAI()` - Handles API calls to OpenAI service
2. `handleSendMessage()` - Processes user input and AI responses
3. `clearChat()` - Resets the conversation history

## UI Elements

1. **Toggle Button**: AI icon in bottom-right corner
2. **Main Widget**: Chat interface with message history
3. **Header**: Title and clear button
4. **Message Area**: Scrollable conversation display
5. **Input Area**: Text input with send button
6. **Resize Handle**: Drag to adjust widget height

## Storage

- Widget height is saved in localStorage as `aiChatWidgetHeight`
- Message history is kept in component state (not persisted between sessions)

## Styling

- Follows the same dark/light mode theming as the rest of the application
- Distinct styling for user vs AI messages
- Loading indicators during AI processing
- Responsive design for different screen sizes

## Usage Examples

```
User: How can I improve my time management?
AI Assistant: Here are some effective time management strategies:

1. Use the Pomodoro Technique (25-minute focused work sessions)
2. Prioritize tasks using the Eisenhower Matrix
3. Block time for deep work in your calendar
4. Minimize context switching between tasks
5. Review and adjust your schedule daily

Would you like me to elaborate on any of these techniques?
```

```
User: /ai What are the best practices for remote work?
AI Assistant: Here are key best practices for effective remote work:

1. Create a dedicated workspace
2. Maintain regular communication with your team
3. Use productivity tools and project management software
4. Set clear boundaries between work and personal time
5. Take regular breaks to avoid burnout
6. Over-communicate to ensure alignment
7. Establish a consistent daily routine

Would you like specific recommendations for any of these areas?
```