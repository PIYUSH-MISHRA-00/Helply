const { getProviderRuntime } = require('./config');

const REQUEST_TIMEOUT_MS = 120000;

function joinUrl(baseUrl, endpoint) {
  const cleanBase = String(baseUrl || '').replace(/\/+$/, '');
  const cleanEndpoint = String(endpoint || '').replace(/^\/+/, '');
  return `${cleanBase}/${cleanEndpoint}`;
}

function buildAuthHeaders(apiKey) {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

async function fetchWithTimeout(url, options = {}, signal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('The AI provider took too long to reply.')), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort(signal.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

function friendlyError(providerName, status, body) {
  if (status === 401 || status === 403) {
    return new Error(`${providerName} rejected the API key. Open Settings and paste a valid key.`);
  }
  if (status === 429) {
    return new Error(`${providerName} rate limit reached. Wait a few seconds and it will answer again.`);
  }
  if (status === 413) {
    return new Error(`${providerName} said the request is too large. Shorten the resume or job description.`);
  }
  let message = body;
  try {
    message = JSON.parse(body).error.message || body;
  } catch (error) {
    // Not JSON, keep the raw text.
  }
  return new Error(`${providerName} error (${status}): ${String(message || '').slice(0, 300)}`);
}

async function postJson(providerName, url, payload, headers, signal) {
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload)
  }, signal);
  if (!response.ok) throw friendlyError(providerName, response.status, await response.text());
  return response.json();
}

function formatResponse(response) {
  return String(response || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^(Sure|Certainly|Great question)[^\n]*\n?/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Reasoning models spend part of max_tokens thinking; keep that short so the answer is not cut off.
function reasoningOptions(model) {
  return /gpt-oss/i.test(model) ? { reasoning_effort: 'low' } : {};
}

class BaseProvider {
  constructor(providerName) {
    this.providerName = providerName;
    this.runtime = getProviderRuntime(providerName);
    this.label = this.runtime.config.name || providerName;
  }

  ensureReady(kind) {
    const supported = kind === 'chat' ? this.runtime.supportsChat : this.runtime.supportsTranscription;
    if (!supported) throw new Error(`${this.label} does not support ${kind === 'chat' ? 'answers' : 'transcription'}. Pick another provider in Settings.`);
    if (this.runtime.apiKeyRequired && !this.runtime.apiKey) throw new Error(`Add your ${this.label} API key in Settings.`);
    if (!this.runtime.baseUrl) throw new Error(`${this.label} base URL is missing. Open Settings to set it.`);
    const model = kind === 'chat' ? this.runtime.chatModel : this.runtime.transcriptionModel;
    if (!model) throw new Error(`No ${kind === 'chat' ? 'chat' : 'transcription'} model set for ${this.label}.`);
    return model;
  }

  async transcribeAudio() {
    throw new Error(`${this.label} does not support transcription. Pick another provider in Settings.`);
  }
}

class OpenAICompatibleProvider extends BaseProvider {
  async transcribeAudio(audioBuffer) {
    const model = this.ensureReady('transcription');
    const isWav = audioBuffer.length >= 12 && audioBuffer.toString('ascii', 0, 4) === 'RIFF';
    const formData = new FormData();
    formData.append('model', model);
    formData.append('response_format', 'text');
    formData.append('file', new Blob([audioBuffer], { type: isWav ? 'audio/wav' : 'audio/webm' }), isWav ? 'audio.wav' : 'audio.webm');

    const response = await fetchWithTimeout(joinUrl(this.runtime.baseUrl, '/audio/transcriptions'), {
      method: 'POST',
      headers: buildAuthHeaders(this.runtime.apiKey),
      body: formData
    });
    if (!response.ok) throw friendlyError(this.label, response.status, await response.text());
    return String((await response.text()) || '').trim();
  }

  async chat(request, signal) {
    const model = this.ensureReady('chat');
    const completion = await postJson(this.label, joinUrl(this.runtime.baseUrl, '/chat/completions'), {
      model,
      messages: [{ role: 'system', content: request.system }, ...request.messages],
      temperature: 0.5,
      max_tokens: request.maxTokens,
      stream: false,
      ...reasoningOptions(model)
    }, buildAuthHeaders(this.runtime.apiKey), signal);
    return formatResponse(completion?.choices?.[0]?.message?.content);
  }
}

class AnthropicProvider extends BaseProvider {
  async chat(request, signal) {
    const model = this.ensureReady('chat');
    const response = await postJson(this.label, joinUrl(this.runtime.baseUrl, '/v1/messages'), {
      model,
      max_tokens: request.maxTokens,
      system: request.system,
      messages: request.messages
    }, { 'x-api-key': this.runtime.apiKey, 'anthropic-version': '2023-06-01' }, signal);
    return formatResponse((response?.content || []).map((part) => part.text || '').join(''));
  }
}

class OllamaProvider extends BaseProvider {
  async chat(request, signal) {
    const model = this.ensureReady('chat');
    const response = await postJson(this.label, joinUrl(this.runtime.baseUrl, '/api/chat'), {
      model,
      messages: [{ role: 'system', content: request.system }, ...request.messages],
      stream: false,
      options: { num_predict: request.maxTokens }
    }, {}, signal);
    return formatResponse(response?.message?.content);
  }
}

function createProvider(providerName) {
  const runtime = getProviderRuntime(providerName);
  switch (runtime.type) {
    case 'openai_compatible':
      return new OpenAICompatibleProvider(providerName);
    case 'anthropic':
      return new AnthropicProvider(providerName);
    case 'ollama':
      return new OllamaProvider(providerName);
    default:
      throw new Error(`Unsupported provider type: ${runtime.type}`);
  }
}

class LLMService {
  constructor() {
    this.configModule = require('./config');
  }

  async transcribeAudio(audioBuffer) {
    return createProvider(this.configModule.config.transcriptionProvider).transcribeAudio(audioBuffer);
  }

  // request: { system, messages, maxTokens } from interview.buildRequest
  async chat(request, signal) {
    return createProvider(this.configModule.config.chatProvider).chat(request, signal);
  }
}

module.exports = new LLMService();
