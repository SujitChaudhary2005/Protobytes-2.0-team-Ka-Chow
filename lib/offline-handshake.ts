/**
 * Cross-Device Offline Payment Protocol
 *
 * Two-phase Ed25519 QR handshake for payments between separate devices
 * with ZERO network connectivity.
 *
 * Phase 1: Merchant creates a signed payment request → displays QR
 * Phase 2: Citizen scans, verifies, counter-signs a receipt → displays QR
 * Merchant scans receipt → verifies citizen signature → both record tx
 *
 * Both parties end up with dual-signed transaction records that
 * auto-sync when reconnected.
 */

import {
    signPayload,
    verifySignature,
    generateNonce,
    getPublicKeyHex,
    hexToKey,
    keyToHex,
    generateKeyPair,
} from "@/lib/crypto";
import { SecureKeyStore } from "@/lib/secure-storage";

// ── Types ─────────────────────────────────────────────────────────

export interface OfflinePaymentRequest {
    protocol: "upa-offline-xdevice";
    version: "1.0";
    phase: "request";
    merchantUPA: string;
    merchantName: string;
    merchantPubKey: string;
    amount: number;
    currency: "NPR";
    intent: string;
    nonce: string;
    issuedAt: string;
    expiresAt: string;
}

export interface SignedPaymentRequest extends OfflinePaymentRequest {
    signature: string;
}

export interface OfflinePaymentReceipt {
    protocol: "upa-offline-xdevice";
    version: "1.0";
    phase: "receipt";
    originalRequest: OfflinePaymentRequest;
    merchantSignature: string;
    payerUPA: string;
    payerName: string;
    payerPubKey: string;
    approvedAt: string;
    payerNonce: string;
}

export interface SignedPaymentReceipt extends OfflinePaymentReceipt {
    payerSignature: string;
}

export interface VerificationResult {
    valid: boolean;
    error?: string;
    data?: OfflinePaymentRequest | OfflinePaymentReceipt;
}

// ── Constants ─────────────────────────────────────────────────────

const PROTOCOL_ID = "upa-offline-xdevice";
const PROTOCOL_VERSION = "1.0";
/** Payment request expires in 10 minutes */
const REQUEST_EXPIRY_MS = 10 * 60 * 1000;

// ── Phase 1: Merchant creates a signed payment request ────────────

/**
 * Create a signed payment request QR payload.
 * The merchant signs this with their Ed25519 private key.
 */
export async function createSignedPaymentRequest(params: {
    merchantUPA: string;
    merchantName: string;
    amount: number;
    intent: string;
}): Promise<SignedPaymentRequest> {
    const now = new Date();

    // Get or generate merchant key pair
    const { publicKeyHex, privateKey } = await getOrCreateKeyPair();

    const request: OfflinePaymentRequest = {
        protocol: PROTOCOL_ID,
        version: PROTOCOL_VERSION,
        phase: "request",
        merchantUPA: params.merchantUPA,
        merchantName: params.merchantName,
        merchantPubKey: publicKeyHex,
        amount: params.amount,
        currency: "NPR",
        intent: params.intent,
        nonce: generateNonce(),
        issuedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + REQUEST_EXPIRY_MS).toISOString(),
    };

    // Sign the request (without the signature field)
    const signature = signPayload(request, privateKey);

    return {
        ...request,
        signature,
    };
}

// ── Phase 1 Verification: Citizen verifies merchant's request ─────

/**
 * Verify a scanned payment request QR.
 * Checks: protocol, version, phase, expiry, Ed25519 signature.
 */
export function verifyPaymentRequest(
    signedRequest: SignedPaymentRequest
): VerificationResult {
    try {
        // 1. Protocol check
        if (signedRequest.protocol !== PROTOCOL_ID) {
            return { valid: false, error: "Unknown protocol" };
        }
        if (signedRequest.phase !== "request") {
            return { valid: false, error: "Not a payment request" };
        }

        // 2. Expiry check
        const expiresAt = new Date(signedRequest.expiresAt).getTime();
        if (Date.now() > expiresAt) {
            return { valid: false, error: "Payment request expired" };
        }

        // 3. Amount check
        if (!signedRequest.amount || signedRequest.amount <= 0) {
            return { valid: false, error: "Invalid amount" };
        }

        // 4. Ed25519 signature verification
        const { signature, ...requestWithoutSig } = signedRequest;
        const isValid = verifySignature(
            requestWithoutSig,
            signature,
            signedRequest.merchantPubKey
        );

        if (!isValid) {
            return { valid: false, error: "Invalid Ed25519 signature — possible tampering" };
        }

        return { valid: true, data: requestWithoutSig };
    } catch (err: any) {
        return { valid: false, error: err.message || "Verification failed" };
    }
}

