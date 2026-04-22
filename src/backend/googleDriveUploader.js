const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

const getEnv = (key) => {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : null;
};

export async function getAdminDriveAccessToken() {
  const clientId = getEnv('GOOGLE_DRIVE_CLIENT_ID');
  const clientSecret = getEnv('GOOGLE_DRIVE_CLIENT_SECRET');
  const refreshToken = getEnv('GOOGLE_DRIVE_REFRESH_TOKEN');

  if (!clientId || !clientSecret || !refreshToken) return null;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google token refresh failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  return json.access_token || null;
}

export async function getOrCreateFolderId(accessToken, folderName) {
  const q = `name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const search = await fetch(`${DRIVE_FILES_URL}?q=${encodeURIComponent(q)}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!search.ok) {
    const text = await search.text().catch(() => '');
    throw new Error(`Drive folder search failed (${search.status}): ${text}`);
  }

  const searchJson = await search.json();
  const existing = searchJson?.files?.[0];
  if (existing?.id) return existing.id;

  const create = await fetch(DRIVE_FILES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!create.ok) {
    const text = await create.text().catch(() => '');
    throw new Error(`Drive folder create failed (${create.status}): ${text}`);
  }

  const created = await create.json();
  return created.id;
}

export async function uploadJpegToDrive(accessToken, { buffer, filename, folderId, description }) {
  const fileMetadata = {
    name: filename,
    parents: folderId ? [folderId] : undefined,
    description: description || undefined,
  };

  const boundary = '-------nexiflow-boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const multipartHeader =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(fileMetadata) +
    delimiter +
    'Content-Type: image/jpeg\r\n\r\n';

  const body = Buffer.concat([
    Buffer.from(multipartHeader, 'utf8'),
    buffer,
    Buffer.from(closeDelim, 'utf8'),
  ]);

  const res = await fetch(`${DRIVE_UPLOAD_URL}&fields=id,name,webViewLink`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Drive upload failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  return {
    fileId: json.id,
    filename: json.name,
    webViewLink: json.webViewLink,
  };
}

