const $ = (id) => document.getElementById(id);
const Ctx = window.HelplyContext;
const Llm = window.HelplyLlm;

const JUNK = new Set(['you', 'thank you', 'thank you.', 'thanks for watching', 'thanks for watching.', 'thanks for watching!', '.', '...', 'bye.', 'okay.']);
// A question often arrives as two or three phrases. Wait this long after the last one before answering.
const QUESTION_PAUSE_MS = 1400;
// If the interviewer keeps talking this soon after an answer started, restart it with the full question.
const MERGE_WINDOW_MS = 6000;
const TYPE_LABEL = { general: 'General', behavioral: 'Behavioral', technical: 'Technical', 'system-design': 'System design', hr: 'HR' };

let providers = {};
let settings = { providers: {}, transcriptionProvider: 'groq', chatProvider: 'groq', guard: true };
let session = null;
let listening = false;
let pending = [];
let pendingTimer = null;
let active = null;
let transcribeQueue = Promise.resolve();
let saveTimer = null;
let clockTimer = null;
let renderFrame = 0;
let shownTranscription = '';
let shownChat = '';

// ---------- helpers ----------

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function at(t) {
  return session ? clock(t - session.startedAt) : '';
}

function esc(text) {
  return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add('hidden'), 2200);
}

function setStatus(text, busy) {
  const el = $('statusText');
  el.textContent = text || '';
  el.classList.toggle('busy', Boolean(busy));
}

function useful(text) {
  const clean = String(text || '').trim();
  return clean.length >= 2 && !JUNK.has(clean.toLowerCase());
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (session) chrome.storage.local.set({ session });
  }, 300);
}

// ---------- profile form ----------

function chipGroup(id) {
  const group = $(id);
  group.addEventListener('click', (event) => {
    const btn = event.target.closest('.chip-opt');
    if (!btn) return;
    group.querySelectorAll('.chip-opt').forEach((b) => b.classList.toggle('on', b === btn));
    onProfileInput();
  });
}

function setChip(id, value) {
  const group = $(id);
  const buttons = [...group.querySelectorAll('.chip-opt')];
  const match = buttons.find((b) => b.dataset.value === value) || buttons[0];
  buttons.forEach((b) => b.classList.toggle('on', b === match));
}

function chipValue(id) {
  const on = $(id).querySelector('.chip-opt.on');
  return on ? on.dataset.value : '';
}

function readProfile() {
  return {
    role: $('pRole').value.trim(),
    company: $('pCompany').value.trim(),
    type: chipValue('pType') || 'general',
    style: chipValue('pStyle') || 'concise',
    resume: $('pResume').value.trim(),
    jd: $('pJd').value.trim()
  };
}

function writeProfile(profile) {
  const p = profile || {};
  $('pRole').value = p.role || '';
  $('pCompany').value = p.company || '';
  setChip('pType', p.type || 'general');
  setChip('pStyle', p.style || 'concise');
  $('pResume').value = p.resume || '';
  $('pJd').value = p.jd || '';
}

function onProfileInput() {
  const profile = readProfile();
  chrome.storage.local.set({ profile });
  if (session) {
    session.profile = profile;
    persist();
  }
}

// ---------- provider settings ----------

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

function captureRole(role, name) {
  if (!name || !providers[name]) return;
  const current = draft(name);
  const prefix = role === 'chat' ? 'chat' : 'transcription';
  settings.providers[name] = {
    ...current,
    ...settings.providers[name],
    apiKey: $(`${prefix}Key`).value.trim(),
    baseUrl: $(`${prefix}Base`).value.trim(),
    [role === 'chat' ? 'chatModel' : 'transcriptionModel']: $(`${prefix}Model`).value.trim()
  };
}

function showRole(role) {
  const prefix = role === 'chat' ? 'chat' : 'transcription';
  const values = draft($(`${prefix}Provider`).value);
  $(`${prefix}Key`).value = values.apiKey;
  $(`${prefix}Base`).value = values.baseUrl;
  $(`${prefix}Model`).value = role === 'chat' ? values.chatModel : values.transcriptionModel;
}

function captureSettings() {
  captureRole('transcription', shownTranscription);
  captureRole('chat', shownChat);
  settings.transcriptionProvider = $('transcriptionProvider').value;
  settings.chatProvider = $('chatProvider').value;
  settings.guard = $('guardToggle').checked;
}

