import 'package:flutter/material.dart';
import '../services/service_manager.dart';
import '../models/chat_message.dart';
import '../models/context_model.dart';
import '../widgets/chat_message_widget.dart';
import '../widgets/api_key_dialog.dart';
import '../widgets/context_dialog.dart';
import 'welcome_screen.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({Key? key}) : super(key: key);
  
  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final ServiceManager _serviceManager = ServiceManager();
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  
  List<ChatMessage> _messages = [];
  bool _isRecording = false;
  bool _isProcessing = false;
  String _liveTranscript = '';
  
  @override
  void initState() {
    super.initState();
    _loadChatHistory();
  }
  
  Future<void> _loadChatHistory() async {
    final history = await _serviceManager.getChatHistory();
    if (mounted) {
      setState(() {
        _messages = history;
      });
      _scrollToBottom();
    }
  }
  
  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }
  
  Future<void> _toggleRecording() async {
    if (_isProcessing) return;
    
    setState(() {
      _isProcessing = true;
    });
    
    try {
      if (!_isRecording) {
        // Start recording
        final hasPermission = await _serviceManager.hasAudioPermission();
        if (!hasPermission) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Microphone permission required')),
            );
          }
          return;
        }
        
        final started = await _serviceManager.startRecording();
        if (started) {
          setState(() {
            _isRecording = true;
            _liveTranscript = 'Listening...';
          });
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Failed to start recording')),
            );
          }
        }
      } else {
        // Stop recording
        setState(() {
          _liveTranscript = 'Processing...';
        });
        
        final audioData = await _serviceManager.stopRecording();
        if (audioData != null && audioData.isNotEmpty) {
          // Transcribe audio
          final transcript = await _serviceManager.transcribeAudio(audioData);
          
          if (transcript.isNotEmpty) {
            setState(() {
              _liveTranscript = '';
            });
            
            // Add user message
            final userMessage = ChatMessage.user(text: transcript);
            setState(() {
              _messages.add(userMessage);
            });
            await _serviceManager.addMessage(userMessage);
            
            // Get AI response
            await _getAIResponse(transcript);
          } else {
            setState(() {
              _liveTranscript = 'No speech detected. Please try again.';
            });
          }
        } else {
          setState(() {
            _liveTranscript = 'No audio recorded. Please try again.';
          });
        }
        
        setState(() {
          _isRecording = false;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
      setState(() {
        _isRecording = false;
        _isProcessing = false;
        _liveTranscript = '';
      });
    } finally {
      setState(() {
        _isProcessing = false;
      });
    }
  }
  
  Future<void> _getAIResponse(String prompt) async {
    setState(() {
      _isProcessing = true;
    });
    
    try {
      // Get context if available
      final context = await _serviceManager.getContext();
      
      // Get conversation history
      final history = await _serviceManager.getChatHistory();
      
      // Prepare context string
      String contextString = '';
      if (context != null && context.hasContext) {
        if (context.resume != null && context.resume!.isNotEmpty) {
          contextString += 'Resume: ${context.resume}\n';
        }
        if (context.jobDescription != null && context.jobDescription!.isNotEmpty) {
          contextString += 'Job Description: ${context.jobDescription}\n';
        }
      }
      
      // Combine context with prompt if available
      final fullPrompt = contextString.isNotEmpty 
          ? '$contextString\nQuestion: $prompt' 
          : prompt;
      
      // Get AI response
      final response = await _serviceManager.getAIResponse(
        fullPrompt,
        conversationHistory: history,
      );
      
      // Add AI message
      final aiMessage = ChatMessage.ai(text: response);
      setState(() {
        _messages.add(aiMessage);
      });
      await _serviceManager.addMessage(aiMessage);
      
      _scrollToBottom();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error getting AI response: $e')),
        );
      }
      
      // Add error message
      final errorMessage = ChatMessage.ai(
        text: 'Sorry, I couldn\'t generate a response. Please try again.',
      );
      setState(() {
        _messages.add(errorMessage);
      });
      await _serviceManager.addMessage(errorMessage);
    } finally {
      setState(() {
        _isProcessing = false;
      });
    }
  }
  
  Future<void> _sendTextMessage() async {
    final text = _textController.text.trim();
    if (text.isEmpty) return;
    
    _textController.clear();
    
    // Add user message
    final userMessage = ChatMessage.user(text: text);
    setState(() {
      _messages.add(userMessage);
    });
    await _serviceManager.addMessage(userMessage);
    
    // Get AI response
    await _getAIResponse(text);
  }
  
  Future<void> _resetConversation() async {
    setState(() {
      _messages.clear();
      _liveTranscript = '';
    });
    await _serviceManager.clearChatHistory();
  }
  
  Future<void> _showApiKeyDialog() async {
    final currentKey = await _serviceManager.getApiKey();
    final newKey = await showDialog<String>(
      context: context,
      builder: (context) => ApiKeyDialog(initialKey: currentKey?.value),
    );
    
    if (newKey != null && newKey.isNotEmpty) {
      await _serviceManager.saveApiKey(newKey);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('API key saved successfully')),
        );
      }
    }
  }
  
  Future<void> _showContextDialog(bool isResume) async {
    final contextModel = await _serviceManager.getContext();
    final newValue = await showDialog<String>(
      context: context,
      builder: (context) => ContextDialog(
        initialContext: contextModel,
        isResume: isResume,
      ),
    );
    
    if (newValue != null) {
      final updatedContext = ContextModel(
        resume: isResume ? newValue : contextModel?.resume,
        jobDescription: isResume ? contextModel?.jobDescription : newValue,
      );
      
      await _serviceManager.saveContext(updatedContext);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Context saved successfully')),
        );
      }
    }
  }
  
  void _goBackToWelcome() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (context) => const WelcomeScreen()),
    );
  }
  
  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async {
        _goBackToWelcome();
        return false;
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Helply AI Assistant'),
          backgroundColor: Theme.of(context).primaryColor,
          foregroundColor: Colors.white,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: _goBackToWelcome,
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: _resetConversation,
            ),
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert),
              onSelected: (value) {
                switch (value) {
                  case 'resume':
                    _showContextDialog(true);
                    break;
                  case 'job':
                    _showContextDialog(false);
                    break;
                }
              },
              itemBuilder: (context) => [
                const PopupMenuItem(
                  value: 'resume',
                  child: Text('Edit Resume'),
                ),
                const PopupMenuItem(
                  value: 'job',
                  child: Text('Edit Job Description'),
                ),
              ],
            ),
          ],
        ),
        body: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Theme.of(context).primaryColor.withOpacity(0.1),
                Colors.white,
              ],
            ),
          ),
          child: Column(
            children: [
              // Chat messages
              Expanded(
                child: ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.all(12),
                  itemCount: _messages.length,
                  itemBuilder: (context, index) {
                    return ChatMessageWidget(message: _messages[index]);
                  },
                ),
              ),
              
              // Live transcript
              if (_liveTranscript.isNotEmpty)
                Container(
                  padding: const EdgeInsets.all(16),
                  margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: Colors.grey.shade300),
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.grey.withOpacity(0.1),
                        spreadRadius: 1,
                        blurRadius: 5,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.record_voice_over,
                        color: Colors.red,
                        size: 16,
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'LIVE',
                        style: TextStyle(
                          color: Colors.red,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _liveTranscript,
                          style: const TextStyle(
                            fontStyle: FontStyle.italic,
                            color: Colors.grey,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              
              // Input area
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border(
                    top: BorderSide(color: Colors.grey.shade300),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Container(
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(24),
                        ),
                        child: TextField(
                          controller: _textController,
                          decoration: const InputDecoration(
                            hintText: 'Type your question...',
                            border: InputBorder.none,
                            contentPadding: EdgeInsets.symmetric(
                              horizontal: 20,
                              vertical: 16,
                            ),
                          ),
                          onSubmitted: (_) => _sendTextMessage(),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _isRecording 
                            ? Colors.red 
                            : Theme.of(context).primaryColor,
                        boxShadow: [
                          BoxShadow(
                            color: (_isRecording 
                                    ? Colors.red 
                                    : Theme.of(context).primaryColor)
                                .withOpacity(0.3),
                            spreadRadius: 2,
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: IconButton(
                        icon: Icon(
                          _isRecording ? Icons.mic_off : Icons.mic,
                          color: Colors.white,
                        ),
                        onPressed: _toggleRecording,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Theme.of(context).primaryColor,
                        boxShadow: [
                          BoxShadow(
                            color: Theme.of(context).primaryColor.withOpacity(0.3),
                            spreadRadius: 2,
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: IconButton(
                        icon: const Icon(
                          Icons.send,
                          color: Colors.white,
                        ),
                        onPressed: _sendTextMessage,
                      ),
                    ),
                  ],
                ),
              ),
              
              // Status text
              if (_isProcessing)
                const Padding(
                  padding: EdgeInsets.all(12.0),
                  child: Text(
                    'Processing...',
                    style: TextStyle(color: Colors.grey),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}