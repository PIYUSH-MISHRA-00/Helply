const { app, BrowserWindow, ipcMain, systemPreferences, desktopCapturer } = require('electron')
const path = require('path')
const fs = require('fs')
const GroqService = require('./groq-service')
const { groqApiKey } = require('./load-env')

// Global variables
let mainWindow = null
let isRecording = false
let currentTranscript = ''
let answerDebounceTimer = null
let conversationHistory = []

// Create a backup of window position and size for restoring
let windowState = {
  width: 500,
  height: 400,
  x: null,
  y: null
};

// Add this to track if we're in screen sharing mode
let isInScreenSharingMode = false;

// Add this near the top with other platform-specific code
const isWindows = process.platform === 'win32';

// Function to get credentials path that works in both dev and production
function getCredentialsPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'helply-credentials.json')
  } else {
    return path.join(__dirname, 'helply-credentials.json')
  }
}

// Update the createWindow function to handle Windows-specific settings
function createWindow() {
  // Configure window options with screen sharing compatibility in mind
  const windowOptions = {
    width: 500,
    height: 400,
    alwaysOnTop: true,
    transparent: false,
    frame: true,
    skipTaskbar: false,
    icon: path.join(__dirname, 'assets/icons/icon.png'),
    backgroundColor: '#FFFFFF',
    titleBarStyle: 'default',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false
    }
  };
  
  // Create the window
  mainWindow = new BrowserWindow(windowOptions);
  
  // Load the HTML file
  mainWindow.loadFile('index.html');
  
  // Set up window for screen exclusion compatibility
  if (process.platform === 'darwin') {
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
      
      // Initialize with properties that make exclusion work better
      mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      mainWindow.setWindowButtonVisibility(true);
      
      // Move to front to establish window layering
      app.dock.show();
      mainWindow.moveTop();
    });
  } else if (isWindows) {
    // Windows-specific setup
    mainWindow.setSkipTaskbar(false);
    app.setAppUserModelId('com.helply.assistant');
  }
  
  // Log when window is created
  console.log('Main window created');
}

// Update the toggle-recording handler to provide immediate feedback
ipcMain.on('toggle-recording', async (event, isStarting) => {
  // Clear timeout if there's any pending
  if (answerDebounceTimer) {
    clearTimeout(answerDebounceTimer);
    answerDebounceTimer = null;
  }

  // Handle recording start/stop based on explicit parameter
  if (isStarting) {
    // Starting a new recording session
    console.log('Starting new recording session');
    isRecording = true;
    // Reset transcript when starting a new recording
    currentTranscript = '';
    // Initialize audio chunks array
    global.audioChunks = [];
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('recording-started');
      // Send empty transcript to UI
      mainWindow.webContents.send('transcript', '');
    }
  } else {
    // Stopping recording - this should be fast
    console.log('Stopping recording and generating answer');
    isRecording = false;
    
    // Process all collected audio chunks
    if (global.audioChunks && global.audioChunks.length > 0) {
      try {
        // Combine all audio chunks into a single buffer
        const combinedBuffer = Buffer.concat(global.audioChunks);
        console.log('Combined audio buffer size:', combinedBuffer.length);
        
        // Transcribe the combined audio
        const transcription = await GroqService.transcribeAudio(combinedBuffer);
        
        if (transcription) {
          console.log('Transcription:', transcription);
          currentTranscript = transcription;
          
          // Send transcription to renderer
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('transcript', transcription);
            // Automatically get answer from Groq
            await getGroqAnswer(transcription);
          }
        } else {
          console.log('No transcription available');
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('transcript', 'No speech detected. Please try again.');
          }
        }
      } catch (error) {
        console.error('Error processing audio:', error);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('transcript', `Error: ${error.message || 'Unknown error'}`);
        }
      }
    } else {
      console.log('No audio chunks collected');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('transcript', 'No speech detected. Please try again.');
      }
    }
    
    // Clear audio chunks
    global.audioChunks = [];
  }
});

