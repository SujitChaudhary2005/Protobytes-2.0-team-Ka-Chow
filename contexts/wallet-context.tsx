"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Wallet, Transaction } from "@/types";
import { generateKeyPair, keyToHex } from "@/lib/crypto";
import { SecureKeyStore } from "@/lib/secure-storage";

interface WalletContextType {
    wallet: Wallet | null;
    transactions: Transaction[];
    balance: number;
    isAuthenticated: boolean;
    isLoading: boolean;
    initializeWallet: () => void;
    addTransaction: (transaction: Transaction) => void;
    updateBalance: (amount: number) => void;
    login: (citizenshipId: string, phone: string) => Promise<boolean>;
    logout: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [balance, setBalance] = useState(50000);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [mounted, setMounted] = useState(false);

    // Load wallet on mount, migrating old keys to secure storage
    useEffect(() => {
        setMounted(true);
        if (typeof window === "undefined") return;

        const init = async () => {
            // Migrate any old plaintext private keys to secure storage
            await SecureKeyStore.migrateFromLocalStorage();

            // Check auth session
            const session = localStorage.getItem("upa_auth_session");
            if (session) {
                try {
                    const s = JSON.parse(session);
                    if (s.expiresAt > Date.now()) {
                        setIsAuthenticated(true);
                    } else {
                        localStorage.removeItem("upa_auth_session");
                    }
                } catch {
                    localStorage.removeItem("upa_auth_session");
                }
            }

            // Load wallet
            const stored = localStorage.getItem("upa_wallet");
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    setWallet(parsed);
                    setBalance(parsed.balance || 50000);
                } catch {
                    await createNewWallet();
                }
            } else {
                await createNewWallet();
            }

            // Load transactions
            const storedTx = localStorage.getItem("upa_transactions");
            if (storedTx) {
                try {
                    setTransactions(JSON.parse(storedTx));
                } catch { }
            }

            setIsLoading(false);
        };

        init();
    }, []);

    const createNewWallet = async () => {
        if (typeof window === "undefined") return;

        const { publicKey, privateKey } = generateKeyPair();
        const address = keyToHex(publicKey).slice(0, 20);

        const walletId = localStorage.getItem("upa_wallet_id") || `wallet_${Date.now()}`;
        if (!localStorage.getItem("upa_wallet_id")) {
            localStorage.setItem("upa_wallet_id", walletId);
        }

        const newWallet: Wallet = {
            id: walletId,
            name: "Demo Wallet",
            balance: 50000,
            address: `upa_${address}`,
            publicKey: keyToHex(publicKey),
        };

        // Store private key securely (encrypted IndexedDB on web, Keychain on iOS, Keystore on Android)
        await SecureKeyStore.set("upa_private_key", keyToHex(privateKey));

        setWallet(newWallet);
        localStorage.setItem("upa_wallet", JSON.stringify(newWallet));
    };

    const initializeWallet = () => {
        createNewWallet();
    };

    const addTransaction = (transaction: Transaction) => {
        setTransactions((prev) => {
            const updated = [transaction, ...prev];
            localStorage.setItem("upa_transactions", JSON.stringify(updated));
            return updated;
        });
    };

    const updateBalance = (amount: number) => {
        setBalance((prev) => {
            const newBalance = prev - amount;
            if (wallet) {
                const updated = { ...wallet, balance: newBalance };
                setWallet(updated);
                localStorage.setItem("upa_wallet", JSON.stringify(updated));
            }
            return newBalance;
        });
    };

    /**
     * Login with Citizenship ID + phone (demo auth)
     * In production: integrates with Supabase Auth SMS OTP or govt ID verification
     */
    const login = useCallback(async (citizenshipId: string, phone: string): Promise<boolean> => {
        try {
            // Simulate OTP verification delay
            await new Promise((r) => setTimeout(r, 800));

            // Validate citizenship ID format: XX-XX-XX-XXXXX
            const cidPattern = /^\d{2}-\d{2}-\d{2}-\d{5}$/;
            if (!cidPattern.test(citizenshipId)) {
                return false;
            }

            // Validate Nepali phone number: +977 9XXXXXXXXX
            const phonePattern = /^(\+977)?9\d{9}$/;
            const cleanPhone = phone.replace(/[\s-]/g, "");
            if (!phonePattern.test(cleanPhone)) {
                return false;
            }

            // Create authenticated session
            const session = {
                citizenshipId,
                phone: cleanPhone,
                loginAt: Date.now(),
                expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
            };
            localStorage.setItem("upa_auth_session", JSON.stringify(session));
            setIsAuthenticated(true);

            // Update wallet name
            if (wallet) {
                const updated = { ...wallet, name: `Citizen ${citizenshipId.slice(-5)}` };
                setWallet(updated);
                localStorage.setItem("upa_wallet", JSON.stringify(updated));
            }

            return true;
        } catch {
            return false;
        }
    }, [wallet]);

    const logout = useCallback(() => {
        localStorage.removeItem("upa_auth_session");
        setIsAuthenticated(false);
    }, []);

    return (
        <WalletContext.Provider
            value={{
                wallet,
                transactions,
                balance,
                isAuthenticated,
                isLoading,
                initializeWallet,
                addTransaction,
                updateBalance,
                login,
                logout,
            }}
        >
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error("useWallet must be used within a WalletProvider");
    }
    return context;
}

