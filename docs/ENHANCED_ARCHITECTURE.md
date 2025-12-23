# Enhanced Architecture Documentation

## Overview

This document describes the enhanced architecture implementation that transforms the base system into a stateful, cognitive WhatsApp assistant with semantic long-term memory, emotional tone adaptation, and persistent Redis + Postgres hybrid storage.

## Architecture Components

### 1. Handlers Layer (`src/handlers/`)

#### emotionHandler.js
Analyzes emotional tone of messages using OpenAI GPT-4o-mini.

**Features:**
- Classifies emotions: happy, frustrated, curious, angry, neutral, excited, sad, anxious, grateful
- Returns emotion intensity (0-1)
- Provides emotion-adaptive reply prefixes
- Graceful fallback to neutral for errors

**Usage:**
```javascript
const { analyzeEmotion, styleByEmotion } = require('./handlers/emotionHandler');

const result = await analyzeEmotion("isso é incrível!");
// { emotion: 'excited', intensity: 0.9 }

const prefix = styleByEmotion('excited', 0.9);
// "🎉 Adorei sua energia! Vamos nessa!"
```

#### memoryHandler.js
Manages hybrid memory system using Redis (fast cache) and Postgres (persistent storage).

**Features:**
- Redis cache with 24h TTL for fast access
- Postgres persistence for long-term storage
- Emotion history tracking
- Automatic fallback to JSON file if database unavailable
- Graceful connection management

**Database Schema:**
```sql
CREATE TABLE memory_logs (
  user_id VARCHAR(255) PRIMARY KEY,
  summary TEXT NOT NULL,
  emotion_history JSONB DEFAULT '[]',
  interaction_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Usage:**
```javascript
const { updateUserMemory, getUserContext } = require('./handlers/memoryHandler');

// Store memory
await updateUserMemory(userId, summary, { 
  emotion: 'happy', 
  intensity: 0.8 
});

// Retrieve context
const context = await getUserContext(userId);
```

#### messageHandler.js
Central message processing handler integrating emotion analysis and memory retrieval.

**Features:**
- Parallel emotion analysis and context retrieval
- Enriched context building
- Conversation memory updates
- Key topic extraction

**Usage:**
```javascript
const { processMessage, updateConversationMemory } = require('./handlers/messageHandler');

const result = await processMessage(chatId, message);
// {
//   emotion: { emotion: 'excited', intensity: 0.9 },
//   context: "Previous conversation context...",
//   emotionalPrefix: "🎉 Adorei sua energia! Vamos nessa!",
//   metadata: { ... }
// }

await updateConversationMemory(chatId, userMsg, botResponse, emotion);
```

### 2. Services Layer (`src/services/`)

#### openaiService.js
Centralized wrapper for OpenAI API interactions.

**Features:**
- Chat completions (GPT-4o-mini by default)
- Text embeddings (text-embedding-3-small)
- Configurable model options
- Lazy loading to avoid initialization errors

#### redisService.js
Centralized Redis client management.

**Features:**
- Connection pooling
- Automatic reconnection
- Key-value operations
- TTL support
- Pattern-based key search

#### pgService.js
Centralized PostgreSQL client management.

**Features:**
- Connection pooling (max 10 connections)
- Transaction support
- Schema management utilities
- Health checks
- Pool statistics

### 3. Utilities Layer (`src/utils/`)

#### delay.js
Smart delay implementation for humanized responses.

**Features:**
- Dynamic delay based on message length and emotion
- Typing simulation
- Recording delay calculation
- Progress callbacks

**Usage:**
```javascript
const { smartDelay } = require('./utils/delay');

// Delay based on text length and emotion intensity
await smartDelay(text, emotionIntensity);
```

**Algorithm:**
- Base delay: word count / 10 (reading speed)
- Emotional boost: intensity * 1.5 seconds
- Random variance: 0-0.5 seconds
- Final range: 1-5 seconds

#### regexExtractors.js
Utility functions for extracting structured data from text.

**Features:**
- Name extraction
- Business name extraction
- Location extraction (Brazilian states)
- Niche/industry detection
- Email and phone extraction
- Complete client data extraction

**Usage:**
```javascript
const { extractClientData } = require('./utils/regexExtractors');

const data = extractClientData("Meu nome é João, tenho uma pizzaria em SP");
// {
//   name: "João",
//   businessName: null,
//   niche: "Restaurante",
//   location: "SP",
//   email: null,
//   phone: null
// }
```

### 4. Persona Layer (`src/persona/`)

Contains persona definitions (copy of existing personas.js for modular structure).

## Infrastructure

### Docker Compose

Updated configuration with:
- PostgreSQL 16 (user: ai_bot, db: aibotdb)
- Redis 7 Alpine
- Redis Commander (UI at port 8081)
- Health checks for all services
- Optional containerized bot service

**Start services:**
```bash
docker-compose up -d
```

**View logs:**
```bash
docker-compose logs -f postgres
docker-compose logs -f redis
```

### PM2 Configuration

Production-ready process manager configuration (`ecosystem.config.js`):

**Features:**
- Auto-restart on crashes
- Memory limit (500MB)
- Log rotation
- Multiple environment support
- Graceful shutdown

**Commands:**
```bash
# Start
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# Logs
pm2 logs whatsapp-bot

