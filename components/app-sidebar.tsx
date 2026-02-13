"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Wallet,
    ScanLine,
    QrCode,
    Shield,
    Store,
    Building2,
    UserCheck,
    LogOut,
    Settings,
    Smartphone,
    Presentation,
    ArrowLeftRight,
} from "lucide-react";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "@/components/ui/sidebar";
import { NetworkStatus } from "@/components/network-status";
import { OfflineToggle } from "@/components/offline-toggle";
import { useWallet } from "@/contexts/wallet-context";
import type { UserRole } from "@/types";

interface NavItem {
    title: string;
    url: string;
    icon: React.ComponentType<{ className?: string }>;
    roles: UserRole[];
}

const navItems: NavItem[] = [
    {
        title: "Home",
        url: "/",
        icon: Wallet,
        roles: ["citizen"],
    },
    {
        title: "Pay",
        url: "/pay",
        icon: ScanLine,
        roles: ["citizen"],
    },
    {
        title: "Gov Office Portal",
        url: "/officer",
        icon: QrCode,
        roles: ["officer"],
    },
    {
        title: "My Business",
        url: "/merchant",
        icon: Store,
        roles: ["citizen", "merchant"],
    },
    {
        title: "Gov Dashboard",
        url: "/admin",
        icon: Building2,
        roles: ["admin", "superadmin"],
    },
    {
        title: "Settings",
        url: "/settings",
        icon: Settings,
        roles: ["citizen", "officer", "merchant", "admin", "superadmin"],
    },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const pathname = usePathname();
    const { isAuthenticated, user, role, logout } = useWallet();

    const isActive = (url: string) => {
        if (url === "/") return pathname === "/";
        if (url === "/pay") return pathname.startsWith("/pay") && pathname !== "/pay/settings" && pathname !== "/pay/success" && pathname !== "/pay/confirm" && pathname !== "/pay/c2c" && pathname !== "/pay/bills" && pathname !== "/pay/nid" && pathname !== "/pay/queued";
        return pathname.startsWith(url);
    };

    // Filter nav items based on user role
    const visibleNav = role
        ? navItems.filter((item) => item.roles.includes(role))
        : [];

    return (
        <Sidebar variant="inset" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={isAuthenticated ? (role === "citizen" ? "/" : role === "officer" ? "/officer" : role === "merchant" ? "/merchant" : "/admin") : "/auth"}>
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                    <Shield className="size-4" />
                                </div>
                                <div className="flex flex-col gap-0.5 leading-none">
                                    <span className="font-semibold">SaralPay</span>
                                    <span className="text-xs text-muted-foreground">
                                        Nepal Gov Payments
                                    </span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                {visibleNav.length > 0 && (
                    <SidebarGroup>
                        <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {visibleNav.map((item) => (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={isActive(item.url)}
                                            tooltip={item.title}
                                        >
                                            <Link href={item.url}>
                                                <item.icon />
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}

                <SidebarGroup>
                    <SidebarGroupLabel>Account</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {!isAuthenticated ? (
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={isActive("/auth")}
                                        tooltip="Login"
                                    >
                                        <Link href="/auth">
                                            <UserCheck />
                                            <span>Login</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ) : (
                                <>
                                    <SidebarMenuItem>
                                        <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
                                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                                                {user?.name?.charAt(0) || "U"}
                                            </div>
                                            <div className="flex flex-col leading-tight">
                                                <span className="text-xs font-medium truncate">{user?.name}</span>
                                                <span className="text-[10px] text-muted-foreground capitalize">{role}</span>
                                            </div>
                                        </div>
                                    </SidebarMenuItem>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton
                                            tooltip="Logout"
                                            onClick={logout}
                                        >
                                            <LogOut />
                                            <span>Logout</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                </>
                            )}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <div className="flex items-center gap-2 px-2 py-1.5">
                            <NetworkStatus />
                        </div>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}
