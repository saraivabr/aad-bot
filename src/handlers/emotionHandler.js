/**
 * EMOTION HANDLER
 * 
 * Analyzes emotional tone of messages using OpenAI GPT-4o-mini
 * Returns emotion classification and intensity for adaptive responses
 */

// Lazy load to avoid initialization errors
let ChatOpenAI = null;

/**
 * Analyze emotional tone of text
 * @param {string} text - The text to analyze
 * @returns {Promise<{emotion: string, intensity: number}>}
 */
async function analyzeEmotion(text) {
  // Return neutral for empty or very short text
  if (!text || text.trim().length < 3) {
    return { emotion: 'neutral', intensity: 0.3 };
  }

  try {
    // Only load if we have an API key
    if (!process.env.OPENAI_API_KEY) {
      console.warn('[EmotionHandler] No OPENAI_API_KEY - returning neutral');
      return { emotion: 'neutral', intensity: 0.5 };
    }

    // Lazy load OpenAI
    if (!ChatOpenAI) {
      const { ChatOpenAI: OpenAIChat } = require("@langchain/openai");
      ChatOpenAI = OpenAIChat;
    }

    const model = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.3,
      maxTokens: 100,
    });

    const prompt = `Classify the user's emotional tone as one of:
[happy, frustrated, curious, angry, neutral, excited, sad, anxious, grateful].

User message: "${text}"

Return ONLY a valid JSON object (no markdown, no extra text):
{"emotion": "<tone>", "intensity": <0.0-1.0>}

Examples:
- "isso é incrível!" → {"emotion": "excited", "intensity": 0.9}
- "não entendi nada" → {"emotion": "confused", "intensity": 0.6}
- "obrigado pela ajuda" → {"emotion": "grateful", "intensity": 0.7}
- "que raiva disso" → {"emotion": "angry", "intensity": 0.8}`;

    const response = await model.invoke(prompt);
    const content = response.content.trim();
    
    // Remove markdown code blocks if present
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const result = JSON.parse(cleanContent);
    
    // Validate result
    const validEmotions = ['happy', 'frustrated', 'curious', 'angry', 'neutral', 'excited', 'sad', 'anxious', 'grateful'];
    if (!validEmotions.includes(result.emotion)) {
      console.warn(`[EmotionHandler] Invalid emotion: ${result.emotion}, defaulting to neutral`);
      return { emotion: 'neutral', intensity: 0.5 };
    }
    
    // Clamp intensity between 0 and 1
    const intensity = Math.max(0, Math.min(1, parseFloat(result.intensity) || 0.5));
    
    console.log(`[EmotionHandler] Detected: ${result.emotion} (${intensity.toFixed(2)})`);
    return { emotion: result.emotion, intensity };

  } catch (error) {
    console.error('[EmotionHandler] Error analyzing emotion:', error.message);
    return { emotion: 'neutral', intensity: 0.5 };
  }
}

/**
 * Get emotion-adaptive reply prefix
 * @param {string} emotion - The detected emotion
 * @param {number} intensity - The emotion intensity (0-1)
 * @returns {string} - A contextual reply prefix
 */
function styleByEmotion(emotion, intensity = 0.5) {
  // Only add emotional context if intensity is high enough
  if (intensity < 0.6) {
    return '';
  }

  const tones = {
    happy: "😊 Que bom ver você animado!",
    frustrated: "😔 Percebo que você está frustrado — vamos resolver isso?",
    curious: "🤔 Ótima pergunta!",
    angry: "😤 Entendo sua frustração. Vamos tentar resolver isso com calma.",
    excited: "🎉 Adorei sua energia! Vamos nessa!",
    sad: "😞 Sinto que algo não está bem. Como posso ajudar?",
    anxious: "🫂 Calma, vamos resolver isso juntos.",
    grateful: "🙏 Fico feliz em poder ajudar!",
  };
  
  return tones[emotion] || "";
}

module.exports = {
  analyzeEmotion,
  styleByEmotion
};
