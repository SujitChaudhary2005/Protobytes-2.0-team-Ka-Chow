"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Wallet, Transaction, UserRole, AppUser, MerchantProfile, NIDCard, BankAccount, OfflineLimit, MOCK_NID_DATABASE } from "@/types";
import { generateKeyPair, keyToHex } from "@/lib/crypto";
import { SecureKeyStore } from "@/lib/secure-storage";

// Demo users — matches supabase/02_seed.sql
const DEMO_USERS: AppUser[] = [
    { id: "c1000000-0000-0000-0000-000000000001", email: "citizen@demo.np",  name: "Ram Bahadur Thapa", role: "citizen",  phone: "+9779841000001" },
    { id: "c1000000-0000-0000-0000-000000000005", email: "citizen2@demo.np", name: "Anita Gurung",      role: "citizen",  phone: "+9779841000005" },
    { id: "c1000000-0000-0000-0000-000000000002", email: "officer@demo.np",  name: "Sita Sharma",       role: "officer",  phone: "+9779841000002" },
    { id: "c1000000-0000-0000-0000-000000000003", email: "merchant@demo.np", name: "Hari Prasad Oli",   role: "merchant", phone: "+9779841000003" },
    { id: "c1000000-0000-0000-0000-000000000004", email: "admin@demo.np",    name: "Gita Adhikari",     role: "admin",    phone: "+9779841000004" },
];

const DEMO_PASSWORDS: Record<string, string> = {
    "citizen@demo.np": "citizen123",
    "citizen2@demo.np": "citizen123",
    "officer@demo.np": "officer123",
    "merchant@demo.np": "merchant123",
    "admin@demo.np": "admin123",
};

