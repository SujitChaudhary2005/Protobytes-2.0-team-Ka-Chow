"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { Wallet, Transaction, UserRole, AppUser, MerchantProfile, NIDCard, BankAccount, OfflineWallet, MOCK_NID_DATABASE } from "@/types";
import { generateKeyPair, keyToHex } from "@/lib/crypto";
import { SecureKeyStore } from "@/lib/secure-storage";

// ── Per-user storage helper ──
let _activeUserId: string | null = null;
function uKey(base: string): string {
    return _activeUserId ? `${base}:${_activeUserId}` : base;
}
function uKeyFor(base: string, userId: string): string {
    return `${base}:${userId}`;
}

// ── Citizen-specific config ──
const CITIZEN_INITIAL_BALANCE: Record<string, number> = {
    "c1000000-0000-0000-0000-000000000001": 50000,  // Ram — city worker
    "c1000000-0000-0000-0000-000000000005": 35000,  // Anita — university student
};
const CITIZEN_NID_MAP: Record<string, string> = {
    "c1000000-0000-0000-0000-000000000001": "RAM-KTM-1990-4521",
    "c1000000-0000-0000-0000-000000000005": "ANITA-BRT-1998-5643",
};

// UPA → user ID mapping (for crediting receivers in C2C)
export const UPA_TO_USER: Record<string, string> = {
    "ram@upa.np": "c1000000-0000-0000-0000-000000000001",
    "anita@upa.np": "c1000000-0000-0000-0000-000000000005",
    "sita@upa.np": "c1000000-0000-0000-0000-000000000002",
    "hari@upa.np": "c1000000-0000-0000-0000-000000000003",
};

// Demo users — matches supabase/02_seed.sql
const DEMO_USERS: AppUser[] = [
    { id: "c1000000-0000-0000-0000-000000000001", email: "citizen@demo.np", name: "Ram Bahadur Thapa", role: "citizen", phone: "+9779841000001", nidNumber: "RAM-KTM-1990-4521", upa_id: "ram@upa.np" },
    { id: "c1000000-0000-0000-0000-000000000005", email: "citizen2@demo.np", name: "Anita Gurung", role: "citizen", phone: "+9779841000005", nidNumber: "ANITA-BRT-1998-5643", upa_id: "anita@upa.np" },
    { id: "c1000000-0000-0000-0000-000000000002", email: "officer@demo.np", name: "Sita Sharma", role: "officer", phone: "+9779841000002" },
    { id: "c1000000-0000-0000-0000-000000000003", email: "merchant@demo.np", name: "Hari Prasad Oli", role: "merchant", phone: "+9779841000003" },
    { id: "c1000000-0000-0000-0000-000000000004", email: "admin@demo.np", name: "Gita Adhikari", role: "admin", phone: "+9779841000004" },
];

