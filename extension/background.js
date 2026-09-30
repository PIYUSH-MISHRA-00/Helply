const PANEL = 'sidepanel.html';

async function findPanel() {
  const wins = await chrome.windows.getAll({ populate: true });
  return wins.find((win) => (win.tabs || []).some((tab) => String(tab.url || '').includes(PANEL))) || null;
}

async function openPanel() {
  const existing = await findPanel();
  if (existing) {
    await chrome.windows.update(existing.id, { state: 'normal', focused: true });
    return;
  }
  await chrome.windows.create({ url: PANEL, type: 'popup', width: 440, height: 820 });
}

async function toggleHide() {
  const panel = await findPanel();
  if (!panel) return openPanel();
  const hide = panel.state !== 'minimized';
  await chrome.windows.update(panel.id, hide ? { state: 'minimized' } : { state: 'normal', focused: true });
}

async function guardOn() {
  const { settings } = await chrome.storage.local.get('settings');
  return !settings || settings.guard !== false;
}

async function onShare(active, surface) {
  const panel = await findPanel();
  const { hiddenByGuard } = await chrome.storage.session.get('hiddenByGuard');
  // "unknown" is treated as a full-screen share so Helply errs on the side of hiding.
  const exposed = surface === 'monitor' || surface === 'unknown';

  if (active && exposed && (await guardOn())) {
    if (panel && panel.state !== 'minimized') await chrome.windows.update(panel.id, { state: 'minimized' });
    await chrome.storage.session.set({ hiddenByGuard: true });
    chrome.action.setBadgeText({ text: 'HID' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  } else if (!active && hiddenByGuard) {
    await chrome.storage.session.set({ hiddenByGuard: false });
    chrome.action.setBadgeText({ text: '' });
    if (panel) await chrome.windows.update(panel.id, { state: 'normal' });
  }
  chrome.runtime.sendMessage({ type: 'guard-event', active, surface, hidden: active && exposed }).catch(() => {});
}

chrome.action.onClicked.addListener(() => {
  openPanel().catch((error) => console.error(error));
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-hide') toggleHide().catch((error) => console.error(error));
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message && message.type === 'share-state' && sender.tab) {
    onShare(message.active, message.surface).catch((error) => console.error(error));
  }
  if (message && message.type === 'toggle-hide') {
    toggleHide().catch((error) => console.error(error));
  }
});
