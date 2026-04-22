/* global chrome */

const DEFAULT_API_BASE = 'https://nexi-flow.com/api';

const storageGet = (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve));
const storageSet = (obj) => new Promise((resolve) => chrome.storage.local.set(obj, resolve));

const getState = async () => {
  const { auth, timer, capture, config } = await storageGet(['auth', 'timer', 'capture', 'config']);
  return {
    auth: auth || null,
    timer:
      timer || {
        isRunning: false,
        screenshotsEnabled: false,
        draftClientId: '',
        draftProjectId: '',
        draftDescription: '',
      },
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
    reasons: ['DISPLAY_MEDIA'],
    justification: 'Capture screenshots for proof-of-work',
  });
};

const offscreenSend = (message) =>
  new Promise((resolve) => {
    chrome.runtime.sendMessage({ ...message, _to: 'offscreen' }, (resp) => {
      const err = chrome.runtime.lastError;
      if (err) {
        console.error('[sw] offscreen sendMessage lastError:', err);
        resolve({ ok: false, error: err.message || String(err) });
        return;
      }
      resolve(resp);
    });
  });

const captureVisibleTabBase64 = async () => {
  const dataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: 'jpeg', quality: 82 });
  const base64 = String(dataUrl).split(',')[1];
  if (!base64) throw new Error('Failed to capture visible tab');
  return base64;
};

const METADATA_CACHE_KEY = 'metadata_cache_v1';
const METADATA_TTL_MS = 5 * 60 * 1000;

const getMetadataCache = async () => {
  const { [METADATA_CACHE_KEY]: cache } = await storageGet([METADATA_CACHE_KEY]);
  return cache || null;
};

const setMetadataCache = async (cache) => {
  await storageSet({ [METADATA_CACHE_KEY]: cache });
};

const fetchAllProjects = async (apiBase, token) => {
  const all = [];
  let offset = 0;
  const limit = 100;
  let count = null;

  // Cap to avoid runaway loops in huge orgs.
  for (let i = 0; i < 10; i += 1) {
    const res = await apiFetch(
      apiBase,
      `/projects?archived=0&limit=${limit}&offset=${offset}`,
      { token }
    );
    if (!res.ok) throw new Error(res.data?.error || 'Failed to fetch projects');
    const batch = Array.isArray(res.data?.data) ? res.data.data : [];
    for (const p of batch) {
      all.push({
        id: p.id,
        name: p.name,
        clientId: p.clientId || null,
        isArchived: !!p.isArchived,
      });
    }
    if (typeof res.data?.count === 'number') count = res.data.count;
    offset += batch.length;
    if (!batch.length) break;
    if (count !== null && offset >= count) break;
    if (batch.length < limit) break;
  }

  return all;
};

const fetchClients = async (apiBase, token) => {
  const res = await apiFetch(apiBase, `/clients`, { token });
  if (!res.ok) throw new Error(res.data?.error || 'Failed to fetch clients');
  const clients = Array.isArray(res.data?.data) ? res.data.data : [];
  return clients.map((c) => ({ id: c.id, name: c.name }));
};

const getMetadata = async () => {
  const state = await getState();
  const token = state.auth?.token;
  if (!token) return { ok: false, error: 'Not logged in' };

  const apiBase = state.config.apiBase || DEFAULT_API_BASE;
  const cache = await getMetadataCache();
  const now = Date.now();
  if (cache?.fetchedAt && now - cache.fetchedAt < METADATA_TTL_MS) {
    return { ok: true, clients: cache.clients || [], projects: cache.projects || [] };
  }

  const [clients, projects] = await Promise.all([
    fetchClients(apiBase, token),
    fetchAllProjects(apiBase, token),
  ]);

  await setMetadataCache({ fetchedAt: now, clients, projects });
  return { ok: true, clients, projects };
};

