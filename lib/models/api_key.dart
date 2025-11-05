class ApiKey {
  String value;

  ApiKey({required this.value});

  bool get isValid => value.isNotEmpty && (value.startsWith('gsk_') || value.startsWith('sk-'));

  @override
  String toString() {
    int length = value.length < 10 ? value.length : 10;
    return 'ApiKey{value: ${value.substring(0, length)}...}';
  }
}