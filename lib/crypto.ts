import { ed25519 } from "@noble/ed25519";
import { randomBytes } from "@noble/ed25519";

// Browser-compatible Buffer polyfill
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

export interface SignedPayload {
    payload: string;
    signature: string;
    publicKey: string;
    timestamp: number;
    nonce: string;
}

/**
 * Generate a new Ed25519 key pair
 */
export async function generateKeyPair(): Promise<{
    publicKey: Uint8Array;
    privateKey: Uint8Array;
}> {
    const privateKey = ed25519.utils.randomPrivateKey();
    const publicKey = ed25519.getPublicKey(privateKey);
    return { publicKey, privateKey };
}

/**
 * Sign a payload with Ed25519
 */
export async function signPayload(
    payload: string,
    privateKey: Uint8Array
): Promise<string> {
    const message = new TextEncoder().encode(payload);
    const signature = await ed25519.sign(message, privateKey);
    return toHex(signature);
}

/**
 * Verify a signature
 */
export async function verifySignature(
    payload: string,
    signature: string,
    publicKey: string
): Promise<boolean> {
    try {
        const message = new TextEncoder().encode(payload);
        const sigBytes = fromHex(signature);
        const pubKeyBytes = fromHex(publicKey);
        return await ed25519.verify(sigBytes, message, pubKeyBytes);
    } catch {
        return false;
    }
}

/**
 * Generate a nonce for replay protection
 */
export function generateNonce(): string {
    return Buffer.from(randomBytes(16)).toString("hex");
}

/**
 * Create a signed payment request
 */
export async function createSignedPaymentRequest(
    paymentData: {
        recipient: string;
        amount: number;
        intent: string;
        metadata?: Record<string, string>;
    },
    privateKey: Uint8Array
): Promise<SignedPayload> {
    const nonce = generateNonce();
    const timestamp = Date.now();

    const payload = JSON.stringify({
        recipient: paymentData.recipient,
        amount: paymentData.amount,
        intent: paymentData.intent,
        metadata: paymentData.metadata || {},
        timestamp,
        nonce,
    });

    const signature = await signPayload(payload, privateKey);
    const publicKey = ed25519.getPublicKey(privateKey);

    return {
        payload,
        signature,
        publicKey: toHex(publicKey),
        timestamp,
        nonce,
    };
}

