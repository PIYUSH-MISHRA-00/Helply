function joinUrl(baseUrl, endpoint) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const path = String(endpoint || '').replace(/^\/+/, '');
  return `${base}/${path}`;
}

function bytesFromBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function isCodingPrompt(prompt) {
  const lower = String(prompt || '').toLowerCase();
  const words = ['code', 'program', 'implement', 'function', 'class', 'algorithm', 'python', 'java', 'javascript', 'sql', 'write a', 'create a'];
  return words.some((word) => lower.includes(word));
}

function systemPrompt() {
  return `You are an expert interview assistant that gives structured, speakable answers in an interview format.

For ALL questions, provide BOTH explanations:
1. Layman Explanation: Simple, easy-to-understand explanation (2-3 sentences)
2. Professional Explanation: Detailed technical explanation (3-4 sentences)

For coding/technical questions ALSO provide:
3. Code Implementation: Complete, runnable code
4. Code Walkthrough: Brief explanation of how the code works

Format your responses EXACTLY like this:

## Code Implementation
\`\`\`[language]
[your complete code here]
\`\`\`

## Code Walkthrough
[Explanation of how the code works]

## Professional Explanation
[Detailed technical explanation]

## Layman Explanation
[Simple explanation in plain English]

General rules:
- Keep answers professional and complete
- Never include introductory phrases like "Sure, here's..."
- Always provide both layman and professional explanations
- Only add the code sections if the question asks for code`;
}

function messagesFor(prompt, history) {
  const wantsCode = isCodingPrompt(prompt);
  return {
    messages: [
      { role: 'system', content: systemPrompt() },
      ...history,
      {
        role: 'user',
        content: `Provide a complete interview-ready response with both layman and professional explanations${wantsCode ? ' and code implementation' : ''}:\n\n${prompt}`
      }
    ],
    maxTokens: wantsCode ? 1200 : 700
  };
}

async function readError(response) {
  const body = await response.text();
  throw new Error(`Request failed (${response.status}): ${body || response.statusText}`);
}

async function transcribe(runtime, wavBase64) {
  if (!runtime.supports) throw new Error(`${runtime.label} does not support transcription.`);
  if (runtime.apiKeyRequired && !runtime.apiKey) throw new Error(`${runtime.label} API key is required.`);
  if (!runtime.baseUrl) throw new Error(`${runtime.label} base URL is required.`);
  if (!runtime.model) throw new Error(`No transcription model configured for ${runtime.label}.`);

  const form = new FormData();
  form.append('model', runtime.model);
  form.append('response_format', 'text');
  form.append('file', new Blob([bytesFromBase64(wavBase64)], { type: 'audio/wav' }), 'audio.wav');

  const headers = {};
  if (runtime.apiKey) headers.Authorization = `Bearer ${runtime.apiKey}`;
  const response = await fetch(joinUrl(runtime.baseUrl, '/audio/transcriptions'), {
    method: 'POST',
    headers,
    body: form
  });
  if (!response.ok) await readError(response);
  return (await response.text()).trim();
}

async function chat(runtime, prompt, history) {
  if (!runtime.supports) throw new Error(`${runtime.label} does not support chat.`);
  if (runtime.apiKeyRequired && !runtime.apiKey) throw new Error(`${runtime.label} API key is required.`);
  if (!runtime.baseUrl) throw new Error(`${runtime.label} base URL is required.`);
  if (!runtime.model) throw new Error(`No chat model configured for ${runtime.label}.`);

  if (runtime.type === 'anthropic') {
    const { messages } = messagesFor(prompt, history);
    const response = await fetch(joinUrl(runtime.baseUrl, '/v1/messages'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': runtime.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: runtime.model,
        max_tokens: 1200,
        system: systemPrompt(),
        messages: messages.filter((item) => item.role !== 'system')
      })
    });
    if (!response.ok) await readError(response);
    const data = await response.json();
    return String(data?.content?.[0]?.text || '').trim();
  }

  if (runtime.type === 'ollama') {
    const response = await fetch(joinUrl(runtime.baseUrl, '/api/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: runtime.model,
        prompt: `${systemPrompt()}\n\n${prompt}`,
        stream: false
      })
    });
    if (!response.ok) await readError(response);
    const data = await response.json();
    return String(data?.response || '').trim();
  }

  const { messages, maxTokens } = messagesFor(prompt, history);
  const headers = { 'Content-Type': 'application/json' };
  if (runtime.apiKey) headers.Authorization = `Bearer ${runtime.apiKey}`;
  const response = await fetch(joinUrl(runtime.baseUrl, '/chat/completions'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: runtime.model,
      messages,
      temperature: 0.7,
      max_tokens: maxTokens,
      stream: false
    })
  });
  if (!response.ok) await readError(response);
  const data = await response.json();
  return String(data?.choices?.[0]?.message?.content || '').trim();
}

window.HelplyLlm = { transcribe, chat };
