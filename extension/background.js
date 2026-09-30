const MEETING = /https?:\/\/((meet\.google\.com)|([^/]*\.zoom\.us)|(teams\.microsoft\.com)|(teams\.live\.com)|([^/]*\.webex\.com)|(whereby\.com)|(app\.around\.co))/i;
const PANEL_URL = chrome.runtime.getURL('sidepanel.html');
const WIDTH = 440;
const HEIGHT = 600;
// Laptop webcams sit at the top centre, so the window opens just under it and your eyes stay near the lens.
const CAMERA_GAP = 8;

let panelId = null;
let hiddenForShare = false;

async function findPanel() {
  if (panelId != null) {
    try {
      await chrome.windows.get(panelId);
      return panelId;
    } catch (error) {
      panelId = null;
    }
  }
  const [tab] = await chrome.tabs.query({ url: PANEL_URL });
  if (tab) panelId = tab.windowId;
  return panelId;
}

async function placeUnderCamera() {
  const { panelBounds } = await chrome.storage.local.get('panelBounds');
  if (panelBounds) return panelBounds;
  let area = { left: 0, top: 0, width: 1280 };
  try {
    const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
    area = { left: win.left, top: win.top, width: win.width };
  } catch (error) {
    // No browser window yet; use the top of the screen.
  }
  return {
    left: Math.round(area.left + (area.width - WIDTH) / 2),
    top: area.top + CAMERA_GAP,
    width: WIDTH,
    height: HEIGHT
  };
}

let opening = Promise.resolve();

// Page loads fire several tab events at once; open one window, not one per event.
function openPanel(focused) {
  opening = opening.catch(() => {}).then(async () => {
    const id = await findPanel();
    if (id != null) {
      await chrome.windows.update(id, { state: 'normal', focused: Boolean(focused) });
      return;
    }
    const bounds = await placeUnderCamera();
    const win = await chrome.windows.create({ url: PANEL_URL, type: 'popup', focused: Boolean(focused), ...bounds });
    panelId = win.id;
  });
  return opening;
}

chrome.action.onClicked.addListener(() => openPanel(true).catch(() => {}));

chrome.windows.onBoundsChanged.addListener((win) => {
  if (win.id !== panelId || win.state !== 'normal') return;
  chrome.storage.local.set({ panelBounds: { left: win.left, top: win.top, width: win.width, height: win.height } });
});

chrome.windows.onRemoved.addListener((id) => {
  if (id === panelId) panelId = null;
});

function consider(tab) {
  if (!tab || tab.id == null || !tab.url || tab.url.startsWith(PANEL_URL)) return;
  chrome.runtime.sendMessage({
    type: 'meeting-tab',
    tab: { id: tab.id, url: tab.url, title: tab.title || '' }
  }).catch(() => {});
  if (MEETING.test(tab.url) && !hiddenForShare) openPanel(false).catch(() => {});
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

// A full-screen share captures every window on the screen, and browsers give extensions no way
// to opt a window out of it, so Helply gets out of the picture for as long as that share runs.
async function onShare(active, surface) {
  const { settings } = await chrome.storage.local.get('settings');
  if (settings && settings.guard === false) return;
  const id = await findPanel();
  if (active && surface === 'monitor') {
    hiddenForShare = true;
    if (id != null) await chrome.windows.update(id, { state: 'minimized' });
  } else if (!active && hiddenForShare) {
    hiddenForShare = false;
    if (id != null) await chrome.windows.update(id, { state: 'normal', focused: false });
  }
  chrome.runtime.sendMessage({ type: 'share-state', active, surface, hidden: hiddenForShare }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return;
  if (message.type === 'share-state' && sender.tab) {
    onShare(message.active, message.surface).catch(() => {});
    return;
  }
  if (message.type !== 'capture-tab') return;
  chrome.tabCapture.getMediaStreamId({ targetTabId: message.tabId }, (id) => {
    const err = chrome.runtime.lastError && chrome.runtime.lastError.message;
    if (err || !id) sendResponse({ ok: false, error: err || 'This page has no audio yet.' });
    else sendResponse({ ok: true, streamId: id });
  });
  return true;
});
