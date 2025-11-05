class ContextModel {
  String? resume;
  String? jobDescription;

  ContextModel({this.resume, this.jobDescription});

  bool get hasContext => (resume != null && resume!.isNotEmpty) || 
                         (jobDescription != null && jobDescription!.isNotEmpty);

  Map<String, dynamic> toJson() {
    return {
      'resume': resume,
      'jobDescription': jobDescription,
    };
  }

  factory ContextModel.fromJson(Map<String, dynamic> json) {
    return ContextModel(
      resume: json['resume'] as String?,
      jobDescription: json['jobDescription'] as String?,
    );
  }

  @override
  String toString() {
    return 'ContextModel{resume: ${resume != null ? 'present' : 'null'}, jobDescription: ${jobDescription != null ? 'present' : 'null'}}';
  }
}