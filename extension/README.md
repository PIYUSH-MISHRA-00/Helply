# Helply – Interview Copilot (browser extension)

A real-time interview copilot docked in the browser’s side panel, in the same window as the meeting. It hears the meeting tab and your microphone on its own, keeps the whole interview in context, and hands you an answer you can say right away.

## Install

Unzip `Helply-Extension.zip` first for every browser except Firefox.

| Browser | Steps |
|---|---|
| Chrome | `chrome://extensions` → turn on Developer mode → Load unpacked → pick the unzipped folder |
| Edge | `edge://extensions` → turn on Developer mode → Load unpacked → pick the unzipped folder |
| Opera | `opera://extensions` → turn on Developer mode → Load unpacked → pick the unzipped folder |
| Brave / Vivaldi | `brave://extensions` or `vivaldi://extensions` → Developer mode → Load unpacked |
Firefox and Internet Explorer cannot run this panel. Firefox has no side panel and cannot capture a tab’s audio, so use the desktop app there.

## Start an interview

1. Click the Helply icon once. The panel opens on the right side of the same browser window.
2. Open **Settings**, pick providers and models, add API keys, and **Save**. Fill in the role and resume if you want answers grounded in them.
3. Open Meet, Zoom, or Teams and join. Listening starts on its own. Leaving that tab stops it, and coming back starts it again. Allow the microphone the first time only.

When the interviewer stops talking, the answer appears. Nothing to press during the call.

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

The panel is part of the browser, not part of the meeting tab. Share the **meeting tab** and Helply is not in that share, while you can still read it and it keeps answering.

Sharing your entire screen captures the whole browser, including this panel. Chrome does not let an extension opt its side panel out of a full-screen capture. The desktop app on `main` does that: Windows excludes its window from the capture, including a full-screen share, and the window stays on your screen so you can keep reading.

## Providers

`providers.json` lists Groq, OpenAI, Anthropic, Ollama, LM Studio, and any OpenAI-compatible endpoint. Answers stream in live for OpenAI-compatible providers. Firefox cannot share tab audio yet, so there Helply hears only your microphone; type the interviewer's question into the box instead.
