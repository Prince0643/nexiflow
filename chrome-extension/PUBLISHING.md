# Publishing to the Chrome Web Store

## 1) Prepare the ZIP

From the repo root:

```sh
cd chrome-extension
zip -r nexi-flow-time-tracker.zip . -x \"*.DS_Store\" -x \"*/node_modules/*\"
```

The ZIP must contain `manifest.json` at the ZIP root (not inside an extra folder).

## 2) Create/Access your Developer account

- Go to the Chrome Web Store Developer Dashboard and register as a developer (one-time fee).

## 3) Create a new item

- Upload `nexi-flow-time-tracker.zip`
- Fill in:
  - Name, short description, detailed description
  - At least one screenshot (recommended: 1280×800)
  - Support email + website URL
  - Privacy Policy URL (publish `PRIVACY_POLICY.md` at a public URL)
  - Data usage disclosures (screenshots are sensitive; be explicit)

## 4) Choose visibility

- **Unlisted**: install via a private link (recommended for internal/beta)
- **Public**: discoverable and searchable
- **Private**: restricted to an organization (Google Workspace)

## 5) Submit for review

- Fix any permission or disclosure feedback from the review team.
- For updates, bump `version` in `manifest.json` and upload a new ZIP.

