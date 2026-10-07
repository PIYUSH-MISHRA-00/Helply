const { app, BrowserWindow, ipcMain, session, desktopCapturer, safeStorage } = require('electron')
const path = require('path')
const fs = require('fs')
if (app.isPackaged && !process.env.HELPLY_ENV_PATH) {
  process.env.HELPLY_ENV_PATH = path.join(app.getPath('userData'), '.env')
}
const llmService = require('./llm-service')
const config = require('./config')
const Interview = require('./interview')

let mainWindow = null
const interview = Interview.createSession()

// The interviewer often pauses mid-question. Wait this long after the last words before answering.
const QUESTION_PAUSE_MS = 1300
// If no transcript follows a burst of speech (noise, a cough), answer what we have after this.
const SPEECH_END_FALLBACK_MS = 2600
// If the interviewer keeps talking this soon after an answer started, restart with the full question.
const MERGE_WINDOW_MS = 7000

let pendingQuestion = []
let pendingTimer = null
let speakerSpeaking = false
let activeAnswer = null
let answerSeq = 0

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
}

function enableSystemAudioLoopback() {
  const ses = session.defaultSession
  if (!ses || typeof ses.setDisplayMediaRequestHandler !== 'function') return

  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'] })
      if (!sources.length) {
        callback({})
        return
      }
      // Loopback is the speakers. The mic stays on getUserMedia so the two never mix.
      callback({ video: sources[0], audio: 'loopback' })
    } catch (error) {
      console.error('System audio loopback failed:', error)
      callback({})
    }
  })
}

// ---------- interview flow ----------

const WHISPER_JUNK = new Set([
  'you', 'thank you', 'thank you.', 'thanks for watching', 'thanks for watching.',
  'thanks for watching!', '.', '...', 'bye.', 'okay.'
])

function isUsefulTranscript(text) {
  const cleaned = String(text || '').trim()
  return cleaned.length >= 2 && !WHISPER_JUNK.has(cleaned.toLowerCase())
}

function schedulePending(ms) {
  clearTimeout(pendingTimer)
  pendingTimer = setTimeout(flushPending, ms)
}

function flushPending() {
  clearTimeout(pendingTimer)
  pendingTimer = null
  const question = pendingQuestion.join(' ').replace(/\s+/g, ' ').trim()
  pendingQuestion = []
  if (!question) return
  // Pause must not cancel an answer that is already on its way. Ask this one when it lands.
  if (activeAnswer) {
    pendingQuestion = [question]
    return
  }
  answer(question, { auto: true })
}

function onSpeakerText(text, cut, paused) {
  Interview.addTurn(interview, 'speaker', text)
  send('speaker-transcript', text)
  if (!paused && activeAnswer && activeAnswer.auto && Date.now() - activeAnswer.startedAt < MERGE_WINDOW_MS) {
    pendingQuestion.unshift(activeAnswer.question)
    activeAnswer.controller.abort()
    send('answer-cancelled', { id: activeAnswer.id })
    activeAnswer = null
  }
  pendingQuestion.push(text)
  if (!paused) send('answer-status', 'Interviewer is speaking…')
  // A chunk cut only for length, or speech already under way, means the question is not finished.
  // Pause is the end of what we heard, so that part is answered.
  if (paused) schedulePending(0)
  else if (cut || speakerSpeaking) clearTimeout(pendingTimer)
  else schedulePending(QUESTION_PAUSE_MS)
}

