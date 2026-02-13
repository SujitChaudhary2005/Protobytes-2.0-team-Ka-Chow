"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Wallet,
    ScanLine,
    QrCode,
    Store,
    Building2,
    UserCheck,
    MoreHorizontal,
    LogOut,
    Wifi,
    WifiOff,
    Shield,
    Settings,
    X,
    Smartphone,
} from "lucide-react";
import { useWallet } from "@/contexts/wallet-context";
import { useNetwork } from "@/hooks/use-network";
import type { UserRole } from "@/types";
import { cn } from "@/lib/utils";

interface BottomNavItem {
    label: string;
    shortLabel: string;
    url: string;
    icon: React.ComponentType<{ className?: string }>;
    roles: UserRole[];
}

const bottomNavItems: BottomNavItem[] = [
    {
        label: "Home",
        shortLabel: "Home",
        url: "/",
        icon: Wallet,
        roles: ["citizen"],
    },
    {
        label: "Pay",
        shortLabel: "Pay",
        url: "/pay",
        icon: ScanLine,
        roles: ["citizen", "officer", "merchant"],
    },
    {
        label: "My Business",
        shortLabel: "Business",
        url: "/merchant",
        icon: Store,
        roles: ["citizen", "merchant"],
    },
    {
        label: "Gov Office Portal",
        shortLabel: "Office",
        url: "/officer",
        icon: QrCode,
        roles: ["officer"],
    },
    {
        label: "Gov Dashboard",
        shortLabel: "Admin",
        url: "/admin",
        icon: Building2,
        roles: ["admin", "superadmin"],
    },
    {
        label: "Settings",
        shortLabel: "Settings",
        url: "/settings",
        icon: Settings,
        roles: ["citizen", "officer", "merchant", "admin", "superadmin"],
    },
];

export function BottomNav() {
    const pathname = usePathname();
    const { isAuthenticated, role, user, logout } = useWallet();
    const { online: isOnline } = useNetwork();
    const [moreOpen, setMoreOpen] = useState(false);

    const isActive = (url: string) => {
        if (url === "/") return pathname === "/";
        if (url === "/pay") return pathname.startsWith("/pay") && pathname !== "/pay/settings" && pathname !== "/pay/success" && pathname !== "/pay/confirm" && pathname !== "/pay/c2c" && pathname !== "/pay/bills" && pathname !== "/pay/nid" && pathname !== "/pay/queued";
        return pathname.startsWith(url);
    };

    // Build visible items based on auth + role
    const visibleItems: BottomNavItem[] = [];

    if (!isAuthenticated) {
        visibleItems.push({
            label: "Login",
            shortLabel: "Login",
            url: "/auth",
            icon: UserCheck,
            roles: [],
        });
    } else if (role) {
        visibleItems.push(
            ...bottomNavItems.filter((item) => item.roles.includes(role))
        );
    }

    if (visibleItems.length === 0 && !isAuthenticated) return null;

    return (
        <>
            {/* More sheet overlay */}
            {moreOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden"
                    onClick={() => setMoreOpen(false)}
                />
            )}

            {/* More sheet */}
            <div
                className={cn(
                    "fixed bottom-0 left-0 right-0 z-50 md:hidden transition-transform duration-300 ease-out",
                    moreOpen ? "translate-y-0" : "translate-y-full"
                )}
            >
                <div className="mx-3 mb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] rounded-2xl border border-border/60 bg-background shadow-xl overflow-hidden">
                    {/* Sheet header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                        <span className="text-sm font-semibold">More</span>
                        <button
                            onClick={() => setMoreOpen(false)}
                            className="p-1 rounded-lg hover:bg-muted transition-colors"
                        >
                            <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                    </div>

                    {/* User card */}
                    {isAuthenticated && user && (
                        <div className="px-4 py-3 border-b">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                                    {user.name?.charAt(0) || "U"}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{user.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                </div>
                                <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                    {role}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Status row */}
                    <div className="px-4 py-2.5 border-b flex items-center gap-2 text-xs text-muted-foreground">
                        {isOnline ? (
                            <Wifi className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                            <WifiOff className="h-3.5 w-3.5 text-orange-500" />
                        )}
                        <span>{isOnline ? "Online" : "Offline"}</span>
                        <span className="mx-1">·</span>
                        <Shield className="h-3.5 w-3.5" />
                        <span>v1.0.0</span>
                    </div>

                    {/* Actions */}
                    {isAuthenticated && (
                        <div className="p-2">
                            <button
                                onClick={() => {
                                    logout();
                                    setMoreOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors"
                            >
                                <LogOut className="h-4 w-4" />
                                <span className="font-medium">Logout</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom nav bar */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
                <div className="mx-3 mb-3 rounded-2xl border border-border/60 bg-background/80 backdrop-blur-xl shadow-lg shadow-black/10">
                    <div className="flex items-center justify-around px-1 py-1.5">
                        {visibleItems.map((item) => {
                            const active = isActive(item.url);
                            return (
                                <Link
                                    key={item.url}
                                    href={item.url}
                                    onClick={() => setMoreOpen(false)}
                                    className={cn(
                                        "relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 transition-all duration-200",
                                        active
                                            ? "text-primary"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {active && (
                                        <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-1 w-6 rounded-full bg-primary" />
                                    )}
                                    <item.icon
                                        className={cn(
                                            "h-5 w-5 transition-transform duration-200",
                                            active && "scale-110"
                                        )}
                                    />
                                    <span className="text-[10px] font-medium leading-none">
                                        {item.shortLabel}
                                    </span>
                                </Link>
                            );
                        })}

                        {/* More button */}
                        {isAuthenticated && (
                            <button
                                onClick={() => setMoreOpen(!moreOpen)}
                                className={cn(
                                    "relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 transition-all duration-200",
                                    moreOpen
                                        ? "text-primary"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {moreOpen && (
                                    <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-1 w-6 rounded-full bg-primary" />
                                )}
                                {user ? (
                                    <div className={cn(
                                        "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold transition-transform duration-200",
                                        moreOpen ? "bg-primary text-primary-foreground scale-110" : "bg-muted-foreground/20 text-muted-foreground"
                                    )}>
                                        {user.name?.charAt(0) || "U"}
                                    </div>
                                ) : (
                                    <MoreHorizontal className={cn("h-5 w-5 transition-transform duration-200", moreOpen && "scale-110")} />
                                )}
                                <span className="text-[10px] font-medium leading-none">More</span>
                            </button>
                        )}
                    </div>
                </div>
                <div className="h-[env(safe-area-inset-bottom,0px)] bg-transparent" />
            </nav>
        </>
    );
}
