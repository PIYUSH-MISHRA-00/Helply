enum MessageType { user, ai }

class ChatMessage {
  final String text;
  final MessageType type;
  final DateTime timestamp;

  ChatMessage({
    required this.text,
    required this.type,
    required this.timestamp,
  });

  ChatMessage.user({
    required String text,
  }) : this(
          text: text,
          type: MessageType.user,
          timestamp: DateTime.now(),
        );

  ChatMessage.ai({
    required String text,
  }) : this(
          text: text,
          type: MessageType.ai,
          timestamp: DateTime.now(),
        );

  Map<String, dynamic> toJson() {
    return {
      'text': text,
      'type': type.index,
      'timestamp': timestamp.toIso8601String(),
    };
  }

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      text: json['text'] as String,
      type: MessageType.values[json['type'] as int],
      timestamp: DateTime.parse(json['timestamp'] as String),
    );
  }

  @override
  String toString() {
    return 'ChatMessage{text: $text, type: $type, timestamp: $timestamp}';
  }
}