// Modify the stream-audio-chunk handler to collect chunks instead of processing them immediately
ipcMain.on('stream-audio-chunk', async (event, audioChunk) => {
  try {
    // Skip processing if we're not recording
    if (!isRecording) return;
    
    // Collect the audio chunk
    if (!global.audioChunks) {
      global.audioChunks = [];
    }
    
    // Convert base64 audio chunk to buffer and store it
    const audioBuffer = Buffer.from(audioChunk, 'base64');
    global.audioChunks.push(audioBuffer);
    
    console.log('Collected audio chunk, total chunks:', global.audioChunks.length);
  } catch (error) {
    console.error('Error collecting audio chunk:', error);
  }
});

// Function to get AI response using Groq
async function getGroqAnswer(transcript) {
  try {
    if (!transcript || transcript.trim().length === 0) {
      console.log('Empty transcript, not sending to Groq');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('answer', 'I couldn\'t hear anything. Please try again.');
      }
      return;
    }

    console.log('Sending to Groq:', transcript);
    
    // Send status update
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('answer-status', 'Generating answer...');
    }

    // Get response from Groq
    const answer = await GroqService.getAIResponse(transcript);
    
    if (answer) {
      console.log('Received answer from Groq:', answer);
      
      // Explicitly send answer to UI
      if (mainWindow && !mainWindow.isDestroyed()) {
        console.log('Sending answer to UI, length:', answer.length);
        console.log('Answer preview:', answer.substring(0, 200) + '...');
        mainWindow.webContents.send('answer', answer);
      } else {
        console.error('Main window not available for sending answer');
      }
    } else {
      console.error('No answer content in Groq response');
      
      // Send appropriate error message
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('answer', 'Could not generate an answer. Please try again.');
      }
    }
  } catch (error) {
    console.error('Groq API error:', error);
    
    // Provide more specific error message
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        mainWindow.webContents.send('answer', 'The connection to the AI service timed out. Please try again.');
      } else {
        mainWindow.webContents.send('answer', `Sorry, I couldn't generate an answer: ${error.message}`);
      }
    }
  }
}

// Function to get AI response using Groq with context
async function getGroqAnswerWithContext(question, resume, jobDescription) {
  try {
    if (!question || question.trim().length === 0) {
      console.log('Empty question, not sending to Groq');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('answer', 'I couldn\'t understand your question. Please try again.');
      }
      return;
    }

    console.log('Sending to Groq with context:', question);
    
    // Send status update
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('answer-status', 'Generating answer...');
    }

    // Prepare context for the AI
    let context = "";
    if ((resume && resume.trim().length > 0) || (jobDescription && jobDescription.trim().length > 0)) {
      context = "Use the following context to answer the question:\n";
      if (resume && resume.trim().length > 0) {
        // Truncate resume to avoid making the prompt too long
        const truncatedResume = resume.length > 1000 ? resume.substring(0, 1000) + '...' : resume;
        context += `Resume: ${truncatedResume}\n`;
      }
      if (jobDescription && jobDescription.trim().length > 0) {
        // Truncate job description to avoid making the prompt too long
        const truncatedJobDescription = jobDescription.length > 1000 ? jobDescription.substring(0, 1000) + '...' : jobDescription;
        context += `Job Description: ${truncatedJobDescription}\n`;
      }
      context += "\nQuestion: ";
    }

    // Combine context with question, but ensure the total prompt isn't too long
    let fullPrompt = question;
    if (context && context.trim().length > 0) {
      // Limit the total prompt length to avoid API errors
      const maxQuestionLength = 1500;
      const maxContextLength = 1000;
      
      let truncatedQuestion = question;
      if (question.length > maxQuestionLength) {
        truncatedQuestion = question.substring(0, maxQuestionLength) + '...';
      }
      
      let truncatedContext = context;
      if (context.length > maxContextLength) {
        truncatedContext = context.substring(0, maxContextLength) + '...';
      }
      
      fullPrompt = truncatedContext + truncatedQuestion;
    }

    // Get response from Groq with conversation history
    const answer = await GroqService.getAIResponse(fullPrompt, conversationHistory);
    
    if (answer && answer.trim().length > 0) {
      console.log('Received answer from Groq:', answer);
      
      // Add the interaction to conversation history
      conversationHistory.push({ role: "user", content: fullPrompt });
      conversationHistory.push({ role: "assistant", content: answer });
      
      // Limit conversation history to prevent token overflow
      if (conversationHistory.length > 10) {
        conversationHistory = conversationHistory.slice(-10);
      }
      
      // Explicitly send answer to UI
      if (mainWindow && !mainWindow.isDestroyed()) {
        console.log('Sending answer to UI');
        mainWindow.webContents.send('answer', answer);
      } else {
        console.error('Main window not available for sending answer');
      }
    } else {
      console.error('No answer content in Groq response');
      
      // Send appropriate error message
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('answer', 'Could not generate an answer. Please try again.');
      }
    }
  } catch (error) {
    console.error('Groq API error:', error);
    
    // Provide more specific error message
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        mainWindow.webContents.send('answer', 'The connection to the AI service timed out. Please try again.');
      } else {
        mainWindow.webContents.send('answer', `Sorry, I couldn't generate an answer: ${error.message}`);
      }
    }
  }
}