async function answer(question, options = {}) {
  if (activeAnswer) {
    activeAnswer.controller.abort()
    send('answer-cancelled', { id: activeAnswer.id })
  }
  const id = ++answerSeq
  const controller = new AbortController()
  const request = Interview.buildRequest(interview, question)
  activeAnswer = { id, question, controller, startedAt: Date.now(), auto: Boolean(options.auto) }
  send('question', { id, text: question, type: request.type, typed: Boolean(options.typed) })
  send('answer-status', 'Writing answer…')

  try {
    const text = await llmService.chat(request, controller.signal)
    if (controller.signal.aborted) return
    const reply = text || 'The model returned an empty answer. Try again, or pick another chat model in Settings.'
    if (text) Interview.recordAnswer(interview, question, request.type, text)
    send('answer', { id, text: reply })
  } catch (error) {
    if (controller.signal.aborted) return
    console.error('Answer failed:', error.message)
    send('answer', { id, text: error.message || 'Could not get an answer.', error: true })
  } finally {
    if (activeAnswer && activeAnswer.id === id) activeAnswer = null
  }
  if (!activeAnswer && pendingQuestion.length) flushPending()
  else if (!activeAnswer) send('answer-status', 'Listening')
}

let utteranceQueue = Promise.resolve()

async function handleUtterance(data) {
  const source = data && data.source
  const audio = data && data.audio
  if ((source !== 'speaker' && source !== 'mic') || !audio) return

  const audioBuffer = Buffer.from(audio, 'base64')
  if (audioBuffer.length < (data.paused ? 100 : 1000)) return

  const transcription = await llmService.transcribeAudio(audioBuffer)
  if (!isUsefulTranscript(transcription)) {
    if (source === 'speaker' && pendingQuestion.length && !data.cut) schedulePending(QUESTION_PAUSE_MS)
    return
  }
  const text = String(transcription).trim()

  if (source === 'mic') {
    // The candidate's own words are context for follow-ups, not something to answer.
    Interview.addTurn(interview, 'mic', text)
    send('mic-transcript', text)
    return
  }
  onSpeakerText(text, Boolean(data.cut), Boolean(data.paused))
}

ipcMain.on('utterance', (event, data) => {
  utteranceQueue = utteranceQueue
    .then(() => handleUtterance(data))
    .catch((error) => {
      console.error('Utterance failed:', error.message)
      send('transcription-error', error.message || 'Transcription failed')
    })
})

ipcMain.on('speaker-activity', (event, active) => {
  speakerSpeaking = Boolean(active)
  if (speakerSpeaking) clearTimeout(pendingTimer)
  else if (pendingQuestion.length) schedulePending(SPEECH_END_FALLBACK_MS)
})

ipcMain.on('set-context', (event, context) => {
  Interview.setContext(interview, context)
})

ipcMain.on('ask', (event, data) => {
  const question = String((data && data.question) || '').trim()
  if (!question) return
  clearTimeout(pendingTimer)
  pendingQuestion = []
  Interview.addTurn(interview, 'speaker', question)
  answer(question, { typed: true })
})

ipcMain.on('answer-now', () => {
  if (pendingQuestion.length) {
    flushPending()
    return
  }
  const last = [...interview.turns].reverse().find((turn) => turn.who === 'speaker')
  if (last) answer(last.text, { auto: false })
  else send('answer-status', 'Nothing from the interviewer yet')
})

ipcMain.on('reset-transcript', () => {
  if (activeAnswer) activeAnswer.controller.abort()
  activeAnswer = null
  clearTimeout(pendingTimer)
  pendingQuestion = []
  interview.turns = []
  interview.qa = []
})

// ---------- window ----------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 560,
    height: 760,
    minWidth: 380,
    minHeight: 620,
    alwaysOnTop: true,
    // Packaged builds use the exe icon, which build-win sets to the Chrome logo.
    icon: app.isPackaged
      ? undefined
      : fs.existsSync(path.join(__dirname, 'build/chrome-icon.png'))
        ? path.join(__dirname, 'build/chrome-icon.png')
        : path.join(__dirname, 'assets/icons/icon.png'),
    backgroundColor: '#07080d',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false
    }
  })

  mainWindow.loadFile('index.html')

  if (process.platform === 'darwin') {
    mainWindow.once('ready-to-show', () => {
      mainWindow.show()
      app.dock.show()
      mainWindow.moveTop()
    })
  } else if (process.platform === 'win32') {
    app.setAppUserModelId('com.helply.assistant')
  }

  // Invisible to screen capture, including a full-screen share, while staying
  // visible and usable on this machine. Applied before the window is shown.
  setHidden(mainWindow, true)
  mainWindow.on('ready-to-show', () => setHidden(mainWindow, true))

  // A crashed renderer leaves a blank window; reload it and keep the interview memory.
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Window crashed:', details.reason)
    if (details.reason !== 'clean-exit' && mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => mainWindow.reload(), 500)
    }
  })
  mainWindow.on('unresponsive', () => console.error('Window is not responding'))
}

