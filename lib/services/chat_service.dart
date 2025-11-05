import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/chat_message.dart';

class ChatService {
  static const String _chatHistoryKey = 'chat_history';
  static const int _maxHistoryLength = 10;
  
  // Save chat history to shared preferences
  Future<void> saveChatHistory(List<ChatMessage> messages) async {
    final prefs = await SharedPreferences.getInstance();
    
    // Limit the history to the maximum length
    final limitedMessages = messages.length > _maxHistoryLength 
        ? messages.sublist(messages.length - _maxHistoryLength) 
        : messages;
    
    final List<Map<String, dynamic>> jsonList = 
        limitedMessages.map((message) => message.toJson()).toList();
    
    final jsonString = jsonEncode(jsonList);
    await prefs.setString(_chatHistoryKey, jsonString);
  }
  
  // Get chat history from shared preferences
  Future<List<ChatMessage>> getChatHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = prefs.getString(_chatHistoryKey);
    
    if (jsonString == null || jsonString.isEmpty) {
      return [];
    }
    
    try {
      final List<dynamic> jsonList = jsonDecode(jsonString);
      return jsonList
          .map((json) => ChatMessage.fromJson(json as Map<String, dynamic>))
          .toList();
    } catch (e) {
      print('Error decoding chat history: $e');
      return [];
    }
  }
  
  // Add a message to chat history
  Future<void> addMessage(ChatMessage message) async {
    final history = await getChatHistory();
    history.add(message);
    await saveChatHistory(history);
  }
  
  // Clear chat history
  Future<void> clearChatHistory() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_chatHistoryKey);
  }
}