// Add a new IPC event handler for stopping the stream
ipcMain.on('stop-audio-stream', () => {
  // Just set recording flag to false since we're not using a stream anymore
  isRecording = false;
});

// Add this new function to reset transcript without creating a new chat
ipcMain.on('reset-transcript', () => {
  currentTranscript = '';
  conversationHistory = [];
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('transcript', '');
  }
});

// Completely rework the IPC handler for toggling screen sharing mode
ipcMain.on('toggle-screen-sharing-mode', (event, isScreenSharing) => {
  // Get current window position and size if not in sharing mode already
  if (!isInScreenSharingMode && mainWindow) {
    const position = mainWindow.getPosition();
    const size = mainWindow.getSize();
    windowState = {
      width: size[0],
      height: size[1],
      x: position[0],
      y: position[1]
    };
  }
  
  // Update tracking variable
  isInScreenSharingMode = isScreenSharing;
  
  if (mainWindow) {
    if (isScreenSharing) {
      // On macOS, we need special handling
      if (process.platform === 'darwin') {
        try {
          // Critical sequence for macOS - order matters
          
          // First make it invisible to screen sharing
          mainWindow.setContentProtection(true);
          console.log('Screen sharing exclusion activated on macOS');
          
          // Set window to be visible on all workspaces (including full screen)
          mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
          
          // Use specific window level to ensure it stays on top but excluded
          mainWindow.setAlwaysOnTop(true, "floating", 1);
          
          // Hide the traffic lights (window buttons)
          mainWindow.setWindowButtonVisibility(false);
          
          // Apply a very slight opacity change (not visible to users)
          // This is a crucial trick that helps with exclusion
          mainWindow.setOpacity(0.99);
          
          // Get the window bounds and temporarily resize to force a redraw
          const bounds = mainWindow.getBounds();
          mainWindow.setBounds({ 
            x: bounds.x, 
            y: bounds.y, 
            width: bounds.width + 1, 
            height: bounds.height 
          });
          
          // Restore original bounds after a brief delay
          setTimeout(() => {
            mainWindow.setBounds(bounds);
          }, 10);
          
          // Force a repaint with vibrancy changes
          mainWindow.setVibrancy('popover');
          setTimeout(() => {
            mainWindow.setVibrancy(null);
          }, 50);
        } catch (error) {
          console.error('Failed to apply screen sharing protection on macOS:', error);
        }
      } 
      // For Windows
      else if (process.platform === 'win32') {
        try {
          // Windows approach is simpler
          mainWindow.setContentProtection(true);
          mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
          console.log('Screen sharing exclusion activated on Windows');
        } catch (error) {
          console.error('Failed to apply screen sharing protection on Windows:', error);
        }
      }
      
      // Notify renderer that screen sharing mode is active
      mainWindow.webContents.send('screen-sharing-active', true);
    } 
    else {
      try {
        // Restore normal window behavior in exact opposite order
        mainWindow.setOpacity(1.0);
        
        if (process.platform === 'darwin') {
          mainWindow.setWindowButtonVisibility(true);
          mainWindow.setVisibleOnAllWorkspaces(false);
        }
        
        mainWindow.setAlwaysOnTop(true); // Keep on top but with default behavior
        mainWindow.setContentProtection(false);
        
        // Force window redraw on macOS
        if (process.platform === 'darwin') {
          const bounds = mainWindow.getBounds();
          mainWindow.setBounds({ 
            x: bounds.x, 
            y: bounds.y, 
            width: bounds.width + 1, 
            height: bounds.height 
          });
          setTimeout(() => {
            mainWindow.setBounds(bounds);
          }, 10);
        }
        
        // Notify renderer
        mainWindow.webContents.send('screen-sharing-active', false);
        console.log('Screen sharing exclusion deactivated');
      } catch (error) {
        console.error('Error disabling screen sharing protection:', error);
      }
    }
  }
});

