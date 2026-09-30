const JUNK = new Set([
  'you', 'thank you', 'thank you.', 'thanks for watching', 'thanks for watching.', 'thanks for watching!', '.', '...'
]);

const speakerLive = document.getElementById('speakerLive');
const micLive = document.getElementById('micLive');
const chat = document.getElementById('chat');
const statusEl = document.getElementById('status');
const settingsStatus = document.getElementById('settingsStatus');
const listenBtn = document.getElementById('listen');
const transcriptionSelect = document.getElementById('transcriptionProvider');
const chatSelect = document.getElementById('chatProvider');

let providers = {};
let settings = { providers: {}, resume: '', jobDescription: '' };
let listening = false;
let micHandle = null;
let speakerHot = false;
let speakerQuietUntil = 0;
let queue = Promise.resolve();
let history = [];

function setStatus(text) {
  statusEl.textContent = text;
}

function addMessage(text, kind) {
  const div = document.createElement('div');
  div.className = `msg ${kind}`;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function draft(name) {
  const provider = providers[name] || {};
  const saved = settings.providers[name] || {};
  return {
    apiKey: saved.apiKey || '',
    baseUrl: saved.baseUrl || provider.baseUrl || '',
    transcriptionModel: saved.transcriptionModel || provider.transcription?.defaultModel || '',
    chatModel: saved.chatModel || provider.chat?.defaultModel || ''
  };
}

function rememberVisible() {
  const transcriptionName = transcriptionSelect.value;
  const chatName = chatSelect.value;
  settings.providers[transcriptionName] = {
    ...draft(transcriptionName),
    apiKey: document.getElementById('transcriptionKey').value.trim(),
    baseUrl: document.getElementById('transcriptionBase').value.trim(),
    transcriptionModel: document.getElementById('transcriptionModel').value.trim()
  };
  const chatDraft = draft(chatName);
  settings.providers[chatName] = {
    ...chatDraft,
    ...settings.providers[chatName],
    apiKey: document.getElementById('chatKey').value.trim(),
    baseUrl: document.getElementById('chatBase').value.trim(),
    chatModel: document.getElementById('chatModel').value.trim()
  };
  settings.transcriptionProvider = transcriptionName;
  settings.chatProvider = chatName;
  settings.resume = document.getElementById('resume').value;
  settings.jobDescription = document.getElementById('job').value;
}

function showProvider(role) {
  const name = role === 'chat' ? chatSelect.value : transcriptionSelect.value;
  const values = draft(name);
  if (role === 'chat') {
    document.getElementById('chatKey').value = values.apiKey;
    document.getElementById('chatBase').value = values.baseUrl;
    document.getElementById('chatModel').value = values.chatModel;
    return;
  }
  document.getElementById('transcriptionKey').value = values.apiKey;
  document.getElementById('transcriptionBase').value = values.baseUrl;
  document.getElementById('transcriptionModel').value = values.transcriptionModel;
}

function fillProviders() {
  const names = Object.keys(providers);
  for (const select of [transcriptionSelect, chatSelect]) {
    select.innerHTML = '';
    for (const name of names) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = providers[name].name || name;
      select.appendChild(option);
    }
  }
  transcriptionSelect.value = settings.transcriptionProvider || 'groq';
  chatSelect.value = settings.chatProvider || 'groq';
  shownTranscription = transcriptionSelect.value;
  shownChat = chatSelect.value;
  showProvider('transcription');
  showProvider('chat');
  document.getElementById('resume').value = settings.resume || '';
  document.getElementById('job').value = settings.jobDescription || '';
}

function runtime(role) {
  rememberVisible();
  const name = role === 'chat' ? settings.chatProvider : settings.transcriptionProvider;
  const provider = providers[name];
  const values = draft(name);
  const supports = role === 'chat' ? provider.chat?.enabled : provider.transcription?.enabled;
  return {
    type: provider.type,
    label: provider.name || name,
    baseUrl: values.baseUrl,
    apiKey: values.apiKey,
    apiKeyRequired: Boolean(provider.apiKeyRequired),
    model: role === 'chat' ? values.chatModel : values.transcriptionModel,
    supports: Boolean(supports)
  };
}

function promptFor(question) {
  const resume = document.getElementById('resume').value.trim().slice(0, 1000);
  const job = document.getElementById('job').value.trim().slice(0, 1000);
  if (!resume && !job) return question;
  let context = 'Use the following context to answer the question:\n';
  if (resume) context += `Resume: ${resume}\n`;
  if (job) context += `Job Description: ${job}\n`;
  return `${context}\nQuestion: ${question.slice(0, 1500)}`;
}

function useful(text) {
  const cleaned = String(text || '').trim();
  return cleaned.length >= 2 && !JUNK.has(cleaned.toLowerCase());
}

function enqueue(task) {
  queue = queue.then(task).catch((error) => {
    addMessage(error.message || 'Request failed', 'ai');
    setStatus('Something failed. Listening is still on.');
  });
  return queue;
}

async function answerQuestion(question) {
  const chatRuntime = runtime('chat');
  const prompt = promptFor(question);
  setStatus('Generating answer...');
  const answer = await window.HelplyLlm.chat(chatRuntime, prompt, history);
  history.push({ role: 'user', content: prompt });
  history.push({ role: 'assistant', content: answer });
  if (history.length > 10) history = history.slice(-10);
  addMessage(answer || 'No answer received.', 'ai');
  if (listening) setStatus('Listening. No key needed for the next turn.');
}

