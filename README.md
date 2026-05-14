# Helply AI Meeting Assistant

![License](https://img.shields.io/badge/license-MIT-green.svg)
![Languages](https://img.shields.io/badge/languages-JavaScript%20%7C%20HTML%20%7C%20Shell-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-%F0%9F%8D%B5-yellow)](https://buymeacoffee.com/piyushmishra00)

Helply is a lightweight desktop meeting assistant that delivers live transcription and AI-powered meeting help without taking you away from the conversation.

## Why Helply?

Helply is built for professionals, teams, and remote workers who want a reliable meeting companion that listens, transcribes, and answers questions in real time.

- Turn spoken meeting content into searchable text
- Ask follow-up questions instantly
- Keep the assistant visible but unobtrusive
- Hide the app during screen sharing when needed
- Add résumé or job description context for smarter responses

## Features

- Live transcription during meetings
- Context-aware AI responses
- Cross-platform support for Windows, macOS, and Linux
- Always-on-top support for focus-driven meetings
- Screen sharing friendly hide mode
- Dual audio capture for mic and system audio
- Resume and job context for better answers

## Quick Start

### Requirements

- Node.js 18 or newer
- npm 9 or newer
- Windows 10 / 11, macOS 10.14+, or Linux 64-bit
- A working microphone
- Internet connection for AI and transcription services

### Install

Open a terminal inside the project folder and run:

~~~bash
npm install
~~~

### Environment Setup

Copy the example environment file and update it with your Groq API key:

~~~bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
~~~

Then edit `.env` and add:

~~~env
GROQ_API_KEY=your-groq-api-key-here
~~~

### Run

Start Helply with:

~~~bash
npm start
~~~

## How to Use

- Click the microphone icon or press **Spacebar** to start and stop recording.
- Type questions in the chat box to get answers from the meeting assistant.
- Use the **Hide** toggle while screen sharing to keep Helply out of view.
- Add resume or job description context for more relevant responses.

## Development

Use these scripts to run and package the app:

- npm start — launch Helply locally
- npm run build — package with electron-builder
- npm run build-mac — build a macOS release
- npm run build-win — build a Windows release
- npm run build-all — run the full build script

> Note: build-all.sh and start.sh are included for supported workflows.

## Contribution

Helply is open for contributions. If you would like to help:

- Open an issue for bugs or feature ideas
- Send a pull request with your improvements
- Keep the original author credit intact
- Reference **Piyush Mishra** and GitHub user **PIYUSH-MISHRA-00** when using or extending this project

If Helply helps you, please star the repository, share it with your team, and spread the word to help it go viral.

## Support

If you want to support continued development, buy me a coffee:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-%F0%9F%8D%B5-yellow)](https://buymeacoffee.com/piyushmishra00)

## License

This project is released under the **MIT License**.

© 2025 Piyush Mishra (PIYUSH-MISHRA-00)

When using, forking, or building on top of Helply, please retain this notice and credit the original author.
