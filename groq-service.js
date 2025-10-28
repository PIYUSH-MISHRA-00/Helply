const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');
const { groqApiKey } = require('./load-env');

// Check if API key is available and valid
if (!groqApiKey) {
  console.error('GROQ_API_KEY not found in environment variables. Please check your .env file.');
  process.exit(1);
} else if (!groqApiKey.startsWith('gsk_')) {
  console.warn('Warning: Groq API Key might be invalid. It should start with "gsk_".');
}

// Initialize Groq client
const groq = new Groq({
  apiKey: groqApiKey
});

/**
 * Transcribe audio using Groq's Whisper model
 * @param {Buffer} audioBuffer - Audio buffer to transcribe
 * @returns {Promise<string>} Transcribed text
 */
async function transcribeAudio(audioBuffer) {
  try {
    console.log('Attempting to transcribe audio with Groq...');
    
    // Create a temporary file for transcription
    const tempFileName = `temp_audio_${Date.now()}.webm`;
    const tempFilePath = path.join(__dirname, tempFileName);
    
    // Write buffer to temporary file
    fs.writeFileSync(tempFilePath, audioBuffer);
    
    // Transcribe using Groq's Whisper model
    // Using the correct model name for Groq's Whisper
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: "whisper-large-v3", // Correct model name for Groq's Whisper
      response_format: "text"
    });
    
    // Clean up temporary file
    fs.unlinkSync(tempFilePath);
    
    console.log('Transcription successful:', transcription);
    return transcription.text || transcription;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
}

/**
 * Get AI response using Groq's gpt-oss-120b model
 * @param {string} prompt - The prompt to send to the AI
 * @returns {Promise<string>} AI-generated response
 */
async function getAIResponse(prompt) {
  try {
    console.log('Getting AI response with Groq gpt-oss-120b model...');
    
    // Truncate prompt if it's too long to avoid API errors
    const maxPromptLength = 2000;
    let truncatedPrompt = prompt;
    if (prompt.length > maxPromptLength) {
      truncatedPrompt = prompt.substring(0, maxPromptLength) + '...';
      console.log('Prompt truncated to avoid API limits');
    }
    
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful AI assistant in a meeting. Your answers must be brief, clear, and direct - no more than 2-3 sentences. If provided with resume and job description context, use that information to tailor your responses to be relevant to the job and candidate. Always provide a helpful response, even if the input seems unclear."
        },
        {
          role: "user",
          content: truncatedPrompt
        }
      ],
      model: "openai/gpt-oss-120b", // Correct model name with openai/ prefix
      temperature: 0.7,
      max_tokens: 150,
      top_p: 1,
      stream: false,
    });

    const response = chatCompletion.choices[0]?.message?.content || "";
    
    // If response is empty or just whitespace, provide a default response
    if (!response || response.trim().length === 0) {
      return "I heard you, but I'm not sure how to respond to that. Could you please rephrase your question?";
    }
    
    return response;
  } catch (error) {
    console.error('Error getting AI response:', error);
    
    // Provide a more helpful error message
    if (error.response && error.response.status === 429) {
      return "I'm currently experiencing high demand. Please try again in a moment.";
    } else if (error.response && error.response.status === 500) {
      return "I'm having trouble processing your request right now. Please try again.";
    }
    
    throw error;
  }
}

module.exports = {
  transcribeAudio,
  getAIResponse
};