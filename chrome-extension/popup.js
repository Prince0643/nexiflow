/* global chrome */

const el = (id) => document.getElementById(id);

const statusPill = el('statusPill');
const loggedOut = el('loggedOut');
const loggedIn = el('loggedIn');

const emailInput = el('email');
const passwordInput = el('password');
const loginBtn = el('loginBtn');
const loginError = el('loginError');

const whoEl = el('who');
const companyEl = el('company');
const logoutBtn = el('logoutBtn');

const clientSelect = el('clientSelect');
const projectSelect = el('projectSelect');
const descriptionInput = el('description');
const screenshotsEnabled = el('screenshotsEnabled');
const grantBtn = el('grantBtn');
const startStopBtn = el('startStopBtn');
const timerLine = el('timerLine');
const actionMsg = el('actionMsg');

const defaultApiBase = 'https://nexi-flow.com/api';

const setPill = (type, text) => {
  statusPill.className = `pill pill-${type}`;
  statusPill.textContent = text;
};

const send = (msg) =>
  new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));

let cachedClients = [];
let cachedProjects = [];
let lastState = null;

const toArray = (maybeArray) => (Array.isArray(maybeArray) ? maybeArray : []);

const setSelectOptions = (selectEl, { placeholder, options, value, disabled }) => {
  // eslint-disable-next-line no-param-reassign
  selectEl.innerHTML = '';
  const placeholderOpt = document.createElement('option');
  placeholderOpt.value = '';
  placeholderOpt.textContent = placeholder;
  selectEl.appendChild(placeholderOpt);

  for (const opt of options) {
    const elOpt = document.createElement('option');
    elOpt.value = opt.value;
    elOpt.textContent = opt.label;
    selectEl.appendChild(elOpt);
  }

  // eslint-disable-next-line no-param-reassign
  selectEl.value = value || '';
  // eslint-disable-next-line no-param-reassign
  selectEl.disabled = !!disabled;
};

const getSelectedClient = (clientId) => cachedClients.find((c) => c.id === clientId) || null;
const getSelectedProject = (projectId) => cachedProjects.find((p) => p.id === projectId) || null;

const syncDraft = async () => {
  const draft = {
    clientId: String(clientSelect.value || ''),
    projectId: String(projectSelect.value || ''),
    description: String(descriptionInput.value || '').trim(),
  };
  await send({ type: 'NF_SET_DRAFT_METADATA', draft });
};

const refresh = async () => {
  // Keep extension in sync with server state (timer may be started/stopped in web app).
  await send({ type: 'NF_SYNC' });
  const state = await send({ type: 'NF_GET_STATE' });
  lastState = state || null;
  if (!state?.auth?.token) {
    loggedIn.hidden = true;
    loggedOut.hidden = false;
    setPill('neutral', 'Logged out');
    return;
  }

  loggedOut.hidden = true;
  loggedIn.hidden = false;
  whoEl.textContent = state.auth.name || state.auth.email || 'Signed in';
  companyEl.textContent = state.auth.companyName
    ? `Company: ${state.auth.companyName}`
    : (state.auth.companyId ? `Company: ${state.auth.companyId}` : 'No company');
  screenshotsEnabled.checked = !!state.timer?.screenshotsEnabled;

  // Load metadata (clients/projects)
  const meta = await send({ type: 'NF_GET_METADATA' });
  if (meta?.error) {
    console.error('[popup] metadata error:', meta.error);
    actionMsg.textContent = `Failed to load clients/projects: ${meta.error}`;
  }
  cachedClients = toArray(meta?.clients);
  cachedProjects = toArray(meta?.projects);

  const draftClientId = state.timer?.draftClientId || '';
  const draftProjectId = state.timer?.draftProjectId || '';
  const draftDescription = state.timer?.draftDescription || '';

  const clientOptions = cachedClients.map((c) => ({ value: c.id, label: c.name }));
  setSelectOptions(clientSelect, {
    placeholder: 'Select client…',
    options: clientOptions,
    value: draftClientId,
    disabled: false,
  });

  const filteredProjects = draftClientId
    ? cachedProjects.filter((p) => p.clientId === draftClientId)
    : [];
  const projectOptions = filteredProjects.map((p) => ({ value: p.id, label: p.name }));
  setSelectOptions(projectSelect, {
    placeholder: draftClientId ? 'Select project…' : 'Select client first…',
    options: projectOptions,
    value: draftProjectId,
    disabled: !draftClientId,
  });

  descriptionInput.value = draftDescription;

  if (state.timer?.isRunning) {
    setPill('ok', 'Running');
    const requiredOk = !!draftClientId && !!draftProjectId && !!draftDescription;
    startStopBtn.textContent = requiredOk ? 'Save & Stop' : 'Stop';
    startStopBtn.disabled = !requiredOk;
  } else {
    setPill('neutral', 'Stopped');
    startStopBtn.textContent = 'Start';
    startStopBtn.disabled = false;
  }

  if (state.timer?.isRunning && state.timer?.startTimeMs) {
    const elapsedMs = Date.now() - state.timer.startTimeMs;
    timerLine.textContent = `Elapsed: ${Math.floor(elapsedMs / 1000)}s`;
  } else {
    timerLine.textContent = '';
  }

  if (state.capture?.streamActive) {
    grantBtn.textContent = 'Screen granted';
    grantBtn.disabled = true;
  } else {
    grantBtn.textContent = 'Grant screen permission (optional)';
    grantBtn.disabled = false;
    if (screenshotsEnabled.checked) {
      actionMsg.textContent = 'Note: without screen permission, screenshots will capture the active tab only.';
    }
  }

  if (state.timer?.isRunning) {
    const requiredOk = !!draftClientId && !!draftProjectId && !!draftDescription;
    if (!requiredOk) {
      actionMsg.textContent = 'Select client, project, and description to stop the timer.';
    }
  }
};

