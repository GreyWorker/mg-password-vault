// js/ui.js
// Utilitaires UI minimalistes (CSP-clean) : toasts, purge clipboard, badge KDF.
// NB : aucun style inline injecté ici (compatible CSP). Les classes sont posées
// pour être stylées par styles/app.css au lot suivant.

import { CONFIG } from './config.js';

export function toast(type = 'info', title = '', message = '', timeout = CONFIG.UI.TOAST_TIMEOUT_MS) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const head = document.createElement('div');
  head.className = 'toast-title';
  head.textContent = title || type.toUpperCase();

  el.appendChild(head);

  if (message) {
    const body = document.createElement('div');
    body.className = 'toast-body';
    body.textContent = message;
    el.appendChild(body);
  }

  container.appendChild(el);
  if (timeout > 0) setTimeout(() => el.remove(), timeout);
}

export async function copyWithPurge(text, clearAfter = CONFIG.UI.CLIPBOARD_PURGE_MS) {
  if (!navigator.clipboard) {
    toast('error', 'Erreur', 'Presse-papier non supporté.');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('success', 'Copié', `Purge dans ${Math.round(clearAfter / 1000)}s.`);
    setTimeout(async () => {
      try {
        const current = await navigator.clipboard.readText();
        if (current === text) await navigator.clipboard.writeText('');
      } catch {/* permissions / http(s) */}
    }, clearAfter);
  } catch (err) {
    toast('error', 'Échec', 'Impossible de copier (permissions ?).');
  }
}

export function setKdfBadge(text) {
  const host = document.getElementById('settings-badge');
  if (!host) return;
  const badge = document.createElement('span');
  badge.className = 'badge badge-warn';
  badge.textContent = text;
  host.replaceChildren(badge);
}
