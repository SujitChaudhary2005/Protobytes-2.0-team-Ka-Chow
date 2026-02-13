"use client";

import { LoginForm } from "@/components/login-form";
import { useWallet } from "@/contexts/wallet-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, LogOut } from "lucide-react";
import type { UserRole } from "@/types";

const ROLE_ROUTES: Record<UserRole, string> = {
    citizen: "/",
    officer: "/officer",
    merchant: "/merchant",
    admin: "/admin",
};

const ROLE_LABELS: Record<UserRole, string> = {
    citizen: "Citizen Dashboard",
    officer: "Gov Office Portal",
    merchant: "Merchant Dashboard",
    admin: "Gov Admin Panel",
};

export default function AuthPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading, user, role, logout } = useWallet();

    // If already authenticated, redirect to the correct dashboard
    useEffect(() => {
        if (!isLoading && isAuthenticated && role) {
            router.replace(ROLE_ROUTES[role]);
        }
    }, [isLoading, isAuthenticated, role, router]);

    if (isLoading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    // Show authenticated state briefly before redirect
    if (isAuthenticated && user && role) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-4">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <div className="text-center">
                    <h2 className="text-xl font-bold">Logged in as {user.name}</h2>
                    <p className="text-muted-foreground">Role: {role}</p>
                </div>
                <div className="flex gap-3">
                    <Button onClick={() => router.push(ROLE_ROUTES[role])}>
                        Go to {ROLE_LABELS[role]}
                    </Button>
                    <Button variant="outline" onClick={logout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-6 md:p-10">
            <div className="w-full max-w-sm md:max-w-3xl">
                <LoginForm />
            </div>
        </div>
    );
}