loginBtn.addEventListener('click', async () => {
  loginError.hidden = true;
  actionMsg.textContent = '';

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    loginError.textContent = 'Email and password are required.';
    loginError.hidden = false;
    return;
  }

  loginBtn.disabled = true;
  setPill('warn', 'Signing in…');
  const res = await send({ type: 'NF_LOGIN', email, password });
  loginBtn.disabled = false;

  if (!res?.ok) {
    setPill('err', 'Login failed');
    loginError.textContent = res?.error || 'Login failed.';
    loginError.hidden = false;
    return;
  }

  await refresh();
});

logoutBtn.addEventListener('click', async () => {
  await send({ type: 'NF_LOGOUT' });
  await refresh();
});

screenshotsEnabled.addEventListener('change', async () => {
  await send({ type: 'NF_SET_SCREENSHOTS_ENABLED', enabled: screenshotsEnabled.checked });
  await refresh();
});

clientSelect.addEventListener('change', async () => {
  // Reset project when client changes
  await send({
    type: 'NF_SET_DRAFT_METADATA',
    draft: { clientId: clientSelect.value || '', projectId: '', description: (descriptionInput.value || '').trim() },
  });
  await refresh();
});

projectSelect.addEventListener('change', async () => {
  await syncDraft();
  await refresh();
});

descriptionInput.addEventListener('input', async () => {
  await syncDraft();
  if (lastState?.timer?.isRunning) {
    const requiredOk = !!clientSelect.value && !!projectSelect.value && !!String(descriptionInput.value || '').trim();
    startStopBtn.disabled = !requiredOk;
    startStopBtn.textContent = requiredOk ? 'Save & Stop' : 'Stop';
  }
});

grantBtn.addEventListener('click', async () => {
  actionMsg.textContent = '';
  setPill('warn', 'Pick a screen…');

  chrome.desktopCapture.chooseDesktopMedia(['screen', 'window'], async (streamId) => {
    if (!streamId) {
      setPill('neutral', 'Stopped');
      actionMsg.textContent = 'Screen permission was cancelled.';
      return;
    }
    const res = await send({ type: 'NF_GRANT_SCREEN', streamId });
    if (!res?.ok) {
      setPill('warn', 'Tab-only mode');
      console.error('[popup] grant failed:', JSON.stringify(res));
      actionMsg.textContent =
        (res?.error || 'Failed to start screen stream.') +
        ' Using active-tab screenshots instead.';
      return;
    }
    await refresh();
  });
});

startStopBtn.addEventListener('click', async () => {
  actionMsg.textContent = '';
  const state = await send({ type: 'NF_GET_STATE' });

  if (!state?.timer?.isRunning) {
    setPill('warn', 'Starting…');
    // Start quickly; metadata is required before stopping.
    const res = await send({ type: 'NF_START' });
    if (!res?.ok) {
      setPill('err', 'Error');
      actionMsg.textContent = res?.error || 'Failed to start.';
    }
  } else {
    const draftClientId = state.timer?.draftClientId || '';
    const draftProjectId = state.timer?.draftProjectId || '';
    const draftDescription = state.timer?.draftDescription || '';
    if (!draftClientId || !draftProjectId || !draftDescription) {
      setPill('warn', 'Missing info');
      actionMsg.textContent = 'Select client, project, and description before stopping.';
      return;
    }
    setPill('warn', 'Stopping…');
    const res = await send({
      type: 'NF_STOP',
      draft: { clientId: draftClientId, projectId: draftProjectId, description: draftDescription },
    });
    if (!res?.ok) {
      setPill('err', 'Error');
      actionMsg.textContent = res?.error || 'Failed to stop.';
    }
  }

  await refresh();
});

// Initialize
chrome.storage.local.get(['config']).then(({ config }) => {
  void refresh();
});
