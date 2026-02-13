"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/wallet-context";
import type { UserRole } from "@/types";

interface RouteGuardProps {
    allowedRoles: UserRole[];
    children: React.ReactNode;
}

const ROLE_ROUTES: Record<UserRole, string> = {
    citizen: "/",
    officer: "/officer",
    merchant: "/merchant",
    admin: "/admin",
    superadmin: "/admin",
};

export function RouteGuard({ allowedRoles, children }: RouteGuardProps) {
    const { isAuthenticated, isLoading, role } = useWallet();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        // Not authenticated → go to login
        if (!isAuthenticated || !role) {
            router.replace("/auth");
            return;
        }

        // Wrong role → redirect to their correct dashboard
        if (!allowedRoles.includes(role)) {
            router.replace(ROLE_ROUTES[role]);
        }
    }, [isLoading, isAuthenticated, role, allowedRoles, router]);

    if (isLoading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    // Don't render children if not authenticated or wrong role
    if (!isAuthenticated || !role || !allowedRoles.includes(role)) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    return <>{children}</>;
}
