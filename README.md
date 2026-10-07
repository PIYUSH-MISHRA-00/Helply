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

You can also configure providers inside the app Settings UI. The first launch copies `.env` into the saved settings, and from then on the app uses what you save in Settings.

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

After that, double-click the exe. No terminal is needed. Add your keys in Settings once. They are saved to `%APPDATA%\helply-ai-assistant\settings.json`, with API keys encrypted by Windows for your user account, so they are still there after closing, updating, or reinstalling the app. The build never includes your local `.env`.

The taskbar icon is the Google Chrome logo. `scripts/chrome-icon.ps1` copies it from the Chrome installed on the build machine, so the logo is never committed. Without Chrome, the Helply icon is used.

## Settings Guide (UI)

1. Open `Settings` from the welcome screen.
2. Choose your `Transcription Provider` and `Chat Provider`.
3. Enter API keys only for providers that need them.
4. Set base URL for local/custom providers.
5. Set `Transcription Model` and `Chat Model` for the selected providers.
6. Press **Test Connection**. A working key is saved and you stay on this screen. Press **Start Assistant** after it says the key was accepted. Save settings stores the key without testing it.

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
- Speaker audio (the other person) is transcribed and answered. Helply waits until the interviewer finishes, so a long question is answered once, in full, however long it runs. If they keep talking right after an answer starts, the answer restarts with the whole question.
- Your microphone is transcribed into the **You** line and kept as context for follow-ups. It is not added to the chat, so the answer you are reading stays put. It is ignored while the speaker is talking.
- The chat only scrolls when you are already at the bottom, and it lands on the start of the new answer.
- The microphone button pauses or resumes listening. <kbd>Ctrl</kbd>+<kbd>Enter</kbd> answers right away without waiting for the pause.
- Type questions manually in the input box.
- The window is excluded from screen capture as soon as it opens, including a full-screen share, and it stays on your screen so you can keep reading. The Hidden switch turns that off.

## Resume, job description, and context

- Paste your resume and the job description from the welcome screen, or with the resume and briefcase buttons while the assistant runs. Listening keeps going while you edit. The buttons turn green when they are set.
- Both are saved on this computer and reused on the next launch.
- With them, answers draw on your real projects and skills and connect them to the job. Without them, Helply gives strong general answers.
- Helply remembers the whole interview: each question and its type (intro, behavioral, technical, coding, system design, HR), the earlier answers, and what both sides said. Follow-ups like "why?" are answered in context, and earlier stories are not repeated. The reset button starts a new interview.

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
