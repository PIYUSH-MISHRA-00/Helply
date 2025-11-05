import 'api_key_service.dart';
import 'groq_service.dart';
import 'audio_service.dart';
import 'context_service.dart';
import 'chat_service.dart';
import '../models/api_key.dart';
import '../models/context_model.dart';
import '../models/chat_message.dart';

class ServiceManager {
  static final ServiceManager _instance = ServiceManager._internal();
  
  factory ServiceManager() => _instance;
  
  ServiceManager._internal();
  
  final ApiKeyService _apiKeyService = ApiKeyService();
  final GroqService _groqService = GroqService();
  final AudioService _audioService = AudioService();
  final ContextService _contextService = ContextService();
  final ChatService _chatService = ChatService();
  
  // Initialize services
  Future<void> initialize() async {
    // Load API key if available
    final apiKey = await _apiKeyService.getApiKey();
    if (apiKey != null) {
      _groqService.setApiKey(apiKey.value);
    }
  }
  
  // API Key Service
  Future<void> saveApiKey(String apiKey) async {
    await _apiKeyService.saveApiKey(apiKey);
    _groqService.setApiKey(apiKey);
  }
  
  Future<ApiKey?> getApiKey() async {
    return await _apiKeyService.getApiKey();
  }
  
  Future<bool> hasApiKey() async {
    return await _apiKeyService.hasApiKey();
  }
  
  Future<void> clearApiKey() async {
    await _apiKeyService.clearApiKey();
  }
  
  // Groq Service
  bool get groqHasApiKey => _groqService.hasApiKey;
  
  Future<String> transcribeAudio(List<int> audioData) async {
    return await _groqService.transcribeAudio(audioData);
  }
  
  Future<String> getAIResponse(String prompt, {List<ChatMessage>? conversationHistory}) async {
    return await _groqService.getAIResponse(prompt, conversationHistory: conversationHistory);
  }
  
  // Audio Service
  Future<bool> hasAudioPermission() async {
    return await _audioService.hasPermission();
  }
  
  Future<bool> startRecording() async {
    return await _audioService.startRecording();
  }
  
  Future<List<int>?> stopRecording() async {
    return await _audioService.stopRecording();
  }
  
  Future<void> cancelRecording() async {
    await _audioService.cancelRecording();
  }
  
  bool get isRecording => _audioService.isRecording;
  
  // Context Service
  Future<void> saveContext(ContextModel context) async {
    await _contextService.saveContext(context);
  }
  
  Future<ContextModel?> getContext() async {
    return await _contextService.getContext();
  }
  
  Future<bool> hasContext() async {
    return await _contextService.hasContext();
  }
  
  Future<void> clearContext() async {
    await _contextService.clearContext();
  }
  
  // Chat Service
  Future<void> saveChatHistory(List<ChatMessage> messages) async {
    await _chatService.saveChatHistory(messages);
  }
  
  Future<List<ChatMessage>> getChatHistory() async {
    return await _chatService.getChatHistory();
  }
  
  Future<void> addMessage(ChatMessage message) async {
    await _chatService.addMessage(message);
  }
  
  Future<void> clearChatHistory() async {
    await _chatService.clearChatHistory();
  }
}