function setHidden(win, hidden) {
  if (!win || win.isDestroyed()) return
  try {
    win.setContentProtection(hidden)
    if (process.platform === 'darwin') {
      win.setVisibleOnAllWorkspaces(hidden, { visibleOnFullScreen: true })
      win.setAlwaysOnTop(true, hidden ? 'floating' : 'normal', 1)
    } else if (process.platform === 'win32') {
      win.setAlwaysOnTop(true, hidden ? 'screen-saver' : 'normal', 1)
    }
  } catch (error) {
    console.error('Could not change screen-capture protection:', error)
  }
}

ipcMain.on('toggle-screen-sharing-mode', (event, hidden) => {
  setHidden(mainWindow, Boolean(hidden))
  send('screen-sharing-active', Boolean(hidden))
})

ipcMain.handle('get-context', () => ({ resume: interview.resume, jobDescription: interview.jobDescription }))

// ---------- settings ----------

ipcMain.handle('get-settings', async () => config.getConfig())

ipcMain.handle('update-settings', async (event, settings) => {
  config.updateConfig(settings)
  return true
})

function joinUrl(baseUrl, endpoint) {
  const cleanBase = String(baseUrl || '').replace(/\/+$/, '')
  const cleanEndpoint = String(endpoint || '').replace(/^\/+/, '')
  return `${cleanBase}/${cleanEndpoint}`
}

function mergedProviderRuntime(providerName, draftSettings = {}) {
  const allProviders = (config.providersConfig && config.providersConfig.providers) || {}
  const providerConfig = allProviders[providerName]
  if (!providerConfig) throw new Error(`Unknown provider: ${providerName}`)

  const currentSettings = (config.getConfig().providerSettings || {})[providerName] || {}
  const draftProviderSettings = (draftSettings.providerSettings || {})[providerName] || {}
  const settings = { ...currentSettings, ...draftProviderSettings }

  return {
    name: providerName,
    type: providerConfig.type || 'openai_compatible',
    config: providerConfig,
    apiKeyRequired: Boolean(providerConfig.apiKeyRequired),
    supportsChat: Boolean(providerConfig.chat?.enabled),
    supportsTranscription: Boolean(providerConfig.transcription?.enabled),
    apiKey: String(settings.apiKey || '').trim(),
    baseUrl: String(settings.baseUrl || providerConfig.baseUrl || '').trim(),
    chatModel: String(settings.chatModel || providerConfig.chat?.defaultModel || '').trim(),
    transcriptionModel: String(settings.transcriptionModel || providerConfig.transcription?.defaultModel || '').trim()
  }
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const responseText = await response.text()
    let json
    try {
      json = responseText ? JSON.parse(responseText) : null
    } catch {
      json = null
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('The API key was rejected. Check that it is copied in full and still active.')
    }
    if (!response.ok) {
      const message = json?.error?.message || responseText || response.statusText || `HTTP ${response.status}`
      if (json?.error?.code === 'model_not_found') {
        throw new Error(`${message} Choose another model in Settings.`)
      }
      throw new Error(message)
    }
    return json
  } finally {
    clearTimeout(timer)
  }
}

