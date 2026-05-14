const { getProviderRuntime } = require('./config');

const REQUEST_TIMEOUT_MS = 120000;

function joinUrl(baseUrl, endpoint) {
  const cleanBase = String(baseUrl || '').replace(/\/+$/, '');
  const cleanEndpoint = String(endpoint || '').replace(/^\/+/, '');
  return `${cleanBase}/${cleanEndpoint}`;
}

function buildAuthHeaders(apiKey) {
  if (!apiKey) {
    return {};
  }

  return {
    Authorization: `Bearer ${apiKey}`
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function postJson(url, payload, headers = {}) {
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Request failed (${response.status}): ${errorBody || response.statusText}`);
  }

  return response.json();
}

function isCodingPrompt(prompt) {
  const lowerPrompt = String(prompt || '').toLowerCase();
  const codeIndicators = [
    'code', 'program', 'implement', 'function', 'class', 'algorithm',
    'loop', 'array', 'python', 'java', 'c++', 'javascript', 'sql',
    'develop a', 'write a', 'create a', 'build a', 'snippet', 'fibonacci',
    'armstrong', 'prime', 'factorial', 'sort', 'search', 'print'
  ];

  return codeIndicators.some((word) => lowerPrompt.includes(word));
}

function buildSystemPrompt() {
  return `You are an expert interview assistant that gives structured, speakable answers in an interview format.

For ALL questions, provide BOTH explanations:
1. Layman Explanation: Simple, easy-to-understand explanation as if explaining to someone without technical background (2-3 sentences)
2. Professional Explanation: Detailed, technical explanation suitable for a professional interview setting (3-4 sentences)

For coding/technical questions ALSO provide:
3. Code Implementation: Complete, runnable code in appropriate language with proper syntax
4. Code Walkthrough: Brief explanation of how the code works (2-3 sentences)

Format your responses EXACTLY like this:

## Code Implementation
\`\`\`[language]
[your complete code here]
\`\`\`

## Code Walkthrough
[Explanation of how the code works]

## Professional Explanation
[Detailed technical explanation with relevant terminology]

## Layman Explanation
[Simple explanation in plain English]

General rules:
- Keep answers professional, complete, and neatly formatted
- Do NOT stop mid-explanation or mid-code
- For coding questions, make sure the code is runnable and complete with all necessary parts
- Never include introductory phrases like "Sure, here's..." or similar
- Directly start with the explanations
- Always provide both layman and professional explanations for every question
- Only add code section if the question is specifically asking for code`;
}

function buildMessages(prompt, conversationHistory = []) {
  const wantsCode = isCodingPrompt(prompt);

  return {
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt()
      },
      ...conversationHistory,
      {
        role: 'user',
        content: `Provide a complete interview-ready response with both layman and professional explanations${wantsCode ? ' and code implementation' : ''}:\n\n${prompt}`
      }
    ],
    maxTokens: wantsCode ? 1200 : 700
  };
}