const syncTimerWithServer = async () => {
  const state = await getState();
  const token = state.auth?.token;
  const userId = state.auth?.userId;
  if (!token || !userId) return { ok: false, error: 'Not logged in' };

  const apiBase = state.config.apiBase || DEFAULT_API_BASE;
  const res = await apiFetch(apiBase, `/time-entries/user/${encodeURIComponent(userId)}/running`, { token });
  if (!res.ok) return { ok: false, error: res.data?.error || 'Failed to fetch running time entry' };

  const running = res.data?.data || null;
  if (!running) {
    if (state.timer?.isRunning) {
      chrome.alarms.clear('nf_screenshot');
      await offscreenSend({ type: 'OFFSCREEN_STOP_STREAM' });
      await storageSet({
        timer: {
          isRunning: false,
          screenshotsEnabled: !!state.timer?.screenshotsEnabled,
          draftClientId: state.timer?.draftClientId || '',
          draftProjectId: state.timer?.draftProjectId || '',
          draftDescription: state.timer?.draftDescription || '',
        },
      });
    }
    return { ok: true, running: null };
  }

  const startMs = running.startTime ? new Date(running.startTime).getTime() : Date.now();
  const nextTimer = {
    ...(state.timer || {}),
    isRunning: true,
    timeEntryId: running.id,
    startTimeMs: Number.isFinite(startMs) ? startMs : Date.now(),
    draftClientId: running.clientId || state.timer?.draftClientId || '',
    draftProjectId: running.projectId || state.timer?.draftProjectId || '',
    draftDescription: running.description || state.timer?.draftDescription || '',
  };
  await storageSet({ timer: nextTimer });

  if (nextTimer.screenshotsEnabled) {
    chrome.alarms.create('nf_screenshot', { periodInMinutes: 5 });
  }

  return { ok: true, running };
};

