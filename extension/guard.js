window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || event.data.__helply !== 'share') return;
  chrome.runtime.sendMessage({
    type: 'share-state',
    active: Boolean(event.data.active),
    surface: String(event.data.surface || 'unknown')
  }).catch(() => {});
});
