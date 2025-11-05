import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../models/chat_message.dart';

class GroqService {
  static const String _baseUrl = 'https://api.groq.com/openai/v1';
  static const String _transcriptionEndpoint = '/audio/transcriptions';
  static const String _chatCompletionEndpoint = '/chat/completions';
  
  String? _apiKey;
  
  GroqService({String? apiKey}) {
    _apiKey = apiKey;
  }
  
  void setApiKey(String apiKey) {
    _apiKey = apiKey;
  }
  
  bool get hasApiKey => _apiKey != null && _apiKey!.isNotEmpty;
  
  // Transcribe audio using Groq's Whisper model
  Future<String> transcribeAudio(List<int> audioData) async {
    if (!hasApiKey) {
      throw Exception('Groq API key not set');
    }
    
    final uri = Uri.parse('$_baseUrl$_transcriptionEndpoint');
    
    final request = http.MultipartRequest('POST', uri)
      ..headers['Authorization'] = 'Bearer $_apiKey'
      ..fields['model'] = 'whisper-large-v3'
      ..fields['response_format'] = 'text';
    
    // Create a temporary file for the audio data
    final tempFile = File('${Directory.systemTemp.path}/temp_audio.webm');
    await tempFile.writeAsBytes(audioData);
    
    // Add the audio file to the request
    final file = await http.MultipartFile.fromPath('file', tempFile.path);
    request.files.add(file);
    
    try {
      final response = await request.send();
      final responseBody = await response.stream.bytesToString();
      
      if (response.statusCode == 200) {
        // Clean up the temporary file
        await tempFile.delete();
        return responseBody;
      } else {
        // Clean up the temporary file
        await tempFile.delete();
        throw Exception('Transcription failed with status ${response.statusCode}: $responseBody');
      }
    } catch (e) {
      // Clean up the temporary file
      await tempFile.delete();
      rethrow;
    }
  }
  
