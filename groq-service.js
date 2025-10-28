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
    
    // Determine appropriate max_tokens based on question complexity
    const maxTokens = determineAppropriateLength(truncatedPrompt);
    
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful AI assistant in a meeting. Your answers should be concise and complete. For brief questions, provide 1-2 sentences. For complex questions, provide 2-4 sentences as needed. Always ensure your responses end with complete sentences and proper punctuation. If provided with resume and job description context, use that information to tailor your responses to be relevant to the job and candidate. Always provide a helpful response, even if the input seems unclear. When responding to 'Tell me about yourself' or similar open-ended questions, provide a complete, well-structured response that covers key points without being cut off."
        },
        {
          role: "user",
          content: truncatedPrompt
        }
      ],
      model: "openai/gpt-oss-120b", // Correct model name with openai/ prefix
      temperature: 0.7,
      max_tokens: maxTokens,
      top_p: 1,
      stream: false,
      stop: ["\n\n"] // Stop generation at double newlines to avoid incomplete thoughts
    });

    let response = chatCompletion.choices[0]?.message?.content || "";
    
    // If response is empty or just whitespace, provide a default response
    if (!response || response.trim().length === 0) {
      return "I heard you, but I'm not sure how to respond to that. Could you please rephrase your question?";
    }
    
    // Ensure the response ends with a complete sentence
    response = ensureCompleteSentence(response);
    
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

/**
 * Determines appropriate response length based on question complexity
 * @param {string} prompt - The user's prompt
 * @returns {number} Appropriate max_tokens value
 */
function determineAppropriateLength(prompt) {
  // Keywords that typically require longer responses
  const complexKeywords = [
    'tell me about yourself', 'explain', 'describe', 'how does', 'why is',
    'what are the', 'compare', 'analyze', 'evaluate', 'discuss', 'overview',
    'introduce', 'background', 'experience', 'approach', 'methodology'
  ];
  
  // Convert prompt to lowercase for matching
  const lowerPrompt = prompt.toLowerCase();
  
  // Check if prompt contains complex keywords
  const hasComplexKeywords = complexKeywords.some(keyword => lowerPrompt.includes(keyword));
  
  // Check prompt length
  const isLongPrompt = prompt.length > 100;
  
  // Return appropriate token limit
  if (hasComplexKeywords || isLongPrompt) {
    return 250; // More tokens for complex questions
  }
  
  return 150; // Standard token limit for simple questions
}

/**
 * Ensures a response ends with a complete sentence
 * @param {string} text - The text to check and potentially modify
 * @returns {string} Text ending with a complete sentence
 */
function ensureCompleteSentence(text) {
  // Trim whitespace
  text = text.trim();
  
  // If text is empty, return as is
  if (!text) return text;
  
  // If text is very short, it's likely incomplete - try to make it complete
  if (text.length < 10) {
    // If it doesn't end with punctuation, add a period
    const lastChar = text.charAt(text.length - 1);
    if (![ '.', '!', '?', '"', "'" ].includes(lastChar)) {
      return text + '.';
    }
    return text;
  }
  
  // Check if the text ends mid-sentence with common incomplete patterns
  const incompleteEndings = [
    'and', 'but', 'or', 'so', 'then', 'than', 'as', 'if', 'when', 'while',
    'because', 'since', 'although', 'though', 'unless', 'until', 'where',
    'whereas', 'whether', 'after', 'before', 'during', 'through', 'throughout',
    'within', 'without', 'despite', 'in', 'on', 'at', 'by', 'for', 'with',
    'about', 'against', 'between', 'among', 'toward', 'into', 'onto', 'upon'
  ];
  
  const words = text.split(/\s+/);
  const lastWord = words[words.length - 1].toLowerCase().replace(/[.,;:!?]+$/, '');
  
  // If the last word is an incomplete ending, try to complete the thought
  if (incompleteEndings.includes(lastWord)) {
    // Remove the incomplete word and add a period
    const textWithoutLastWord = words.slice(0, -1).join(' ');
    if (textWithoutLastWord.length > 0) {
      return textWithoutLastWord.trim() + '.';
    }
  }
  
  // Get the last character
  const lastChar = text.charAt(text.length - 1);
  
  // If it already ends with sentence-ending punctuation, return as is
  if (lastChar === '.' || lastChar === '!' || lastChar === '?') {
    return text;
  }
  
  // If it ends with a comma, semicolon, or colon, remove it and add a period
  if (lastChar === ',' || lastChar === ';' || lastChar === ':') {
    return text.slice(0, -1).trim() + '.';
  }
  
  // If it ends with a closing parenthesis or bracket, check the character before it
  if (lastChar === ')' || lastChar === ']' || lastChar === '"' || lastChar === "'") {
    if (text.length > 1) {
      const charBefore = text.charAt(text.length - 2);
      if (charBefore === '.' || charBefore === '!' || charBefore === '?') {
        return text; // Ends with properly punctuated quote/parenthesis
      }
    }
    // If not properly punctuated, add a period
    return text + '.';
  }
  
  // For all other cases, add a period
  return text + '.';
}

module.exports = {
  transcribeAudio,
  getAIResponse
};