import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";

// Required: set sha512 sync for ed25519
try {
  // @ts-ignore - etc may be read-only in some builds
  const etc = ed.etc;
  if (etc && !etc.sha512Sync) {
    Object.defineProperty(etc, 'sha512Sync', {
      value: (...m: Uint8Array[]) => sha512(etc.concatBytes(...m)),
      writable: false,
      configurable: true,
    });
  }
} catch {
  // Ignore if already set or read-only
}

// Hex encoding helpers
const toHex = (bytes: Uint8Array): string => {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
};

const fromHex = (hex: string): Uint8Array => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
};

/**
 * Generate a new Ed25519 key pair
 */
export function generateKeyPair(): {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
} {
    const privateKey = ed.utils.randomPrivateKey();
    const publicKey = ed.getPublicKey(privateKey);
    return { publicKey, privateKey };
}

/**
 * Sign a canonical JSON payload with Ed25519
 */
export function signPayload(
    payload: object,
    privateKey: Uint8Array
): string {
    const message = new TextEncoder().encode(
        JSON.stringify(payload, Object.keys(payload).sort())
    );
    const signature = ed.sign(message, privateKey);
    return toHex(signature);
}

/**
 * Verify a signature against a payload
 */
export function verifySignature(
    payload: object | string,
    signatureHex: string,
    publicKeyHex: string
): boolean {
    try {
        const data = typeof payload === "string" ? payload : JSON.stringify(payload, Object.keys(payload).sort());
        const message = new TextEncoder().encode(data);
        const sigBytes = fromHex(signatureHex);
        const pubKeyBytes = fromHex(publicKeyHex);
        return ed.verify(sigBytes, message, pubKeyBytes);
    } catch {
        return false;
    }
}

/**
 * Generate a nonce for replay protection
 */
export function generateNonce(): string {
    const array = new Uint8Array(16);
    if (typeof crypto !== "undefined") {
        crypto.getRandomValues(array);
    } else {
        for (let i = 0; i < 16; i++) array[i] = Math.floor(Math.random() * 256);
    }
    return toHex(array);
}

/**
 * Get public key hex from private key
 */
export function getPublicKeyHex(privateKey: Uint8Array): string {
    return toHex(ed.getPublicKey(privateKey));
}

/**
 * Convert key to hex string
 */
export function keyToHex(key: Uint8Array): string {
    return toHex(key);
}

/**
 * Convert hex string to key bytes
 */
export function hexToKey(hex: string): Uint8Array {
    return fromHex(hex);
}

