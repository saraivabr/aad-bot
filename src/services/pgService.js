/**
 * POSTGRES SERVICE
 * 
 * Centralized PostgreSQL client management and operations
 */

let Pool = null;
let pool = null;

/**
 * Get or create Postgres connection pool
 * @returns {Pool} - Postgres pool instance
 */
function getPool() {
  if (!pool) {
    if (!Pool) {
      const pg = require('pg');
      Pool = pg.Pool;
    }
    
    const postgresUrl = process.env.POSTGRES_URL || 
                        process.env.DATABASE_URL || 
                        'postgresql://ai_bot:securepass@localhost:5432/aibotdb';
    
    pool = new Pool({
      connectionString: postgresUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      console.error('[PgService] Pool error:', err.message);
    });

    pool.on('connect', () => {
      console.log('[PgService] New client connected to pool');
    });
  }
  
  return pool;
}

/**
 * Execute a query
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<object>} - Query result
 */
async function query(text, params = []) {
  try {
    const pgPool = getPool();
    const result = await pgPool.query(text, params);
    return result;
  } catch (error) {
    console.error('[PgService] Query error:', error.message);
    throw error;
  }
}

/**
 * Execute a transaction
 * @param {Function} callback - Transaction callback receiving client
 * @returns {Promise<any>} - Transaction result
 */
async function transaction(callback) {
  const pgPool = getPool();
  const client = await pgPool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[PgService] Transaction error:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check if table exists
 * @param {string} tableName - Name of the table
 * @returns {Promise<boolean>} - True if table exists
 */
async function tableExists(tableName) {
  try {
    const result = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = $1
      )`,
      [tableName]
    );
    return result.rows[0].exists;
  } catch (error) {
    console.error('[PgService] Table exists check error:', error.message);
    return false;
  }
}

/**
 * Create table if not exists
 * @param {string} createSQL - CREATE TABLE SQL statement
 */
async function createTableIfNotExists(createSQL) {
  try {
    await query(createSQL);
    console.log('[PgService] Table creation executed');
  } catch (error) {
    console.error('[PgService] Create table error:', error.message);
    throw error;
  }
}

/**
 * Close pool connections
 */
async function close() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[PgService] Pool closed');
  }
}

/**
 * Check if Postgres is available
 * @returns {Promise<boolean>} - True if connected
 */
async function isAvailable() {
  try {
    const result = await query('SELECT 1');
    return result.rows.length === 1;
  } catch (error) {
    return false;
  }
}

/**
 * Get pool statistics
 * @returns {object} - Pool stats
 */
function getStats() {
  if (!pool) {
    return { error: 'Pool not initialized' };
  }
  
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };
}

module.exports = {
  getPool,
  query,
  transaction,
  tableExists,
  createTableIfNotExists,
  close,
  isAvailable,
  getStats
};
