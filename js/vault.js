// js/vault.js — Gestion du coffre (CRUD, export/import, atomic writes)
import { CONFIG } from './config.js';
import * as Crypto from './crypto.js';
import * as UI from './ui.js';

// Clé temporaire pour écriture atomique
const STORE_TMP = 'mg_vault_store_tmp';

// État du coffre
let vaultState = {
  isUnlocked: false,
  vaultKey: null,
  store: null,
  meta: null
};

// Store par défaut (fallback sûr)
const DEFAULT_STORE = {
  passwords: [],
  settings: { autoLock: true, clipboardClear: true, theme: 'light' }
};

/**
 * Création d’un nouveau coffre
 */
export async function createVault(masterPassword) {
  try {
    // Salt 16 octets
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltBase64 = Crypto.b64encode(salt);

    // Métadonnées initiales (inclut paramètres KDF effectifs)
    const meta = {
      version: CONFIG.VERSION,
      timestamp: Date.now(),
      saltBase64,
      kdf: 'PBKDF2',
      kdfParams: { iterations: CONFIG.SECURITY.KDF.PBKDF2.ITERATIONS, hash: CONFIG.SECURITY.KDF.PBKDF2.HASH },
      integrity: '' // rempli après dérivation
    };

    // Dérivation & HMAC(meta)
    const vaultKey = await Crypto.deriveKeyPBKDF2(masterPassword, meta);
    meta.integrity = await Crypto.hmacMeta(meta, vaultKey);

    // Sauvegarde atomique (meta puis store chiffré)
    await saveMetaAtomic(meta);
    await saveStoreAtomic(DEFAULT_STORE, vaultKey);

    vaultState = { isUnlocked: true, vaultKey, store: DEFAULT_STORE, meta };
    UI.toast('success', 'Coffre créé', 'Votre coffre a été créé avec succès.');
    return true;
  } catch (err) {
    console.error('Erreur création coffre:', err);
    UI.toast('error', 'Erreur', 'Impossible de créer le coffre.');
    return false;
  }
}

/**
 * Déverrouillage d’un coffre existant
 */
export async function unlockVault(masterPassword) {
  // Charger meta
  const meta = await loadMeta();
  if (!meta) throw new Error('Aucun coffre trouvé. Créez-en un.');

  // Dériver la clé depuis meta fournie
  const vaultKey = await Crypto.deriveKeyPBKDF2(masterPassword, meta);

  // Vérifier HMAC(meta) AVANT déchiffrement
  const ok = await Crypto.verifyHmacMeta(meta, vaultKey);
  if (!ok) throw new Error('Intégrité des métadonnées compromise.');

  // Déchiffrer store (fallback défaut si indisponible/corrompu)
  const store = (await loadStore(vaultKey)) || DEFAULT_STORE;

  vaultState = { isUnlocked: true, vaultKey, store, meta };
  return true;
}

/** Verrouille le coffre en mémoire */
export function lockVault() {
  vaultState = { isUnlocked: false, vaultKey: null, store: null, meta: null };
}

/** Ajoute une entrée */
export async function addPassword({ site, username, password }) {
  if (!vaultState.isUnlocked) throw new Error('Coffre verrouillé');

  const entry = {
    id: crypto.randomUUID(),
    site, username, password,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  vaultState.store.passwords.push(entry);
  await saveStoreAtomic(vaultState.store, vaultState.vaultKey);
  return entry;
}

/** Export JSON lisible */
export async function exportVault() {
  if (!vaultState.isUnlocked) throw new Error('Coffre verrouillé');
  const out = {
    version: CONFIG.VERSION,
    timestamp: Date.now(),
    meta: vaultState.meta,
    store: vaultState.store
  };
  return JSON.stringify(out, null, 2);
}

/** Import depuis JSON (remplace meta+store) */
export async function importVault(fileContent, masterPassword) {
  const data = JSON.parse(fileContent);
  if (!data?.meta || !data?.store) throw new Error('Format de fichier invalide');

  if (data.version !== CONFIG.VERSION) {
    UI.toast('warning', 'Version différente', 'Le fichier provient d’une autre version.');
  }

  const meta = data.meta;
  const vaultKey = await Crypto.deriveKeyPBKDF2(masterPassword, meta);
  const ok = await Crypto.verifyHmacMeta(meta, vaultKey);
  if (!ok) throw new Error('Intégrité compromise ou mot de passe incorrect.');

  await saveMetaAtomic(meta);
  await saveStoreAtomic(data.store, vaultKey);

  vaultState = { isUnlocked: true, vaultKey, store: data.store, meta };
  UI.toast('success', 'Import réussi', 'Coffre importé avec succès.');
  return true;
}

/* ----------------- Internes (atomiques) ----------------- */

async function loadMeta() {
  const j = localStorage.getItem(CONFIG.STORAGE_KEYS.META);
  return j ? JSON.parse(j) : null;
}

async function saveMetaAtomic(meta) {
  localStorage.setItem(CONFIG.STORAGE_KEYS.META, JSON.stringify(meta));
}

async function loadStore(vaultKey) {
  const j = localStorage.getItem(CONFIG.STORAGE_KEYS.STORE);
  if (!j) return null;
  try {
    const encrypted = JSON.parse(j);
    return await Crypto.decryptJSON(encrypted, vaultKey);
  } catch (e) {
    console.error('Erreur déchiffrement store:', e);
    return null;
  }
}

async function saveStoreAtomic(store, vaultKey) {
  try {
    const encrypted = await Crypto.encryptJSON(store, vaultKey);
    const ser = JSON.stringify(encrypted);
    localStorage.setItem(STORE_TMP, ser);
    localStorage.setItem(CONFIG.STORAGE_KEYS.STORE, ser);
    localStorage.removeItem(STORE_TMP);
  } catch (e) {
    localStorage.removeItem(STORE_TMP);
    throw e;
  }
}

/* ----------------- Getters ----------------- */
export function getVaultState() { return { ...vaultState }; }
export function isUnlocked() { return vaultState.isUnlocked; }
export function getPasswords() { return vaultState.store?.passwords || []; }