ipcMain.on('get-answer', async (event, transcript) => {
  // For backward compatibility, call without context
  await getGroqAnswerWithContext(transcript, '', '');
})

ipcMain.on('new-chat', () => {
  currentTranscript = ''
  conversationHistory = []
  if (isRecording) {
    isRecording = false
    if (recording) {
      record.stop()
      recording = null
    }
    if (mainWindow) {
      mainWindow.webContents.send('recording-stopped')
    }
  }
  if (mainWindow) {
    mainWindow.webContents.send('transcript', '')
  }
})

ipcMain.on('recording-stopped', () => {
  if (mainWindow) {
    mainWindow.webContents.send('update-recording-status', false)
  }
})

// Handle audio data from renderer process (without context for backward compatibility)
ipcMain.on('audio-data', async (event, base64Audio) => {
  try {
    if (!base64Audio) {
      console.error('No audio data received');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('transcript', 'Error: No audio data received');
      }
      return;
    }

    const audioBuffer = Buffer.from(base64Audio, 'base64');
    console.log('Received audio data from renderer, size:', audioBuffer.length);

    // Reduce the minimum buffer size check for faster processing
    if (audioBuffer.length < 50) {
      console.error('Audio buffer too small, likely empty recording');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('transcript', 'No speech detected. Please try again.');
      }
      return;
    }

    // Transcribe audio using Groq
    console.log('Sending audio to Groq for transcription...');
    try {
      const transcription = await GroqService.transcribeAudio(audioBuffer);
      
      if (transcription) {
        console.log('Transcription:', transcription);
        currentTranscript = transcription;
        
        // Send transcription to renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('transcript', transcription);
          // Automatically get answer from Groq without context for backward compatibility
          await getGroqAnswerWithContext(transcription, '', '');
        }
      } else {
        console.log('No transcription available');
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('transcript', 'No speech detected. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error transcribing audio with Groq:', error);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('transcript', `Error: ${error.message || 'Unknown error'}`);
      }
    }
  } catch (error) {
    console.error('Error processing audio:', error);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transcript', `Error: ${error.message || 'Unknown error'}`);
    }
  }
});

// Handle get-answer-with-context IPC event
ipcMain.on('get-answer-with-context', async (event, data) => {
  const { question, resume, jobDescription } = data;
  await getGroqAnswerWithContext(question, resume, jobDescription);
});

// Handle audio-data-with-context IPC event
ipcMain.on('audio-data-with-context', async (event, data) => {
  try {
    const { audio, resume, jobDescription } = data;
    
    if (!audio) {
      console.error('No audio data received');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('transcript', 'Error: No audio data received');
      }
      return;
    }

    const audioBuffer = Buffer.from(audio, 'base64');
    console.log('Received audio data from renderer, size:', audioBuffer.length);

    // Reduce the minimum buffer size check for faster processing
    if (audioBuffer.length < 50) {
      console.error('Audio buffer too small, likely empty recording');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('transcript', 'No speech detected. Please try again.');
      }
      return;
    }

    // Transcribe audio using Groq
    console.log('Sending audio to Groq for transcription...');
    try {
      const transcription = await GroqService.transcribeAudio(audioBuffer);
      
      if (transcription) {
        console.log('Transcription:', transcription);
        currentTranscript = transcription;
        
        // Send transcription to renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('transcript', transcription);
          // Automatically get answer from Groq with context
          await getGroqAnswerWithContext(transcription, resume, jobDescription);
        }
      } else {
        console.log('No transcription available');
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('transcript', 'No speech detected. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error transcribing audio with Groq:', error);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('transcript', `Error: ${error.message || 'Unknown error'}`);
      }
    }
  } catch (error) {
    console.error('Error processing audio:', error);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transcript', `Error: ${error.message || 'Unknown error'}`);
    }
  }
});

// Optimize audio processing by reducing buffer size check
// This will make the processing faster and more responsive

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error)
})