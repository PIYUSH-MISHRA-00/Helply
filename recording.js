class RecordingService {
    constructor() {
        this.mediaRecorder = null;
        this.isRecording = false;
        this.chunks = [];
        this.stream = null;
    }

    async start() {
        if (this.isRecording) return false;

        try {
            // Try system audio capture first (getDisplayMedia)
            try {
                this.stream = await navigator.mediaDevices.getDisplayMedia({
                    audio: true,
                    video: true // Required for getDisplayMedia to work
                });

                // Use only audio tracks
                const audioTracks = this.stream.getAudioTracks();
                if (audioTracks.length === 0) {
                    throw new Error('No audio tracks available in the selected source');
                }

                // Create a new stream with only audio tracks
                const audioStream = new MediaStream(audioTracks);
                
                this.mediaRecorder = new MediaRecorder(audioStream, {
                    mimeType: 'audio/webm;codecs=opus'
                });

                this.chunks = [];
                this.mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        this.chunks.push(event.data);
                    }
                };

                this.mediaRecorder.start(100); // Collect data every 100ms
                this.isRecording = true;

                return true;
            } catch (displayError) {
                console.warn('System audio capture failed, falling back to microphone:', displayError.message);
                
                // Fallback to microphone capture
                this.stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: true,
                    video: false
                });

                this.mediaRecorder = new MediaRecorder(this.stream, {
                    mimeType: 'audio/webm;codecs=opus'
                });

                this.chunks = [];
                this.mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        this.chunks.push(event.data);
                    }
                };

                this.mediaRecorder.start(100); // Collect data every 100ms
                this.isRecording = true;

                return true;
            }
        } catch (error) {
            console.error('Failed to start recording:', error);
            this.cleanup();
            throw error;
        }
    }

    stop() {
        if (!this.isRecording) return null;

        return new Promise((resolve, reject) => {
            try {
                if (!this.mediaRecorder) {
                    reject(new Error('MediaRecorder not initialized'));
                    return;
                }

                this.mediaRecorder.onstop = async () => {
                    try {
                        // Convert chunks to base64
                        const blob = new Blob(this.chunks, { type: 'audio/webm' });
                        const reader = new FileReader();
                        
                        reader.onload = () => {
                            // Convert to base64
                            const base64Data = reader.result.split(',')[1]; // Remove data URL prefix
                            this.cleanup();
                            resolve(base64Data);
                        };
                        
                        reader.onerror = (error) => {
                            reject(error);
                        };
                        
                        reader.readAsDataURL(blob);
                    } catch (error) {
                        reject(error);
                    }
                };

                // Stop recording
                this.mediaRecorder.stop();
                
                // Stop all tracks
                if (this.stream) {
                    this.stream.getTracks().forEach(track => track.stop());
                }
            } catch (error) {
                console.error('Failed to stop recording:', error);
                this.cleanup();
                reject(error);
            }
        });
    }

    cleanup() {
        this.chunks = [];
        this.isRecording = false;
        if (this.mediaRecorder) {
            this.mediaRecorder = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                if (track.readyState === 'live') {
                    track.stop();
                }
            });
            this.stream = null;
        }
    }

    isActive() {
        return this.isRecording;
    }
}

module.exports = RecordingService;