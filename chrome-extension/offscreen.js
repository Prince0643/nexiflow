/* global chrome */

let stream = null;
let video = null;
let canvas = null;

const ensureNodes = () => {
  if (!video) {
    video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
  }
  if (!canvas) {
    canvas = document.createElement('canvas');
  }
};

const stopStream = () => {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  if (video) {
    video.srcObject = null;
  }
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?._to !== 'offscreen') return;

  (async () => {
    try {
      switch (msg.type) {
        case 'OFFSCREEN_START_STREAM': {
          ensureNodes();
          stopStream();
          const streamId = msg.streamId;
          if (!streamId) {
            sendResponse({ ok: false, error: 'Missing streamId' });
            return;
          }

          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: streamId,
              },
            },
          });

          video.srcObject = stream;
          await video.play();
          sendResponse({ ok: true });
          return;
        }
        case 'OFFSCREEN_CAPTURE': {
          if (!stream || !video) {
            sendResponse({ ok: false, error: 'No active stream. Please grant screen permission again.' });
            return;
          }

          const width = video.videoWidth || 1280;
          const height = video.videoHeight || 720;
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: false });
          ctx.drawImage(video, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          const base64 = String(dataUrl).split(',')[1];
          sendResponse({ ok: true, base64 });
          return;
        }
        case 'OFFSCREEN_STOP_STREAM': {
          stopStream();
          sendResponse({ ok: true });
          return;
        }
        default:
          sendResponse({ ok: false, error: 'Unknown offscreen message' });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e?.message || 'Offscreen error' });
    }
  })();

  return true;
});

