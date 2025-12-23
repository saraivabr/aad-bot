/**
 * MESSAGE HANDLER
 * 
 * Central message processing handler that integrates:
 * - Emotion analysis
 * - Memory retrieval and storage
 * - Context building for AI responses
 */

const { analyzeEmotion, styleByEmotion } = require('./emotionHandler');
const { getUserContext, updateUserMemory } = require('./memoryHandler');

/**
 * Process incoming message with emotion and memory context
 * @param {string} chatId - Chat identifier
 * @param {string} message - Message text
 * @param {object} options - Additional options
 * @returns {Promise<object>} - Processing result with emotion and context
 */
async function processMessage(chatId, message, options = {}) {
  try {
    // 1. Analyze emotion (async)
    const emotionPromise = analyzeEmotion(message);
    
    // 2. Get memory context (async)
    const contextPromise = getUserContext(chatId);
    
    // Wait for both
    const [emotion, context] = await Promise.all([emotionPromise, contextPromise]);
    
    // 3. Build enriched context
    const emotionalPrefix = styleByEmotion(emotion.emotion, emotion.intensity);
    
    return {
      emotion,
      context,
      emotionalPrefix,
      metadata: {
        hasContext: context.length > 0,
        emotionDetected: emotion.emotion !== 'neutral',
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('[MessageHandler] Process error:', error.message);
    return {
      emotion: { emotion: 'neutral', intensity: 0.5 },
      context: '',
      emotionalPrefix: '',
      metadata: {
        hasContext: false,
        emotionDetected: false,
        error: error.message
      }
    };
  }
}

/**
 * Update conversation memory after response
 * @param {string} chatId - Chat identifier
 * @param {string} userMessage - User's message
 * @param {string} botResponse - Bot's response
 * @param {object} emotion - Detected emotion
 */
async function updateConversationMemory(chatId, userMessage, botResponse, emotion) {
  try {
    // Build summary from conversation
    const summary = `Last interaction: User said "${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}", bot responded about ${extractKeyTopics(botResponse)}. User emotion: ${emotion.emotion}.`;
    
    await updateUserMemory(chatId, summary, {
      emotion: emotion.emotion,
      intensity: emotion.intensity
    });
    
    console.log(`[MessageHandler] Memory updated for ${chatId}`);
  } catch (error) {
    console.error('[MessageHandler] Memory update error:', error.message);
  }
}

/**
 * Extract key topics from response for memory summary
 * @param {string} text - Response text
 * @returns {string} - Key topics
 */
function extractKeyTopics(text) {
  // Simple extraction - first 50 chars cleaned
  const cleaned = text
    .replace(/<SPLIT>/g, ' ')
    .replace(/\|\|[A-Z_]+\|\|/g, '')
    .replace(/<REACT:.*?>/g, '')
    .trim();
  
  return cleaned.substring(0, 50) + (cleaned.length > 50 ? '...' : '');
}

/**
 * Build full context for AI prompt
 * @param {object} processResult - Result from processMessage
 * @param {object} additionalContext - Any additional context data
 * @returns {string} - Formatted context for AI
 */
function buildAIContext(processResult, additionalContext = {}) {
  let context = '';
  
  // Add memory context if available
  if (processResult.context) {
    context += `\n## MEMORY CONTEXT\n${processResult.context}\n`;
  }
  
  // Add emotional context if significant
  if (processResult.emotion.intensity > 0.6) {
    context += `\n## EMOTIONAL STATE\nUser is showing ${processResult.emotion.emotion} emotion (intensity: ${processResult.emotion.intensity.toFixed(2)}).\n`;
    context += `${getEmotionalGuidance(processResult.emotion.emotion)}\n`;
  }
  
  // Add any additional context
  if (additionalContext.clientData) {
    context += `\n## CLIENT DATA\n${JSON.stringify(additionalContext.clientData, null, 2)}\n`;
  }
  
  return context;
}

/**
 * Get guidance for responding to specific emotions
 * @param {string} emotion - The detected emotion
 * @returns {string} - Response guidance
 */
function getEmotionalGuidance(emotion) {
  const guidance = {
    frustrated: 'Be empathetic, acknowledge their frustration, and offer clear solutions.',
    angry: 'Stay calm and professional, validate their feelings, focus on resolution.',
    excited: 'Match their energy, be enthusiastic, capitalize on their positive mood.',
    sad: 'Be supportive and understanding, offer help and comfort.',
    anxious: 'Be reassuring, provide clear information, reduce uncertainty.',
    grateful: 'Acknowledge their gratitude warmly, reinforce positive relationship.',
    curious: 'Be informative and engaging, encourage their curiosity.',
    happy: 'Share their positive energy, build on the good mood.',
  };
  
  return guidance[emotion] || 'Respond naturally and appropriately.';
}

module.exports = {
  processMessage,
  updateConversationMemory,
  buildAIContext,
  extractKeyTopics
};
