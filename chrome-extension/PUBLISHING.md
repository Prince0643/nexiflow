# Publishing to the Chrome Web Store

This guide is specific to this repo’s `chrome-extension/` folder and the Chrome Web Store Developer Dashboard flow.

## 0) Preflight (before packaging)

- Confirm the extension works when loaded unpacked:
  - Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `chrome-extension/`
- Verify the Store Listing text matches real behavior:
  - This extension tracks time and can **optionally capture screenshots** for proof-of-work.
- Review permissions and keep them minimal:
  - If you remove a feature, remove the associated permissions too.

## 1) Prepare the ZIP (upload artifact)

From the repo root:

```sh
node scripts/validate-chrome-extension.mjs
./scripts/package-chrome-extension.sh
```

This produces `build/chrome-extension/nexiflow-time-tracker.zip`.

Requirements:

- The ZIP must contain `manifest.json` at the ZIP root (not inside an extra folder).
- Do not upload `chrome-extension.crx` or `chrome-extension.pem` (those are not for Web Store submission).

## 2) Create/Access your Developer account

- Go to the Chrome Web Store Developer Dashboard and register as a developer (one-time fee).
- In the dashboard **Account** page, set:
  - **Publisher name**
  - **Support email** (and enable important notifications)

## 3) Create a new item

In the Chrome Web Store Developer Dashboard:

- Click **Add new item**
- Upload `build/chrome-extension/nexiflow-time-tracker.zip`

Then complete the left-hand tabs:

- **Store Listing**
  - Name, short description, detailed description
  - At least one screenshot (recommend 1280×800)
  - Support email + website URL
  - Privacy Policy URL (publish `chrome-extension/PRIVACY_POLICY.md` at a public URL)
- **Privacy** (most common source of review issues)
  - Single purpose (recommended wording): “Track time against NexiFlow projects and optionally capture screenshots for proof-of-work.”
  - Be explicit that screenshots are **optional** and only captured while tracking is running and the user enabled the toggle.
  - Accurately disclose data handling (auth/session, time logs, and optional screenshots are sent to `https://nexi-flow.com/`).
- **Distribution**
  - Choose free/paid, countries/regions, and visibility (Public/Unlisted/Private)
- **Test instructions**
  - Only if reviewers need special steps (e.g., test account, feature flags, or non-obvious flows)

## 4) Choose visibility

- **Unlisted**: install via a private link (recommended for internal/beta)
- **Public**: discoverable and searchable
- **Private**: restricted to an organization (Google Workspace)

## 5) Submit for review

- Click **Submit for review**.
- Consider **deferred publishing** so you can pick the exact release moment after approval.
- If rejected:
  - Fix the mismatch (usually: permission justification, privacy disclosures, or listing claims vs actual behavior)
  - Bump `version` in `chrome-extension/manifest.json`
  - Re-package and re-submit
