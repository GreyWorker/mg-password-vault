// js/crypto.js
// Noyau sécurité : AES-GCM helpers, PBKDF2 600k (fallback) + toast-once + flag,
// HKDF/HMAC pour l’intégrité meta AVANT déchiffrement.
// TOTP & WebAuthn : stubs (phase suivante).

import { CONFIG } from './config.js';
import { toast } from './ui.js';

// --- Encodage & Base64 ---
export function utf8(s) { return new TextEncoder().encode(s); }
export function b64encode(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))); }
export function b64decode(str) {
  const bin = atob(str);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}

// --- AES-GCM JSON helpers ---
export async function encryptJSON(obj, cryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pt = utf8(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: CONFIG.SECURITY.ENCRYPTION.ALGO, iv }, cryptoKey, pt);
  return { iv: b64encode(iv), ct: b64encode(ct) };
}
export async function decryptJSON(payload, cryptoKey) {
  const iv = new Uint8Array(b64decode(payload.iv));
  const ct = b64decode(payload.ct);
  const pt = await crypto.subtle.decrypt({ name: CONFIG.SECURITY.ENCRYPTION.ALGO, iv }, cryptoKey, ct);
  return JSON.parse(new TextDecoder().decode(pt));
}

// --- KDFs ---
export async function deriveKeyArgon2(/* password, meta */) {
  // Phase suivante : branchement WASM (argon2-browser) + calibration.
  throw new Error('Argon2id non implémenté (prochaine phase).');
}

export async function deriveKeyPBKDF2(password, meta, iters = CONFIG.SECURITY.KDF.PBKDF2.ITERATIONS) {
  if (CONFIG.KDF_FALLBACK_NOTICE === 'TOAST_ONCE' &&
      !localStorage.getItem(CONFIG.STORAGE_KEYS.PBKDF2_WARNING_SHOWN)) {
    toast('warning', 'Sécurité réduite',
      `Argon2 indisponible. PBKDF2 ${iters.toLocaleString()} itérations utilisé. Recommandé : MDP 16+ et TOTP.`,
      10_000);
    localStorage.setItem(CONFIG.STORAGE_KEYS.PBKDF2_WARNING_SHOWN, 'true');
  }
  localStorage.setItem(CONFIG.STORAGE_KEYS.KDF_CURRENT, 'pbkdf2');

  const baseKey = await crypto.subtle.importKey('raw', utf8(password), { name: 'PBKDF2' }, false, ['deriveKey']);
  const salt = meta?.saltBase64 ? b64decode(meta.saltBase64) : utf8('mg-vault-placeholder-salt'); // remplacé par vault.js
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: iters, hash: CONFIG.SECURITY.KDF.PBKDF2.HASH },
    baseKey,
    { name: CONFIG.SECURITY.ENCRYPTION.ALGO, length: CONFIG.SECURITY.ENCRYPTION.KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// --- HKDF & HMAC(meta) ---
async function hkdfFromVaultKey(vaultKey, infoStr) {
  return crypto.subtle.deriveKey(
    { name: 'HKDF', salt: new Uint8Array(16), info: utf8(infoStr), hash: 'SHA-256' },
    vaultKey,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign', 'verify']
  );
}

export async function hmacMeta(meta, vaultKey) {
  if (CONFIG.SECURITY.META_INTEGRITY_MODE !== 'HMAC') return '';
  const key = await hkdfFromVaultKey(vaultKey, 'meta-integrity');
  const toSign = { ...meta }; delete toSign.integrity;
  const sig = await crypto.subtle.sign('HMAC', key, utf8(JSON.stringify(toSign)));
  return b64encode(sig);
}

export async function verifyHmacMeta(meta, vaultKey) {
  const stored = meta?.integrity;
  if (!stored || CONFIG.SECURITY.META_INTEGRITY_MODE !== 'HMAC') return false;
  const recomputed = await hmacMeta(meta, vaultKey);
  return stored === recomputed;
}

// --- TOTP / WebAuthn (stubs pour phase suivante) ---
export function generateTOTPSecret() { return 'BASE32_SECRET_TODO'; }
export function verifyTOTP(/* { secretBase32, code, timestamp } */) { return false; }
export async function webauthnEnroll() { throw new Error('WebAuthn enroll: TODO'); }
export async function webauthnGet() { throw new Error('WebAuthn get: TODO'); }
