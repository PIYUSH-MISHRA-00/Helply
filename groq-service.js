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
 * Automatically detects coding vs. conceptual interview questions
 * and structures output with both layman and professional explanations
 */
async function getAIResponse(prompt, conversationHistory = []) {
  try {
    console.log("Generating AI response for interview question...");
    console.log('Sending to Groq with context:', prompt);

    // STEP 1: Smart detection for code-related prompts
    const lowerPrompt = prompt.toLowerCase();
    const codeIndicators = [
      "code", "program", "implement", "function", "class", "algorithm", 
      "loop", "array", "python", "java", "c++", "javascript", "sql", 
      "develop a", "write a", "create a", "build a", "snippet", "fibonacci", 
      "armstrong", "prime", "factorial", "sort", "search", "print"
    ];
    const isCodingPrompt = codeIndicators.some(word => lowerPrompt.includes(word));

    // STEP 2: Prepare system message with clear formatting rules
    const systemMessage = {
      role: "system",
      content: `
You are an expert interview assistant that gives structured, speakable answers in an interview format.

Your response format depends on the question type:

For ALL questions, provide BOTH explanations:
1. Layman Explanation: Simple, easy-to-understand explanation as if explaining to someone without technical background (2-3 sentences)
2. Professional Explanation: Detailed, technical explanation suitable for a professional interview setting (3-4 sentences)

For coding/technical questions ALSO provide:
3. Code Implementation: Complete, runnable code in appropriate language with proper syntax
4. Code Walkthrough: Brief explanation of how the code works (2-3 sentences)

Format your responses EXACTLY like this:

## Layman Explanation
[Simple explanation in plain English]

## Professional Explanation
[Detailed technical explanation with relevant terminology]

${isCodingPrompt ? `## Code Implementation
\`\`\`[language]
[your complete code here]
\`\`\`

## Code Walkthrough
[Explanation of how the code works]
` : ''}

General rules:
- Keep answers professional, complete, and neatly formatted
- Do NOT stop mid-explanation or mid-code
- For coding questions, make sure the code is runnable and complete with all necessary parts
- Never include introductory phrases like "Sure, here's..." or similar
- Directly start with the explanations
- Always provide both layman and professional explanations for every question
- Only add code section if the question is specifically asking for code
`
    };

    // STEP 3: Adapt message content based on whether it's coding or not
    const userMessage = {
      role: "user",
      content: `Provide a complete interview-ready response with both layman and professional explanations${isCodingPrompt ? ' and code implementation' : ''}:\n\n${prompt}`
    };

    const messages = [
      systemMessage,
      ...conversationHistory,
      userMessage
    ];

    // STEP 4: Adjust token limit dynamically
    const maxTokens = isCodingPrompt ? 1200 : 600;

    // STEP 5: Request Groq completion
    const chatCompletion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages,
      temperature: 0.7,
      max_tokens: maxTokens,
      top_p: 1,
      stream: false,
      stop: [] // Don't stop early for interview responses - let them be complete
    });

    let response = chatCompletion.choices?.[0]?.message?.content || "";
    
    // If response is empty or just whitespace, provide a default response
    if (!response || response.trim().length === 0) {
      response = "I couldn't generate a response. Please try rephrasing your question.";
    }

    // STEP 6: Ensure it ends cleanly
    response = ensureCompleteSentence(response);

    // STEP 7: Return response with clean Markdown (handled by frontend)
    return formatCodeInResponse(response);

  } catch (error) {
    console.error("Error generating AI response:", error);
    if (error.response?.status === 429) {
      return "Server is busy. Please try again shortly.";
    }
    if (error.response?.status === 500) {
      return "Temporary issue with the AI model. Please retry.";
    }
    throw error;
  }
}

/**
 * Enhanced formatCodeInResponse (adds consistency)
 * @param {string} response - The AI response to process
 * @returns {string} Formatted response with properly structured code blocks
 */
function formatCodeInResponse(response) {
  if (!response) return "";

  // Remove common introductory phrases
  response = response.replace(/^Sure, here[^\n]*\n?/i, '');
  response = response.replace(/^Here[^\n]*response[^\n]*\n?/i, '');
  response = response.replace(/^I can help you with that[^\n]*\n?/i, '');
  response = response.replace(/^Here's a concise[^\n]*\n?/i, '');
  response = response.replace(/^Here's how you can[^\n]*\n?/i, '');
  
  // Ensure Markdown headers are consistent
  response = response
    .replace(/^#+\s*/gm, match => match.trim() + " ")
    .replace(/\n{3,}/g, "\n\n");

  // Ensure code blocks have proper language tags
  if (response.includes("```") && !/```[a-z]+/i.test(response)) {
    // Try to infer language
    if (response.includes("def ") || response.includes("import ")) {
      response = response.replace(/```/g, "```python");
    } else if (response.includes("function ") || response.includes("console.log")) {
      response = response.replace(/```/g, "```javascript");
    } else if (response.includes("public class") || response.includes("public static")) {
      response = response.replace(/```/g, "```java");
    } else if (response.includes("#include") || response.includes("std::")) {
      response = response.replace(/```/g, "```cpp");
    }
  }

  // Add a trailing newline for clean rendering
  return response.trim() + "\n";
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
  if (text.length < 15) {
    // If it doesn't end with punctuation, add a period
    const lastChar = text.charAt(text.length - 1);
    if (![ '.', '!', '?', '"', "'" ].includes(lastChar)) {
      return text + '.';
    }
    return text;
  }
  
  // Special handling for code responses - don't modify if it looks like code
  if (text.includes('```') && (text.includes('def ') || text.includes('function ') || text.includes('class '))) {
    // If it ends with an incomplete line of code, try to complete it
    const lines = text.split('\n');
    const lastLine = lines[lines.length - 1].trim();
    
    // If the last line looks incomplete (ends with =, (, [, {, or :)
    if (/[=\(\[\{:]$/.test(lastLine)) {
      // Remove the incomplete line and add a note
      lines.pop();
      return lines.join('\n') + '\n\n[Response appears to be incomplete. This may be due to token limits. Please try rephrasing your question or asking for a simpler implementation.]';
    }
    
    // If it looks complete, return as is
    return text;
  }
  
  // Check if the response appears to be cut off (ends with a dash or incomplete thought)
  if (text.endsWith('---') || text.endsWith('--') || text.endsWith('-') || text.endsWith('...')) {
    // Remove the trailing incomplete markers and add a note
    let cleanedText = text.replace(/-+$/, '').replace(/\.{3}$/, '').trim();
    return cleanedText + '\n\n[Response appears to be incomplete. This may be due to token limits. Please try rephrasing your question or asking for a simpler implementation.]';
  }
  
  // Check if the text ends mid-sentence with common incomplete patterns
  // Include interview-specific incomplete endings
  const incompleteEndings = [
    'and', 'but', 'or', 'so', 'then', 'than', 'as', 'if', 'when', 'while',
    'because', 'since', 'although', 'though', 'unless', 'until', 'where',
    'whereas', 'whether', 'after', 'before', 'during', 'through', 'throughout',
    'within', 'without', 'despite', 'in', 'on', 'at', 'by', 'for', 'with',
    'about', 'against', 'between', 'among', 'toward', 'into', 'onto', 'upon',
    'especially', 'particularly', 'specifically', 'namely', 'for example', 'such as',
    'in conclusion', 'to conclude', 'finally', 'ultimately', 'overall',
    'answer', 'response', 'here', 'there', 'sure', 'well', 'first', 'next', 'second', 'third'
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
  
  // Special handling for phrases that sound incomplete
  const incompletePhrases = [
    'here is', 'here are', 'here\'s', 'there is', 'there are', 'there\'s',
    'sure here', 'well here', 'so here', 'now here', 'let me', 'allow me'
  ];
  
  const lowerText = text.toLowerCase();
  for (const phrase of incompletePhrases) {
    if (lowerText.includes(phrase) && !lowerText.includes('.')) {
      // Try to complete the thought or add a period
      if (text.length > 20) {
        return text + '.';
      } else {
        return text + ' Let me provide a more complete answer.';
      }
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

// Test the formatCodeInResponse function (for development only)
/*
const testResponse = "Sure, here's a concise, spoken-style response you can use in an interview:\n\n### Explanation\nThis is a test explanation.\n\n### Code\n```python\ndef test():\n    pass\n```\n\n### Summary\nThis is a test summary.";
console.log('Testing formatCodeInResponse:');
console.log(formatCodeInResponse(testResponse));
*/

// Test the ensureCompleteSentence function (for development only)
/*
const testResponse = "Write a program to print the Fibonacci series in Python. 1. Brief Explanation of the Approach We will generate the Fibonacci series using an iterative method, which is efficient and easy to understand. The algorithm starts with the first two Fibonacci numbers, `0` and `1`. For each subsequent term, we compute the sum of the two previous terms and update the variables accordingly. The process repeats until we have produced the desired number of terms. Key points: - Handles the edge case where the requested length is `0` (no output) or `1` (only `0`). - Runs in O(n) time and O(1) extra space (aside from the list used for output). 2. Complete Code Implementation ```python def fibonacci_series(n: int) -> list[int]: \"\"\" Return a list containing the first `n` numbers of the Fibonacci series. Parameters ---------- n : int Number of Fibonacci numbers to generate. Must be >= 0. Returns ------- list[int] List of the first `n` Fibonacci numbers. \"\"\" if n < 0: raise ValueError(\"Number of terms must be non‑negative\") # Edge cases if n == 0: return [] if n == 1: return [0] # Start with the first two Fibonacci numbers fib = [0, 1] # Generate remaining numbers iteratively while len(fib) < n: next_val = fib[-1] + fib[-2] # sum of last two numbers fib.append(next_val) return fib def main(): # Example usage: ask the user for the number of terms try: count =";
console.log('Testing ensureCompleteSentence with incomplete response:');
console.log(ensureCompleteSentence(testResponse));
*/

// Test the token allocation (for development only)
/*
const testQuestion = "What is supervised and unsupervised, semi-supervised and related reinforcement learning?";
const tokens = determineAppropriateLength(testQuestion);
console.log('Token allocation for ML question:', tokens);

const simpleQuestion = "Hello";
const simpleTokens = determineAppropriateLength(simpleQuestion);
console.log('Token allocation for simple question:', simpleTokens);

const codingQuestion = "Write code to print Fibonacci series in Python";
const codingTokens = determineAppropriateLength(codingQuestion);
console.log('Token allocation for coding question:', codingTokens);
*/

// Test the updated implementation (for development only)
/*
const testResponse = "Here's a Python implementation to print the Fibonacci series. \`\`\`python\ndef print_fibonacci(n):\n    a, b = 0, 1\n    for i in range(n):\n        print(a, end=' ')\n        a, b = b, a + b\n    print()\n\n# Example usage\nprint_fibonacci(10)\n\`\`\`\n\nThis function prints the first n numbers in the Fibonacci series. It uses two variables to keep track of the current and next numbers in the sequence.";
console.log('Testing updated formatCodeInResponse:');
console.log(formatCodeInResponse(testResponse));
*/