interface WalletContextType {
    wallet: Wallet | null;
    transactions: Transaction[];
    balance: number;
    isAuthenticated: boolean;
    isLoading: boolean;
    user: AppUser | null;
    role: UserRole | null;
    merchantProfile: MerchantProfile | null;
    // NID & Bank
    nid: NIDCard | null;
    linkedBank: BankAccount | null;
    // Offline limits
    offlineLimit: OfflineLimit;
    // Actions
    initializeWallet: () => void;
    addTransaction: (transaction: Transaction) => void;
    updateBalance: (amount: number) => void;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
    registerMerchant: (profile: Omit<MerchantProfile, "id" | "upaAddress" | "registeredAt" | "ownerId">) => MerchantProfile;
    // New actions
    linkNID: (nidNumber: string) => NIDCard | null;
    linkBank: (bank: BankAccount) => void;
    setOfflineLimit: (limit: number) => void;
    useOfflineLimit: (amount: number) => boolean;
    resetOfflineLimit: () => void;
    canSpendOffline: (amount: number) => boolean;
    deductFromBank: (amount: number) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [balance, setBalance] = useState(50000);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [user, setUser] = useState<AppUser | null>(null);
    const [merchantProfile, setMerchantProfile] = useState<MerchantProfile | null>(null);
    const [nid, setNid] = useState<NIDCard | null>(null);
    const [linkedBank, setLinkedBank] = useState<BankAccount | null>(null);
    const [offlineLimit, setOfflineLimitState] = useState<OfflineLimit>({
        maxAmount: 5000,
        currentUsed: 0,
        lastReset: Date.now(),
    });

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
                        // Restore user from session
                        if (s.user) {
                            setUser(s.user);
                        }
                    } else {
                        localStorage.removeItem("upa_auth_session");
                    }
                } catch {
                    localStorage.removeItem("upa_auth_session");
                }
            }

            // Load merchant profile
            const storedMerchant = localStorage.getItem("upa_merchant_profile");
            if (storedMerchant) {
                try { setMerchantProfile(JSON.parse(storedMerchant)); } catch { /* ignore */ }
            }

            // Load NID
            const storedNid = localStorage.getItem("upa_nid");
            if (storedNid) {
                try { setNid(JSON.parse(storedNid)); } catch { /* ignore */ }
            }

            // Load linked bank
            const storedBank = localStorage.getItem("upa_linked_bank");
            if (storedBank) {
                try { setLinkedBank(JSON.parse(storedBank)); } catch { /* ignore */ }
            }

            // Load offline limit
            const storedLimit = localStorage.getItem("upa_offline_limit");
            if (storedLimit) {
                try { setOfflineLimitState(JSON.parse(storedLimit)); } catch { /* ignore */ }
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
     * Login with email + password (demo auth — matches seeded users)
     */
    const login = useCallback(async (email: string, password: string): Promise<boolean> => {
        try {
            // Simulate network delay
            await new Promise((r) => setTimeout(r, 600));

            // Check demo credentials
            const expectedPassword = DEMO_PASSWORDS[email.toLowerCase()];
            if (!expectedPassword || expectedPassword !== password) {
                return false;
            }

            const matchedUser = DEMO_USERS.find(u => u.email === email.toLowerCase());
            if (!matchedUser) return false;

            // Create authenticated session with role
            const session = {
                user: matchedUser,
                loginAt: Date.now(),
                expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
            };
            localStorage.setItem("upa_auth_session", JSON.stringify(session));
            setIsAuthenticated(true);
            setUser(matchedUser);

            // Update wallet name
            if (wallet) {
                const updated = { ...wallet, name: matchedUser.name };
                setWallet(updated);
                localStorage.setItem("upa_wallet", JSON.stringify(updated));
            }

            return true;
        } catch {
            return false;
        }
    }, [wallet]);

    /**
     * Register a citizen as a merchant — creates profile with generated UPA address
     */
    const registerMerchant = useCallback((profile: Omit<MerchantProfile, "id" | "upaAddress" | "registeredAt" | "ownerId">): MerchantProfile => {
        const slug = profile.businessName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
        const newProfile: MerchantProfile = {
            ...profile,
            id: `merchant_${Date.now()}`,
            upaAddress: `${slug}@merchant.np`,
            registeredAt: Date.now(),
            ownerId: user?.id ?? "unknown",
        };
        setMerchantProfile(newProfile);
        localStorage.setItem("upa_merchant_profile", JSON.stringify(newProfile));
        return newProfile;
    }, [user]);

    /**
     * Link National ID — look up in mock database
     */
    const linkNID = useCallback((nidNumber: string): NIDCard | null => {
        const found = MOCK_NID_DATABASE.find(n => n.nidNumber === nidNumber);
        if (!found) return null;
        setNid(found);
        localStorage.setItem("upa_nid", JSON.stringify(found));
        // Auto-link primary bank
        if (found.linkedBanks.length > 0) {
            const primary = found.linkedBanks.find(b => b.isPrimary) || found.linkedBanks[0];
            setLinkedBank(primary);
            localStorage.setItem("upa_linked_bank", JSON.stringify(primary));
        }
        return found;
    }, []);

    /**
     * Link a bank account
     */
    const linkBank = useCallback((bank: BankAccount) => {
        setLinkedBank(bank);
        localStorage.setItem("upa_linked_bank", JSON.stringify(bank));
    }, []);

    /**
     * Set offline spending limit
     */
    const setOfflineLimit = useCallback((limit: number) => {
        const newLimit: OfflineLimit = { maxAmount: limit, currentUsed: offlineLimit.currentUsed, lastReset: offlineLimit.lastReset };
        setOfflineLimitState(newLimit);
        localStorage.setItem("upa_offline_limit", JSON.stringify(newLimit));
    }, [offlineLimit]);

    /**
     * Check if amount is within offline spending limit
     */
    const canSpendOffline = useCallback((amount: number): boolean => {
        return amount <= (offlineLimit.maxAmount - offlineLimit.currentUsed);
    }, [offlineLimit]);

    /**
     * Use offline limit — returns true if success, false if exceeded
     */
    const useOfflineLimit = useCallback((amount: number): boolean => {
        if (!canSpendOffline(amount)) return false;
        const newLimit: OfflineLimit = { ...offlineLimit, currentUsed: offlineLimit.currentUsed + amount };
        setOfflineLimitState(newLimit);
        localStorage.setItem("upa_offline_limit", JSON.stringify(newLimit));
        return true;
    }, [offlineLimit, canSpendOffline]);

    /**
     * Reset offline limit usage (on sync complete)
     */
    const resetOfflineLimit = useCallback(() => {
        const newLimit: OfflineLimit = { maxAmount: offlineLimit.maxAmount, currentUsed: 0, lastReset: Date.now() };
        setOfflineLimitState(newLimit);
        localStorage.setItem("upa_offline_limit", JSON.stringify(newLimit));
    }, [offlineLimit.maxAmount]);

    /**
     * Mock deduct from bank (NID-linked bank payment)
     */
    const deductFromBank = useCallback((amount: number) => {
        // In production: call bank API. For demo: just log.
        console.log(`[Bank Gateway] Deducted NPR ${amount} from ${linkedBank?.bankName ?? "unknown"} (${linkedBank?.accountNumber})`);
    }, [linkedBank]);

    const logout = useCallback(() => {
        localStorage.removeItem("upa_auth_session");
        localStorage.removeItem("upa_merchant_profile");
        localStorage.removeItem("upa_nid");
        localStorage.removeItem("upa_linked_bank");
        setIsAuthenticated(false);
        setUser(null);
        setMerchantProfile(null);
        setNid(null);
        setLinkedBank(null);
    }, []);

    return (
        <WalletContext.Provider
            value={{
                wallet,
                transactions,
                balance,
                isAuthenticated,
                isLoading,
                user,
                role: user?.role ?? null,
                merchantProfile,
                nid,
                linkedBank,
                offlineLimit,
                initializeWallet,
                addTransaction,
                updateBalance,
                login,
                logout,
                registerMerchant,
                linkNID,
                linkBank,
                setOfflineLimit,
                useOfflineLimit,
                resetOfflineLimit,
                canSpendOffline,
                deductFromBank,
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

