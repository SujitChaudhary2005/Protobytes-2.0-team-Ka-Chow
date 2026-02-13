"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/wallet-context";
import type { UserRole } from "@/types";

const ROLE_ROUTES: Record<UserRole, string> = {
    citizen: "/",
    officer: "/officer",
    merchant: "/merchant",
    admin: "/admin",
    superadmin: "/admin",
};

export default function DashboardPage() {
    const router = useRouter();
    const { role, isAuthenticated, isLoading } = useWallet();

    useEffect(() => {
        if (isLoading) return;

        if (!isAuthenticated || !role) {
            router.replace("/auth");
            return;
        }

        router.replace(ROLE_ROUTES[role]);
    }, [isLoading, isAuthenticated, role, router]);

    return (
        <div className="flex min-h-[50vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
    );
}
