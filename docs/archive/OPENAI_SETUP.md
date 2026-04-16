# OpenAI Integration Setup

The AI chat widget now uses a backend proxy (`POST /api/ai/chat`). Your OpenAI key must be configured on the server only.

## Steps to Configure OpenAI

1. **Create an OpenAI API Key**
   - Go to [OpenAI Platform](https://platform.openai.com/)
   - Create a new API key

2. **Set backend environment variables**
   - In your backend `.env` (or deployment secrets), set:
   ```bash
   OPENAI_API_KEY=your_actual_api_key_here
   OPENAI_MODEL=gpt-4o-mini
   ```
   - `OPENAI_MODEL` is optional; defaults to `gpt-4o-mini`.

3. **Restart backend**
   - Restart the API service so it picks up the new environment values.

## Verification

1. Log in to the app and open the AI chat widget.
2. Send a message.
3. Confirm responses are returned from your backend route (`/api/ai/chat`).
4. Confirm the browser is not sending requests directly to `api.openai.com`.

## Security Notes

- Do **not** put OpenAI keys in `VITE_*` variables.
- Do **not** expose keys in frontend bundles.
- All OpenAI traffic should flow through your authenticated backend route.