async function testChatConnection(runtime) {
  if (!runtime.supportsChat) return { ok: false, mode: 'chat', message: `${runtime.config.name} does not support chat.` }
  if (!runtime.baseUrl) return { ok: false, mode: 'chat', message: 'Base URL is required.' }
  if (runtime.apiKeyRequired && !runtime.apiKey) return { ok: false, mode: 'chat', message: 'API key is required.' }

  try {
    if (runtime.type === 'anthropic') {
      await fetchJsonWithTimeout(joinUrl(runtime.baseUrl, '/v1/messages'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': runtime.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: runtime.chatModel, max_tokens: 1, messages: [{ role: 'user', content: 'Ping' }] })
      })
    } else if (runtime.type === 'ollama') {
      await fetchJsonWithTimeout(joinUrl(runtime.baseUrl, '/api/tags'))
    } else {
      const headers = { 'Content-Type': 'application/json' }
      if (runtime.apiKey) headers.Authorization = `Bearer ${runtime.apiKey}`
      const body = { model: runtime.chatModel, messages: [{ role: 'user', content: 'Reply with the single word OK' }], max_tokens: 64, temperature: 0 }
      // Reasoning models spend a 1-token budget thinking and return an empty answer.
      if (/gpt-oss/i.test(runtime.chatModel)) body.reasoning_effort = 'low'
      const completion = await fetchJsonWithTimeout(joinUrl(runtime.baseUrl, '/chat/completions'), {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })
      const answer = completion?.choices?.[0]?.message?.content
      if (!String(answer || '').trim()) {
        return { ok: false, mode: 'chat', message: `${runtime.config.name} accepted the key, but ${runtime.chatModel} returned no answer. Choose another chat model.` }
      }
    }
    return { ok: true, mode: 'chat', message: `${runtime.config.name} accepted the key and answered.` }
  } catch (error) {
    return { ok: false, mode: 'chat', message: error.message || 'Chat test failed.' }
  }
}

async function testTranscriptionConnection(runtime) {
  if (!runtime.supportsTranscription) return { ok: false, mode: 'transcription', message: `${runtime.config.name} does not support transcription.` }
  if (!runtime.baseUrl) return { ok: false, mode: 'transcription', message: 'Base URL is required.' }
  if (runtime.apiKeyRequired && !runtime.apiKey) return { ok: false, mode: 'transcription', message: 'API key is required.' }

  try {
    const headers = runtime.apiKey ? { Authorization: `Bearer ${runtime.apiKey}` } : {}
    await fetchJsonWithTimeout(joinUrl(runtime.baseUrl, '/models'), { headers })
    return { ok: true, mode: 'transcription', message: `${runtime.config.name} authentication is valid.` }
  } catch (error) {
    return { ok: false, mode: 'transcription', message: error.message || 'Transcription test failed.' }
  }
}

ipcMain.handle('test-provider-connection', async (event, draftSettings) => {
  const transcriptionProvider = draftSettings?.transcriptionProvider || config.getConfig().transcriptionProvider
  const chatProvider = draftSettings?.chatProvider || config.getConfig().chatProvider
  const checks = []

  try {
    checks.push(await testChatConnection(mergedProviderRuntime(chatProvider, draftSettings || {})))
  } catch (error) {
    checks.push({ ok: false, mode: 'chat', message: error.message || 'Chat provider test failed.' })
  }
  try {
    checks.push(await testTranscriptionConnection(mergedProviderRuntime(transcriptionProvider, draftSettings || {})))
  } catch (error) {
    checks.push({ ok: false, mode: 'transcription', message: error.message || 'Transcription provider test failed.' })
  }
  return { ok: checks.every((item) => item.ok), checks }
})

// ---------- app ----------

// Two copies would fight over the speakers and microphone, so focus the open one instead.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    config.loadSettings({
      path: process.env.HELPLY_SETTINGS_PATH || path.join(app.getPath('userData'), 'settings.json'),
      safeStorage,
      migratedEnvPath: app.isPackaged ? process.env.HELPLY_ENV_PATH : ''
    })
    enableSystemAudioLoopback()
    createWindow()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error)
})