function fillSettings() {
  for (const id of ['transcriptionProvider', 'chatProvider']) {
    const select = $(id);
    select.innerHTML = '';
    const role = id === 'chatProvider' ? 'chat' : 'transcription';
    for (const [name, provider] of Object.entries(providers)) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = provider[role]?.enabled ? provider.name || name : `${provider.name || name} (not supported)`;
      option.disabled = !provider[role]?.enabled;
      select.appendChild(option);
    }
  }
  $('transcriptionProvider').value = settings.transcriptionProvider || 'groq';
  $('chatProvider').value = settings.chatProvider || 'groq';
  shownTranscription = $('transcriptionProvider').value;
  shownChat = $('chatProvider').value;
  showRole('transcription');
  showRole('chat');
  $('guardToggle').checked = settings.guard !== false;
}

function runtime(role) {
  captureSettings();
  const name = role === 'chat' ? settings.chatProvider : settings.transcriptionProvider;
  const provider = providers[name] || {};
  const values = draft(name);
  return {
    type: provider.type,
    label: provider.name || name,
    baseUrl: values.baseUrl,
    apiKey: values.apiKey,
    apiKeyRequired: Boolean(provider.apiKeyRequired),
    model: role === 'chat' ? values.chatModel : values.transcriptionModel,
    supports: Boolean(role === 'chat' ? provider.chat?.enabled : provider.transcription?.enabled)
  };
}

function missingSetup() {
  for (const role of ['transcription', 'chat']) {
    const rt = runtime(role);
    if (!rt.supports) return `${rt.label} cannot do ${role === 'chat' ? 'answers' : 'transcription'}. Pick another provider in Settings.`;
    if (rt.apiKeyRequired && !rt.apiKey) return `Add your ${rt.label} API key in Settings to start.`;
  }
  return '';
}

// ---------- drawer ----------

function openDrawer(withProfile) {
  $('drawerProfile').classList.toggle('hidden', !withProfile);
  if (withProfile) $('drawerProfile').appendChild($('profileForm'));
  $('drawer').classList.remove('hidden');
  $('drawer').setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
  $('profileHome').appendChild($('profileForm'));
  $('drawer').classList.add('hidden');
  $('drawer').setAttribute('aria-hidden', 'true');
  refreshSetupWarn();
}

// ---------- views ----------

function refreshSetupWarn() {
  const problem = missingSetup();
  $('setupWarn').textContent = problem;
  $('setupWarn').classList.toggle('hidden', !problem);
}

function showSetup() {
  $('setupView').classList.remove('hidden');
  $('liveView').classList.add('hidden');
  $('btnContext').classList.add('hidden');
  $('timer').classList.add('hidden');
  setPill('Ready', '');
  refreshSetupWarn();
}

function showLive() {
  $('setupView').classList.add('hidden');
  $('liveView').classList.remove('hidden');
  $('btnContext').classList.remove('hidden');
  $('timer').classList.remove('hidden');
  clearInterval(clockTimer);
  clockTimer = setInterval(() => {
    if (session) $('timer').textContent = clock(Date.now() - session.startedAt);
  }, 1000);
  $('timer').textContent = clock(Date.now() - session.startedAt);
  renderAll();
}

function setPill(text, kind) {
  const pill = $('livePill');
  pill.textContent = text;
  pill.className = `pill ${kind || ''}`.trim();
}

function setLane(who, text, speaking) {
  const lane = who === 'you' ? $('laneYou') : $('laneInterviewer');
  if (text !== undefined) (who === 'you' ? $('youText') : $('interviewerText')).textContent = text;
  if (speaking !== undefined) lane.classList.toggle('speaking', speaking);
}

// ---------- rendering ----------

function answerHtml(item) {
  const text = String(item.answer || '');
  if (item.error) return `<div class="card-error">${esc(item.error)}</div>`;
  if (!text.trim() || (item.status === 'streaming' && 'SKIP'.startsWith(text.trim()))) {
    return '<div class="typing"><i></i><i></i><i></i></div>';
  }
  return Ctx.renderMarkdown(text);
}

