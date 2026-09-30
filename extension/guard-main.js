// Runs in the page so it sees the meeting app's own screen-share calls.
(() => {
  const devices = navigator.mediaDevices;
  if (!devices || typeof devices.getDisplayMedia !== 'function' || devices.__helplyGuard) return;
  Object.defineProperty(devices, '__helplyGuard', { value: true });

  const original = devices.getDisplayMedia.bind(devices);
  const report = (active, surface) => window.postMessage({ __helply: 'share', active, surface }, '*');

  devices.getDisplayMedia = function getDisplayMedia(...args) {
    return original(...args).then((stream) => {
      const track = stream.getVideoTracks()[0];
      if (!track) return stream;
      const surface = (track.getSettings && track.getSettings().displaySurface) || 'unknown';
      let ended = false;
      const end = () => {
        if (ended) return;
        ended = true;
        report(false, surface);
      };
      // Meeting apps usually stop the track themselves, which never fires "ended".
      const stop = track.stop.bind(track);
      track.stop = () => {
        end();
        stop();
      };
      track.addEventListener('ended', end);
      report(true, surface);
      return stream;
    });
  };
})();
