import 'package:flutter/material.dart';
import '../models/context_model.dart';

class ContextDialog extends StatefulWidget {
  final ContextModel? initialContext;
  final bool isResume;
  
  const ContextDialog({
    Key? key,
    this.initialContext,
    required this.isResume,
  }) : super(key: key);
  
  @override
  State<ContextDialog> createState() => _ContextDialogState();
}

class _ContextDialogState extends State<ContextDialog> {
  late TextEditingController _controller;
  
  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(
      text: widget.isResume 
          ? widget.initialContext?.resume 
          : widget.initialContext?.jobDescription,
    );
  }
  
  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.isResume ? 'Resume' : 'Job Description'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _controller,
            decoration: InputDecoration(
              hintText: widget.isResume 
                  ? 'Paste your resume here...' 
                  : 'Paste the job description here...',
              border: const OutlineInputBorder(),
            ),
            maxLines: 8,
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: () {
            Navigator.of(context).pop(_controller.text.trim());
          },
          child: const Text('Save'),
        ),
      ],
    );
  }
}