function actionsHtml(item) {
  const busy = item.status === 'streaming' ? 'disabled' : '';
  const code = session.profile.type === 'technical' || /```/.test(item.answer || '')
    ? `<button class="act" data-act="code" ${busy}>Code</button>` : '';
  return `<footer class="actions">
    <button class="act" data-act="copy" ${busy}>Copy</button>
    <button class="act" data-act="shorter" ${busy}>Shorter</button>
    <button class="act" data-act="detail" ${busy}>More detail</button>
    <button class="act" data-act="example" ${busy}>Example</button>
    ${code}
    <button class="act" data-act="regen" ${busy}>Retry</button>
  </footer>`;
}

function cardHtml(item) {
  const tag = item.refined ? `<span class="tag">${esc(item.refined)}</span>` : `<span class="tag">${esc(TYPE_LABEL[session.profile.type] || 'General')}</span>`;
  return `<article class="card current" data-id="${item.id}">
    <div class="card-head">
      <div class="q-meta"><span>${item.typed ? 'You asked' : 'Interviewer asked'}</span>${tag}<time>${at(item.t)}</time></div>
      <p class="q-text">${esc(item.q)}</p>
    </div>
    <div class="answer">${answerHtml(item)}</div>
    ${actionsHtml(item)}
  </article>`;
}

function pastHtml(item, index) {
  return `<details class="past" data-id="${item.id}">
    <summary><span class="n">Q${index + 1}</span><span class="t">${esc(item.q)}</span><time>${at(item.t)}</time></summary>
    <div class="answer">${answerHtml(item)}</div>
    ${actionsHtml(item)}
  </details>`;
}

function renderAll() {
  if (!session) return;
  const qa = session.qa;
  const latest = qa[qa.length - 1];
  $('emptyState').classList.toggle('hidden', qa.length > 0);
  $('current').innerHTML = latest ? cardHtml(latest) : '';
  const older = qa.slice(0, -1);
  $('historyWrap').classList.toggle('hidden', older.length === 0);
  const openIds = new Set([...document.querySelectorAll('.past[open]')].map((el) => el.dataset.id));
  $('history').innerHTML = older.map((item, i) => pastHtml(item, i)).reverse().join('');
  openIds.forEach((id) => {
    const el = document.querySelector(`.past[data-id="${id}"]`);
    if (el) el.open = true;
  });
  $('countAnswers').textContent = String(qa.length);
  renderTranscript();
}

function renderCard(item) {
  cancelAnimationFrame(renderFrame);
  renderFrame = requestAnimationFrame(() => {
    const el = document.querySelector(`[data-id="${item.id}"] .answer`);
    if (el) el.innerHTML = answerHtml(item);
    else renderAll();
  });
}

function renderTranscript() {
  const turns = session ? session.turns : [];
  $('countTurns').textContent = String(turns.length);
  $('transcript').innerHTML = turns.length
    ? turns.map((t) => `<div class="turn ${t.who}"><span class="badge">${t.who === 'you' ? 'You' : 'Interviewer'}</span><p>${esc(t.text)}</p><time>${at(t.t)}</time></div>`).join('')
    : '<div class="empty"><p>The full conversation shows up here as it happens.</p></div>';
}

// ---------- answering ----------

function cancelActive(removeCard) {
  if (!active) return;
  active.controller.abort();
  if (removeCard) session.qa = session.qa.filter((item) => item.id !== active.id);
  active = null;
}

async function ask(question, options) {
  const opts = options || {};
  const mode = opts.mode || 'answer';
  let item = opts.item;

  if (active && (!item || active.id !== item.id)) cancelActive(false);

  if (!item) {
    item = { id: uid(), q: question, t: Date.now(), answer: '', status: 'streaming', typed: Boolean(opts.typed) };
    session.qa.push(item);
  }
  const previous = item.answer;
  item.status = 'streaming';
  item.error = '';
  item.answer = '';
  item.refined = mode === 'answer' ? '' : { shorter: 'Shorter', detail: 'More detail', example: 'With example', code: 'With code', regen: 'Retried' }[mode];
  renderAll();
  document.querySelector('.pane').scrollTop = 0;

  const controller = new AbortController();
  active = { id: item.id, controller, startedAt: Date.now(), auto: Boolean(opts.auto), question };
  setStatus('Writing answer…', true);

  try {
    const request = Ctx.buildRequest(session, { id: item.id, question, mode, previous, allowSkip: Boolean(opts.auto) });
    const text = await Llm.chat(runtime('chat'), request, (full) => {
      item.answer = full;
      renderCard(item);
    }, controller.signal);
    if (active && active.id === item.id) active = null;
    if (opts.auto && text.trim().toUpperCase() === 'SKIP') {
      session.qa = session.qa.filter((x) => x.id !== item.id);
      renderAll();
      setStatus('Small talk, no answer needed');
      persist();
      return;
    }
    item.answer = text || previous;
    item.status = 'done';
    setStatus(listening ? 'Listening' : '');
  } catch (error) {
    if (error.name === 'AbortError') {
      item.status = 'done';
      if (!item.answer) item.answer = previous;
      renderAll();
      return;
    }
    if (active && active.id === item.id) active = null;
    item.status = 'done';
    item.error = error.message || 'Could not get an answer';
    item.answer = previous;
    setStatus('Answer failed');
  }
  renderAll();
  persist();
}

function flushPending(auto) {
  clearTimeout(pendingTimer);
  pendingTimer = null;
  let question = pending.join(' ').trim();
  pending = [];
  if (!question && !auto) {
    const last = [...session.turns].reverse().find((t) => t.who === 'interviewer');
    question = last ? last.text : '';
  }
  if (!question) {
    toast('Nothing from the interviewer yet');
    return;
  }
  ask(question, { auto });
}

function onInterviewer(text) {
  if (active && active.auto && Date.now() - active.startedAt < MERGE_WINDOW_MS) {
    pending.unshift(active.question);
    cancelActive(true);
    renderAll();
  }
  pending.push(text);
  clearTimeout(pendingTimer);
  setStatus('Interviewer is asking…', true);
  pendingTimer = setTimeout(() => flushPending(true), QUESTION_PAUSE_MS);
}

function onTranscript(source, text) {
  if (!session || !useful(text)) return;
  const who = source === 'mic' ? 'you' : 'interviewer';
  session.turns.push({ who, text: text.trim(), t: Date.now() });
  if (session.turns.length > 400) session.turns = session.turns.slice(-400);
  setLane(who, text.trim(), false);
  renderTranscript();
  persist();
  if (who === 'interviewer') onInterviewer(text.trim());
}

function takeAudio(source, audio) {
  transcribeQueue = transcribeQueue
    .then(async () => onTranscript(source, await Llm.transcribe(runtime('transcription'), audio)))
    .catch((error) => {
      setStatus('Transcription failed');
      toast(error.message || 'Transcription failed');
    });
}

// ---------- listening ----------

function ensureListener() {
  if (window.autoListen) return window.autoListen;
  window.autoListen = new window.HelplyListen.AutoListen({
    onUtterance: (source, audio) => takeAudio(source, audio),
    onActivity: (source, on) => setLane(source === 'mic' ? 'you' : 'interviewer', undefined, on)
  });
  return window.autoListen;
}

function showAudioProblems(errors) {
  const speakerDown = errors.some((line) => line.startsWith('Speaker'));
  const micDown = errors.some((line) => line.startsWith('Microphone'));
  $('laneInterviewer').classList.toggle('off', speakerDown);
  $('laneYou').classList.toggle('off', micDown);
  if (!speakerDown) setLane('interviewer', 'Listening…');
  if (!micDown) setLane('you', 'Listening…');
  const notes = [];
  if (speakerDown) notes.push('Interviewer audio is off. Share the meeting tab with “Share tab audio” turned on.');
  if (micDown) notes.push('Your microphone is off. Allow microphone access.');
  $('audioWarnText').textContent = notes.join(' ');
  $('audioWarn').classList.toggle('hidden', notes.length === 0);
}

async function startListening() {
  try {
    const result = await ensureListener().start();
    listening = true;
    showAudioProblems(result.errors || []);
    setPill('Live', 'live');
    $('btnListen').textContent = 'Pause';
    setStatus('Listening');
  } catch (error) {
    listening = false;
    showAudioProblems(['Speaker', 'Microphone']);
    $('audioWarnText').textContent = `${error.message}. Click Reconnect audio to try again.`;
    setPill('Paused', 'paused');
    $('btnListen').textContent = 'Resume';
  }
}

function stopListening() {
  if (window.autoListen) window.autoListen.stop();
  listening = false;
  setLane('interviewer', undefined, false);
  setLane('you', undefined, false);
  setPill('Paused', 'paused');
  $('btnListen').textContent = 'Resume';
  setStatus('Paused');
}

// ---------- session ----------

async function startInterview() {
  const problem = missingSetup();
  if (problem) {
    refreshSetupWarn();
    openDrawer(false);
    return;
  }
  session = { id: uid(), profile: readProfile(), turns: [], qa: [], startedAt: Date.now() };
  persist();
  showLive();
  await startListening();
}

function endInterview() {
  if (!confirm('End this interview? The transcript and answers will be cleared.')) return;
  stopListening();
  cancelActive(false);
  clearTimeout(pendingTimer);
  pending = [];
  session = null;
  chrome.storage.local.remove('session');
  clearInterval(clockTimer);
  showSetup();
}

// ---------- events ----------

function onCardAction(event) {
  const btn = event.target.closest('[data-act], .copy-code');
  if (!btn || !session) return;
  if (btn.classList.contains('copy-code')) {
    navigator.clipboard.writeText(btn.closest('.code').querySelector('code').textContent).then(() => toast('Code copied'));
    return;
  }
  const id = btn.closest('[data-id]').dataset.id;
  const item = session.qa.find((x) => x.id === id);
  if (!item) return;
  if (btn.dataset.act === 'copy') {
    navigator.clipboard.writeText(item.answer || '').then(() => toast('Answer copied'));
    return;
  }
  ask(item.q, { mode: btn.dataset.act, item });
}

function wire() {
  chipGroup('pType');
  chipGroup('pStyle');
  $('profileForm').addEventListener('input', onProfileInput);

  $('btnStart').addEventListener('click', startInterview);
  $('btnSettings').addEventListener('click', () => openDrawer(Boolean(session)));
  $('btnContext').addEventListener('click', () => openDrawer(true));
  $('btnCloseDrawer').addEventListener('click', closeDrawer);
  $('drawer').addEventListener('click', (event) => {
    if (event.target === $('drawer')) closeDrawer();
  });
  $('btnHide').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'toggle-hide' }).catch(() => {}));

  $('btnListen').addEventListener('click', () => (listening ? stopListening() : startListening()));
  $('btnReconnect').addEventListener('click', startListening);
  $('btnEnd').addEventListener('click', endInterview);
  $('btnAnswerNow').addEventListener('click', () => flushPending(false));

  $('askForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const text = $('askInput').value.trim();
    if (!text) return;
    $('askInput').value = '';
    ask(text, { typed: true });
  });

  document.querySelector('.tabs').addEventListener('click', (event) => {
    const tab = event.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    $('answersPane').classList.toggle('hidden', tab.dataset.tab !== 'answers');
    $('transcriptPane').classList.toggle('hidden', tab.dataset.tab !== 'transcript');
  });

  $('current').addEventListener('click', onCardAction);
  $('history').addEventListener('click', onCardAction);

  $('transcriptionProvider').addEventListener('change', () => {
    captureRole('transcription', shownTranscription);
    shownTranscription = $('transcriptionProvider').value;
    showRole('transcription');
  });
  $('chatProvider').addEventListener('change', () => {
    captureRole('chat', shownChat);
    shownChat = $('chatProvider').value;
    showRole('chat');
  });

  $('btnSave').addEventListener('click', async () => {
    captureSettings();
    await chrome.storage.local.set({ settings });
    $('settingsStatus').textContent = 'Saved in this browser.';
    refreshSetupWarn();
    toast('Settings saved');
  });

  $('btnTest').addEventListener('click', async () => {
    $('settingsStatus').textContent = 'Testing…';
    try {
      const text = await Llm.chat(runtime('chat'), {
        system: 'Reply with the single word OK.',
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 5
      });
      $('settingsStatus').textContent = text ? 'Answers provider is working.' : 'The provider replied with nothing.';
    } catch (error) {
      $('settingsStatus').textContent = error.message;
    }
  });

  $('guardToggle').addEventListener('change', async () => {
    captureSettings();
    await chrome.storage.local.set({ settings });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('drawer').classList.contains('hidden')) closeDrawer();
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && session) {
      event.preventDefault();
      flushPending(false);
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== 'guard-event') return;
    const banner = $('guardBanner');
    if (message.active && message.hidden) {
      banner.textContent = 'You started sharing your entire screen, so Helply hid itself. Share only the meeting tab or window to keep using it.';
      banner.className = 'banner';
    } else if (message.active) {
      banner.textContent = 'Screen sharing is on. Helply is not in the shared tab or window.';
      banner.className = 'banner ok';
    } else {
      banner.textContent = 'Screen sharing stopped.';
      banner.className = 'banner ok';
      setTimeout(() => banner.classList.add('hidden'), 4000);
    }
  });
}

async function init() {
  wire();
  const catalog = await (await fetch(chrome.runtime.getURL('providers.json'))).json();
  providers = catalog.providers || {};
  const stored = await chrome.storage.local.get(['settings', 'session', 'profile']);
  settings = { ...settings, ...(stored.settings || {}) };
  if (!settings.providers) settings.providers = {};
  fillSettings();
  writeProfile((stored.session && stored.session.profile) || stored.profile);

  if (stored.session) {
    session = stored.session;
    showLive();
    stopListening();
    setStatus('Interview restored. Click Resume to keep listening.');
    $('audioWarnText').textContent = 'Your interview and its context were restored.';
    $('audioWarn').classList.remove('hidden');
    $('btnReconnect').textContent = 'Resume listening';
  } else {
    showSetup();
  }
}

init().catch((error) => toast(error.message));
