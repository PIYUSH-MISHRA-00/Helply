import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/context_model.dart';

class ContextService {
  static const String _contextKey = 'user_context';
  
  // Save context to shared preferences
  Future<void> saveContext(ContextModel context) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = jsonEncode(context.toJson());
    await prefs.setString(_contextKey, jsonString);
  }
  
  // Get context from shared preferences
  Future<ContextModel?> getContext() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = prefs.getString(_contextKey);
    
    if (jsonString == null || jsonString.isEmpty) {
      return null;
    }
    
    try {
      final jsonMap = jsonDecode(jsonString);
      return ContextModel.fromJson(jsonMap);
    } catch (e) {
      print('Error decoding context: $e');
      return null;
    }
  }
  
  // Check if context exists
  Future<bool> hasContext() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.containsKey(_contextKey) && 
           prefs.getString(_contextKey) != null && 
           prefs.getString(_contextKey)!.isNotEmpty;
  }
  
  // Clear context
  Future<void> clearContext() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_contextKey);
  }
}