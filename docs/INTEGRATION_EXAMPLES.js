/**
 * INTEGRATION EXAMPLE
 * 
 * This file demonstrates how to integrate the new enhanced architecture
 * handlers and services with the existing command dispatcher and AI system.
 * 
 * You can use these patterns to enhance your existing message handling flow.
 */

// ============================================
// EXAMPLE 1: Enhanced Message Handler
// ============================================

/**
 * Enhanced version of handleMessage in commandDispatcher.js
 * Adds emotion analysis and memory retrieval
 */
async function enhancedHandleMessage(message) {
  const { processMessage, updateConversationMemory } = require('./src/handlers/messageHandler');
  const { smartDelay } = require('./src/utils/delay');
  const conversationOrchestrator = require('./src/ai/conversationOrchestrator');
  
  const chatId = message.from;
  const text = message.body ? message.body.trim() : "";
  
  if (!text) return;
  
  try {
    // 1. Process message with emotion and memory context
    console.log(`[Enhanced] Processing message from ${chatId}`);
    const messageContext = await processMessage(chatId, text);
    
    // 2. Log emotional state if significant
    if (messageContext.emotion.intensity > 0.6) {
      console.log(`[Enhanced] Strong emotion detected: ${messageContext.emotion.emotion} (${messageContext.emotion.intensity.toFixed(2)})`);
    }
    
    // 3. Generate response using existing orchestrator (with enriched context)
    message.body = text; // Ensure body is set
    const response = await conversationOrchestrator.processMessage(message, chatId);
    
    // 4. Add emotional prefix if appropriate
    let finalResponse = response.text;
    if (messageContext.emotionalPrefix && messageContext.emotion.intensity > 0.7) {
      finalResponse = messageContext.emotionalPrefix + ' ' + finalResponse;
    }
    
    // 5. Use smart delay based on emotion
    await smartDelay(finalResponse, messageContext.emotion.intensity);
    
    // 6. Execute response
    response.text = finalResponse;
    await conversationOrchestrator.executeResponse(message, response);
    
    // 7. Update conversation memory
    await updateConversationMemory(
      chatId, 
      text, 
      finalResponse, 
      messageContext.emotion
    );
    
    console.log(`[Enhanced] Response sent successfully`);
    
  } catch (error) {
    console.error('[Enhanced] Error:', error.message);
    await message.reply("Desculpe, tive um problema. Pode tentar novamente? 😅");
  }
}

// ============================================
// EXAMPLE 2: Enhanced AI Service
// ============================================

/**
 * Enhanced version of generateResponse in aiService.js
 * Integrates memory context and emotion awareness
 */
async function enhancedGenerateResponse(chatId, userMessage, persona, contactName = null) {
  const { getUserContext } = require('./src/handlers/memoryHandler');
  const { analyzeEmotion } = require('./src/handlers/emotionHandler');
  const { buildAIContext } = require('./src/handlers/messageHandler');
  const aiService = require('./src/ai/aiService');
  const clientService = require('./src/services/clientService');
  
  try {
    // 1. Get memory context and emotion in parallel
    const [memoryContext, emotion] = await Promise.all([
      getUserContext(chatId),
      analyzeEmotion(userMessage)
    ]);
    
    // 2. Build enhanced context
    const clientData = clientService.getClient(chatId);
    if (!clientData.name) {
      clientData._whatsappName = contactName;
    }
    
    const processResult = {
      emotion,
      context: memoryContext,
      emotionalPrefix: '',
      metadata: { hasContext: memoryContext.length > 0 }
    };
    
    const enhancedContext = buildAIContext(processResult, { clientData });
    
    // 3. Generate response with enhanced context
    const response = await aiService.generateResponse(
      chatId,
      userMessage,
      persona,
      contactName,
      enhancedContext // Pass as state instructions
    );
    
    return {
      text: response,
      emotion,
      memoryContext
    };
    
  } catch (error) {
    console.error('[Enhanced AI] Error:', error.message);
    throw error;
  }
}

// ============================================
// EXAMPLE 3: Data Extraction Integration
// ============================================

/**
 * Enhanced client data extraction using regex extractors
 * Can be integrated into existing save mechanisms
 */
async function enhancedDataExtraction(chatId, message) {
  const { extractClientData } = require('./src/utils/regexExtractors');
  const clientService = require('./src/services/clientService');
  
  // Extract all possible data
  const extracted = extractClientData(message);
  
  // Filter out null values
  const validData = {};
  for (const [key, value] of Object.entries(extracted)) {
    if (value !== null) {
      validData[key] = value;
    }
  }
  
  // Update if we found anything
  if (Object.keys(validData).length > 0) {
    console.log(`[DataExtraction] Found data for ${chatId}:`, validData);
    clientService.updateClient(chatId, validData);
    return validData;
  }
  
  return null;
}

// ============================================
// EXAMPLE 4: Response Timing Enhancement
// ============================================

/**
 * Enhanced response delivery with smart delays
 * Can replace existing delay calculations
 */
