// src/services/firebase.js
// 100% Mocked Firebase implementation for offline self-contained mobile application

export const app = {};
export const auth = {
  currentUser: {
    uid: 'mock_user_id',
    getIdToken: async () => 'mock_firebase_id_token',
  }
};
export const db = {};

/**
 * Mock Sign in with phone number
 * @param {string} phone - Full phone number with country code (e.g. +1234567890)
 * @param {object} recaptchaVerifier - RecaptchaVerifier instance
 * @returns {Promise<ConfirmationResult>}
 */
export const signInWithPhoneNumber = async (phone, recaptchaVerifier) => {
  console.log('[Mock Firebase] Sending OTP to phone:', phone);
  return {
    confirm: async (otp) => {
      console.log('[Mock Firebase] Confirming OTP:', otp);
      // For developer convenience, accept 123456 or any 6-digit code
      return {
        user: {
          uid: 'user_' + phone.replace(/\D/g, ''),
          phone,
          getIdToken: async () => 'mock_firebase_id_token_' + Date.now(),
        }
      };
    }
  };
};

/**
 * Mock onAuthStateChanged listener
 * @param {function} callback - Called with user or null
 * @returns {function} Unsubscribe function
 */
export const onAuthStateChanged = (callback) => {
  // Immediately call with mock user
  callback(auth.currentUser);
  return () => {};
};

export default { app, auth, db, signInWithPhoneNumber, onAuthStateChanged };
