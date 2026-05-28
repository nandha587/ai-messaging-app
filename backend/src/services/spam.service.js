const { Filter } = require('bad-words');
const validator = require('validator');

const filter = new Filter();

// In-memory rate limit tracking: { uid -> [timestamps] }
const messageTimestamps = new Map();

/**
 * Clean up old timestamps for a user (older than 60 seconds)
 */
function cleanupTimestamps(uid) {
  const now = Date.now();
  const timestamps = messageTimestamps.get(uid) || [];
  const recent = timestamps.filter(t => now - t < 60000);
  messageTimestamps.set(uid, recent);
  return recent;
}

/**
 * Check for repeated characters (e.g., "aaaaaaaaaaaaa")
 */
function isRepeatedCharSpam(text) {
  if (text.length < 8) return false;
  const chars = text.replace(/\s/g, '');
  if (chars.length === 0) return false;
  const sorted = [...chars].sort();
  const mostCommon = sorted
    .reduce((acc, c) => {
      acc[c] = (acc[c] || 0) + 1;
      return acc;
    }, {});
  const maxCount = Math.max(...Object.values(mostCommon));
  return maxCount / chars.length > 0.7;
}

/**
 * Check for repeated words (e.g., "buy buy buy buy buy buy")
 */
function isRepeatedWordSpam(text) {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  if (words.length < 6) return false;
  const counts = {};
  for (const word of words) {
    counts[word] = (counts[word] || 0) + 1;
  }
  const maxCount = Math.max(...Object.values(counts));
  return maxCount >= 5;
}

/**
 * Check for suspicious/fake links
 */
function hasSuspiciousLinks(text) {
  // IP-based URLs
  const ipUrlPattern = /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i;
  // URL shorteners commonly used for spam
  const shortenerPattern = /\b(bit\.ly|tinyurl\.com|goo\.gl|t\.co|ow\.ly|short\.link|rebrand\.ly|cutt\.ly)\//i;
  // Excessive URLs (more than 3 URLs in a message)
  const urlMatches = text.match(/https?:\/\/\S+/gi) || [];

  return ipUrlPattern.test(text) || shortenerPattern.test(text) || urlMatches.length > 3;
}

/**
 * Check for bot-like behavior
 */
function isBotLike(text) {
  const stripped = text.replace(/\s/g, '');
  if (stripped.length === 0) return false;

  // All caps text (more than 80% uppercase)
  const upperCount = (text.match(/[A-Z]/g) || []).length;
  const letterCount = (text.match(/[a-zA-Z]/g) || []).length;
  if (letterCount > 10 && upperCount / letterCount > 0.8) return true;

  // Excessive punctuation
  const punctCount = (text.match(/[!?]{2,}/g) || []).join('').length;
  if (punctCount > 5) return true;

  return false;
}

/**
 * Main spam detection function
 * @param {string} message - The message content to analyze
 * @param {string} senderId - The UID of the message sender
 * @returns {{ isSpam: boolean, reason: string | null }}
 */
function detectSpam(message, senderId) {
  // 1. Empty message
  if (!message || message.trim().length === 0) {
    return { isSpam: true, reason: 'Empty message' };
  }

  // 2. Message too long
  if (message.length > 2000) {
    return { isSpam: true, reason: 'Message exceeds maximum length' };
  }

  // 3. Rate limiting: >20 messages in 60 seconds
  if (senderId) {
    const recent = cleanupTimestamps(senderId);
    if (recent.length >= 20) {
      return { isSpam: true, reason: 'Sending too many messages too quickly' };
    }
    recent.push(Date.now());
    messageTimestamps.set(senderId, recent);
  }

  // 4. Repeated character spam
  if (isRepeatedCharSpam(message)) {
    return { isSpam: true, reason: 'Repeated character spam detected' };
  }

  // 5. Repeated word spam
  if (isRepeatedWordSpam(message)) {
    return { isSpam: true, reason: 'Repeated word spam detected' };
  }

  // 6. Suspicious links
  if (hasSuspiciousLinks(message)) {
    return { isSpam: true, reason: 'Suspicious or fake links detected' };
  }

  // 7. Abusive language
  try {
    if (filter.isProfane(message)) {
      return { isSpam: true, reason: 'Message contains inappropriate language' };
    }
  } catch {
    // bad-words library can throw on edge cases
  }

  // 8. Bot-like behavior
  if (isBotLike(message)) {
    return { isSpam: true, reason: 'Bot-like message pattern detected' };
  }

  // 9. Suspicious URLs via validator
  const urlMatches = message.match(/https?:\/\/\S+/gi) || [];
  for (const url of urlMatches) {
    if (!validator.isURL(url, { require_protocol: true, require_tld: true })) {
      return { isSpam: true, reason: 'Invalid URL detected in message' };
    }
  }

  return { isSpam: false, reason: null };
}

/**
 * Reset rate limit tracking for a user (e.g., after ban lifted)
 */
function resetUserRateLimit(uid) {
  messageTimestamps.delete(uid);
}

module.exports = { detectSpam, resetUserRateLimit };
