import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { WalletProvider } from "@/contexts/wallet-context";
import { ClientProviders } from "@/components/client-providers";
import { AppShell } from "@/components/app-shell";

const inter = Inter({ subsets: ["latin"] });

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
            <body className={`${inter.className} antialiased`} suppressHydrationWarning>
                <WalletProvider>
                    <AppShell>
                        {children}
                    </AppShell>
                </WalletProvider>
                <Toaster />
                <ClientProviders />
            </body>
        </html>
    );
}

