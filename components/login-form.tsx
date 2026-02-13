"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useWallet } from "@/contexts/wallet-context";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { UserRole } from "@/types";

const ROLE_ROUTES: Record<UserRole, string> = {
    citizen: "/",
    officer: "/officer",
    merchant: "/merchant",
    admin: "/admin",
    superadmin: "/admin",
};

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
    const router = useRouter();
    const { login } = useWallet();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            toast.error("Please enter both email and password");
            return;
        }

        setLoading(true);
        const success = await login(email, password);
        setLoading(false);

        if (success) {
            // Get the user's role to redirect to the correct dashboard
            const session = localStorage.getItem("upa_auth_session");
            if (session) {
                const s = JSON.parse(session);
                const role = s.user?.role as UserRole;
                toast.success(`Welcome, ${s.user?.name}!`);
                router.push(ROLE_ROUTES[role] || "/");
            }
        } else {
            toast.error("Invalid credentials. Please check your email and password.");
        }
    };

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card className="overflow-hidden">
                <CardContent className="grid p-0 md:grid-cols-2">
                    <form className="p-6 md:p-8" onSubmit={handleSubmit}>
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col items-center text-center">
                                <h1 className="text-2xl font-bold">Welcome to UPA Pay</h1>
                                <p className="text-balance text-muted-foreground">
                                    Login to your Nepal Government Payment account
                                </p>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@gov.np"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Login
                            </Button>

                            <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                                <span className="relative z-10 bg-background px-2 text-muted-foreground">
                                    Quick Access
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                                {[
                                    { label: "Ram Bahadur Thapa", email: "citizen@demo.np", pass: "citizen123" },
                                    { label: "Anita Gurung", email: "citizen2@demo.np", pass: "citizen123" },
                                    { label: "Sita Sharma", email: "officer@demo.np", pass: "officer123" },
                                    { label: "Hari Prasad Oli", email: "merchant@demo.np", pass: "merchant123" },
                                    { label: "Gita Adhikari", email: "admin@demo.np", pass: "admin123" },
                                ].map((demo) => (
                                    <button
                                        key={demo.email}
                                        type="button"
                                        className="rounded-md border p-2 text-left hover:bg-muted transition-colors"
                                        onClick={() => {
                                            setEmail(demo.email);
                                            setPassword(demo.pass);
                                        }}
                                    >
                                        <div className="font-medium">{demo.label}</div>
                                        <div className="text-muted-foreground truncate">{demo.email}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </form>
                    <div className="relative hidden bg-muted md:block">
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /></svg>
                            </div>
                            <h2 className="text-xl font-bold mb-2">UPA Pay</h2>
                            <p className="text-sm text-muted-foreground max-w-[250px]">
                                Unified Payment Address — Secure, offline-capable government payments for Nepal.
                            </p>
                            <div className="mt-6 grid gap-2 text-left text-xs text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                    Ed25519 cryptographic verification
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                    Offline-first with background sync
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                    Intent-locked QR code payments
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <div className="text-balance text-center text-xs text-muted-foreground">
                Government of Nepal — Ministry of Finance
            </div>
        </div>
    );
}