function formatResponse(response) {
  if (!response) return '';

  let normalized = String(response);

  normalized = normalized.replace(/^Sure, here[^\n]*\n?/i, '');
  normalized = normalized.replace(/^Here[^\n]*response[^\n]*\n?/i, '');
  normalized = normalized.replace(/^I can help you with that[^\n]*\n?/i, '');
  normalized = normalized.replace(/^Here's a concise[^\n]*\n?/i, '');
  normalized = normalized.replace(/^Here's how you can[^\n]*\n?/i, '');
  normalized = normalized.replace(/\n{3,}/g, '\n\n');

  return normalized.trim();
}

class BaseProvider {
  constructor(providerName) {
    this.providerName = providerName;
    this.runtime = getProviderRuntime(providerName);
  }

  ensureApiKey() {
    if (this.runtime.apiKeyRequired && !this.runtime.apiKey) {
      throw new Error(`${this.runtime.config.name} API key is required. Open Settings to add it.`);
    }
  }

  ensureBaseUrl() {
    if (!this.runtime.baseUrl) {
      throw new Error(`${this.runtime.config.name} base URL is missing. Open Settings to configure it.`);
    }
  }

  async transcribeAudio() {
    throw new Error(`Transcription is not implemented for ${this.runtime.config.name}.`);
  }

  async getChatResponse() {
    throw new Error(`Chat is not implemented for ${this.runtime.config.name}.`);
  }
}

class OpenAICompatibleProvider extends BaseProvider {
  async transcribeAudio(audioBuffer) {
    if (!this.runtime.supportsTranscription) {
      throw new Error(`${this.runtime.config.name} does not support transcription.`);
    }

    this.ensureApiKey();
    this.ensureBaseUrl();

    const model = this.runtime.transcriptionModel;
    if (!model) {
      throw new Error(`No transcription model configured for ${this.runtime.config.name}.`);
    }

    const formData = new FormData();
    formData.append('model', model);
    formData.append('response_format', 'text');
    formData.append('file', new Blob([audioBuffer], { type: 'audio/webm' }), 'audio.webm');

    const response = await fetchWithTimeout(
      joinUrl(this.runtime.baseUrl, '/audio/transcriptions'),
      {
        method: 'POST',
        headers: buildAuthHeaders(this.runtime.apiKey),
        body: formData
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Transcription failed (${response.status}): ${errorBody || response.statusText}`);
    }

    const text = await response.text();
    return String(text || '').trim();
  }

  async getChatResponse(prompt, conversationHistory = []) {
    if (!this.runtime.supportsChat) {
      throw new Error(`${this.runtime.config.name} does not support chat.`);
    }

    this.ensureApiKey();
    this.ensureBaseUrl();

    const model = this.runtime.chatModel;
    if (!model) {
      throw new Error(`No chat model configured for ${this.runtime.config.name}.`);
    }

    const { messages, maxTokens } = buildMessages(prompt, conversationHistory);

    const completion = await postJson(
      joinUrl(this.runtime.baseUrl, '/chat/completions'),
      {
        model,
        messages,
        temperature: 0.7,
        max_tokens: maxTokens,
        top_p: 1,
        stream: false
      },
      buildAuthHeaders(this.runtime.apiKey)
    );

    return formatResponse(completion?.choices?.[0]?.message?.content || '');
  }
}

class AnthropicProvider extends BaseProvider {
  async getChatResponse(prompt, conversationHistory = []) {
    if (!this.runtime.supportsChat) {
      throw new Error(`${this.runtime.config.name} does not support chat.`);
    }

    this.ensureApiKey();
    this.ensureBaseUrl();

    const model = this.runtime.chatModel;
    if (!model) {
      throw new Error('No Anthropic chat model configured.');
    }

    const { messages } = buildMessages(prompt, conversationHistory);

    const anthropicMessages = messages
      .filter((item) => item.role !== 'system')
      .map((item) => ({ role: item.role, content: item.content }));

    const response = await postJson(
      joinUrl(this.runtime.baseUrl, '/v1/messages'),
      {
        model,
        max_tokens: 1200,
        system: buildSystemPrompt(),
        messages: anthropicMessages
      },
      {
        'x-api-key': this.runtime.apiKey,
        'anthropic-version': '2023-06-01'
      }
    );

    return formatResponse(response?.content?.[0]?.text || '');
  }
}

class OllamaProvider extends BaseProvider {
  async getChatResponse(prompt) {
    if (!this.runtime.supportsChat) {
      throw new Error(`${this.runtime.config.name} does not support chat.`);
    }

    this.ensureBaseUrl();

    const model = this.runtime.chatModel;
    if (!model) {
      throw new Error('No Ollama model configured.');
    }

    const response = await postJson(joinUrl(this.runtime.baseUrl, '/api/generate'), {
      model,
      prompt: `${buildSystemPrompt()}\n\n${prompt}`,
      stream: false
    });

    return formatResponse(response?.response || '');
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

  getTranscriptionProvider() {
    return createProvider(this.configModule.config.transcriptionProvider);
  }

  getChatProvider() {
    return createProvider(this.configModule.config.chatProvider);
  }

  async transcribeAudio(audioBuffer) {
    const provider = this.getTranscriptionProvider();
    return provider.transcribeAudio(audioBuffer);
  }

  async getAIResponse(prompt, conversationHistory = []) {
    const provider = this.getChatProvider();
    return provider.getChatResponse(prompt, conversationHistory);
  }
}

module.exports = new LLMService();
