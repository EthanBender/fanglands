// ============================================================================
// SECRET WORDS — how a knight's password is stored and checked
// PBKDF2-SHA256, 100,000 rounds (the most the Workers free plan allows), a fresh 16-byte salt per knight,
// and a compare that takes the same time whether the guess is close or not. Only crypto.subtle is used, so
// this runs the same in the Worker and in plain Node for the tests.
// ============================================================================

const ROUNDS = 100000;
const enc = new TextEncoder();
const hex = a => Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
const unhex = s => new Uint8Array((String(s).match(/../g) || []).map(h => parseInt(h, 16)));

export function randomHex(bytes) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return hex(a);
}

export async function hashPassword(pass, saltHex) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(pass)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(saltHex), iterations: ROUNDS }, key, 256);
  return hex(new Uint8Array(bits));
}

// A new salt and the hash to store beside it.
export async function makeHash(pass) {
  const salt = randomHex(16);
  return { salt, hash: await hashPassword(pass, salt) };
}

export async function checkPassword(pass, salt, hash) {
  return sameString(await hashPassword(pass, salt), hash);
}

// Compares two strings without leaking how far in they differ. The loop always runs to the longer length.
export function sameString(a, b) {
  const x = enc.encode(String(a)), y = enc.encode(String(b));
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}
