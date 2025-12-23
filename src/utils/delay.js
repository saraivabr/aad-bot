/**
 * SMART DELAY
 * 
 * Dynamic delay simulation for humanized responses
 * Takes into account message length and emotional intensity
 */

/**
 * Calculate smart delay based on message and emotion
 * @param {string} text - Message text
 * @param {number} emotionIntensity - Emotion intensity (0-1)
 * @returns {Promise<void>} - Resolves after delay
 */
async function smartDelay(text, emotionIntensity = 0.5) {
  if (!text) {
    return Promise.resolve();
  }

  // Base delay calculation (words per second reading speed)
  const wordCount = text.split(/\s+/).length;
  const baseDelay = Math.min(5, Math.max(1, wordCount / 10)); // 10 words per second reading

  // Emotional boost - higher emotions add slight delay (processing time)
  const emotionalBoost = emotionIntensity * 1.5;

  // Random variance for natural feeling
  const variance = Math.random() * 0.5;

  // Final delay in seconds
  const finalDelay = baseDelay + emotionalBoost + variance;

  console.log(`[SmartDelay] Waiting ${finalDelay.toFixed(2)}s (words: ${wordCount}, emotion: ${emotionIntensity.toFixed(2)})`);

  return new Promise((resolve) => setTimeout(resolve, finalDelay * 1000));
}

/**
 * Simple delay helper
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate typing delay based on text length
 * @param {string} text - Text being "typed"
 * @param {number} charsPerSecond - Typing speed (default: 30)
 * @returns {number} - Delay in milliseconds
 */
function typingDelay(text, charsPerSecond = 30) {
  if (!text) return 1000;
  
  const chars = text.length;
  const baseDelay = (chars / charsPerSecond) * 1000;
  
  // Add variance
  const variance = Math.random() * 500;
  
  // Clamp between 1 and 5 seconds
  return Math.min(5000, Math.max(1000, baseDelay + variance));
}

/**
 * Calculate recording delay for voice messages
 * @param {string} text - Text that would be spoken
 * @returns {number} - Delay in milliseconds
 */
function recordingDelay(text) {
  if (!text) return 2000;
  
  // Average speaking rate: 150 words per minute = 2.5 words per second
  const wordCount = text.split(/\s+/).length;
  const baseDelay = (wordCount / 2.5) * 1000;
  
  // Add buffer for natural pauses
  const buffer = 1000;
  
  return Math.min(10000, Math.max(2000, baseDelay + buffer));
}

/**
 * Delay with progress callback
 * @param {number} ms - Milliseconds to delay
 * @param {Function} onProgress - Callback called periodically
 * @param {number} interval - Progress callback interval
 * @returns {Promise<void>}
 */
async function delayWithProgress(ms, onProgress, interval = 100) {
  const steps = Math.ceil(ms / interval);
  
  for (let i = 0; i < steps; i++) {
    await delay(interval);
    if (onProgress) {
      onProgress((i + 1) / steps);
    }
  }
}

module.exports = {
  smartDelay,
  delay,
  typingDelay,
  recordingDelay,
  delayWithProgress
};
