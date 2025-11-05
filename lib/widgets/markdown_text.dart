import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

class MarkdownText extends StatelessWidget {
  final String data;
  final TextStyle? style;
  final TextAlign textAlign;
  
  const MarkdownText({
    Key? key,
    required this.data,
    this.style,
    this.textAlign = TextAlign.start,
  }) : super(key: key);
  
  @override
  Widget build(BuildContext context) {
    return MarkdownBody(
      data: data,
      styleSheet: MarkdownStyleSheet(
        p: style?.copyWith(fontSize: 16) ?? const TextStyle(fontSize: 16),
        h1: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.indigo),
        h2: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.indigo),
        h3: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.indigo),
        strong: const TextStyle(fontWeight: FontWeight.bold),
        em: const TextStyle(fontStyle: FontStyle.italic),
        blockquote: const TextStyle(
          color: Colors.grey,
          fontStyle: FontStyle.italic,
        ),
        code: const TextStyle(
          fontFamily: 'monospace',
          fontSize: 14,
          backgroundColor: Color(0xFFf5f5f5),
          color: Colors.black87,
        ),
        codeblockDecoration: BoxDecoration(
          color: const Color(0xFFf8f8f8),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.grey.shade300),
        ),
        horizontalRuleDecoration: BoxDecoration(
          border: Border(
            top: BorderSide(
              color: Colors.grey.shade300,
              width: 1,
            ),
          ),
        ),
      ),
      onTapLink: (text, href, title) {
        // Handle link taps if needed
      },
    );
  }
}