const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Existing IPC methods
  toggleRecording: (isStarting) => ipcRenderer.send('toggle-recording', isStarting),
  streamAudioChunk: (audioChunk) => ipcRenderer.send('stream-audio-chunk', audioChunk),
  stopAudioStream: () => ipcRenderer.send('stop-audio-stream'),
  resetTranscript: () => ipcRenderer.send('reset-transcript'),
  toggleScreenSharingMode: (isScreenSharing) => ipcRenderer.send('toggle-screen-sharing-mode', isScreenSharing),
  getAnswer: (transcript) => ipcRenderer.send('get-answer', transcript),
  newChat: () => ipcRenderer.send('new-chat'),
  recordingStopped: () => ipcRenderer.send('recording-stopped'),
  audioData: (base64Audio) => ipcRenderer.send('audio-data', base64Audio),
  getAnswerWithContext: (data) => ipcRenderer.send('get-answer-with-context', data),
  audioDataWithContext: (data) => ipcRenderer.send('audio-data-with-context', data),

  // New settings IPC methods
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings)
})

contextBridge.exposeInMainWorld('ipcRenderer', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, callback) => ipcRenderer.on(channel, callback)
})