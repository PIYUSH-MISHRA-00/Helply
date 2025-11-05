import 'dart:io';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';

class AudioService {
  static final AudioService _instance = AudioService._internal();
  
  factory AudioService() => _instance;
  
  AudioService._internal();
  
  final AudioRecorder _recorder = AudioRecorder();
  bool _isRecording = false;
  String? _audioPath;
  
  bool get isRecording => _isRecording;
  
  // Check if recording is permitted
  Future<bool> hasPermission() async {
    return await _recorder.hasPermission();
  }
  
  // Start recording audio
  Future<bool> startRecording() async {
    try {
      if (await _recorder.hasPermission() == false) {
        return false;
      }
      
      // Get temporary directory for audio file
      final tempDir = await getTemporaryDirectory();
      _audioPath = '${tempDir.path}/recording_${DateTime.now().millisecondsSinceEpoch}.m4a';
      
      // Start recording
      await _recorder.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 128000,
          sampleRate: 44100,
        ),
        path: _audioPath!,
      );
      
      _isRecording = true;
      return true;
    } catch (e) {
      print('Error starting recording: $e');
      return false;
    }
  }
  
  // Stop recording and return audio data
  Future<List<int>?> stopRecording() async {
    try {
      if (!_isRecording) return null;
      
      // Stop recording
      final recording = await _recorder.stop();
      _isRecording = false;
      
      // Read audio file data
      if (_audioPath != null && File(_audioPath!).existsSync()) {
        final file = File(_audioPath!);
        final data = await file.readAsBytes();
        
        // Clean up the temporary file
        await file.delete();
        _audioPath = null;
        
        return data;
      }
      
      return null;
    } catch (e) {
      print('Error stopping recording: $e');
      _isRecording = false;
      _audioPath = null;
      return null;
    }
  }
  
  // Cancel recording without returning data
  Future<void> cancelRecording() async {
    try {
      if (!_isRecording) return;
      
      // Stop recording
      await _recorder.stop();
      _isRecording = false;
      
      // Clean up the temporary file if it exists
      if (_audioPath != null && File(_audioPath!).existsSync()) {
        await File(_audioPath!).delete();
        _audioPath = null;
      }
    } catch (e) {
      print('Error canceling recording: $e');
      _isRecording = false;
      _audioPath = null;
    }
  }
}