/* global chrome */

const el = (id) => document.getElementById(id);

const statusPill = el('statusPill');
const loggedOut = el('loggedOut');
const loggedIn = el('loggedIn');

const emailInput = el('email');
const passwordInput = el('password');
const apiBaseInput = el('apiBase');
const loginBtn = el('loginBtn');
const loginError = el('loginError');

const whoEl = el('who');
const companyEl = el('company');
const logoutBtn = el('logoutBtn');

const projectNameInput = el('projectName');
const screenshotsEnabled = el('screenshotsEnabled');
const grantBtn = el('grantBtn');
const startStopBtn = el('startStopBtn');
const captureNowBtn = el('captureNowBtn');
const timerLine = el('timerLine');
const actionMsg = el('actionMsg');

const defaultApiBase = 'https://nexi-flow.com/api';

const setPill = (type, text) => {
  statusPill.className = `pill pill-${type}`;
  statusPill.textContent = text;
};

const send = (msg) =>
  new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));

const refresh = async () => {
  const state = await send({ type: 'NF_GET_STATE' });
  if (!state?.auth?.token) {
    loggedIn.hidden = true;
    loggedOut.hidden = false;
    setPill('neutral', 'Logged out');
    apiBaseInput.value = state?.config?.apiBase || defaultApiBase;
    return;
  }

  loggedOut.hidden = true;
  loggedIn.hidden = false;
  whoEl.textContent = state.auth.name || state.auth.email || 'Signed in';
  companyEl.textContent = state.auth.companyId ? `Company: ${state.auth.companyId}` : 'No company';
  projectNameInput.value = state.timer?.projectName || '';
  screenshotsEnabled.checked = !!state.timer?.screenshotsEnabled;

  if (state.timer?.isRunning) {
    setPill('ok', 'Running');
    startStopBtn.textContent = 'Stop';
  } else {
    setPill('neutral', 'Stopped');
    startStopBtn.textContent = 'Start';
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
    grantBtn.textContent = 'Grant screen permission';
    grantBtn.disabled = !screenshotsEnabled.checked;
  }
};

loginBtn.addEventListener('click', async () => {
  loginError.hidden = true;
  actionMsg.textContent = '';

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const apiBase = apiBaseInput.value.trim() || defaultApiBase;

  if (!email || !password) {
    loginError.textContent = 'Email and password are required.';
    loginError.hidden = false;
    return;
  }

  loginBtn.disabled = true;
  setPill('warn', 'Signing in…');
  const res = await send({ type: 'NF_LOGIN', email, password, apiBase });
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

grantBtn.addEventListener('click', async () => {
  actionMsg.textContent = '';
  setPill('warn', 'Pick a screen…');

  chrome.desktopCapture.chooseDesktopMedia(['screen'], async (streamId) => {
    if (!streamId) {
      setPill('neutral', 'Stopped');
      actionMsg.textContent = 'Screen permission was cancelled.';
      return;
    }
    const res = await send({ type: 'NF_GRANT_SCREEN', streamId });
    if (!res?.ok) {
      setPill('err', 'Error');
      actionMsg.textContent = res?.error || 'Failed to start screen stream.';
      return;
    }
    await refresh();
  });
});

startStopBtn.addEventListener('click', async () => {
  actionMsg.textContent = '';
  const projectName = projectNameInput.value.trim();
  const state = await send({ type: 'NF_GET_STATE' });

  if (!state?.timer?.isRunning) {
    setPill('warn', 'Starting…');
    const res = await send({ type: 'NF_START', projectName });
    if (!res?.ok) {
      setPill('err', 'Error');
      actionMsg.textContent = res?.error || 'Failed to start.';
    }
  } else {
    setPill('warn', 'Stopping…');
    const res = await send({ type: 'NF_STOP' });
    if (!res?.ok) {
      setPill('err', 'Error');
      actionMsg.textContent = res?.error || 'Failed to stop.';
    }
  }

  await refresh();
});

captureNowBtn.addEventListener('click', async () => {
  const res = await send({ type: 'NF_CAPTURE_NOW' });
  if (!res?.ok) {
    actionMsg.textContent = res?.error || 'Capture failed.';
    return;
  }
  actionMsg.textContent = `Uploaded: ${res.filename || 'screenshot'}`
});

// Initialize
chrome.storage.local.get(['config']).then(({ config }) => {
  apiBaseInput.value = config?.apiBase || defaultApiBase;
  void refresh();
});

