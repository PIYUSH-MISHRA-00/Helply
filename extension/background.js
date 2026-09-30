const MEETING = /https?:\/\/((meet\.google\.com)|([^/]*\.zoom\.us)|(teams\.microsoft\.com)|(teams\.live\.com)|([^/]*\.webex\.com)|(whereby\.com)|(app\.around\.co))/i;

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

function consider(tab) {
  if (!tab || tab.id == null || !tab.url) return;
  chrome.runtime.sendMessage({
    type: 'meeting-tab',
    tab: { id: tab.id, url: tab.url, title: tab.title || '' }
  }).catch(() => {});
  if (MEETING.test(tab.url)) {
    chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  }
}

chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.url || change.status === 'complete') consider({ ...tab, id: tab.id ?? tabId });
});

chrome.tabs.onActivated.addListener(async (info) => {
  try {
    consider(await chrome.tabs.get(info.tabId));
  } catch (error) {
    // The tab can close before we read it.
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'capture-tab') return;
  chrome.tabCapture.getMediaStreamId({ targetTabId: message.tabId }, (id) => {
    const err = chrome.runtime.lastError && chrome.runtime.lastError.message;
    if (err || !id) sendResponse({ ok: false, error: err || 'This page has no audio yet.' });
    else sendResponse({ ok: true, streamId: id });
  });
  return true;
});
