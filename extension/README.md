# Helply browser extension

One package for Chrome, Edge, Opera, Brave, Vivaldi, and Firefox. It listens to the meeting and your microphone on its own, with no key to start or stop each turn.

## Install

Unzip `Helply-Extension.zip` first for every browser except Firefox.

| Browser | Steps |
|---|---|
| Chrome | `chrome://extensions` → turn on Developer mode → Load unpacked → pick the unzipped folder |
| Edge | `edge://extensions` → turn on Developer mode → Load unpacked → pick the unzipped folder |
| Opera | `opera://extensions` → turn on Developer mode → Load unpacked → pick the unzipped folder |
| Brave / Vivaldi | `brave://extensions` or `vivaldi://extensions` → Developer mode → Load unpacked |
| Firefox | `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → pick the zip or `manifest.json` |

Firefox removes temporary add-ons when it closes. Keeping it for good needs a Mozilla-signed build. Internet Explorer has no extension support, so it cannot run Helply.

## Use

1. Click the Helply icon. The Helply window opens.
2. Open **Model and provider**, set providers, models, base URLs, and API keys, then **Save**.
3. Click **Start listening**. Allow the microphone, pick the meeting tab or window, and turn on **Share audio**.

From then on, the shared meeting audio is the speaker and is answered. Your microphone is tracked on its own, kept in the chat, and ignored while the speaker is talking.

Firefox cannot share tab audio yet, so there Helply only hears your microphone. Type the interviewer's question, or use the desktop app for speaker audio.

## Hidden from a screen share

Helply runs in its own window. Share only the meeting tab or window and Helply is not in that share. A full-screen share shows everything, including Helply.

## Providers

The list is `providers.json`: Groq, OpenAI, Anthropic, Ollama, LM Studio, and any OpenAI-compatible endpoint. Transcription uses `/audio/transcriptions`. Chat uses `/chat/completions`, except Anthropic and Ollama, which use their own APIs.
