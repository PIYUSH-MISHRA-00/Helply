const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '.env') });

// Export the loaded environment variables
const groqApiKey = process.env.GROQ_API_KEY;

// Check if API key is valid (not a placeholder)
if (groqApiKey && (groqApiKey.startsWith('gsk_') || groqApiKey.startsWith('sk-'))) {
  console.log('Groq API Key loaded successfully');
} else if (groqApiKey) {
  console.warn('Warning: Groq API Key might be invalid or a placeholder');
} else {
  console.error('Error: GROQ_API_KEY not found in environment variables. Please check your .env file.');
}

module.exports = {
  groqApiKey
};