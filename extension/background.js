async function openPanel() {
  const wins = await chrome.windows.getAll({ populate: true });
  const existing = wins.find((win) => (win.tabs || []).some((tab) => String(tab.url || '').includes('sidepanel.html')));
  if (existing) {
    await chrome.windows.update(existing.id, { focused: true });
    return;
  }
  await chrome.windows.create({
    url: 'sidepanel.html',
    type: 'popup',
    width: 420,
    height: 760
  });
}

chrome.action.onClicked.addListener(() => {
  openPanel().catch((error) => console.error(error));
});