async function enhancedSendResponse(message, responseText, emotion = null) {
  const { smartDelay, typingDelay } = require('./src/utils/delay');
  const chat = await message.getChat();
  
  // Split response into chunks if needed
  const chunks = responseText.split('<SPLIT>').map(c => c.trim()).filter(c => c.length > 0);
  
  for (const [index, chunk] of chunks.entries()) {
    // Show typing indicator
    await chat.sendStateTyping();
    
    // Use smart delay if emotion is available, otherwise typing delay
    if (emotion && emotion.intensity) {
      await smartDelay(chunk, emotion.intensity);
    } else {
      const delay = typingDelay(chunk);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Send message
    if (index === 0) {
      await message.reply(chunk);
    } else {
      await chat.sendMessage(chunk);
    }
    
    // Small pause between chunks
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

// ============================================
// EXAMPLE 5: Memory-Aware Conversation Start
// ============================================

/**
 * Start conversation with memory context awareness
 */
async function startConversationWithMemory(chatId, contactName) {
  const { getUserContext } = require('./src/handlers/memoryHandler');
  const { getEmotionHistory } = require('./src/handlers/memoryHandler');
  
  // Get user's history
  const context = await getUserContext(chatId);
  const emotionHistory = await getEmotionHistory(chatId, 5);
  
  // Build greeting based on context
  let greeting = `Olá, ${contactName}!`;
  
  if (context) {
    // User has history - acknowledge it
    if (emotionHistory.length > 0) {
      const lastEmotion = emotionHistory[emotionHistory.length - 1];
      
      if (lastEmotion.emotion === 'frustrated' || lastEmotion.emotion === 'angry') {
        greeting += ' Espero que esteja se sentindo melhor hoje!';
      } else if (lastEmotion.emotion === 'happy' || lastEmotion.emotion === 'excited') {
        greeting += ' Bom te ver de novo!';
      }
    }
    
    greeting += ' Como posso ajudar hoje?';
  } else {
    // New user
    greeting += ' É um prazer te conhecer! Como posso ajudar?';
  }
  
  return greeting;
}

// ============================================
// EXAMPLE 6: Complete Integration Pattern
// ============================================

/**
 * Complete integration example showing full flow
 */
async function completeIntegrationExample(message) {
  const chatId = message.from;
  const text = message.body.trim();
  
  // Import all needed modules
  const { processMessage, updateConversationMemory } = require('./src/handlers/messageHandler');
  const { smartDelay } = require('./src/utils/delay');
  const { extractClientData } = require('./src/utils/regexExtractors');
  const clientService = require('./src/services/clientService');
  const aiService = require('./src/ai/aiService');
  const { PERSONAS } = require('./src/personas');
  
  try {
    // 1. Process with enhanced handlers
    const messageContext = await processMessage(chatId, text);
    
    // 2. Extract and save client data automatically
    const extracted = extractClientData(text);
    if (extracted && Object.values(extracted).some(v => v !== null)) {
      clientService.updateClient(chatId, extracted);
    }
    
    // 3. Get contact name
    let contactName = null;
    try {
      const contact = await message.getContact();
      contactName = contact?.pushname || contact?.name || null;
    } catch (e) {}
    
    // 4. Generate response with context
    const clientData = clientService.getClient(chatId);
    const persona = PERSONAS.SOCIAL_MEDIA; // or determine dynamically
    
    const response = await aiService.generateResponse(
      chatId,
      text,
      persona,
      contactName,
      messageContext.context // Pass memory context
    );
    
    // 5. Add emotional context if strong
    let finalResponse = response;
    if (messageContext.emotionalPrefix && messageContext.emotion.intensity > 0.7) {
      finalResponse = messageContext.emotionalPrefix + '\n\n' + response;
    }
    
    // 6. Send with smart timing
    await enhancedSendResponse(message, finalResponse, messageContext.emotion);
    
    // 7. Update memory
    await updateConversationMemory(
      chatId,
      text,
      finalResponse,
      messageContext.emotion
    );
    
    console.log(`[Integration] Successfully processed message with enhanced features`);
    
  } catch (error) {
    console.error('[Integration] Error:', error.message);
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  enhancedHandleMessage,
  enhancedGenerateResponse,
  enhancedDataExtraction,
  enhancedSendResponse,
  startConversationWithMemory,
  completeIntegrationExample
};

// ============================================
// USAGE NOTES
// ============================================

/*
To integrate into your existing system:

1. In commandDispatcher.js:
   - Import: const { enhancedHandleMessage } = require('./integration_example');
   - Replace or enhance existing handleMessage logic

2. In aiService.js:
   - Import memory and emotion handlers
   - Add context retrieval before LLM call
   - Pass enhanced context to prompt

3. In conversationOrchestrator.js:
   - Add emotion analysis step
   - Use smart delays for response timing
   - Update memory after successful responses

4. Environment Setup:
   - Start databases: docker-compose up -d postgres redis
   - Set POSTGRES_URL and REDIS_URL in .env
   - Services will fallback to JSON if databases unavailable

5. Gradual Migration:
   - Start with emotion analysis only
   - Add memory retrieval
   - Enhance delays
   - Full integration last

6. Monitoring:
   - Use PM2: pm2 start ecosystem.config.js
   - Check logs: pm2 logs whatsapp-bot
   - Monitor Redis: http://localhost:8081

Remember: All new features are optional and backward-compatible!
*/
