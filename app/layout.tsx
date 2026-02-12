import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { WalletProvider } from "@/contexts/wallet-context";
import { ClientProviders } from "@/components/client-providers";

export const metadata: Metadata = {
    title: "UPA Pay - Unified Payment Address for Nepal",
    description: "Offline-capable government payment system using intent-locked QR codes and Ed25519 cryptographic verification.",
    manifest: "/manifest.json",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <meta name="theme-color" content="#2563EB" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="default" />
                <link rel="apple-touch-icon" href="/icons/icon-192.png" />
            </head>
            <body className="font-sans antialiased" suppressHydrationWarning>
                <WalletProvider>
                    <SidebarProvider>
                        <AppSidebar />
                        <SidebarInset>
                            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
                                <SidebarTrigger className="-ml-1" />
                                <Separator orientation="vertical" className="mr-2 h-4" />
                                <div className="flex items-center gap-2">
                                    <h1 className="text-sm font-semibold text-primary">UPA Pay</h1>
                                    <span className="text-xs text-muted-foreground hidden sm:inline">
                                        Unified Payment Address for Nepal
                                    </span>
                                </div>
                            </header>
                            <main className="flex-1 overflow-auto">
                                {children}
                            </main>
                        </SidebarInset>
                    </SidebarProvider>
                </WalletProvider>
                <Toaster />
                <ClientProviders />
            </body>
        </html>
    );
}

