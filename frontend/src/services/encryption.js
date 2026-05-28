// src/services/encryption.js
// AES-256 message encryption/decryption using crypto-js

import CryptoJS from 'crypto-js';

const DEFAULT_KEY = process.env.EXPO_PUBLIC_ENCRYPTION_KEY || 'fallback-key-32-chars-padding!!';

/**
 * Encrypt a plain-text message using AES-256-CBC
 * @param {string} text - Plain text to encrypt
 * @param {string} [key] - Optional encryption key (uses env default if omitted)
 * @returns {string} Base64-encoded ciphertext with IV prepended
 */
export const encryptMessage = (text, key = DEFAULT_KEY) => {
  try {
    if (!text) return '';

    // Generate a random 16-byte IV for each message
    const iv = CryptoJS.lib.WordArray.random(16);
    const keyWordArray = CryptoJS.enc.Utf8.parse(key.substring(0, 32).padEnd(32, '0'));

    const encrypted = CryptoJS.AES.encrypt(text, keyWordArray, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    // Prepend IV to ciphertext so we can extract it during decryption
    const ivHex = iv.toString(CryptoJS.enc.Hex);
    const cipherHex = encrypted.ciphertext.toString(CryptoJS.enc.Hex);

    // Combine and encode as base64
    const combined = ivHex + ':' + cipherHex;
    return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(combined));
  } catch (error) {
    console.error('[Encryption] encryptMessage error:', error);
    return text; // Fall back to plain text on error
  }
};

/**
 * Decrypt a base64-encoded AES ciphertext
 * @param {string} ciphertext - Base64 ciphertext string with IV prepended
 * @param {string} [key] - Optional decryption key (uses env default if omitted)
 * @returns {string} Plain text or '[Encrypted message]' on failure
 */
export const decryptMessage = (ciphertext, key = DEFAULT_KEY) => {
  try {
    if (!ciphertext) return '';

    // Decode base64
    const combined = CryptoJS.enc.Base64.parse(ciphertext).toString(CryptoJS.enc.Utf8);

    const parts = combined.split(':');
    if (parts.length !== 2) {
      // Not in our encrypted format — return as-is (plain text message)
      return ciphertext;
    }

    const [ivHex, cipherHex] = parts;
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Hex.parse(cipherHex),
    });

    const keyWordArray = CryptoJS.enc.Utf8.parse(key.substring(0, 32).padEnd(32, '0'));

    const decrypted = CryptoJS.AES.decrypt(cipherParams, keyWordArray, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    const plainText = decrypted.toString(CryptoJS.enc.Utf8);

    if (!plainText) {
      return '[Encrypted message]';
    }

    return plainText;
  } catch (error) {
    console.warn('[Encryption] decryptMessage error:', error);
    return '[Encrypted message]';
  }
};

/**
 * Check if a string looks like our encrypted format
 * @param {string} str
 * @returns {boolean}
 */
export const isEncrypted = (str) => {
  if (!str || typeof str !== 'string') return false;
  try {
    const combined = CryptoJS.enc.Base64.parse(str).toString(CryptoJS.enc.Utf8);
    return combined.includes(':') && combined.split(':').length === 2;
  } catch {
    return false;
  }
};

export default { encryptMessage, decryptMessage, isEncrypted };
