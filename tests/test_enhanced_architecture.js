/**
 * TEST: Enhanced Architecture Integration
 * 
 * This test demonstrates how to use the new handlers and services
 * in integration with the existing system.
 * 
 * Prerequisites:
 * 1. Start services: docker-compose up -d postgres redis
 * 2. Set OPENAI_API_KEY in .env
 * 3. Run: node tests/test_enhanced_architecture.js
 */

console.log('🧪 Testing Enhanced Architecture Integration\n');

// Import new handlers
const { processMessage, updateConversationMemory, buildAIContext } = require('../src/handlers/messageHandler');
const { analyzeEmotion, styleByEmotion } = require('../src/handlers/emotionHandler');
const { updateUserMemory, getUserContext, initializeSchema } = require('../src/handlers/memoryHandler');
const { smartDelay } = require('../src/utils/delay');
const { extractClientData } = require('../src/utils/regexExtractors');

// Import services for health checks
const redisService = require('../src/services/redisService');
const pgService = require('../src/services/pgService');

// Test data
const testChatId = 'test_user_123';
const testMessages = [
  "Olá! Meu nome é João e tenho uma pizzaria em São Paulo",
  "Estou muito frustrado com as vendas este mês",
  "Preciso de ajuda para melhorar minhas redes sociais!",
  "Obrigado pela ajuda, você é incrível!"
];

/**
 * Run comprehensive tests
 */
async function runTests() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('1️⃣  TESTING SERVICE AVAILABILITY');
    console.log('═══════════════════════════════════════════════════════\n');

    // Test Redis
    console.log('📡 Testing Redis connection...');
    const redisAvailable = await redisService.isAvailable();
    console.log(`   ${redisAvailable ? '✅' : '❌'} Redis: ${redisAvailable ? 'Connected' : 'Not available'}\n`);

    // Test Postgres
    console.log('📡 Testing Postgres connection...');
    const pgAvailable = await pgService.isAvailable();
    console.log(`   ${pgAvailable ? '✅' : '❌'} Postgres: ${pgAvailable ? 'Connected' : 'Not available'}\n`);

    if (pgAvailable) {
      console.log('📊 Postgres pool stats:', pgService.getStats(), '\n');
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('2️⃣  TESTING EMOTION ANALYSIS');
    console.log('═══════════════════════════════════════════════════════\n');

    for (const message of testMessages) {
      console.log(`💬 Message: "${message}"`);
      
      try {
        const emotion = await analyzeEmotion(message);
        console.log(`   Emotion: ${emotion.emotion} (intensity: ${emotion.intensity.toFixed(2)})`);
        
        const prefix = styleByEmotion(emotion.emotion, emotion.intensity);
        if (prefix) {
          console.log(`   Prefix: ${prefix}`);
        }
        console.log('');
      } catch (error) {
        console.log(`   ⚠️  Error: ${error.message}\n`);
      }
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('3️⃣  TESTING DATA EXTRACTION');
    console.log('═══════════════════════════════════════════════════════\n');

    const extractionTest = "Meu nome é Maria Silva, tenho uma clínica odontológica chamada SmileCare em Belo Horizonte, MG. Meu email é maria@smilecare.com.br";
    console.log(`📝 Test text: "${extractionTest}"\n`);
    
    const extracted = extractClientData(extractionTest);
    console.log('📊 Extracted data:');
    console.log(JSON.stringify(extracted, null, 2));
    console.log('');

    console.log('═══════════════════════════════════════════════════════');
    console.log('4️⃣  TESTING MEMORY SYSTEM');
    console.log('═══════════════════════════════════════════════════════\n');

    if (redisAvailable || pgAvailable) {
      console.log('💾 Storing test memory...');
      const memorySummary = "User João from São Paulo, owns a pizzaria. Currently frustrated with sales.";
      
      await updateUserMemory(testChatId, memorySummary, {
        emotion: 'frustrated',
        intensity: 0.7
      });
      console.log('   ✅ Memory stored\n');

      console.log('🔍 Retrieving memory...');
      const context = await getUserContext(testChatId);
      console.log(`   Retrieved: "${context}"\n`);
    } else {
      console.log('⚠️  Skipping memory tests (databases not available)');
      console.log('   Note: Memory will fallback to JSON file\n');
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('5️⃣  TESTING MESSAGE PROCESSING');
    console.log('═══════════════════════════════════════════════════════\n');

    const testMessage = "Estou muito empolgado para começar!";
    console.log(`💬 Processing: "${testMessage}"\n`);

    try {
      const result = await processMessage(testChatId, testMessage);
      
      console.log('📊 Processing result:');
      console.log(`   Emotion: ${result.emotion.emotion} (${result.emotion.intensity.toFixed(2)})`);
      console.log(`   Has context: ${result.metadata.hasContext}`);
      console.log(`   Emotional prefix: ${result.emotionalPrefix || '(none)'}`);
      console.log('');
    } catch (error) {
      console.log(`   ⚠️  Error: ${error.message}\n`);
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('6️⃣  TESTING SMART DELAY');
    console.log('═══════════════════════════════════════════════════════\n');

    const delayTests = [
      { text: "Ok", emotion: 0.3 },
      { text: "Vamos discutir sua estratégia de marketing digital", emotion: 0.5 },
      { text: "Eu estou absolutamente furioso com essa situação!", emotion: 0.9 }
    ];

    for (const test of delayTests) {
      console.log(`⏱️  Text: "${test.text}"`);
      console.log(`   Emotion intensity: ${test.emotion.toFixed(2)}`);
      
      const start = Date.now();
      await smartDelay(test.text, test.emotion);
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      
      console.log(`   ✅ Delayed for ${elapsed}s\n`);
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('7️⃣  TESTING INTEGRATION WITH AI CONTEXT');
    console.log('═══════════════════════════════════════════════════════\n');

    try {
      const processResult = await processMessage(testChatId, "Como posso vender mais?");
      const aiContext = buildAIContext(processResult, {
        clientData: extracted
      });

      console.log('🤖 AI Context generated:');
      console.log(aiContext);
      console.log('');
    } catch (error) {
      console.log(`   ⚠️  Error: ${error.message}\n`);
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ ALL TESTS COMPLETED');
    console.log('═══════════════════════════════════════════════════════\n');

    // Cleanup
    console.log('🧹 Cleaning up...');
    await redisService.close();
    await pgService.close();
    console.log('   ✅ Connections closed\n');

    console.log('💡 Next steps:');
    console.log('   1. Review the ENHANCED_ARCHITECTURE.md documentation');
    console.log('   2. Integrate handlers into commandDispatcher.js or conversationOrchestrator.js');
    console.log('   3. Start using emotion-aware and memory-enhanced responses');
    console.log('   4. Monitor with PM2: pm2 start ecosystem.config.js\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  }
}

// Run tests
console.log('Starting tests...\n');
runTests();
