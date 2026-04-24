# NexiFlow Time Tracker — Privacy Policy

Last updated: 2026-04-24

This privacy policy describes how the NexiFlow Time Tracker Chrome extension (the “Extension”) handles data. This document is intended to be published at a public URL for Chrome Web Store listing purposes.

## What the Extension does

- Lets users log in to NexiFlow and track time against a selected client/project with a description.
- Optionally captures periodic screenshots for proof-of-work when the user enables the screenshot toggle.

## Data the Extension collects and processes

- **Account and session data:** The Extension stores authentication/session data locally in Chrome extension storage to keep the user signed in, and sends authentication information to the NexiFlow API to perform authorized actions.
- **Work tracking inputs:** Client, project, and description values entered/selected in the popup are stored locally and sent to the NexiFlow API when starting/stopping tracking.
- **Optional screenshots:** If the user enables screenshots, the Extension captures images and uploads them to the NexiFlow API for proof-of-work.
- **Technical data:** Basic request metadata (for example timestamps and request headers required for HTTPS communication) is processed as part of normal API communication.

## How screenshots work

- Screenshots are captured **only when** the user has enabled screenshot capture and tracking is running.
- If screen permission is not granted, the Extension captures the **visible/active tab** only.
- Screenshots are uploaded to NexiFlow for proof-of-work and are not used for advertising.

## What the Extension does not do

- The Extension does not sell user data.
- The Extension does not use data for personalized advertising.

## Data storage

- **Local:** The Extension stores necessary state in Chrome’s extension storage (e.g., auth/session, timer state, user selections).
- **Server:** Data sent to NexiFlow (time logs and optional screenshots) is stored according to NexiFlow’s server-side retention and access controls.

## Data sharing

- Data is shared only with the NexiFlow backend service to provide the time tracking and screenshot functionality.

## User controls

- Users can stop tracking at any time.
- Users can disable screenshot capture at any time by turning off the screenshot toggle.
- Users can log out, which removes the local session from the Extension.

## Security

- The Extension communicates with NexiFlow over HTTPS.

## Contact

- For privacy questions or data requests, contact: support@nexi-flow.com
