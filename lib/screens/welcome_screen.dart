import 'package:flutter/material.dart';
import '../services/service_manager.dart';
import '../widgets/api_key_dialog.dart';
import '../widgets/context_dialog.dart';
import '../models/context_model.dart';
import 'chat_screen.dart';

class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({Key? key}) : super(key: key);
  
  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  final ServiceManager _serviceManager = ServiceManager();
  ContextModel _context = ContextModel();
  
  @override
  void initState() {
    super.initState();
    _loadContext();
  }
  
  Future<void> _loadContext() async {
    final context = await _serviceManager.getContext();
    if (context != null) {
      setState(() {
        _context = context;
      });
    }
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
    final newValue = await showDialog<String>(
      context: context,
      builder: (context) => ContextDialog(
        initialContext: _context,
        isResume: isResume,
      ),
    );
    
    if (newValue != null) {
      setState(() {
        if (isResume) {
          _context = ContextModel(
            resume: newValue,
            jobDescription: _context.jobDescription,
          );
        } else {
          _context = ContextModel(
            resume: _context.resume,
            jobDescription: newValue,
          );
        }
      });
      
      await _serviceManager.saveContext(_context);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Context saved successfully')),
        );
      }
    }
  }
  
  Future<void> _startAssistant() async {
    // Check if API key is set
    final hasApiKey = await _serviceManager.hasApiKey();
    if (!hasApiKey) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please set your API key first')),
        );
      }
      return;
    }
    
    // Save context if it has any data
    if (_context.hasContext) {
      await _serviceManager.saveContext(_context);
    }
    
    // Navigate to chat screen
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (context) => const ChatScreen()),
      );
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Colors.indigo, Colors.purple],
              ),
            ),
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text(
                      'Helply',
                      style: TextStyle(
                        fontSize: 48,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        fontFamily: 'PlayfairDisplay',
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'AI Meeting Assistant',
                      style: TextStyle(
                        fontSize: 20,
                        color: Colors.white70,
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Silent, Smart, and Always On Top',
                      style: TextStyle(
                        fontSize: 16,
                        color: Colors.white70,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 40),
                    // Context buttons
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        ElevatedButton.icon(
                          onPressed: () => _showContextDialog(true),
                          icon: const Icon(Icons.file_present),
                          label: const Text('Resume'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white.withOpacity(0.2),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 24,
                              vertical: 16,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        ElevatedButton.icon(
                          onPressed: () => _showContextDialog(false),
                          icon: const Icon(Icons.work),
                          label: const Text('Job Description'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white.withOpacity(0.2),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 24,
                              vertical: 16,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 40),
                    // Start button
                    ElevatedButton.icon(
                      onPressed: _startAssistant,
                      icon: const Icon(Icons.play_arrow),
                      label: const Text('Start Assistant'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: Colors.indigo,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 32,
                          vertical: 16,
                        ),
                        textStyle: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          // Gear icon positioned at top-right
          Positioned(
            top: 40,
            right: 20,
            child: IconButton(
              icon: const Icon(
                Icons.settings,
                color: Colors.white,
                size: 30,
              ),
              onPressed: _showApiKeyDialog,
            ),
          ),
        ],
      ),
    );
  }
}