  // Get AI response using Groq's models
  Future<String> getAIResponse(String prompt, {List<ChatMessage>? conversationHistory}) async {
    if (!hasApiKey) {
      throw Exception('Groq API key not set');
    }
    
    final uri = Uri.parse('$_baseUrl$_chatCompletionEndpoint');
    
    // Detect if this is a coding prompt
    final lowerPrompt = prompt.toLowerCase();
    final codeIndicators = [
      'code', 'program', 'implement', 'function', 'class', 'algorithm',
      'loop', 'array', 'python', 'java', 'c++', 'javascript', 'sql',
      'develop a', 'write a', 'create a', 'build a', 'snippet', 'fibonacci',
      'armstrong', 'prime', 'factorial', 'sort', 'search', 'print'
    ];
    final isCodingPrompt = codeIndicators.any((word) => lowerPrompt.contains(word));
    
    // Prepare system message
    final systemMessage = {
      'role': 'system',
      'content': '''
You are an expert interview assistant that gives *concise, structured* and *speakable* answers.

General rules:
- For simple behavioral or conceptual questions: give 3-4 polished sentences suitable for spoken answers.
- For coding/technical questions: give
  1. A short explanation (2–3 sentences)
  2. The full code block in Markdown format (e.g. \`\`\`python)
  3. A 1-line summary or usage tip

Format example:
"### Explanation
...
### Code
\`\`\`python
# your code here
\`\`\`
### Summary
..."

Keep your answers professional, complete, and neatly formatted in Markdown.
Do NOT stop mid-code or mid-sentence. Always provide complete implementations.
For coding questions, make sure the code is runnable and complete with all necessary parts.
Never include introductory phrases like "Sure, here's a concise, spoken-style response" or similar.
Directly start with the explanation or answer.

You are context-aware and can reference previous conversation history to provide follow-up answers.
'''
    };
    
    // Prepare user message
    final userMessage = {
      'role': 'user',
      'content': isCodingPrompt
          ? 'This is a coding question. Follow the format (Explanation → Code → Summary) and provide complete runnable code:\n\n$prompt'
          : 'This is a spoken interview question. Provide a concise but complete spoken-style answer:\n\n$prompt'
    };
    
    // Build messages array
    final messages = [systemMessage];
    
    // Add conversation history if provided
    if (conversationHistory != null && conversationHistory.isNotEmpty) {
      for (final message in conversationHistory) {
        messages.add({
          'role': message.type == MessageType.user ? 'user' : 'assistant',
          'content': message.text
        });
      }
    }
    
    // Add the current user message
    messages.add(userMessage);
    
    // Set max tokens based on prompt type
    final maxTokens = isCodingPrompt ? 1000 : 300;
    
    final body = {
      'model': 'openai/gpt-oss-120b',
      'messages': messages,
      'temperature': 0.7,
      'max_tokens': maxTokens,
      'top_p': 1,
      'stream': false,
      'stop': []
    };
    
    try {
      final response = await http.post(
        uri,
        headers: {
          'Authorization': 'Bearer $_apiKey',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(body),
      );
      
      if (response.statusCode == 200) {
        final jsonResponse = jsonDecode(response.body);
        String responseText = jsonResponse['choices'][0]['message']['content'];
        
        // If response is empty or just whitespace, provide a default response
        if (responseText.trim().isEmpty) {
          responseText = "I couldn't generate a response. Please try rephrasing your question.";
        }
        
        // Ensure it ends cleanly
        responseText = _ensureCompleteSentence(responseText);
        
        // Format code in response
        responseText = _formatCodeInResponse(responseText);
        
        return responseText;
      } else {
        throw Exception('AI response failed with status ${response.statusCode}: ${response.body}');
      }
    } catch (e) {
      rethrow;
    }
  }
  
  // Format code in response
  String _formatCodeInResponse(String response) {
    if (response.isEmpty) return "";

    // Remove common introductory phrases using simpler regex
    response = response.replaceAll(RegExp(r'^Sure, here.*\n?', caseSensitive: false), '');
    response = response.replaceAll(RegExp(r'^Here.*response.*\n?', caseSensitive: false), '');
    response = response.replaceAll(RegExp(r'^I can help you with that.*\n?', caseSensitive: false), '');
    response = response.replaceAll(RegExp(r'^Here.s a concise.*\n?', caseSensitive: false), '');
    response = response.replaceAll(RegExp(r'^Here.s how you can.*\n?', caseSensitive: false), '');
    
    // Ensure Markdown headers are consistent
    response = response.replaceAllMapped(RegExp(r'^#+\s*', multiLine: true), (match) {
      String? group = match.group(0);
      return (group?.trim() ?? "") + " ";
    });
    response = response.replaceAll(RegExp(r'\n{3,}'), '\n\n');
    
    // Ensure code blocks have proper language tags
    if (response.contains('```') && !RegExp(r'```[a-z]+', caseSensitive: false).hasMatch(response)) {
      // Try to infer language
      if (response.contains('def ') || response.contains('import ')) {
        response = response.replaceAll('```', '```python');
      } else if (response.contains('function ') || response.contains('console.log')) {
        response = response.replaceAll('```', '```javascript');
      } else if (response.contains('public class') || response.contains('public static')) {
        response = response.replaceAll('```', '```java');
      } else if (response.contains('#include') || response.contains('std::')) {
        response = response.replaceAll('```', '```cpp');
      }
    }
    
    // Add a trailing newline for clean rendering
    return response.trim() + '\n';
  }
  
  // Ensure a response ends with a complete sentence
  String _ensureCompleteSentence(String text) {
    // Trim whitespace
    text = text.trim();
    
    // If text is empty, return as is
    if (text.isEmpty) return text;
    
    // If text is very short, it's likely incomplete - try to make it complete
    if (text.length < 15) {
      // If it doesn't end with punctuation, add a period
      final lastChar = text[text.length - 1];
      if (!['.', '!', '?', '"', "'"].contains(lastChar)) {
        return '$text.';
      }
      return text;
    }
    
    // Special handling for code responses - don't modify if it looks like code
    if (text.contains('```') && (text.contains('def ') || text.contains('function ') || text.contains('class '))) {
      // If it ends with an incomplete line of code, try to complete it
      final lines = text.split('\n');
      final lastLine = lines[lines.length - 1].trim();
      
      // If the last line looks incomplete (ends with =, (, [, {, or :)
      if (RegExp(r'[=\(\[\{:]$').hasMatch(lastLine)) {
        // Remove the incomplete line and add a note
        lines.removeLast();
        return lines.join('\n') + '\n\n[Response appears to be incomplete. This may be due to token limits. Please try rephrasing your question or asking for a simpler implementation.]';
      }
      
      // If it looks complete, return as is
      return text;
    }
    
    // Check if the response appears to be cut off (ends with a dash or incomplete thought)
    if (text.endsWith('---') || text.endsWith('--') || text.endsWith('-') || text.endsWith('...')) {
      // Remove the trailing incomplete markers and add a note
      String cleanedText = text.replaceAll(RegExp(r'-+$'), '').replaceAll(RegExp(r'\.{3}$'), '').trim();
      return '$cleanedText\n\n[Response appears to be incomplete. This may be due to token limits. Please try rephrasing your question or asking for a simpler implementation.]';
    }
    
    // Check if the text ends mid-sentence with common incomplete patterns
    // Include interview-specific incomplete endings
    final incompleteEndings = [
      'and', 'but', 'or', 'so', 'then', 'than', 'as', 'if', 'when', 'while',
      'because', 'since', 'although', 'though', 'unless', 'until', 'where',
      'whereas', 'whether', 'after', 'before', 'during', 'through', 'throughout',
      'within', 'without', 'despite', 'in', 'on', 'at', 'by', 'for', 'with',
      'about', 'against', 'between', 'among', 'toward', 'into', 'onto', 'upon',
      'especially', 'particularly', 'specifically', 'namely', 'for example', 'such as',
      'in conclusion', 'to conclude', 'finally', 'ultimately', 'overall',
      'answer', 'response', 'here', 'there', 'sure', 'well', 'first', 'next', 'second', 'third'
    ];
    
    final words = text.split(RegExp(r'\s+'));
    final lastWord = words[words.length - 1].toLowerCase().replaceAll(RegExp(r'[.,;:!?]+$'), '');
    
    // If the last word is an incomplete ending, try to complete the thought
    if (incompleteEndings.contains(lastWord)) {
      // Remove the incomplete word and add a period
      final textWithoutLastWord = words.sublist(0, words.length - 1).join(' ');
      if (textWithoutLastWord.length > 0) {
        return '${textWithoutLastWord.trim()}.';
      }
    }
    
    // Special handling for phrases that sound incomplete
    final incompletePhrases = [
      'here is', 'here are', 'here\'s', 'there is', 'there are', 'there\'s',
      'sure here', 'well here', 'so here', 'now here', 'let me', 'allow me'
    ];
    
    final lowerText = text.toLowerCase();
    for (final phrase in incompletePhrases) {
      if (lowerText.contains(phrase) && !lowerText.contains('.')) {
        // Try to complete the thought or add a period
        if (text.length > 20) {
          return '$text.';
        } else {
          return '$text Let me provide a more complete answer.';
        }
      }
    }
    
    // Get the last character
    final lastChar = text[text.length - 1];
    
    // If it already ends with sentence-ending punctuation, return as is
    if ('.!?'.contains(lastChar)) {
      return text;
    }
    
    // If it ends with a comma, semicolon, or colon, remove it and add a period
    if (',;:'.contains(lastChar)) {
      return '${text.substring(0, text.length - 1).trim()}.';
    }
    
    // If it ends with a closing parenthesis or bracket, check the character before it
    if (')]"\''.contains(lastChar)) {
      if (text.length > 1) {
        final charBefore = text[text.length - 2];
        if ('.!?'.contains(charBefore)) {
          return text; // Ends with properly punctuated quote/parenthesis
        }
      }
      // If not properly punctuated, add a period
      return '$text.';
    }
    
    // For all other cases, add a period
    return '$text.';
  }
}