/**
 * Sleek, local, high-performance carrier SMS spam classification engine.
 * Inspects sender addresses and message contents fully offline for spam indicators.
 */

const SUSPICIOUS_WORDS = [
  'win', 'won', 'lottery', 'prize', 'giftcard', 'gift card', 'cash reward', 
  'earned', 'claim', 'jackpot', 'casino', 'luckydraw', 'lucky draw',
  'account suspended', 'urgent action', 'verify your account', 'verify details',
  'reset password', 'security alert', 'unauthorized login', 'bank alert',
  'loan approved', 'no credit check', 'instant cash', 'bitcoin', 'crypto investment',
  'make money fast', 'get rich', 'investment double', 'casino slots', 'promo code',
  'discount offer', 'exclusive offer', 'limited time deal', 'click here to claim',
  'free voucher', 'bonus credit', 'congratulations you won'
];

const SUSPICIOUS_DOMAINS = [
  'bit.ly', 'tinyurl.com', 'tiny.cc', 't.me', 'wa.me', 'ow.ly', 'is.gd', 'buff.ly',
  'rebrand.ly', 'shorturl.at', 'cutt.ly', 't.co', 'forms.gle'
];

/**
 * Classify a carrier SMS message for spam risk.
 * @param {string} body The message content.
 * @param {string} address The sender phone number or alphanumeric ID.
 * @returns {{ isSpam: boolean, score: number, category: string, reason: string }}
 */
export function classifyMessage(body, address) {
  if (!body) {
    return { isSpam: false, score: 0, category: 'Safe', reason: 'Empty message' };
  }

  const cleanBody = body.toLowerCase().trim();
  const cleanAddress = address.toLowerCase().trim();
  
  let score = 0;
  let category = 'Safe';
  let reason = '';

  // 1. Inspect sender address
  // Alphanumeric shortcodes (e.g. "AD-PROMOT", "VK-INFO") are highly correlated with automated/promotional SMS
  const isAlphanumeric = /^[a-z0-9\-]+$/i.test(cleanAddress) && !/^\+?[0-9]+$/.test(cleanAddress);
  const isShortNumeric = /^\d{4,6}$/.test(cleanAddress); // 4-6 digit automated sender IDs

  if (isAlphanumeric) {
    score += 35;
    reason = 'Automated promotional sender ID';
  } else if (isShortNumeric) {
    score += 25;
    reason = 'Shortcode broadcast sender';
  }

  // 2. Keyword matching analysis
  let matchedWord = null;
  for (const word of SUSPICIOUS_WORDS) {
    if (cleanBody.includes(word)) {
      score += 30;
      matchedWord = word;
      break; // Match first high-risk word
    }
  }

  if (matchedWord) {
    reason = reason ? `${reason} & High-risk phrase detected ("${matchedWord}")` : `High-risk phrase detected ("${matchedWord}")`;
  }

  // 3. Suspect Link Analysis
  let matchedDomain = null;
  for (const domain of SUSPICIOUS_DOMAINS) {
    if (cleanBody.includes(domain)) {
      score += 40;
      matchedDomain = domain;
      break;
    }
  }

  // General url pattern checking in SMS
  const hasUrl = /(https?:\/\/[^\s]+)/g.test(cleanBody) || /www\.[^\s]+/g.test(cleanBody);
  if (hasUrl) {
    score += 20;
    if (matchedDomain) {
      score += 30;
      reason = reason ? `${reason} & Suspicious shortened URL (${matchedDomain})` : `Suspicious shortened URL (${matchedDomain})`;
    } else {
      reason = reason ? `${reason} & Contains links` : 'Contains links';
    }
  }

  // 4. Final classification determination
  // A threshold of 50 indicates high probability of spam or scam
  const isSpam = score >= 50;
  if (isSpam) {
    if (cleanBody.includes('bank') || cleanBody.includes('account') || cleanBody.includes('verify')) {
      category = 'Phishing Alert';
    } else if (cleanBody.includes('win') || cleanBody.includes('prize') || cleanBody.includes('lottery')) {
      category = 'Lottery Scam';
    } else if (cleanBody.includes('loan') || cleanBody.includes('cash') || cleanBody.includes('investment')) {
      category = 'Financial Spam';
    } else {
      category = 'Promotional Spam';
    }
  }

  return {
    isSpam,
    score,
    category: isSpam ? category : 'Safe',
    reason: isSpam ? reason : 'Legitimate personal contact'
  };
}
