/**
 * MEMORY HANDLER
 * 
 * Manages hybrid memory system using Redis (fast cache) and Postgres (persistent storage)
 * Each user has a rolling summary stored in both layers for optimal performance
 */

// Lazy load to avoid initialization errors
let Redis = null;
let Pool = null;

let redis = null;
let pool = null;

/**
 * Initialize Redis connection
 */
function getRedis() {
  if (!redis) {
    if (!Redis) {
      Redis = require('ioredis');
    }
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: false
    });

    redis.on('error', (err) => {
      console.error('[MemoryHandler] Redis error:', err.message);
    });

    redis.on('connect', () => {
      console.log('[MemoryHandler] Redis connected');
    });
  }
  return redis;
}

/**
 * Initialize Postgres connection pool
 */
function getPool() {
  if (!pool) {
    if (!Pool) {
      const pg = require('pg');
      Pool = pg.Pool;
    }
    const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || 
                        'postgresql://ai_bot:securepass@localhost:5432/aibotdb';
    pool = new Pool({ 
      connectionString: postgresUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      console.error('[MemoryHandler] Postgres error:', err.message);
    });

    pool.on('connect', () => {
      console.log('[MemoryHandler] Postgres pool connected');
    });
  }
  return pool;
}

/**
 * Initialize database schema if not exists
 */
async function initializeSchema() {
  try {
    const pgPool = getPool();
    
    // Create memory_logs table if not exists
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS memory_logs (
        user_id VARCHAR(255) PRIMARY KEY,
        summary TEXT NOT NULL,
        emotion_history JSONB DEFAULT '[]',
        interaction_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create index for faster lookups
    await pgPool.query(`
      CREATE INDEX IF NOT EXISTS idx_memory_logs_updated 
      ON memory_logs(updated_at DESC)
    `);

    console.log('[MemoryHandler] Database schema initialized');
  } catch (error) {
    console.error('[MemoryHandler] Schema initialization error:', error.message);
  }
}

/**
 * Update user memory in both Redis and Postgres
 * @param {string} userId - User/chat identifier
 * @param {string} summary - Memory summary text
 * @param {object} options - Additional options (emotion, metadata)
 */
async function updateUserMemory(userId, summary, options = {}) {
  if (!userId || !summary) {
    console.warn('[MemoryHandler] Invalid userId or summary');
    return false;
  }

  try {
    const redisClient = getRedis();
    const pgPool = getPool();

    // Store in Redis with 24h TTL (fast access)
    await redisClient.set(
      `memory:${userId}`, 
      summary, 
      'EX', 
      86400 // 24 hours
    );

    // Store emotion history if provided
    const emotionHistory = options.emotion ? [
      {
        emotion: options.emotion,
        intensity: options.intensity || 0.5,
        timestamp: new Date().toISOString()
      }
    ] : [];

    // Store in Postgres (persistent backup)
    await pgPool.query(`
      INSERT INTO memory_logs (user_id, summary, emotion_history, interaction_count, updated_at) 
      VALUES ($1, $2, $3, 1, NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        summary = EXCLUDED.summary,
        emotion_history = memory_logs.emotion_history || EXCLUDED.emotion_history,
        interaction_count = memory_logs.interaction_count + 1,
        updated_at = NOW()
    `, [userId, summary, JSON.stringify(emotionHistory)]);

    console.log(`[MemoryHandler] Updated memory for ${userId}`);
    return true;

  } catch (error) {
    console.error('[MemoryHandler] Update error:', error.message);
    // Try to save to file as fallback
    return await fallbackSaveToFile(userId, summary);
  }
}

/**
 * Get user context from memory (Redis first, then Postgres)
 * @param {string} userId - User/chat identifier
 * @returns {Promise<string>} - Memory summary
 */
async function getUserContext(userId) {
  if (!userId) {
    return '';
  }

  try {
    const redisClient = getRedis();
    
    // Try Redis first (fast)
    const cached = await redisClient.get(`memory:${userId}`);
    if (cached) {
      console.log(`[MemoryHandler] Cache hit for ${userId}`);
      return cached;
    }

    // Fallback to Postgres
    const pgPool = getPool();
    const result = await pgPool.query(
      'SELECT summary FROM memory_logs WHERE user_id = $1',
      [userId]
    );

    if (result.rows && result.rows.length > 0) {
      const summary = result.rows[0].summary;
      
      // Refresh Redis cache
      await redisClient.set(`memory:${userId}`, summary, 'EX', 86400);
      
      console.log(`[MemoryHandler] Loaded from Postgres for ${userId}`);
      return summary;
    }

    console.log(`[MemoryHandler] No memory found for ${userId}`);
    return '';

  } catch (error) {
    console.error('[MemoryHandler] Get context error:', error.message);
    // Try to load from file as fallback
    return await fallbackLoadFromFile(userId);
  }
}

/**
 * Get emotion history for a user
 * @param {string} userId - User/chat identifier
 * @param {number} limit - Number of recent emotions to retrieve
 * @returns {Promise<Array>} - Array of emotion entries
 */
async function getEmotionHistory(userId, limit = 10) {
  if (!userId) {
    return [];
  }

  try {
    const pgPool = getPool();
    const result = await pgPool.query(
      'SELECT emotion_history FROM memory_logs WHERE user_id = $1',
      [userId]
    );

    if (result.rows && result.rows.length > 0) {
      const history = result.rows[0].emotion_history || [];
      return Array.isArray(history) ? history.slice(-limit) : [];
    }

    return [];
  } catch (error) {
    console.error('[MemoryHandler] Emotion history error:', error.message);
    return [];
  }
}

/**
 * Fallback: Save to JSON file when DB is unavailable
 */
async function fallbackSaveToFile(userId, summary) {
  try {
    const fs = require('fs');
    const path = require('path');
    const memoryFile = path.join(__dirname, '../../data/memory_fallback.json');
    
    let data = {};
    if (fs.existsSync(memoryFile)) {
      data = JSON.parse(fs.readFileSync(memoryFile, 'utf8'));
    }
    
    data[userId] = {
      summary,
      updatedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(memoryFile, JSON.stringify(data, null, 2));
    console.log(`[MemoryHandler] Saved to fallback file for ${userId}`);
    return true;
  } catch (error) {
    console.error('[MemoryHandler] Fallback save error:', error.message);
    return false;
  }
}

/**
 * Fallback: Load from JSON file when DB is unavailable
 */
async function fallbackLoadFromFile(userId) {
  try {
    const fs = require('fs');
    const path = require('path');
    const memoryFile = path.join(__dirname, '../../data/memory_fallback.json');
    
    if (!fs.existsSync(memoryFile)) {
      return '';
    }
    
    const data = JSON.parse(fs.readFileSync(memoryFile, 'utf8'));
    return data[userId]?.summary || '';
  } catch (error) {
    console.error('[MemoryHandler] Fallback load error:', error.message);
    return '';
  }
}

/**
 * Close connections gracefully
 */
async function closeConnections() {
  try {
    if (redis) {
      await redis.quit();
      console.log('[MemoryHandler] Redis connection closed');
    }
    if (pool) {
      await pool.end();
      console.log('[MemoryHandler] Postgres pool closed');
    }
  } catch (error) {
    console.error('[MemoryHandler] Error closing connections:', error.message);
  }
}

// Initialize schema on module load
initializeSchema().catch(err => 
  console.error('[MemoryHandler] Failed to initialize schema:', err.message)
);

module.exports = {
  updateUserMemory,
  getUserContext,
  getEmotionHistory,
  initializeSchema,
  closeConnections
};
