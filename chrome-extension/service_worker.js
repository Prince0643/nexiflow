/* global chrome */

const DEFAULT_API_BASE = 'https://nexi-flow.com/api';

const storageGet = (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve));
const storageSet = (obj) => new Promise((resolve) => chrome.storage.local.set(obj, resolve));

const getState = async () => {
  const { auth, timer, capture, config } = await storageGet(['auth', 'timer', 'capture', 'config']);
  return {
    auth: auth || null,
    timer: timer || { isRunning: false, screenshotsEnabled: false },
    capture: capture || { streamActive: false },
    config: config || { apiBase: DEFAULT_API_BASE },
  };
};

const setConfigApiBase = async (apiBase) => {
  await storageSet({ config: { apiBase: apiBase || DEFAULT_API_BASE } });
};

const apiFetch = async (apiBase, path, { token, method = 'GET', body } = {}) => {
  const url = `${apiBase.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
};

const ensureOffscreen = async () => {
  const exists = await chrome.offscreen.hasDocument?.();
  if (exists) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Capture screenshots for proof-of-work',
  });
};

const offscreenSend = (message) =>
  new Promise((resolve) => chrome.runtime.sendMessage({ ...message, _to: 'offscreen' }, resolve));

const startTimer = async ({ projectName }) => {
  const state = await getState();
  const token = state.auth?.token;
  if (!token) return { ok: false, error: 'Not logged in' };

  const apiBase = state.config.apiBase || DEFAULT_API_BASE;
  const startTime = new Date();
  const res = await apiFetch(apiBase, '/time-entries', {
    token,
    method: 'POST',
    body: {
      description: projectName || '',
      startTime,
      duration: 0,
      tags: [],
    },
  });

  if (!res.ok) return { ok: false, error: res.data?.error || 'Failed to create time entry' };
  const finalId =
    res.data?.data?.id ||
    res.data?.data?.data?.id ||
    res.data?.id ||
    null;
  if (!finalId) return { ok: false, error: 'Time entry created but id missing (unexpected API response)' };

  const timer = {
    isRunning: true,
    timeEntryId: finalId,
    startTimeMs: Date.now(),
    projectName: projectName || '',
    screenshotsEnabled: !!state.timer?.screenshotsEnabled,
  };
  await storageSet({ timer });

  if (timer.screenshotsEnabled) {
    await ensureOffscreen();
    // Only schedule if stream is active; otherwise popup will prompt user to grant.
    if (state.capture?.streamActive) {
      chrome.alarms.create('nf_screenshot', { periodInMinutes: 5 });
    }
  }

  return { ok: true };
};

const stopTimer = async () => {
  const state = await getState();
  const token = state.auth?.token;
  if (!token) return { ok: false, error: 'Not logged in' };
  if (!state.timer?.isRunning || !state.timer?.timeEntryId) return { ok: false, error: 'Not running' };

  chrome.alarms.clear('nf_screenshot');
  await offscreenSend({ type: 'OFFSCREEN_STOP_STREAM' });
  await storageSet({ capture: { streamActive: false } });

  const apiBase = state.config.apiBase || DEFAULT_API_BASE;
  const res = await apiFetch(apiBase, `/time-entries/${state.timer.timeEntryId}/stop`, {
    token,
    method: 'POST',
  });
  if (!res.ok) return { ok: false, error: res.data?.error || 'Failed to stop time entry' };

  await storageSet({ timer: { isRunning: false, screenshotsEnabled: !!state.timer?.screenshotsEnabled } });
  return { ok: true };
};

const captureAndUpload = async ({ reason = 'alarm' } = {}) => {
  const state = await getState();
  const token = state.auth?.token;
  if (!token) return { ok: false, error: 'Not logged in' };
  if (!state.timer?.isRunning) return { ok: false, error: 'Timer not running' };
  if (!state.capture?.streamActive) return { ok: false, error: 'Screen permission not granted' };

  await ensureOffscreen();
  const capture = await offscreenSend({ type: 'OFFSCREEN_CAPTURE' });
  if (!capture?.ok) return { ok: false, error: capture?.error || 'Capture failed' };

  const apiBase = state.config.apiBase || DEFAULT_API_BASE;
  const nowIso = new Date().toISOString();
  const payload = {
    companyId: state.auth.companyId,
    userId: state.auth.userId,
    imageBase64: capture.base64,
    projectName: state.timer.projectName || '',
    duration: '',
    timestamp: nowIso,
    reason,
  };

  const upload = await apiFetch(apiBase, '/screenshots', {
    token,
    method: 'POST',
    body: payload,
  });

  if (!upload.ok) return { ok: false, error: upload.data?.error || 'Upload failed' };
  return { ok: true, filename: upload.data?.filename, webViewLink: upload.data?.webViewLink };
};

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'nf_screenshot') return;
  try {
    await captureAndUpload({ reason: 'alarm' });
  } catch (e) {
    // Best-effort; keep worker alive
    console.error('Alarm capture error:', e);
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?._to === 'offscreen') {
        // ignore (offscreen uses runtime messaging directly)
        return;
      }

      switch (msg?.type) {
        case 'NF_GET_STATE': {
          sendResponse(await getState());
          return;
        }
        case 'NF_LOGIN': {
          const apiBase = (msg.apiBase || DEFAULT_API_BASE).replace(/\/$/, '');
          await setConfigApiBase(apiBase);

          const res = await apiFetch(apiBase, '/auth/login', {
            method: 'POST',
            body: { email: msg.email, password: msg.password },
          });
          if (!res.ok) {
            sendResponse({ ok: false, error: res.data?.error || 'Login failed' });
            return;
          }

          const token = res.data?.token;
          const user = res.data?.user;
          const company = res.data?.company;
          if (!token || !user?.id) {
            sendResponse({ ok: false, error: 'Login succeeded but missing token/user' });
            return;
          }

          await storageSet({
            auth: {
              token,
              userId: user.id,
              companyId: user.companyId || null,
              role: user.role,
              name: user.name,
              email: user.email,
              companyName: company?.name || null,
            },
            timer: { isRunning: false, screenshotsEnabled: false },
            capture: { streamActive: false },
          });
          sendResponse({ ok: true });
          return;
        }
        case 'NF_LOGOUT': {
          chrome.alarms.clear('nf_screenshot');
          await offscreenSend({ type: 'OFFSCREEN_STOP_STREAM' });
          await storageSet({ auth: null, timer: { isRunning: false, screenshotsEnabled: false }, capture: { streamActive: false } });
          sendResponse({ ok: true });
          return;
        }
        case 'NF_SET_SCREENSHOTS_ENABLED': {
          const state = await getState();
          const enabled = !!msg.enabled;
          await storageSet({ timer: { ...(state.timer || {}), screenshotsEnabled: enabled } });
          // Schedule only if running and stream already active
          if (state.timer?.isRunning && enabled && state.capture?.streamActive) {
            chrome.alarms.create('nf_screenshot', { periodInMinutes: 5 });
          } else {
            chrome.alarms.clear('nf_screenshot');
          }
          sendResponse({ ok: true });
          return;
        }
        case 'NF_GRANT_SCREEN': {
          await ensureOffscreen();
          const res = await offscreenSend({ type: 'OFFSCREEN_START_STREAM', streamId: msg.streamId });
          if (!res?.ok) {
            await storageSet({ capture: { streamActive: false } });
            sendResponse({ ok: false, error: res?.error || 'Failed to start stream' });
            return;
          }
          await storageSet({ capture: { streamActive: true } });

          const state = await getState();
          if (state.timer?.isRunning && state.timer?.screenshotsEnabled) {
            chrome.alarms.create('nf_screenshot', { periodInMinutes: 5 });
          }
          sendResponse({ ok: true });
          return;
        }
        case 'NF_START': {
          sendResponse(await startTimer({ projectName: msg.projectName }));
          return;
        }
        case 'NF_STOP': {
          sendResponse(await stopTimer());
          return;
        }
        case 'NF_CAPTURE_NOW': {
          sendResponse(await captureAndUpload({ reason: 'manual' }));
          return;
        }
        default:
          sendResponse({ ok: false, error: 'Unknown message' });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e?.message || 'Unknown error' });
    }
  })();

  return true;
});
