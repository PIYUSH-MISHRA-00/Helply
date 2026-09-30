# Helply browser extension

Installs in Chrome (or another Chromium browser) and listens while you are in a meeting tab.

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose this `extension` folder.
4. Pin Helply and click the icon. The side panel opens.
5. Open **Model and provider**, set the same providers, models, base URLs, and API keys you use in the desktop app, then **Save**.
6. Open the meeting tab (Meet, Zoom in the browser, or similar). Click **Start listening** once and allow the microphone.

After that, no key decides when to listen. The meeting tab is the speaker. Your microphone is tracked on its own and is ignored while the speaker is talking. Speaker turns are answered. Microphone turns are kept in the chat.

## Hidden from a tab share

Share the **meeting tab**, not the whole screen. This panel is outside the tab, so it is not part of that share. A full-screen share includes the browser window, so the panel would be visible.

## Providers

The list is `providers.json`: Groq, OpenAI, Anthropic, Ollama, LM Studio, and any OpenAI-compatible endpoint. Transcription uses `/audio/transcriptions`. Chat uses `/chat/completions`, except Anthropic and Ollama, which use their own APIs. Pick any chat model and any transcription model those providers expose.