function takeAudio(source, audio) {
  enqueue(async () => {
    const text = await window.HelplyLlm.transcribe(runtime('transcription'), audio);
    if (!useful(text)) return;
    if (source === 'mic') {
      micLive.textContent = text;
      addMessage(`You: ${text}`, 'user');
      return;
    }
    speakerLive.textContent = text;
    addMessage(text, 'user');
    await answerQuestion(text);
  });
}

async function startListening() {
  rememberVisible();
  speakerHot = false;
  const tabPromise = chrome.runtime.sendMessage({ type: 'start-tab-audio' });
  const micPromise = navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: false
  });
  const [tab, micStream] = await Promise.all([tabPromise, micPromise]);
  micHandle = window.HelplyListen.attachListener(micStream, {
    threshold: 0.018,
    isBlocked: () => speakerHot || Date.now() < speakerQuietUntil,
    onActivity: (active) => { if (active) micLive.textContent = 'Speaking…'; },
    onUtterance: (audio) => takeAudio('mic', audio)
  });
  if (!tab || !tab.ok) throw new Error((tab && tab.error) || 'Could not hear the meeting tab');
  listening = true;
  listenBtn.textContent = 'Pause listening';
  speakerLive.textContent = 'Listening…';
  micLive.textContent = 'Listening…';
  setStatus(`Listening to ${tab.title}. Speaker and microphone run on their own.`);
}

function stopListening() {
  if (micHandle) micHandle.stop();
  micHandle = null;
  chrome.runtime.sendMessage({ type: 'stop-tab-audio' }).catch(() => {});
  listening = false;
  speakerHot = false;
  listenBtn.textContent = 'Start listening';
  setStatus('Listening paused.');
}

chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.target === 'offscreen') return;
  if (message.type === 'speaker-hot') {
    speakerHot = Boolean(message.hot);
    if (!message.hot) speakerQuietUntil = Date.now() + 600;
    return;
  }
  if (message.type === 'speaker-activity' && message.active) {
    speakerLive.textContent = 'Speaking…';
    return;
  }
  if (message.type === 'speaker-audio') takeAudio('speaker', message.audio);
  if (message.type === 'speaker-status' && message.text) setStatus(message.text);
});

listenBtn.addEventListener('click', async () => {
  try {
    if (listening) stopListening();
    else await startListening();
  } catch (error) {
    stopListening();
    addMessage(error.message, 'ai');
    setStatus('Could not start. Open the meeting tab and try again.');
  }
});

document.getElementById('reset').addEventListener('click', () => {
  history = [];
  chat.innerHTML = '';
  speakerLive.textContent = listening ? 'Listening…' : 'Waiting…';
  micLive.textContent = listening ? 'Listening…' : 'Waiting…';
});

document.getElementById('ask').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = document.getElementById('question');
  const question = input.value.trim();
  if (!question) return;
  input.value = '';
  addMessage(question, 'user');
  enqueue(() => answerQuestion(question));
});

let shownTranscription = '';
let shownChat = '';

function saveRole(role, name) {
  if (!name || !providers[name]) return;
  const current = draft(name);
  if (role === 'chat') {
    settings.providers[name] = {
      ...current,
      apiKey: document.getElementById('chatKey').value.trim(),
      baseUrl: document.getElementById('chatBase').value.trim(),
      chatModel: document.getElementById('chatModel').value.trim()
    };
    return;
  }
  settings.providers[name] = {
    ...current,
    apiKey: document.getElementById('transcriptionKey').value.trim(),
    baseUrl: document.getElementById('transcriptionBase').value.trim(),
    transcriptionModel: document.getElementById('transcriptionModel').value.trim()
  };
}

transcriptionSelect.addEventListener('change', () => {
  saveRole('transcription', shownTranscription);
  shownTranscription = transcriptionSelect.value;
  showProvider('transcription');
});

chatSelect.addEventListener('change', () => {
  saveRole('chat', shownChat);
  shownChat = chatSelect.value;
  showProvider('chat');
});

document.getElementById('save').addEventListener('click', async () => {
  rememberVisible();
  await chrome.storage.local.set({ settings });
  settingsStatus.textContent = 'Saved in this browser.';
});

document.getElementById('test').addEventListener('click', async () => {
  settingsStatus.textContent = 'Testing chat...';
  try {
    const text = await window.HelplyLlm.chat(runtime('chat'), 'Reply with the single word ok.', []);
    settingsStatus.textContent = text ? 'Chat provider responded.' : 'Chat provider returned nothing.';
  } catch (error) {
    settingsStatus.textContent = error.message;
  }
});

async function init() {
  const response = await fetch(chrome.runtime.getURL('providers.json'));
  const catalog = await response.json();
  providers = catalog.providers || {};
  const stored = await chrome.storage.local.get('settings');
  settings = stored.settings || { providers: {}, resume: '', jobDescription: '' };
  if (!settings.providers) settings.providers = {};
  fillProviders();
  if (!draft(transcriptionSelect.value).apiKey && (providers[transcriptionSelect.value] || {}).apiKeyRequired) {
    document.getElementById('settingsBox').open = true;
  }
}

init().catch((error) => setStatus(error.message));
