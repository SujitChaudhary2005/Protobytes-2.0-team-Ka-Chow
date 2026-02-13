import { describe, it, expect } from 'vitest';
import { generateKeyPair, signPayload, verifySignature, generateNonce, keyToHex } from './crypto';

describe('Crypto Library', () => {
    it('should generate a valid key pair', () => {
        const { publicKey, privateKey } = generateKeyPair();
        expect(publicKey).toBeDefined();
        expect(privateKey).toBeDefined();
        expect(publicKey.length).toBe(32);
        expect(privateKey.length).toBe(32);
    });

    it('should sign and verify a payload correctly', () => {
        const { publicKey, privateKey } = generateKeyPair();
        const payload = { amount: 1000, recipient: 'merchant@uoa.np', nonce: generateNonce() };

        const signature = signPayload(payload, privateKey);
        const publicKeyHex = keyToHex(publicKey);

        const isValid = verifySignature(payload, signature, publicKeyHex);
        expect(isValid).toBe(true);
    });

    it('should fail verification for tampered payload', () => {
        const { publicKey, privateKey } = generateKeyPair();
        const payload = { amount: 1000, recipient: 'merchant@uoa.np', nonce: generateNonce() };

        const signature = signPayload(payload, privateKey);
        const publicKeyHex = keyToHex(publicKey);

        const tamperedPayload = { ...payload, amount: 2000 };
        const isValid = verifySignature(tamperedPayload, signature, publicKeyHex);
        expect(isValid).toBe(false);
    });

    it('should fail verification with wrong public key', () => {
        const { privateKey } = generateKeyPair();
        const { publicKey: wrongPublicKey } = generateKeyPair();
        const payload = { amount: 1000, recipient: 'merchant@uoa.np', nonce: generateNonce() };

        const signature = signPayload(payload, privateKey);
        const wrongPublicKeyHex = keyToHex(wrongPublicKey);

        const isValid = verifySignature(payload, signature, wrongPublicKeyHex);
        expect(isValid).toBe(false);
    });

    it('should generate unique nonces', () => {
        const nonce1 = generateNonce();
        const nonce2 = generateNonce();
        expect(nonce1).not.toBe(nonce2);
        expect(nonce1.length).toBe(32); // 16 bytes hex = 32 chars
    });
});
