import 'package:shared_preferences/shared_preferences.dart';
import '../models/api_key.dart';

class ApiKeyService {
  static const String _apiKeyKey = 'groq_api_key';
  
  // Save API key to shared preferences
  Future<void> saveApiKey(String apiKey) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_apiKeyKey, apiKey);
  }
  
  // Get API key from shared preferences
  Future<ApiKey?> getApiKey() async {
    final prefs = await SharedPreferences.getInstance();
    final apiKeyString = prefs.getString(_apiKeyKey);
    
    if (apiKeyString == null || apiKeyString.isEmpty) {
      return null;
    }
    
    return ApiKey(value: apiKeyString);
  }
  
  // Check if API key exists
  Future<bool> hasApiKey() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.containsKey(_apiKeyKey) && 
           prefs.getString(_apiKeyKey) != null && 
           prefs.getString(_apiKeyKey)!.isNotEmpty;
  }
  
  // Clear API key
  Future<void> clearApiKey() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_apiKeyKey);
  }
}