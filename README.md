# Helply AI Meeting Assistant

![License](https://img.shields.io/badge/license-MIT-green.svg)
![Languages](https://img.shields.io/badge/languages-JavaScript%20%7C%20HTML%20%7C%20Shell-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

Helply is a desktop meeting assistant for live transcription and AI answers during calls.

## What is new

- Provider setup now supports local and cloud LLM backends in one flow.
- You can use built-in providers (`Groq`, `OpenAI`, `Anthropic`, `Ollama`, `LM Studio`) or **Any OpenAI-compatible endpoint**.
- Model selection is configurable per selected transcription/chat provider.
- API key entry is easier in the Settings modal (with show/hide controls).
- UI sizing is now more responsive so content is less likely to be cut by the app frame.

## Supported backends

- Cloud: OpenAI, Groq, Anthropic
- Local: Ollama, LM Studio
- Custom: Any endpoint that supports OpenAI-style APIs (`/chat/completions`, optional `/audio/transcriptions`)

## Quick Start

### Requirements

- Node.js 18+
- npm 9+
- Windows / macOS / Linux
- Microphone access

### Install

```bash
npm install
```

### Environment Setup

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

Edit `.env` and set the provider you want:

```env
TRANSCRIPTION_PROVIDER=groq
CHAT_PROVIDER=groq
GROQ_API_KEY=your_key_here
```

You can also configure providers inside the app Settings UI, which persists values back to `.env`.

### Run

```bash
npm start
```

## Settings Guide (UI)

1. Open `Settings` from the welcome screen.
2. Choose your `Transcription Provider` and `Chat Provider`.
3. Enter API keys only for providers that need them.
4. Set base URL for local/custom providers.
5. Set `Transcription Model` and `Chat Model` for the selected providers.
6. Save settings.

## Custom provider (local or cloud)

Use `Any OpenAI-Compatible` if your backend is not listed.

Typical examples:
- OpenRouter
- Together
- vLLM server
- llama.cpp server
- LocalAI
- Internal gateways

For chat, your endpoint should support:
- `POST /chat/completions`

For transcription, it should support:
- `POST /audio/transcriptions`

If your custom endpoint does not support transcription, use another provider for transcription and keep custom for chat.

## Usage

- Press mic button or `Space` to start/stop recording.
- Type questions manually in the input box.
- Use `Hide` toggle when screen sharing.
- Add resume/job-description context to improve responses.

## Development scripts

- `npm start`
- `npm run build`
- `npm run build-mac`
- `npm run build-win`
- `npm run build-all`

## License

MIT

© 2025 Piyush Mishra (PIYUSH-MISHRA-00)
