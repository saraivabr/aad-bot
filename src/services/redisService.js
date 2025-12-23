/**
 * REDIS SERVICE
 * 
 * Centralized Redis client management and operations
 */

let Redis = null;
let client = null;

/**
 * Get or create Redis client
 * @returns {Redis} - Redis client instance
 */
function getClient() {
  if (!client) {
    if (!Redis) {
      Redis = require('ioredis');
    }
    
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: false
    });

    client.on('error', (err) => {
      console.error('[RedisService] Error:', err.message);
    });

    client.on('connect', () => {
      console.log('[RedisService] Connected successfully');
    });

    client.on('ready', () => {
      console.log('[RedisService] Ready to accept commands');
    });
  }
  
  return client;
}

/**
 * Set a key-value pair with optional TTL
 * @param {string} key - The key
 * @param {string} value - The value
 * @param {number} ttl - Time to live in seconds (optional)
 */
async function set(key, value, ttl = null) {
  try {
    const redis = getClient();
    if (ttl) {
      await redis.set(key, value, 'EX', ttl);
    } else {
      await redis.set(key, value);
    }
  } catch (error) {
    console.error('[RedisService] Set error:', error.message);
    throw error;
  }
}

/**
 * Get a value by key
 * @param {string} key - The key
 * @returns {Promise<string|null>} - The value or null
 */
async function get(key) {
  try {
    const redis = getClient();
    return await redis.get(key);
  } catch (error) {
    console.error('[RedisService] Get error:', error.message);
    return null;
  }
}

/**
 * Delete a key
 * @param {string} key - The key to delete
 */
async function del(key) {
  try {
    const redis = getClient();
    await redis.del(key);
  } catch (error) {
    console.error('[RedisService] Delete error:', error.message);
    throw error;
  }
}

/**
 * Check if key exists
 * @param {string} key - The key
 * @returns {Promise<boolean>} - True if exists
 */
async function exists(key) {
  try {
    const redis = getClient();
    const result = await redis.exists(key);
    return result === 1;
  } catch (error) {
    console.error('[RedisService] Exists error:', error.message);
    return false;
  }
}

/**
 * Set expiration on a key
 * @param {string} key - The key
 * @param {number} seconds - Expiration time in seconds
 */
async function expire(key, seconds) {
  try {
    const redis = getClient();
    await redis.expire(key, seconds);
  } catch (error) {
    console.error('[RedisService] Expire error:', error.message);
    throw error;
  }
}

/**
 * Get multiple keys by pattern
 * @param {string} pattern - The key pattern (e.g., 'user:*')
 * @returns {Promise<string[]>} - Array of matching keys
 */
async function keys(pattern) {
  try {
    const redis = getClient();
    return await redis.keys(pattern);
  } catch (error) {
    console.error('[RedisService] Keys error:', error.message);
    return [];
  }
}

/**
 * Close Redis connection
 */
async function close() {
  if (client) {
    await client.quit();
    client = null;
    console.log('[RedisService] Connection closed');
  }
}

/**
 * Check if Redis is available
 * @returns {Promise<boolean>} - True if Redis is connected
 */
async function isAvailable() {
  try {
    const redis = getClient();
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    return false;
  }
}

module.exports = {
  getClient,
  set,
  get,
  del,
  exists,
  expire,
  keys,
  close,
  isAvailable
};
