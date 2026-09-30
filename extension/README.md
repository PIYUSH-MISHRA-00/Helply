# Helply – Interview Copilot (browser extension)

A real-time interview copilot for Chrome, Edge, Opera, Brave, Vivaldi, and Firefox. It hears the interviewer and your microphone on its own, keeps the whole interview in context, and hands you an answer you can say right away.

## Install

Unzip `Helply-Extension.zip` first for every browser except Firefox.

| Browser | Steps |
|---|---|
| Chrome | `chrome://extensions` → turn on Developer mode → Load unpacked → pick the unzipped folder |
| Edge | `edge://extensions` → turn on Developer mode → Load unpacked → pick the unzipped folder |
| Opera | `opera://extensions` → turn on Developer mode → Load unpacked → pick the unzipped folder |
| Brave / Vivaldi | `brave://extensions` or `vivaldi://extensions` → Developer mode → Load unpacked |
| Firefox | `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → pick the zip or `manifest.json` |

Firefox removes temporary add-ons when it closes. Internet Explorer has no extension support.

## Start an interview

1. Click the Helply icon. Helply opens in its own window.
2. Open **Settings** (gear icon), pick providers and models, add API keys, and **Save**.
3. Fill in role, company, interview type, answer style, resume, and job description.
4. Click **Start interview**. Pick the meeting tab, turn on **Share tab audio**, and allow the microphone.

After that there is nothing to press. When the interviewer stops talking, the answer appears.

## How answers are laid out

Each answer card is built to be read aloud:

- **Say first** – one or two sentences to open with while you think.
- **Key points** – three to five bullets, each led by a bold keyword.
- **Code**, **Example** (STAR format), **If they ask more** – only when they help.

Buttons on every card: **Shorter**, **More detail**, **Example**, **Code**, **Retry**, and **Copy**. **Answer now** (<kbd>Ctrl</kbd>+<kbd>Enter</kbd>) answers straight away without waiting for the pause.

## How it keeps context

- Every answer is written with your role, company, interview type, resume, and job description.
- The live transcript of both sides goes with each question, so follow-ups like "why?" or "give an example of that" are answered correctly.
- Earlier questions and answers are sent too, so Helply builds on them instead of repeating them.
- A question said in several bursts is joined into one before answering. If the interviewer keeps talking just after an answer starts, Helply restarts with the full question.
- Small talk ("can you hear me?") is recognised and skipped.
- The whole interview is saved in the browser. Closing the window or restarting the browser does not lose it. **End interview** clears it.

## Hidden from screen share

- Helply is its own window, not part of the meeting tab. Share the meeting tab or window and nobody else sees it.
- If the meeting page starts sharing your **entire screen**, Helply hides itself right away and comes back when the share stops. Turn this off in Settings.
- <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd>, or the eye button, hides or shows Helply instantly.

A browser extension cannot make a window invisible inside a full-screen capture. The desktop app on the `main` branch can.

## Providers

`providers.json` lists Groq, OpenAI, Anthropic, Ollama, LM Studio, and any OpenAI-compatible endpoint. Answers stream in live for OpenAI-compatible providers. Firefox cannot share tab audio yet, so there Helply hears only your microphone; type the interviewer's question into the box instead.
