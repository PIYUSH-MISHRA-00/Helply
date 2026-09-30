async function offscreenIsUp() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'offscreen-ping', target: 'offscreen' });
    return Boolean(response && response.ok);
  } catch (error) {
    return false;
  }
}

async function ensureOffscreen() {
  if (!(await chrome.offscreen.hasDocument())) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
      justification: 'Capture meeting-tab audio and play it back so the call stays audible'
    });
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await offscreenIsUp()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Audio capture page did not start');
}

function queryMeetingTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => resolve((tabs && tabs[0]) || null));
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  ensureOffscreen().catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.target === 'offscreen') return;
  if (message.type === 'start-tab-audio') {
    queryMeetingTab().then((tab) => {
      if (!tab || tab.id == null || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        sendResponse({ ok: false, error: 'Open the meeting tab, then start listening.' });
        return;
      }
      chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (id) => {
        const err = chrome.runtime.lastError && chrome.runtime.lastError.message;
        if (err || !id) {
          sendResponse({ ok: false, error: err || 'Could not capture that tab' });
          return;
        }
        ensureOffscreen()
          .then(() => chrome.runtime.sendMessage({ type: 'offscreen-capture', target: 'offscreen', streamId: id }))
          .then((started) => {
            if (!started || !started.ok) {
              sendResponse({ ok: false, error: (started && started.error) || 'Speaker capture failed' });
              return;
            }
            sendResponse({ ok: true, title: tab.title || 'Meeting tab' });
          })
          .catch((error) => sendResponse({ ok: false, error: error.message }));
      });
    });
    return true;
  }
  if (message.type === 'stop-tab-audio') {
    chrome.runtime.sendMessage({ type: 'offscreen-stop', target: 'offscreen' }).catch(() => {});
    sendResponse({ ok: true });
  }
});