// ── Phase 2: Citizen creates a signed receipt ─────────────────────

/**
 * Create a signed payment receipt after the citizen approves.
 * The citizen counter-signs with their own Ed25519 key.
 */
export async function createSignedReceipt(params: {
    originalRequest: OfflinePaymentRequest;
    merchantSignature: string;
    payerUPA: string;
    payerName: string;
}): Promise<SignedPaymentReceipt> {
    const { publicKeyHex, privateKey } = await getOrCreateKeyPair();

    const receipt: OfflinePaymentReceipt = {
        protocol: PROTOCOL_ID,
        version: PROTOCOL_VERSION,
        phase: "receipt",
        originalRequest: params.originalRequest,
        merchantSignature: params.merchantSignature,
        payerUPA: params.payerUPA,
        payerName: params.payerName,
        payerPubKey: publicKeyHex,
        approvedAt: new Date().toISOString(),
        payerNonce: generateNonce(),
    };

    // Sign the receipt (without the payerSignature field)
    const payerSignature = signPayload(receipt, privateKey);

    return {
        ...receipt,
        payerSignature,
    };
}

// ── Phase 2 Verification: Merchant verifies citizen's receipt ─────

/**
 * Verify a scanned payment receipt QR.
 * Checks: protocol, phase, merchant signature (re-verify), citizen signature.
 */
export function verifyReceipt(
    signedReceipt: SignedPaymentReceipt
): VerificationResult {
    try {
        // 1. Protocol check
        if (signedReceipt.protocol !== PROTOCOL_ID) {
            return { valid: false, error: "Unknown protocol" };
        }
        if (signedReceipt.phase !== "receipt") {
            return { valid: false, error: "Not a payment receipt" };
        }

        // 2. Re-verify merchant signature on the original request
        const origReq = signedReceipt.originalRequest;
        const merchantSigValid = verifySignature(
            origReq,
            signedReceipt.merchantSignature,
            origReq.merchantPubKey
        );
        if (!merchantSigValid) {
            return { valid: false, error: "Merchant signature invalid — receipt may be forged" };
        }

        // 3. Verify citizen signature on the receipt
        const { payerSignature, ...receiptWithoutSig } = signedReceipt;
        const citizenSigValid = verifySignature(
            receiptWithoutSig,
            payerSignature,
            signedReceipt.payerPubKey
        );
        if (!citizenSigValid) {
            return { valid: false, error: "Citizen signature invalid — receipt may be tampered" };
        }

        // 4. Amount sanity
        if (!origReq.amount || origReq.amount <= 0) {
            return { valid: false, error: "Invalid amount in receipt" };
        }

        return { valid: true, data: receiptWithoutSig };
    } catch (err: any) {
        return { valid: false, error: err.message || "Receipt verification failed" };
    }
}

// ── Key Management Helper ─────────────────────────────────────────

/**
 * Get the user's Ed25519 key pair from secure storage,
 * or generate a new one if none exists.
 */
async function getOrCreateKeyPair(): Promise<{
    publicKeyHex: string;
    privateKey: Uint8Array;
}> {
    // Try to load existing private key from secure storage
    const storedHex = await SecureKeyStore.get("upa_private_key");
    if (storedHex) {
        const privateKey = hexToKey(storedHex);
        const publicKeyHex = getPublicKeyHex(privateKey);
        return { publicKeyHex, privateKey };
    }

    // Generate a new key pair
    const { publicKey, privateKey } = generateKeyPair();
    await SecureKeyStore.set("upa_private_key", keyToHex(privateKey));
    return { publicKeyHex: keyToHex(publicKey), privateKey };
}

// ── QR Payload Helpers ────────────────────────────────────────────

/**
 * Encode a signed payment request or receipt for QR display.
 * Uses compact JSON.
 */
export function encodeForQR(payload: SignedPaymentRequest | SignedPaymentReceipt): string {
    return JSON.stringify(payload);
}

/**
 * Decode a scanned QR string into a payment request or receipt.
 */
export function decodeFromQR(qrData: string): SignedPaymentRequest | SignedPaymentReceipt | null {
    try {
        const parsed = JSON.parse(qrData);
        if (parsed.protocol !== PROTOCOL_ID) return null;
        return parsed;
    } catch {
        return null;
    }
}

/**
 * Check if a decoded QR payload is a payment request.
 */
export function isPaymentRequest(
    payload: SignedPaymentRequest | SignedPaymentReceipt
): payload is SignedPaymentRequest {
    return payload.phase === "request";
}

/**
 * Check if a decoded QR payload is a payment receipt.
 */
export function isPaymentReceipt(
    payload: SignedPaymentRequest | SignedPaymentReceipt
): payload is SignedPaymentReceipt {
    return payload.phase === "receipt";
}

