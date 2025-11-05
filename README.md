# Helply Mobile - AI Meeting Assistant

Helply is an intelligent mobile application that serves as your personal AI meeting assistant. It combines real-time voice transcription with context-aware AI responses to help you excel in interviews, meetings, and professional conversations.

## What is Helply Mobile?

Helply Mobile is a cross-platform Flutter application that brings the power of AI to your mobile device. It transforms your smartphone into a sophisticated meeting assistant that can listen, understand, and respond intelligently to professional conversations. Whether you're preparing for a job interview, attending a business meeting, or participating in a phone call, Helply is there to help you perform at your best.

## Key Features

### 🎙️ Real-time Voice Transcription
- Instantly transcribe spoken words using Groq's Whisper API
- Accurate transcription of both your voice and the other party's speech
- Live transcription display during conversations

### 🤖 AI-Powered Responses
- Get intelligent, context-aware answers to your questions
- Powered by Mixtral and GPT models via Groq API
- Professional, interview-ready responses that sound natural when spoken

### 📋 Context Awareness
- Upload your resume and job descriptions for personalized responses
- AI understands your background and tailors answers accordingly
- Maintains conversation context for follow-up questions

### 💬 Interactive Chat Interface
- Clean, professional chat interface for seamless interaction
- Copy any response with a single tap
- Easy navigation between welcome and chat screens

### 🔐 Secure API Management
- Secure storage of Groq API keys
- Easy access to API key settings via gear icon
- Persistent storage using shared preferences

### 🎨 Modern UI/UX
- Beautiful gradient-based design
- Intuitive navigation and controls
- Responsive layout for all device sizes

## How It Works

1. **Setup**: Enter your Groq API key and provide context (resume, job description)
2. **Start**: Begin a conversation by typing or using voice input
3. **Transcribe**: Speak naturally - Helply transcribes your speech in real-time
4. **Respond**: Get AI-generated responses based on your context and question
5. **Succeed**: Use the AI responses to guide your conversation and perform better

## Use Cases

### Job Interviews
- Prepare for technical and behavioral interview questions
- Get sample responses tailored to your experience
- Practice answering questions in a realistic setting

### Business Meetings
- Receive talking points for important discussions
- Get explanations of complex topics on-demand
- Generate follow-up responses during meetings

### Phone Interviews
- Get real-time assistance during phone conversations
- Receive prompts and guidance without being noticed
- Maintain a professional conversation flow

### Learning & Development
- Understand complex technical concepts through AI explanations
- Get coding examples and implementations
- Learn professional communication skills

## Technical Architecture

### Frontend
- Built with Flutter for cross-platform compatibility (Android & iOS)
- Clean architecture with separation of concerns
- Modern UI components with Material Design principles

### Backend Services
- **Groq Integration**: Utilizes Groq's fast inference API for Whisper transcription and Mixtral/GPT models
- **Audio Service**: Handles microphone access and audio recording
- **Context Management**: Stores and manages user context (resume, job descriptions)
- **Chat History**: Maintains conversation history for context-aware responses

### Data Models
- **ChatMessage**: Represents user and AI messages with timestamps
- **ContextModel**: Stores user resume and job description data
- **ApiKey**: Securely manages API key storage

## Getting Started

### Prerequisites
- Flutter SDK (3.0 or higher)
- Android Studio or VS Code with Flutter extensions
- Groq API key (sign up at [Groq Cloud](https://console.groq.com))

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/helply-mobile.git
   ```

2. Navigate to the project directory:
   ```bash
   cd helply_mobile
   ```

3. Install dependencies:
   ```bash
   flutter pub get
   ```

4. Set up your Groq API key in the app settings

5. Run the app:
   ```bash
   flutter run
   ```

## Configuration

### API Key Setup
1. Tap the gear icon on the welcome screen
2. Enter your Groq API key
3. Save the key for persistent storage

### Context Setup
1. On the welcome screen, tap "Resume" to enter your resume
2. Tap "Job Description" to enter the job you're targeting
3. Start the assistant to begin using context-aware features

## Permissions Required

- **Microphone**: For voice recording and transcription
- **Storage**: For temporary audio file handling

## Supported Platforms

- Android (API 21+)
- iOS (12.0+)

## Dependencies

Key packages used in the project:
- `http`: For API communication with Groq
- `flutter_markdown`: For rendering AI responses with formatting
- `record`: For audio recording functionality
- `permission_handler`: For managing device permissions
- `shared_preferences`: For local data storage
- `path_provider`: For accessing device storage paths

## Contributing

We welcome contributions to Helply Mobile! To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

Please ensure your code follows the existing style and includes appropriate tests.

## Troubleshooting

### Common Issues

1. **API Key Not Working**: Ensure you're using a valid Groq API key
2. **Microphone Not Accessible**: Check device permissions in settings
3. **Transcription Errors**: Ensure you're in a quiet environment with clear speech

### Getting Help

If you encounter issues:
1. Check the console logs for error messages
2. Verify your API key is correctly set
3. Ensure all required permissions are granted

## Roadmap

Planned features for future releases:
- Multi-language support
- Offline capabilities for basic functions
- Integration with calendar apps for meeting scheduling
- Advanced analytics for interview performance
- Customizable AI response tones (formal, casual, technical)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Groq](https://groq.com) for providing fast AI inference APIs
- [Flutter](https://flutter.dev) for the cross-platform framework
- All contributors who have helped shape Helply Mobile

---

*Helply Mobile - Your AI-powered companion for professional success*