# Restart
pm2 restart whatsapp-bot

# Stop
pm2 stop whatsapp-bot
```

### Dockerfile

Container image for the WhatsApp bot with:
- Node.js 20
- Chromium for Puppeteer
- Production dependencies only
- Health checks
- Timezone configuration

**Build:**
```bash
docker build -t whatsapp-bot .
```

## Environment Configuration

### Required Variables

```env
# OpenAI API (Required)
OPENAI_API_KEY=your_key

# Google Gemini API (Required)
GOOGLE_API_KEY=your_key

# Database URLs
REDIS_URL=redis://localhost:6379
POSTGRES_URL=postgresql://ai_bot:securepass@localhost:5432/aibotdb

# System
USE_NEW_ENGINE=true
NODE_ENV=production
```

See `.env.example` for complete configuration template.

## Integration with Existing System

The new architecture is **additive and backward-compatible**:

1. **Existing system** continues to work unchanged
2. **New handlers** can be imported and used optionally
3. **Services** provide alternative implementations
4. **No breaking changes** to existing code

### Integration Example

```javascript
// In commandDispatcher.js or conversationOrchestrator.js
const { processMessage } = require('./handlers/messageHandler');
const { smartDelay } = require('./utils/delay');

async function handleIncomingMessage(chatId, message) {
  // Process with new handlers
  const result = await processMessage(chatId, message);
  
  // Use emotional context
  if (result.emotionalPrefix) {
    // Add emotional prefix to response
  }
  
  // Use smart delay
  await smartDelay(response, result.emotion.intensity);
  
  // Send response...
}
```

## Memory System Flow

```
┌─────────────────────────────────────────────────┐
│           User sends message                     │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│    messageHandler.processMessage()               │
│    ├─ analyzeEmotion() (OpenAI)                 │
│    └─ getUserContext() (Redis → Postgres)       │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│    AI generates response                         │
│    (with emotion + memory context)               │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│    smartDelay() based on emotion                 │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│    Send response to user                         │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│    updateConversationMemory()                    │
│    └─ Store in Redis + Postgres                 │
└─────────────────────────────────────────────────┘
```

## Testing

Run existing tests to verify backward compatibility:

```bash
npm test
npm run test:humanization
npm run test:onboarding
```

Test database connections:
```bash
# Start services
docker-compose up -d

# Test in Node.js
node -e "
const { isAvailable } = require('./src/services/redisService');
isAvailable().then(ok => console.log('Redis:', ok));
"

node -e "
const { isAvailable } = require('./src/services/pgService');
isAvailable().then(ok => console.log('Postgres:', ok));
"
```

## Performance Considerations

### Redis Cache Strategy
- 24h TTL for user context
- Automatic refresh on Postgres hit
- Fallback to file system if unavailable

### Postgres Optimization
- Indexed queries on updated_at
- Connection pooling (max 10)
- JSONB for emotion history

### Emotion Analysis
- Cached per message (no redundant calls)
- Lightweight GPT-4o-mini model
- 100 token limit for fast responses

## Deployment

### Local Development
```bash
# Start databases
docker-compose up -d postgres redis

# Run bot
node index.js

# Or with PM2
pm2 start ecosystem.config.js --env development
```

### Production
```bash
# With PM2 (recommended)
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# Or with Docker
docker-compose up -d
```

## Monitoring

### PM2 Monitoring
```bash
pm2 monit           # Real-time monitor
pm2 list            # Process list
pm2 logs            # View logs
```

### Database Monitoring
```bash
# Redis Commander
open http://localhost:8081

# Postgres stats
docker-compose exec postgres psql -U ai_bot -d aibotdb -c "
  SELECT user_id, interaction_count, updated_at 
  FROM memory_logs 
  ORDER BY updated_at DESC 
  LIMIT 10;
"
```

## Troubleshooting

### Redis Connection Issues
```javascript
// Check Redis availability
const { isAvailable } = require('./src/services/redisService');
const ok = await isAvailable();
console.log('Redis available:', ok);
```

### Postgres Connection Issues
```javascript
// Check Postgres availability
const { isAvailable, getStats } = require('./src/services/pgService');
const ok = await isAvailable();
const stats = getStats();
console.log('Postgres available:', ok);
console.log('Pool stats:', stats);
```

### Emotion Detection Issues
- Verify OPENAI_API_KEY is set
- Check API quota/limits
- Review emotion handler logs

### Memory Fallback
If databases are unavailable, system automatically falls back to JSON file:
- Location: `data/memory_fallback.json`
- Automatic migration to database when available

## Future Enhancements

Potential improvements:
1. Vector embeddings for semantic memory search
2. Multi-user emotion analysis aggregation
3. Proactive engagement based on emotion patterns
4. Advanced memory consolidation strategies
5. Real-time analytics dashboard
6. A/B testing framework for responses

## Support

For issues or questions:
1. Check logs: `pm2 logs whatsapp-bot`
2. Check database status: `docker-compose ps`
3. Review this documentation
4. Check existing tests for examples
