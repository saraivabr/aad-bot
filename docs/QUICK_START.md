# Quick Start Guide - Enhanced Architecture

This guide helps you quickly get started with the enhanced architecture features.

## Prerequisites

1. **Node.js 20+** installed
2. **Docker** (optional, for databases)
3. **OpenAI API Key** (required for emotion analysis)
4. **Google API Key** (optional, for Gemini)

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

This installs:
- `ioredis` - Redis client
- `pg` - PostgreSQL client
- `pm2` - Process manager
- All existing dependencies

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
OPENAI_API_KEY=your_openai_key_here
GOOGLE_API_KEY=your_google_key_here
```

### 3. Start Database Services (Optional)

If you want to use Redis and Postgres:

```bash
# Start services
npm run docker:up

# Check status
docker-compose ps

# View logs
npm run docker:logs
```

**Note:** If you skip this step, the system will automatically fallback to JSON file storage.

### 4. Initialize Database Schema

The schema is automatically initialized when the memory handler is first loaded. If services are running, tables will be created automatically.

You can verify with:

```bash
docker-compose exec postgres psql -U ai_bot -d aibotdb -c "\dt"
```

### 5. Run Tests

Test the enhanced architecture:

```bash
npm run test:enhanced
```

This will test:
- ✅ Database connections
- ✅ Emotion analysis
- ✅ Data extraction
- ✅ Memory storage/retrieval
- ✅ Message processing
- ✅ Smart delays
- ✅ AI context building

### 6. Start the Bot

**Option A: Direct Node.js**
```bash
npm start
```

**Option B: With PM2 (Recommended for Production)**
```bash
npm run start:pm2

# Monitor
pm2 monit

# View logs
npm run logs:pm2

# Restart
npm run restart:pm2

# Stop
npm run stop:pm2
```

## Usage Examples

### Using Emotion Analysis

```javascript
const { analyzeEmotion } = require('./src/handlers/emotionHandler');

const emotion = await analyzeEmotion("Estou muito feliz hoje!");
console.log(emotion);
// { emotion: 'happy', intensity: 0.85 }
```

### Using Memory System

```javascript
const { updateUserMemory, getUserContext } = require('./src/handlers/memoryHandler');

// Store
await updateUserMemory(userId, "User prefers formal communication", {
  emotion: 'neutral',
  intensity: 0.5
});

// Retrieve
const context = await getUserContext(userId);
```

### Using Data Extraction

```javascript
const { extractClientData } = require('./src/utils/regexExtractors');

const data = extractClientData("Meu nome é João, tenho uma pizzaria em SP");
// {
//   name: "João",
//   businessName: null,
//   niche: "Restaurante",
//   location: "SP",
//   ...
// }
```

### Using Smart Delay

```javascript
const { smartDelay } = require('./src/utils/delay');

// Delay based on message length and emotion
await smartDelay(responseText, emotionIntensity);
```

## Integration with Existing System

See `docs/INTEGRATION_EXAMPLES.js` for detailed integration patterns.

### Quick Integration

Add to your message handler:

```javascript
const { processMessage, updateConversationMemory } = require('./src/handlers/messageHandler');
const { smartDelay } = require('./src/utils/delay');

async function handleMessage(message) {
  const chatId = message.from;
  const text = message.body.trim();
  
  // Process with emotion and memory
  const context = await processMessage(chatId, text);
  
  // Generate response (your existing logic)
  const response = await generateResponse(chatId, text);
  
  // Use smart delay
  await smartDelay(response, context.emotion.intensity);
  
  // Send response
  await message.reply(response);
  
  // Update memory
  await updateConversationMemory(chatId, text, response, context.emotion);
}
```

## Monitoring

### Database Monitoring

**Redis Commander UI:**
```
http://localhost:8081
```

**Check Postgres Data:**
```bash
docker-compose exec postgres psql -U ai_bot -d aibotdb -c "
  SELECT user_id, interaction_count, updated_at 
  FROM memory_logs 
  ORDER BY updated_at DESC 
  LIMIT 10;
"
```

### Application Monitoring

**With PM2:**
```bash
pm2 monit              # Real-time monitoring
pm2 list               # Process list
pm2 logs whatsapp-bot  # View logs
```

**Log Files (PM2):**
- `logs/error.log` - Error logs
- `logs/out.log` - Output logs
- `logs/combined.log` - All logs

## Troubleshooting

### Databases Not Connecting

**Check if services are running:**
```bash
docker-compose ps
```

**Restart services:**
```bash
npm run docker:down
npm run docker:up
```

**Check logs:**
```bash
npm run docker:logs
```

**Fallback:** Don't worry! The system automatically falls back to JSON file storage if databases are unavailable.

### Emotion Analysis Not Working

1. Verify `OPENAI_API_KEY` is set in `.env`
2. Check your OpenAI API quota/limits
3. Review logs for error messages
4. System falls back to 'neutral' emotion on errors

### PM2 Issues

**Clear PM2 processes:**
```bash
pm2 delete all
pm2 start ecosystem.config.js
```

**Reinstall PM2:**
```bash
npm install -g pm2
```

### Port Conflicts

If ports 5432 (Postgres), 6379 (Redis), or 8081 (Redis Commander) are in use:

Edit `docker-compose.yml` and change port mappings:
```yaml
ports:
  - "5433:5432"  # Change 5432 to 5433
```

Update `.env`:
```env
POSTGRES_URL=postgresql://ai_bot:securepass@localhost:5433/aibotdb
```

## Next Steps

1. **Read Full Documentation**
   - `docs/ENHANCED_ARCHITECTURE.md` - Complete architecture guide
   - `docs/INTEGRATION_EXAMPLES.js` - Integration patterns

2. **Review Code**
   - `src/handlers/` - New handlers
   - `src/services/` - Service wrappers
   - `src/utils/` - Utility functions

3. **Test Integration**
   - Run `npm run test:enhanced`
   - Try integration examples
   - Monitor with PM2

4. **Deploy to Production**
   - Use PM2 for process management
   - Set up monitoring
   - Configure automatic backups for Postgres

## Support

For issues or questions:
1. Check logs: `pm2 logs whatsapp-bot` or `npm run docker:logs`
2. Review documentation in `docs/`
3. Check test results: `npm run test:enhanced`
4. Verify environment variables in `.env`

## Summary of New Features

✅ **Emotion Analysis** - Detects 9 different emotions with intensity
✅ **Hybrid Memory** - Redis cache + Postgres persistence
✅ **Smart Delays** - Context-aware response timing
✅ **Data Extraction** - Automatic client data parsing
✅ **PM2 Support** - Production-ready process management
✅ **Docker Ready** - Containerized deployment
✅ **Backward Compatible** - Works with existing system

Enjoy your enhanced WhatsApp AI bot! 🚀
