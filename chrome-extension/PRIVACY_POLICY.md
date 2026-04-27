# NexiFlow Time Tracker — Privacy Policy

Last updated: 2026-04-24

This privacy policy describes how the NexiFlow Time Tracker Chrome extension (the “Extension”) handles data. This document is intended to be published at a public URL for Chrome Web Store listing purposes.

## What the Extension does

- Lets users log in to NexiFlow and track time against a selected client/project with a description.
- Optionally captures periodic screenshots for proof-of-work when the user enables the screenshot toggle.

## Data the Extension collects and processes

The Extension may collect and process the following categories of data, depending on the features you enable:

- **Personally identifiable information (PII):** Your account identifier (user ID), name, and email address as part of authentication and to associate time logs with your NexiFlow account.
- **Account and session data:** Authentication/session tokens stored locally in Chrome extension storage to keep you signed in, and sent to the NexiFlow API to perform authorized actions.
- **Work tracking inputs:** Client, project, and description values you enter/select in the extension UI; stored locally and sent to the NexiFlow API when starting/stopping tracking.
- **Optional screenshots (website content):** If you enable screenshots, the Extension captures images of your screen/tab and uploads them to the NexiFlow API as proof-of-work while tracking is active.
- **Basic technical metadata:** Request/response metadata required for HTTPS communication (for example timestamps, error logs, and network request headers).

The Extension does **not** collect health information, financial/payment card data, or personal communications content (such as email bodies or chat messages).

## How we use this data

- **Authentication/session:** To sign you in and keep you signed in to the Extension.
- **Time tracking:** To create, update, and submit time logs to your NexiFlow account.
- **Optional proof-of-work screenshots:** To capture and upload screenshots **only when enabled** so your organization can review proof-of-work (if your NexiFlow plan/workflow uses this feature).
- **Reliability and support:** To diagnose errors and improve stability (for example handling API errors, retries, and upload failures).

## How screenshots work

- Screenshots are captured **only when** the user has enabled screenshot capture and tracking is running.
- If screen permission is not granted, the Extension captures the **visible/active tab** only.
- Screenshots are uploaded to NexiFlow for proof-of-work and are not used for advertising.

## What the Extension does not do

- The Extension does not sell user data.
- The Extension does not use data for personalized advertising.
- The Extension does not collect or share data unrelated to time tracking and the optional screenshot feature.

## Data storage

- **Local:** The Extension stores necessary state in Chrome’s extension storage (e.g., auth/session, timer state, user selections).
- **Server:** Data sent to NexiFlow (time logs and optional screenshots) is stored according to NexiFlow’s server-side retention and access controls.

## Data retention

- **Local (in the Extension):** Authentication/session state and timer state remain in Chrome extension storage until you log out, clear the extension’s storage, or uninstall the Extension.
- **Server (NexiFlow API):** Time logs and (if enabled) screenshots are retained on NexiFlow servers so they can be displayed in the NexiFlow app and used for administrative review. Retention duration depends on your NexiFlow account and organization settings.

## Data sharing

- Data is shared only with the NexiFlow backend service to provide the time tracking and screenshot functionality.

We do not sell user data. We do not share user data with third parties for advertising.

## User controls

- Users can stop tracking at any time.
- Users can disable screenshot capture at any time by turning off the screenshot toggle.
- Users can log out, which removes the local session from the Extension.
- Users can uninstall the Extension to remove locally stored extension data.
- Users can request access to or deletion of server-stored data by contacting us (see Contact).

## Security

- The Extension communicates with NexiFlow over HTTPS.
- Authentication tokens are stored in Chrome extension storage and sent only to the NexiFlow API to authorize requests.

## Contact

- For privacy questions or data requests, contact: support@nexi-flow.com