const startTimer = async () => {
  const state = await getState();
  const token = state.auth?.token;
  if (!token) return { ok: false, error: 'Not logged in' };

  // If the user already has a running entry (started from web/app), don't create a new one.
  const sync = await syncTimerWithServer();
  if (sync.ok && sync.running?.id) {
    return { ok: true, reused: true };
  }

  const apiBase = state.config.apiBase || DEFAULT_API_BASE;
  const startTime = new Date();
  const res = await apiFetch(apiBase, '/time-entries', {
    token,
    method: 'POST',
    body: {
      description: '',
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
    // Draft metadata must be filled before stopping.
    draftClientId: '',
    draftProjectId: '',
    draftDescription: '',
    screenshotsEnabled: !!state.timer?.screenshotsEnabled,
  };
  await storageSet({ timer });

  if (timer.screenshotsEnabled) {
    await ensureOffscreen();
    chrome.alarms.create('nf_screenshot', { periodInMinutes: 5 });
  }

  return { ok: true };
};

const stopTimer = async ({ draft } = {}) => {
  const state = await getState();
  const token = state.auth?.token;
  if (!token) return { ok: false, error: 'Not logged in' };
  if (!state.timer?.isRunning || !state.timer?.timeEntryId) return { ok: false, error: 'Not running' };

  const draftClientId = String(draft?.clientId || state.timer?.draftClientId || '').trim();
  const draftProjectId = String(draft?.projectId || state.timer?.draftProjectId || '').trim();
  const draftDescription = String(draft?.description || state.timer?.draftDescription || '').trim();
  if (!draftClientId || !draftProjectId || !draftDescription) {
    return { ok: false, error: 'Client, project, and description are required before stopping.' };
  }

  chrome.alarms.clear('nf_screenshot');
  await offscreenSend({ type: 'OFFSCREEN_STOP_STREAM' });
  await storageSet({ capture: { streamActive: false } });

  const apiBase = state.config.apiBase || DEFAULT_API_BASE;

  // Save metadata to the running entry before stopping so the web app doesn't show "No project/client".
  const updateRes = await apiFetch(apiBase, `/time-entries/${state.timer.timeEntryId}`, {
    token,
    method: 'PUT',
    body: { projectId: draftProjectId, description: draftDescription },
  });
  if (!updateRes.ok) return { ok: false, error: updateRes.data?.error || 'Failed to update time entry before stop' };

  const res = await apiFetch(apiBase, `/time-entries/${state.timer.timeEntryId}/stop`, {
    token,
    method: 'POST',
  });
  if (!res.ok) return { ok: false, error: res.data?.error || 'Failed to stop time entry' };

  await storageSet({
    timer: {
      ...(state.timer || {}),
      isRunning: false,
      screenshotsEnabled: !!state.timer?.screenshotsEnabled,
      draftClientId,
      draftProjectId,
      draftDescription,
    },
  });
  return { ok: true };
};

const captureAndUpload = async ({ reason = 'alarm' } = {}) => {
  const state = await getState();
  const token = state.auth?.token;
  if (!token) return { ok: false, error: 'Not logged in' };
  if (!state.timer?.isRunning) return { ok: false, error: 'Timer not running' };
  const useScreen = !!state.capture?.streamActive;

  let imageBase64 = null;
  if (useScreen) {
    await ensureOffscreen();
    const capture = await offscreenSend({ type: 'OFFSCREEN_CAPTURE' });
    if (!capture?.ok) return { ok: false, error: capture?.error || 'Capture failed' };
    imageBase64 = capture.base64;
  } else {
    // Fallback: capture active tab without a display-media stream (more reliable on macOS).
    try {
      imageBase64 = await captureVisibleTabBase64();
    } catch (e) {
      return { ok: false, error: e?.message || 'Failed to capture visible tab' };
    }
  }

  const apiBase = state.config.apiBase || DEFAULT_API_BASE;
  const nowIso = new Date().toISOString();

  const meta = await getMetadataCache();
  const clients = Array.isArray(meta?.clients) ? meta.clients : [];
  const projects = Array.isArray(meta?.projects) ? meta.projects : [];
  const client = clients.find((c) => c.id === state.timer?.draftClientId) || null;
  const project = projects.find((p) => p.id === state.timer?.draftProjectId) || null;

  const titleParts = [
    client?.name || '',
    project?.name || '',
    (state.timer?.draftDescription || '').trim(),
  ].filter(Boolean);
  const projectNameForUpload = titleParts.join(' - ');

  const durationSeconds = state.timer?.startTimeMs ? Math.floor((Date.now() - state.timer.startTimeMs) / 1000) : '';
  const payload = {
    companyId: state.auth.companyId,
    userId: state.auth.userId,
    imageBase64,
    projectName: projectNameForUpload,
    duration: durationSeconds,
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
        case 'NF_SYNC': {
          sendResponse(await syncTimerWithServer());
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
            timer: {
              isRunning: false,
              screenshotsEnabled: false,
              draftClientId: '',
              draftProjectId: '',
              draftDescription: '',
            },
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
          // If timer running, schedule/clear. Capture may be screen or tab fallback.
          if (state.timer?.isRunning && enabled) {
            chrome.alarms.create('nf_screenshot', { periodInMinutes: 5 });
          } else {
            chrome.alarms.clear('nf_screenshot');
          }
          sendResponse({ ok: true });
          return;
        }
        case 'NF_SET_DRAFT_METADATA': {
          const state = await getState();
          const clientId = String(msg?.draft?.clientId || '').trim();
          const projectId = String(msg?.draft?.projectId || '').trim();
          const description = String(msg?.draft?.description || '').trim();
          await storageSet({
            timer: {
              ...(state.timer || {}),
              draftClientId: clientId,
              draftProjectId: projectId,
              draftDescription: description,
            },
          });
          sendResponse({ ok: true });
          return;
        }
        case 'NF_GET_METADATA': {
          const res = await getMetadata().catch((e) => ({ ok: false, error: e?.message || 'Failed to load metadata' }));
          if (!res?.ok) {
            console.error('[sw] NF_GET_METADATA failed:', res?.error || res);
            sendResponse({ clients: [], projects: [], error: res?.error || 'Failed to load metadata' });
            return;
          }
          sendResponse({ clients: res.clients || [], projects: res.projects || [] });
          return;
        }
        case 'NF_GRANT_SCREEN': {
          await ensureOffscreen();
          const res = await offscreenSend({ type: 'OFFSCREEN_START_STREAM', streamId: msg.streamId });
          if (!res?.ok) {
            console.error('[sw] OFFSCREEN_START_STREAM failed:', JSON.stringify(res));
            await storageSet({ capture: { streamActive: false } });
            sendResponse({
              ok: false,
              error:
                res?.error ||
                'Failed to start screen stream. You can still capture screenshots via active-tab capture.',
            });
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
          sendResponse(await startTimer());
          return;
        }
        case 'NF_STOP': {
          sendResponse(await stopTimer({ draft: msg?.draft }));
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
