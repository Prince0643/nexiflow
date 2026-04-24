# NexiFlow Time Tracker — Chrome Web Store Listing Copy

Use this as copy/paste text when creating the Chrome Web Store listing.

## Single purpose (Privacy tab)

Track time against NexiFlow projects and optionally capture screenshots for proof-of-work.

## Short description

Track time for NexiFlow projects and optionally capture screenshots for proof-of-work.

## Detailed description

NexiFlow Time Tracker helps you log work time directly to NexiFlow.

- Log in to NexiFlow from the extension
- Select a client and project, add a description, and start/stop tracking
- Optional: enable screenshot capture while tracking is running for proof-of-work
- Your data is sent to NexiFlow to create time logs (and screenshots only if enabled)

## Permission/feature mapping (for reviewer context)

- `storage`: keep login session and timer state
- `alarms`: schedule periodic background events while tracking
- `desktopCapture` + `offscreen`: capture screenshots when the user enables the screenshot toggle
- `tabs` + `activeTab`: capture the active/visible tab when needed as part of screenshot capture flow
- Host permissions: `https://nexi-flow.com/*` to communicate with the NexiFlow API

