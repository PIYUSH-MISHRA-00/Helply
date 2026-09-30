(function (root) {
  function joinUrl(baseUrl, endpoint) {
    return `${String(baseUrl || '').replace(/\/+$/, '')}/${String(endpoint || '').replace(/^\/+/, '')}`;
  }

  function bytesFromBase64(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function check(runtime, what) {
    if (!runtime.supports) throw new Error(`${runtime.label} does not support ${what}. Pick another provider in Settings.`);
    if (runtime.apiKeyRequired && !runtime.apiKey) throw new Error(`Add your ${runtime.label} API key in Settings.`);
    if (!runtime.baseUrl) throw new Error(`Add a base URL for ${runtime.label} in Settings.`);
    if (!runtime.model) throw new Error(`Pick a ${what} model for ${runtime.label} in Settings.`);
  }

  async function fail(response) {
    const body = await response.text().catch(() => '');
    throw new Error(`Provider error ${response.status}: ${body.slice(0, 300) || response.statusText}`);
  }

  function bearer(runtime) {
    return runtime.apiKey ? { Authorization: `Bearer ${runtime.apiKey}` } : {};
  }

  async function transcribe(runtime, wavBase64) {
    check(runtime, 'transcription');
    const form = new FormData();
    form.append('model', runtime.model);
    form.append('response_format', 'text');
    form.append('file', new Blob([bytesFromBase64(wavBase64)], { type: 'audio/wav' }), 'audio.wav');
    const response = await fetch(joinUrl(runtime.baseUrl, '/audio/transcriptions'), {
      method: 'POST',
      headers: bearer(runtime),
      body: form
    });
    if (!response.ok) await fail(response);
    return (await response.text()).trim();
  }

  async function readSse(response, onText) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return full;
        try {
          const delta = JSON.parse(data).choices?.[0]?.delta?.content || '';
          if (delta) {
            full += delta;
            onText(full);
          }
        } catch (error) {
          // Ignore keep-alive and partial lines.
        }
      }
    }
    return full;
  }

  // request: { system, messages, maxTokens }. onText gets the full text so far.
  async function chat(runtime, request, onText, signal) {
    check(runtime, 'chat');
    const emit = onText || (() => {});
    const messages = request.messages || [];

    if (runtime.type === 'anthropic') {
      const response = await fetch(joinUrl(runtime.baseUrl, '/v1/messages'), {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': runtime.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({ model: runtime.model, max_tokens: request.maxTokens || 1000, system: request.system, messages })
      });
      if (!response.ok) await fail(response);
      const text = String((await response.json())?.content?.[0]?.text || '').trim();
      emit(text);
      return text;
    }

    const withSystem = [{ role: 'system', content: request.system }, ...messages];

    if (runtime.type === 'ollama') {
      const response = await fetch(joinUrl(runtime.baseUrl, '/api/chat'), {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: runtime.model, messages: withSystem, stream: false })
      });
      if (!response.ok) await fail(response);
      const text = String((await response.json())?.message?.content || '').trim();
      emit(text);
      return text;
    }

    const response = await fetch(joinUrl(runtime.baseUrl, '/chat/completions'), {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', ...bearer(runtime) },
      body: JSON.stringify({
        model: runtime.model,
        messages: withSystem,
        temperature: 0.5,
        max_tokens: request.maxTokens || 800,
        stream: true
      })
    });
    if (!response.ok) await fail(response);
    if (String(response.headers.get('content-type') || '').includes('text/event-stream')) {
      return (await readSse(response, emit)).trim();
    }
    const text = String((await response.json())?.choices?.[0]?.message?.content || '').trim();
    emit(text);
    return text;
  }

  root.HelplyLlm = { transcribe, chat };
})(typeof window !== 'undefined' ? window : globalThis);
