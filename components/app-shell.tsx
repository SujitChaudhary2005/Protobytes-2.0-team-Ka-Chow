"use client";

import { usePathname } from "next/navigation";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { BottomNav } from "@/components/bottom-nav";
import { OfflineToggle } from "@/components/offline-toggle";
import { NetworkStatusBadge } from "@/components/network-status-badge";

// Routes that should NOT show the sidebar/header
const FULL_SCREEN_ROUTES = ["/auth", "/demo"];

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isFullScreen = FULL_SCREEN_ROUTES.some((r) => pathname.startsWith(r));

    if (isFullScreen) {
        return <>{children}</>;
    }

    return (
        <SidebarProvider>
            {/* Sidebar only visible on md+ screens */}
            <div className="hidden md:contents">
                <AppSidebar />
            </div>
            <SidebarInset>
                <header className="hidden md:flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
                    <div className="flex items-center gap-2">
                        <SidebarTrigger className="-ml-1" />
                        <Separator orientation="vertical" className="mr-2 h-4" />
                        <h1 className="text-sm font-semibold text-primary">SaralPay</h1>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                            Unified Payment Address for Nepal
                        </span>
                    </div>
                    <OfflineToggle />
                </header>
                {/* Mobile header — compact with network toggle */}
                <header className="flex md:hidden h-12 shrink-0 items-center justify-between border-b px-4">
                    <h1 className="text-sm font-semibold text-primary">SaralPay</h1>
                    <OfflineToggle />
                </header>
                <main className="flex-1 overflow-auto pb-24 md:pb-0">
                    {children}
                </main>
            </SidebarInset>
            <BottomNav />
            <NetworkStatusBadge />
        </SidebarProvider>
    );
}

