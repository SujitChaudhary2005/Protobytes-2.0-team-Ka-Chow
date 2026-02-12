"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Wallet, Transaction } from "@/types";
import { ed25519 } from "@noble/ed25519";

interface WalletContextType {
    wallet: Wallet | null;
    transactions: Transaction[];
    balance: number;
    initializeWallet: () => Promise<void>;
    addTransaction: (transaction: Transaction) => void;
    updateBalance: (amount: number) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [balance, setBalance] = useState(50000); // Demo balance
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);

        if (typeof window === "undefined") return;

        // Load wallet from localStorage
        const stored = localStorage.getItem("upa_wallet");
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setWallet(parsed);
                setBalance(parsed.balance || 50000);
            } catch {
                initializeWallet();
            }
        } else {
            initializeWallet();
        }

        // Load transactions
        const storedTx = localStorage.getItem("upa_transactions");
        if (storedTx) {
            try {
                setTransactions(JSON.parse(storedTx));
            } catch { }
        }
    }, []);

    const initializeWallet = async () => {
        if (typeof window === "undefined") return;

        const privateKey = ed25519.utils.randomPrivateKey();
        const publicKey = ed25519.getPublicKey(privateKey);
        const address = Array.from(publicKey)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
            .slice(0, 20);

        // Use a stable ID to prevent hydration mismatches
        const walletId = localStorage.getItem("upa_wallet_id") || `wallet_${Date.now()}`;
        if (!localStorage.getItem("upa_wallet_id")) {
            localStorage.setItem("upa_wallet_id", walletId);
        }

        const newWallet: Wallet = {
            id: walletId,
            name: "Demo Wallet",
            balance: 50000,
            address: `upa_${address}`,
            publicKey: Array.from(publicKey)
                .map((b) => b.toString(16).padStart(2, "0"))
                .join(""),
        };

        localStorage.setItem(
            "upa_private_key",
            Array.from(privateKey)
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("")
        );

        setWallet(newWallet);
        localStorage.setItem("upa_wallet", JSON.stringify(newWallet));
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

    return (
        <WalletContext.Provider
            value={{
                wallet,
                transactions,
                balance,
                initializeWallet,
                addTransaction,
                updateBalance,
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

