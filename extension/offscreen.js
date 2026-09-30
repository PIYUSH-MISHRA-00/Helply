let handle = null;
let playback = null;
let stream = null;
let lastHot = false;

function stopCapture() {
  lastHot = false;
  if (handle) handle.stop();
  handle = null;
  if (playback) {
    playback.pause();
    playback.srcObject = null;
    playback = null;
  }
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
}

async function startCapture(streamId) {
  stopCapture();
  stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    },
    video: false
  });

  // Tab capture mutes the tab unless the extension plays the stream.
  playback = new Audio();
  playback.srcObject = stream;
  try {
    await playback.play();
  } catch (error) {
    chrome.runtime.sendMessage({
      type: 'speaker-status',
      text: 'Chrome muted the meeting tab. Click the tab if you cannot hear it.'
    }).catch(() => {});
  }

  handle = window.HelplyListen.attachListener(stream, {
    threshold: 0.01,
    onHot: (hot) => {
      if (hot === lastHot) return;
      lastHot = hot;
      chrome.runtime.sendMessage({ type: 'speaker-hot', hot }).catch(() => {});
    },
    onActivity: (active) => {
      chrome.runtime.sendMessage({ type: 'speaker-activity', active }).catch(() => {});
    },
    onUtterance: (audio) => {
      chrome.runtime.sendMessage({ type: 'speaker-audio', audio }).catch(() => {});
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.target !== 'offscreen') return;
  if (message.type === 'offscreen-ping') {
    sendResponse({ ok: true });
    return;
  }
  if (message.type === 'offscreen-stop') {
    stopCapture();
    sendResponse({ ok: true });
    return;
  }
  if (message.type === 'offscreen-capture') {
    startCapture(message.streamId).then(() => sendResponse({ ok: true })).catch((error) => {
      stopCapture();
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }
});
