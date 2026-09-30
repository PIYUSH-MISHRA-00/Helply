# Helply AI Meeting Assistant

![License](https://img.shields.io/badge/license-MIT-green.svg)
![Languages](https://img.shields.io/badge/languages-JavaScript%20%7C%20HTML%20%7C%20Shell-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support%20Helply-ffdd00?logo=buymeacoffee&logoColor=000000&style=for-the-badge)](https://buymeacoffee.com/piyushmishra00)

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

## Run without a terminal (Windows)

Build once:

```bash
npm run build-win
```

This writes two files to `dist/`:

- `Helply AI Meeting Assistant Setup 1.0.0.exe` installs Helply, adds a desktop shortcut, and starts it.
- `Helply-Portable.exe` runs directly with no install.

After that, double-click the exe. No terminal is needed. Add your keys in Settings. They are saved to `%APPDATA%\helply-ai-assistant\.env`, not inside the app, and the build never includes your local `.env`.

The taskbar icon is the Google Chrome logo. `scripts/chrome-icon.ps1` copies it from the Chrome installed on the build machine, so the logo is never committed. Without Chrome, the Helply icon is used.

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

- Click `Start Assistant`. Speaker audio and the microphone listen on their own. No key to start or stop each turn.
- Speaker audio (the other person) is transcribed and answered. Your microphone is transcribed and kept in the chat, and it is ignored while the speaker is talking.
- The microphone button pauses or resumes listening.
- Type questions manually in the input box.
- Use `Hide` toggle when screen sharing.
- Add resume/job-description context to improve responses.

## Browser extension

The extension lives in `extension/` on the `browser-extension` branch. It docks in the side panel of Chrome, Edge, Opera, Brave, and Vivaldi, and listens on its own when a meeting tab is open. Setup steps are in `extension/README.md`.

## Development scripts

- `npm start`
- `npm run build`
- `npm run build-mac`
- `npm run build-win`
- `npm run build-all`

## Support and Contribute

If Helply helps you, you can support the project here:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Fuel%20Helply-ffdd00?logo=buymeacoffee&logoColor=000000&style=for-the-badge)](https://buymeacoffee.com/piyushmishra00)

Ways to help this repo grow:

- Star the repo if you like the project or want to support it.
- Open issues and PRs to improve Helply for everyone.
- Share it with your friends, team, and developer communities.

Let's make Helply go viral on the web together.

## License

MIT

© 2025 Piyush Mishra (PIYUSH-MISHRA-00)