export { DEMO_USERS };

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
    // SaralPay Offline Wallet
    offlineWallet: OfflineWallet;
    saralPayBalance: number;
    // Actions
    initializeWallet: () => void;
    addTransaction: (transaction: Transaction) => void;
    updateBalance: (amount: number) => void;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
    registerMerchant: (profile: Omit<MerchantProfile, "id" | "upaAddress" | "registeredAt" | "ownerId">) => MerchantProfile;
    // New actions
    linkNID: (nidOrNumber: string | NIDCard) => NIDCard | null;
    linkBank: (bank: BankAccount) => void;
    // SaralPay Wallet actions
    loadSaralPay: (amount: number) => boolean;
    spendFromSaralPay: (amount: number) => boolean;
    unloadSaralPay: () => void;
    canSpendOffline: (amount: number) => boolean;
    deductFromBank: (amount: number) => void;
    creditUser: (upaAddress: string, amount: number, tx: Transaction) => void;
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
    const [offlineWallet, setOfflineWalletState] = useState<OfflineWallet>({
        loaded: false,
        balance: 0,
        initialLoadAmount: 0,
        loadedAt: 0,
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
            let sessionUser: AppUser | null = null;
            if (session) {
                try {
                    const s = JSON.parse(session);
                    if (s.expiresAt > Date.now()) {
                        setIsAuthenticated(true);
                        if (s.user) {
                            sessionUser = s.user;
                            _activeUserId = s.user.id;
                            setUser(s.user);
                        }
                    } else {
                        localStorage.removeItem("upa_auth_session");
                    }
                } catch {
                    localStorage.removeItem("upa_auth_session");
                }
            }

            // Load user-scoped data
            loadUserData(sessionUser);

            setIsLoading(false);
        };

        init();
    }, []);

    /** Load all user-specific data from localStorage */
    const loadUserData = (targetUser: AppUser | null) => {
        const uid = targetUser?.id ?? null;
        _activeUserId = uid;

        // Load merchant profile
        const storedMerchant = localStorage.getItem(uKey("upa_merchant_profile"));
        if (storedMerchant) {
            try { setMerchantProfile(JSON.parse(storedMerchant)); } catch { /* ignore */ }
        } else { setMerchantProfile(null); }

        // Load NID
        let loadedNid: NIDCard | null = null;
        const storedNid = localStorage.getItem(uKey("upa_nid"));
        if (storedNid) {
            try { loadedNid = JSON.parse(storedNid); setNid(loadedNid); } catch { setNid(null); }
        } else {
            // Auto-link NID for citizen users
            if (uid && targetUser?.role === "citizen") {
                const nidNumber = CITIZEN_NID_MAP[uid];
                if (nidNumber) {
                    const found = MOCK_NID_DATABASE.find(n => n.nidNumber === nidNumber);
                    if (found) {
                        loadedNid = found;
                        setNid(found);
                        localStorage.setItem(uKey("upa_nid"), JSON.stringify(found));
                        // Auto-link primary bank
                        if (found.linkedBanks.length > 0) {
                            const primary = found.linkedBanks.find(b => b.isPrimary) || found.linkedBanks[0];
                            setLinkedBank(primary);
                            localStorage.setItem(uKey("upa_linked_bank"), JSON.stringify(primary));
                        }
                    }
                }
            } else {
                setNid(null);
            }
        }

        // Load linked bank (if not already set by NID auto-link)
        if (!loadedNid || localStorage.getItem(uKey("upa_linked_bank"))) {
            const storedBank = localStorage.getItem(uKey("upa_linked_bank"));
            if (storedBank) {
                try { setLinkedBank(JSON.parse(storedBank)); } catch { setLinkedBank(null); }
            } else { setLinkedBank(null); }
        }

        // Load SaralPay offline wallet
        const storedWallet2 = localStorage.getItem(uKey("upa_saral_pay"));
        if (storedWallet2) {
            try { setOfflineWalletState(JSON.parse(storedWallet2)); } catch { /* ignore */ }
        } else {
            // Migrate from old offline limit if it exists
            const oldLimit = localStorage.getItem(uKey("upa_offline_limit"));
            if (oldLimit) {
                try {
                    const parsed = JSON.parse(oldLimit);
                    const migrated: OfflineWallet = {
                        loaded: parsed.currentUsed > 0 || parsed.maxAmount > 0,
                        balance: parsed.maxAmount - (parsed.currentUsed || 0),
                        initialLoadAmount: parsed.maxAmount || 5000,
                        loadedAt: parsed.lastReset || Date.now(),
                        lastReset: parsed.lastReset || Date.now(),
                    };
                    setOfflineWalletState(migrated);
                    localStorage.setItem(uKey("upa_saral_pay"), JSON.stringify(migrated));
                    localStorage.removeItem(uKey("upa_offline_limit"));
                } catch {
                    setOfflineWalletState({ loaded: false, balance: 0, initialLoadAmount: 0, loadedAt: 0, lastReset: Date.now() });
                }
            } else {
                setOfflineWalletState({ loaded: false, balance: 0, initialLoadAmount: 0, loadedAt: 0, lastReset: Date.now() });
            }
        }

        // Load wallet — per-user initial balance
        const initialBalance = uid ? (CITIZEN_INITIAL_BALANCE[uid] ?? 50000) : 50000;
        const stored = localStorage.getItem(uKey("upa_wallet"));
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setWallet(parsed);
                setBalance(parsed.balance ?? initialBalance);
            } catch {
                createNewWallet(initialBalance);
            }
        } else {
            createNewWallet(initialBalance);
        }

        // Load transactions
        const storedTx = localStorage.getItem(uKey("upa_transactions"));
        if (storedTx) {
            try { setTransactions(JSON.parse(storedTx)); } catch { setTransactions([]); }
        } else { setTransactions([]); }
    };

    const createNewWallet = async (initialBalance: number = 50000) => {
        if (typeof window === "undefined") return;

        const { publicKey, privateKey } = generateKeyPair();
        const address = keyToHex(publicKey).slice(0, 20);

        const walletId = localStorage.getItem(uKey("upa_wallet_id")) || `wallet_${Date.now()}`;
        if (!localStorage.getItem(uKey("upa_wallet_id"))) {
            localStorage.setItem(uKey("upa_wallet_id"), walletId);
        }

        const newWallet: Wallet = {
            id: walletId,
            name: "Demo Wallet",
            balance: initialBalance,
            address: `upa_${address}`,
            publicKey: keyToHex(publicKey),
        };

        // Store private key securely (encrypted IndexedDB on web, Keychain on iOS, Keystore on Android)
        await SecureKeyStore.set("upa_private_key", keyToHex(privateKey));

        setWallet(newWallet);
        setBalance(initialBalance);
        localStorage.setItem(uKey("upa_wallet"), JSON.stringify(newWallet));
    };

    const initializeWallet = () => {
        createNewWallet();
    };

    const addTransaction = (transaction: Transaction) => {
        setTransactions((prev) => {
            const updated = [transaction, ...prev];
            localStorage.setItem(uKey("upa_transactions"), JSON.stringify(updated));
            return updated;
        });
    };

    const updateBalance = (amount: number) => {
        setBalance((prev) => {
            const newBalance = prev - amount;
            if (wallet) {
                const updated = { ...wallet, balance: newBalance };
                setWallet(updated);
                localStorage.setItem(uKey("upa_wallet"), JSON.stringify(updated));
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

            // Set active user for scoped storage
            _activeUserId = matchedUser.id;

            // Create authenticated session with role
            const session = {
                user: matchedUser,
                loginAt: Date.now(),
                expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
            };
            localStorage.setItem("upa_auth_session", JSON.stringify(session));
            setIsAuthenticated(true);
            setUser(matchedUser);

            // Load this user's data from scoped storage
            loadUserData(matchedUser);

            // Update wallet name
            const currentWallet = localStorage.getItem(uKey("upa_wallet"));
            if (currentWallet) {
                try {
                    const parsed = JSON.parse(currentWallet);
                    const updated = { ...parsed, name: matchedUser.name };
                    setWallet(updated);
                    localStorage.setItem(uKey("upa_wallet"), JSON.stringify(updated));
                } catch { /* ignore */ }
            }

            return true;
        } catch {
            return false;
        }
    }, []);

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
        localStorage.setItem(uKey("upa_merchant_profile"), JSON.stringify(newProfile));
        return newProfile;
    }, [user]);

    /**
     * Link National ID — accepts a full NIDCard object (from API) or a string to look up locally.
     * When the API returns a verified NID, pass the full object to avoid discarding server data.
     */
    const linkNID = useCallback((nidOrNumber: string | NIDCard): NIDCard | null => {
        let nidCard: NIDCard | null = null;

        if (typeof nidOrNumber === "string") {
            // Fallback: look up in mock database by NID number
            nidCard = MOCK_NID_DATABASE.find(n => n.nidNumber === nidOrNumber) || null;
        } else {
            // Use the full NIDCard object directly (from API/Supabase)
            nidCard = nidOrNumber;
        }

        if (!nidCard) return null;

        setNid(nidCard);
        localStorage.setItem(uKey("upa_nid"), JSON.stringify(nidCard));
        // Auto-link primary bank
        if (nidCard.linkedBanks.length > 0) {
            const primary = nidCard.linkedBanks.find(b => b.isPrimary) || nidCard.linkedBanks[0];
            setLinkedBank(primary);
            localStorage.setItem(uKey("upa_linked_bank"), JSON.stringify(primary));
        }
        return nidCard;
    }, []);

    /**
     * Link a bank account
     */
    const linkBank = useCallback((bank: BankAccount) => {
        setLinkedBank(bank);
        localStorage.setItem(uKey("upa_linked_bank"), JSON.stringify(bank));
    }, []);

    const saralPayBalance = offlineWallet.balance;


    const loadSaralPay = useCallback((amount: number): boolean => {
        if (amount <= 0) return false;
        // Check main balance (get fresh value from state)
        const currentBal = balance;
        if (amount > currentBal) return false;

        // Deduct from main balance
        setBalance((prev) => {
            const newBalance = prev - amount;
            if (wallet) {
                const updated = { ...wallet, balance: newBalance };
                setWallet(updated);
                localStorage.setItem(uKey("upa_wallet"), JSON.stringify(updated));
            }
            return newBalance;
        });

        // Load into SaralPay
        const newWalletState: OfflineWallet = {
            loaded: true,
            balance: offlineWallet.balance + amount,
            initialLoadAmount: offlineWallet.loaded ? offlineWallet.initialLoadAmount + amount : amount,
            loadedAt: Date.now(),
            lastReset: offlineWallet.lastReset,
        };
        setOfflineWalletState(newWalletState);
        localStorage.setItem(uKey("upa_saral_pay"), JSON.stringify(newWalletState));
        return true;
    }, [balance, offlineWallet, wallet]);

    /**
     * Spend from SaralPay wallet — returns true if success, false if insufficient.
     */
    const spendFromSaralPay = useCallback((amount: number): boolean => {
        if (amount <= 0) return false;
        if (amount > offlineWallet.balance) return false;
        const newWalletState: OfflineWallet = {
            ...offlineWallet,
            balance: offlineWallet.balance - amount,
        };
        setOfflineWalletState(newWalletState);
        localStorage.setItem(uKey("upa_saral_pay"), JSON.stringify(newWalletState));
        return true;
    }, [offlineWallet]);

    /**
     * Check if amount can be spent from SaralPay wallet
     */
    const canSpendOffline = useCallback((amount: number): boolean => {
        return offlineWallet.loaded && amount <= offlineWallet.balance;
    }, [offlineWallet]);

    /**
     * Unload SaralPay wallet — returns remaining balance back to main wallet.
     */
    const unloadSaralPay = useCallback(() => {
        const remaining = offlineWallet.balance;

        // Return remaining to main balance
        if (remaining > 0) {
            setBalance((prev) => {
                const newBalance = prev + remaining;
                if (wallet) {
                    const updated = { ...wallet, balance: newBalance };
                    setWallet(updated);
                    localStorage.setItem(uKey("upa_wallet"), JSON.stringify(updated));
                }
                return newBalance;
            });
        }

        // Reset SaralPay wallet
        const resetState: OfflineWallet = {
            loaded: false,
            balance: 0,
            initialLoadAmount: 0,
            loadedAt: 0,
            lastReset: Date.now(),
        };
        setOfflineWalletState(resetState);
        localStorage.setItem(uKey("upa_saral_pay"), JSON.stringify(resetState));
    }, [offlineWallet, wallet]);

    /**
     * Mock deduct from bank (NID-linked bank payment)
     */
    const deductFromBank = useCallback((amount: number) => {
        // In production: call bank API. For demo: no-op.
    }, [linkedBank]);

    const logout = useCallback(() => {
        localStorage.removeItem("upa_auth_session");
        localStorage.removeItem(uKey("upa_merchant_profile"));
        localStorage.removeItem(uKey("upa_nid"));
        localStorage.removeItem(uKey("upa_linked_bank"));
        localStorage.removeItem(uKey("upa_saral_pay"));
        _activeUserId = null;
        setIsAuthenticated(false);
        setUser(null);
        setMerchantProfile(null);
        setNid(null);
        setLinkedBank(null);
    }, []);

    /**
     * Credit another user's wallet & transactions (used for C2C receiver)
     * Works by directly updating the receiver's per-user localStorage
     */
    const creditUser = useCallback((upaAddress: string, amount: number, tx: Transaction) => {
        const receiverId = UPA_TO_USER[upaAddress];
        if (!receiverId) return; // Not a demo user

        // Credit receiver's wallet
        const walletKey = uKeyFor("upa_wallet", receiverId);
        const storedWallet = localStorage.getItem(walletKey);
        if (storedWallet) {
            try {
                const rWallet = JSON.parse(storedWallet);
                rWallet.balance = (rWallet.balance ?? 0) + amount;
                localStorage.setItem(walletKey, JSON.stringify(rWallet));
            } catch { /* ignore */ }
        } else {
            // Receiver hasn't logged in yet — create their wallet with initial balance + credit
            const initBal = CITIZEN_INITIAL_BALANCE[receiverId] ?? 50000;
            localStorage.setItem(walletKey, JSON.stringify({
                id: `wallet_${receiverId}`,
                name: "Demo Wallet",
                balance: initBal + amount,
                address: `upa_${receiverId.slice(0, 20)}`,
                publicKey: "",
            }));
        }

        // Add incoming transaction to receiver's list
        const txKey = uKeyFor("upa_transactions", receiverId);
        const storedTx = localStorage.getItem(txKey);
        let receiverTxs: Transaction[] = [];
        if (storedTx) {
            try { receiverTxs = JSON.parse(storedTx); } catch { /* ignore */ }
        }
        receiverTxs.unshift({
            ...tx,
            id: tx.id + "-received",
            tx_id: (tx.tx_id || tx.id) + "-R",
        });
        localStorage.setItem(txKey, JSON.stringify(receiverTxs));
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
                offlineWallet,
                saralPayBalance,
                initializeWallet,
                addTransaction,
                updateBalance,
                login,
                logout,
                registerMerchant,
                linkNID,
                linkBank,
                loadSaralPay,
                spendFromSaralPay,
                unloadSaralPay,
                canSpendOffline,
                deductFromBank,
                creditUser,
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

