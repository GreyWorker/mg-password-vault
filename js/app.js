// js/app.js
// Point d’entrée unique : boot, SW, persistance, écran Lock minimal.
// Cohérent CSP : pas d’inline scripts/styles.

import { CONFIG } from './config.js';
import { toast, setKdfBadge } from './ui.js';
import { deriveKeyPBKDF2 /*, deriveKeyArgon2, verifyHmacMeta, encryptJSON, decryptJSON */ } from './crypto.js';

async function boot() {
  renderShell();
  toast('info', CONFIG.APP_NAME, 'Initialisation…');

  // Persistance (anti-évictions)
  if (navigator.storage?.persist) {
    try {
      const granted = await navigator.storage.persist();
      if (!granted) toast('warning', 'Stockage non persistant', 'Pensez à exporter régulièrement votre coffre.');
    } catch {/* noop */}
  }

  // Service Worker (ok si absent pour l’instant)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('SW registered:', reg);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        toast('info', 'Mise à jour disponible', 'Rechargez la page pour l’appliquer.', 6000);
      });
    } catch (e) {
      console.warn('SW registration failed:', e);
    }
  }

  // Badge KDF si fallback déjà actif
  const currentKdf = localStorage.getItem(CONFIG.STORAGE_KEYS.KDF_CURRENT);
  if (currentKdf === 'pbkdf2') setKdfBadge('PBKDF2 (sécurité réduite)');

  renderLock();
}

function renderShell() {
  const root = document.getElementById('app');
  root.innerHTML = `
    <div class="container">
      <header class="app-header">
        <h1 class="app-title">${CONFIG.APP_NAME}</h1>
        <nav id="settings-badge" aria-label="indicateurs sécurité"></nav>
      </header>
      <main id="view" class="view"></main>
    </div>
  `;
}

function renderLock() {
  const view = document.getElementById('view');
  view.innerHTML = `
    <section class="card">
      <h2>Déverrouiller</h2>
      <form id="unlock-form" autocomplete="off" class="form">
        <label for="master-pw">Mot de passe maître</label>
        <input type="password" id="master-pw" required />
        <div class="row">
          <button type="submit" class="btn">Déverrouiller</button>
          <button type="button" id="import-btn" class="btn btn-secondary">Importer backup</button>
        </div>
      </form>
    </section>
  `;

  document.getElementById('unlock-form').addEventListener('submit', handleUnlock);
  document.getElementById('import-btn').addEventListener('click', () => {
    toast('info', 'Import', 'Le flux d’import/export arrive dans vault.js (prochaine phase).');
  });
}

async function handleUnlock(e) {
  e.preventDefault();
  const pw = /** @type {HTMLInputElement} */(document.getElementById('master-pw')).value;
  if (!pw) return;

  try {
    // Phase suivante :
    // - Charger meta (localStorage / fichier) via vault.js
    // - deriveKeyArgon2() (fallback deriveKeyPBKDF2)
    // - verifyHmacMeta(meta)
    // - Déchiffrer store et afficher Home
    await deriveKeyPBKDF2(pw, { saltBase64: undefined }); // Démo : dérive une clé sans store
    toast('success', 'OK', 'Flux de déverrouillage sera branché au noyau vault.js.');
  } catch (err) {
    toast('error', 'Échec déverrouillage', String(err?.message || err));
  }
}

document.addEventListener('DOMContentLoaded', boot);
