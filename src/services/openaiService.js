/**
 * OPENAI SERVICE
 * 
 * Centralized wrapper for OpenAI API interactions
 * Provides unified interface for chat completions, embeddings, and other OpenAI features
 */

// Lazy load to avoid initialization errors
let ChatOpenAI = null;
let OpenAIEmbeddings = null;

/**
 * Get or create ChatOpenAI instance
 * @param {object} options - Model options
 * @returns {ChatOpenAI} - OpenAI chat instance
 */
function getChatModel(options = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not found in environment');
  }

  if (!ChatOpenAI) {
    const { ChatOpenAI: OpenAIChat } = require("@langchain/openai");
    ChatOpenAI = OpenAIChat;
  }

  return new ChatOpenAI({
    modelName: options.modelName || "gpt-4o-mini",
    temperature: options.temperature !== undefined ? options.temperature : 0.7,
    maxTokens: options.maxTokens || 2048,
    ...options
  });
}

/**
 * Get or create OpenAI Embeddings instance
 * @returns {OpenAIEmbeddings} - OpenAI embeddings instance
 */
function getEmbeddings() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not found in environment');
  }

  if (!OpenAIEmbeddings) {
    const { OpenAIEmbeddings: Embeddings } = require("@langchain/openai");
    OpenAIEmbeddings = Embeddings;
  }

  return new OpenAIEmbeddings({
    modelName: "text-embedding-3-small"
  });
}

/**
 * Generate a chat completion
 * @param {string} prompt - The prompt text
 * @param {object} options - Generation options
 * @returns {Promise<string>} - Generated text
 */
async function generateCompletion(prompt, options = {}) {
  try {
    const model = getChatModel(options);
    const response = await model.invoke(prompt);
    return response.content;
  } catch (error) {
    console.error('[OpenAIService] Completion error:', error.message);
    throw error;
  }
}

/**
 * Generate embeddings for text
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - Embedding vector
 */
async function generateEmbedding(text) {
  try {
    const embeddings = getEmbeddings();
    const vector = await embeddings.embedQuery(text);
    return vector;
  } catch (error) {
    console.error('[OpenAIService] Embedding error:', error.message);
    throw error;
  }
}

/**
 * Generate embeddings for multiple documents
 * @param {string[]} texts - Array of texts to embed
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
async function generateEmbeddings(texts) {
  try {
    const embeddings = getEmbeddings();
    const vectors = await embeddings.embedDocuments(texts);
    return vectors;
  } catch (error) {
    console.error('[OpenAIService] Embeddings error:', error.message);
    throw error;
  }
}

/**
 * Check if OpenAI is available
 * @returns {boolean} - True if API key is configured
 */
function isAvailable() {
  return !!process.env.OPENAI_API_KEY;
}

module.exports = {
  getChatModel,
  getEmbeddings,
  generateCompletion,
  generateEmbedding,
  generateEmbeddings,
  isAvailable
};
