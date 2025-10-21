// js/config.js
// Configuration unifiée (consensus). Clés standardisées pour cohérence inter-modules.

export const CONFIG = {
  APP_NAME: 'MG Password Vault',
  VERSION: '1.0.0',

  SECURITY: {
    // Intégrité des métadonnées (OBLIGATOIRE)
    META_INTEGRITY_MODE: 'HMAC', // 'HMAC' | 'HMAC+METAENC_V2' (future option)

    // KDFs
    KDF: {
      ARGON2: {
        TARGET_MS: [300, 800],
        MEMORY_MB: [64, 128],
        PARALLELISM: 1,
        HASH_LEN: 32
      },
      PBKDF2: {
        ITERATIONS: 600_000,
        HASH: 'SHA-256'
      }
    },

    // Chiffrement du store
    ENCRYPTION: {
      ALGO: 'AES-GCM',
      KEY_LENGTH: 256
    },

    // WebAuthn (intransigeance : required)
    WEBAUTHN_USER_VERIFICATION: 'required'
  },

  // UX & timeouts
  UI: {
    TOAST_TIMEOUT_MS: 4000,
    CLIPBOARD_PURGE_MS: 30_000,
    AUTO_LOCK_DELAY_MS: 5 * 60 * 1000, // 5 minutes
  },

  // Persistance locale
  STORAGE_KEYS: {
    META: 'mg_vault_meta_v1',
    STORE: 'mg_vault_store_v1',
    SETTINGS: 'mg_vault_settings_v1',
    KDF_CURRENT: 'kdf_current',
    PBKDF2_WARNING_SHOWN: 'pbkdf2_warning_shown'
  },

  // Signalisation fallback KDF
  KDF_FALLBACK_NOTICE: 'TOAST_ONCE' // 'TOAST_ONCE' | 'BANNER_PERSIST' | 'SILENT'
};
