/**
 * Secure Key Storage Abstraction Layer
 *
 * On Web: Uses localStorage (development) or IndexedDB with encryption
 * On Capacitor (iOS/Android): Uses native Secure Enclave / Keystore
 * via @capacitor-community/secure-storage-plugin
 *
 * All private key material is routed through this module.
 */

// Detect if we're running inside Capacitor
function isCapacitor(): boolean {
  return typeof window !== "undefined" && !!(window as any).Capacitor;
}

// ---------- Capacitor Secure Storage (native) ----------

async function getCapacitorSecureStorage() {
  // Dynamic import so the plugin is only loaded on native
  const { SecureStoragePlugin } = await import(
    "@capacitor-community/secure-storage-plugin"
  );
  return SecureStoragePlugin;
}

// ---------- Web Fallback (encrypted IndexedDB via SubtleCrypto) ----------

const DB_NAME = "upa_secure_store";
const STORE_NAME = "keys";
const ENCRYPTION_KEY_NAME = "upa_enc_key";

/** Derive a CryptoKey from a device-stable seed */
async function getEncryptionKey(): Promise<CryptoKey> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("SubtleCrypto not available");
  }

  // Use a device fingerprint seed stored in localStorage (non-secret; it's
  // only used to derive the encryption key that protects private keys in IDB)
  let seed = localStorage.getItem(ENCRYPTION_KEY_NAME);
  if (!seed) {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    seed = Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    localStorage.setItem(ENCRYPTION_KEY_NAME, seed);
  }

  const raw = new TextEncoder().encode(seed);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    raw,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("upa-pay-salt"),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const encKey = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    encKey,
    new TextEncoder().encode(value)
  );
  const payload = JSON.stringify({
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted)),
  });

  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(payload, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openIDB();
  const raw: string | undefined = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (!raw) return null;

  try {
    const { iv, data } = JSON.parse(raw);
    const encKey = await getEncryptionKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      encKey,
      new Uint8Array(data)
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

async function idbRemove(key: string): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- Unified Public API ----------

export const SecureKeyStore = {
  /**
   * Store a value securely
   */
  async set(key: string, value: string): Promise<void> {
    if (isCapacitor()) {
      const plugin = await getCapacitorSecureStorage();
      await plugin.set({ key, value });
    } else if (typeof window !== "undefined" && window.crypto?.subtle) {
      await idbSet(key, value);
    } else {
      // Last resort: plain localStorage (SSR or old browsers)
      localStorage.setItem(`secure_${key}`, value);
    }
  },

  /**
   * Retrieve a value securely
   */
  async get(key: string): Promise<string | null> {
    if (isCapacitor()) {
      const plugin = await getCapacitorSecureStorage();
      try {
        const { value } = await plugin.get({ key });
        return value;
      } catch {
        return null;
      }
    } else if (typeof window !== "undefined" && window.crypto?.subtle) {
      return idbGet(key);
    } else {
      return localStorage.getItem(`secure_${key}`);
    }
  },

  /**
   * Remove a value
   */
  async remove(key: string): Promise<void> {
    if (isCapacitor()) {
      const plugin = await getCapacitorSecureStorage();
      try {
        await plugin.remove({ key });
      } catch {
        // Key may not exist
      }
    } else if (typeof window !== "undefined" && window.crypto?.subtle) {
      await idbRemove(key);
    } else {
      localStorage.removeItem(`secure_${key}`);
    }
  },

  /**
   * Migrate keys from plain localStorage to secure storage
   * Call once during app upgrade
   */
  async migrateFromLocalStorage(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    const oldKey = localStorage.getItem("upa_private_key");
    if (oldKey) {
      await SecureKeyStore.set("upa_private_key", oldKey);
      localStorage.removeItem("upa_private_key");
      return true;
    }
    return false;
  },
};
