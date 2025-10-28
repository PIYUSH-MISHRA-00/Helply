class DualRecordingService {
    constructor() {
        this.microphoneRecorder = null;
        this.systemRecorder = null;
        this.microphoneStream = null;
        this.systemStream = null;
        this.microphoneChunks = [];
        this.systemChunks = [];
        this.isRecording = false;
        this.activeRecorders = 0;
    }

    async start() {
        if (this.isRecording) return false;

        try {
            // Try to get microphone stream first
            try {
                this.microphoneStream = await navigator.mediaDevices.getUserMedia({ 
                    audio: true,
                    video: false
                });
                
                this.microphoneRecorder = new MediaRecorder(this.microphoneStream, {
                    mimeType: 'audio/webm;codecs=opus'
                });

                this.microphoneChunks = [];
                this.microphoneRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        this.microphoneChunks.push(event.data);
                    }
                };

                this.microphoneRecorder.start(100);
                this.activeRecorders++;
                console.log('Microphone recording started');
            } catch (micError) {
                console.warn('Failed to start microphone recording:', micError.message);
            }

            // Try to get system audio stream
            try {
                this.systemStream = await navigator.mediaDevices.getDisplayMedia({
                    audio: true,
                    video: true // Required for getDisplayMedia to work
                });

                // Use only audio tracks from system stream
                const systemAudioTracks = this.systemStream.getAudioTracks();
                if (systemAudioTracks.length > 0) {
                    const systemAudioStream = new MediaStream(systemAudioTracks);
                    
                    this.systemRecorder = new MediaRecorder(systemAudioStream, {
                        mimeType: 'audio/webm;codecs=opus'
                    });

                    this.systemChunks = [];
                    this.systemRecorder.ondataavailable = (event) => {
                        if (event.data.size > 0) {
                            this.systemChunks.push(event.data);
                        }
                    };

                    this.systemRecorder.start(100);
                    this.activeRecorders++;
                    console.log('System audio recording started');
                }
            } catch (systemError) {
                console.warn('Failed to start system audio recording:', systemError.message);
            }

            // If neither recorder started, throw an error
            if (this.activeRecorders === 0) {
                throw new Error('Failed to start any audio recording source');
            }

            this.isRecording = true;
            return true;
        } catch (error) {
            console.error('Failed to start dual recording:', error);
            this.cleanup();
            throw error;
        }
    }

    stop() {
        if (!this.isRecording) return null;

        return new Promise((resolve, reject) => {
            try {
                const cleanupAndResolve = async () => {
                    try {
                        // Combine chunks from both sources
                        const allChunks = [...this.microphoneChunks, ...this.systemChunks];
                        
                        if (allChunks.length === 0) {
                            this.cleanup();
                            resolve(null);
                            return;
                        }

                        // Create a single blob with all audio data
                        const blob = new Blob(allChunks, { type: 'audio/webm' });
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

                // Stop recorders
                let stoppedCount = 0;
                const totalRecorders = this.activeRecorders;
                
                const checkIfAllStopped = () => {
                    stoppedCount++;
                    if (stoppedCount >= totalRecorders) {
                        cleanupAndResolve();
                    }
                };

                // Stop microphone recorder if active
                if (this.microphoneRecorder && this.microphoneRecorder.state !== 'inactive') {
                    this.microphoneRecorder.onstop = checkIfAllStopped;
                    this.microphoneRecorder.stop();
                } else {
                    checkIfAllStopped();
                }

                // Stop system recorder if active
                if (this.systemRecorder && this.systemRecorder.state !== 'inactive') {
                    this.systemRecorder.onstop = checkIfAllStopped;
                    this.systemRecorder.stop();
                } else {
                    checkIfAllStopped();
                }

                // Stop all tracks
                if (this.microphoneStream) {
                    this.microphoneStream.getTracks().forEach(track => track.stop());
                }
                if (this.systemStream) {
                    this.systemStream.getTracks().forEach(track => track.stop());
                }
            } catch (error) {
                console.error('Failed to stop dual recording:', error);
                this.cleanup();
                reject(error);
            }
        });
    }

    cleanup() {
        this.microphoneChunks = [];
        this.systemChunks = [];
        this.isRecording = false;
        this.activeRecorders = 0;
        
        if (this.microphoneRecorder) {
            this.microphoneRecorder = null;
        }
        if (this.systemRecorder) {
            this.systemRecorder = null;
        }
        
        if (this.microphoneStream) {
            this.microphoneStream.getTracks().forEach(track => {
                if (track.readyState === 'live') {
                    track.stop();
                }
            });
            this.microphoneStream = null;
        }
        
        if (this.systemStream) {
            this.systemStream.getTracks().forEach(track => {
                if (track.readyState === 'live') {
                    track.stop();
                }
            });
            this.systemStream = null;
        }
    }

    isActive() {
        return this.isRecording;
    }
}

module.exports = DualRecordingService;