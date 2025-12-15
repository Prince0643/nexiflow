# OpenAI Integration Setup

To use the OpenAI features in the AI chat widget, you need to set up your OpenAI API key.

## Steps to Configure OpenAI API Key

1. **Get an OpenAI API Key**
   - Go to [OpenAI Platform](https://platform.openai.com/)
   - Sign up or log in to your account
   - Navigate to the API keys section
   - Create a new API key

2. **Configure Environment Variables**
   
   Vite will automatically load environment variables from `.env` files. Create a `.env` file in the root directory of your project with your API key:
   
   ```
   # OpenAI Configuration
   VITE_OPENAI_API_KEY=your_actual_api_key_here
   ```
   
   Replace `your_actual_api_key_here` with your actual OpenAI API key.

3. **Alternative: Use .env.local**
   
   If you prefer to use `.env.local` (which is gitignored), make sure it contains your API key:
   
   ```
   # OpenAI Configuration
   VITE_OPENAI_API_KEY=your_actual_api_key_here
   ```

4. **Restart Development Server**
   - If your development server is running, stop it and restart it to load the new environment variables:
   ```
   npm run dev
   ```

## Verifying Configuration

The application will show an error message in the AI chat widget if the OpenAI API key is not configured properly. You can also check the browser console for debugging information.

## Security Note

The current implementation uses `dangerouslyAllowBrowser: true` which exposes your API key in the browser. This is only suitable for development purposes. For production, you should:

1. Create a backend proxy endpoint that calls the OpenAI API
2. Remove `dangerouslyAllowBrowser: true` from the OpenAI configuration
3. Call your backend endpoint instead of the OpenAI API directly

## Using AI in Chat

Once configured, you can use AI in the chat widget by:
1. Opening the AI chat widget (click the AI icon in the bottom right)
2. Typing your question in the input field
3. Pressing Enter or clicking the send button
4. The AI response will appear in the chat as a message from "AI Assistant"