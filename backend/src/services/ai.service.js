const { GoogleGenerativeAI } = require('@google/generative-ai');

const SYSTEM_PROMPT = `You are an intelligent mobile messaging assistant that creates short, natural, context-aware reply suggestions for conversations.

Generate exactly 3 reply suggestions for the given incoming message. 

Rules:
- Each reply must be 2-10 words long
- Sound natural and conversational, like a real human would text
- Be context-appropriate and helpful
- Vary the tone: one positive/agreeable, one neutral/informational, one requesting time/deferring
- Return ONLY a valid JSON array of exactly 3 strings, no other text, no markdown, no explanation
- Example output: ["Yes, I'll handle it right away.", "Got it, thanks for letting me know!", "Let me check and get back to you."]`;

const FALLBACK_SUGGESTIONS = [
  "Sure, I'll handle it!",
  "Got it, thanks!",
  "Let me check and get back to you.",
];

/**
 * Generate 3 AI-powered smart reply suggestions for an incoming message
 * @param {string} incomingMessage - The message to generate replies for
 * @param {Array<{role: string, content: string, isFromMe?: boolean}>} conversationHistory - Last few messages for context
 * @returns {Promise<string[]>} Array of 3 suggestion strings
 */
async function generateSmartReplies(incomingMessage, conversationHistory = []) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    console.warn('⚠️  GEMINI_API_KEY not set, returning fallback suggestions');
    return FALLBACK_SUGGESTIONS;
  }

  try {
    // Initialize Google Generative AI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Using gemini-1.5-flash which is fast, high quality, and has a great free tier
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    // Build context contents from conversation history (last 5 messages)
    const contents = [];
    
    conversationHistory.slice(-5).forEach(msg => {
      // Map frontend/database structure (isFromMe or role) to Gemini roles (model vs user)
      const isFromModel = msg.isFromMe || msg.role === 'assistant' || msg.role === 'model';
      contents.push({
        role: isFromModel ? 'model' : 'user',
        parts: [{ text: msg.content || '' }],
      });
    });

    // Append the current incoming message
    contents.push({
      role: 'user',
      parts: [{ text: `Generate 3 smart reply suggestions for this incoming message: "${incomingMessage}"` }],
    });

    const result = await model.generateContent({
      contents,
    });

    const response = await result.response;
    const rawContent = response.text();
    
    if (!rawContent) {
      return FALLBACK_SUGGESTIONS;
    }

    // Try parsing as JSON
    let parsed;
    try {
      const obj = JSON.parse(rawContent);
      // Handle both array and object with 'suggestions' key
      if (Array.isArray(obj)) {
        parsed = obj;
      } else if (Array.isArray(obj.suggestions)) {
        parsed = obj.suggestions;
      } else if (Array.isArray(obj.replies)) {
        parsed = obj.replies;
      } else {
        // Find first array value
        parsed = Object.values(obj).find(v => Array.isArray(v));
      }
    } catch {
      // Try extracting JSON array from raw text if there is any markdown or wrappers
      const arrayMatch = rawContent.match(/\[.*?\]/s);
      if (arrayMatch) {
        parsed = JSON.parse(arrayMatch[0]);
      }
    }

    if (Array.isArray(parsed) && parsed.length >= 3) {
      return parsed.slice(0, 3).map(s => String(s).trim()).filter(s => s.length > 0);
    }

    return FALLBACK_SUGGESTIONS;
  } catch (error) {
    console.error('❌ Gemini API error:', error.message);
    return FALLBACK_SUGGESTIONS;
  }
}

module.exports = { generateSmartReplies };
