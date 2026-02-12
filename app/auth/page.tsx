"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from "@/contexts/wallet-context";
import { toast } from "sonner";
import {
    Shield,
    Phone,
    CreditCard,
    Loader2,
    ArrowRight,
    CheckCircle2,
    KeyRound,
} from "lucide-react";

type AuthStep = "credentials" | "otp" | "success";

export default function AuthPage() {
    const router = useRouter();
    const { login, isAuthenticated, logout } = useWallet();

    const [step, setStep] = useState<AuthStep>("credentials");
    const [citizenshipId, setCitizenshipId] = useState("");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [generatedOtp, setGeneratedOtp] = useState("");
    const [loading, setLoading] = useState(false);

    // If already authenticated, show session info
    if (isAuthenticated) {
        return (
            <div className="p-4 md:p-6">
                <Card>
                    <CardContent className="p-8 text-center space-y-6">
                        <div className="mx-auto w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
                            <CheckCircle2 className="h-10 w-10 text-success" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">Authenticated</h2>
                            <p className="text-muted-foreground mt-1">
                                Your identity has been verified. You can now make secure payments.
                            </p>
                        </div>
                        <div className="flex gap-3 justify-center">
                            <Button onClick={() => router.push("/")}>
                                Go to Payments
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    logout();
                                    toast.success("Logged out");
                                }}
                            >
                                Log Out
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const handleSendOtp = async () => {
        // Validate citizenship ID
        const cidPattern = /^\d{2}-\d{2}-\d{2}-\d{5}$/;
        if (!cidPattern.test(citizenshipId)) {
            toast.error("Invalid Citizenship ID", {
                description: "Format: XX-XX-XX-XXXXX (e.g. 01-01-76-12345)",
            });
            return;
        }

        // Validate phone
        const cleanPhone = phone.replace(/[\s-]/g, "");
        const phonePattern = /^(\+977)?9\d{9}$/;
        if (!phonePattern.test(cleanPhone)) {
            toast.error("Invalid Phone Number", {
                description: "Enter a valid Nepali number (98XXXXXXXX)",
            });
            return;
        }

        setLoading(true);
        try {
            // In production: call Supabase Auth signInWithOtp({ phone })
            // For demo: generate a 6-digit OTP locally
            await new Promise((r) => setTimeout(r, 1000));
            const demoOtp = String(Math.floor(100000 + Math.random() * 900000));
            setGeneratedOtp(demoOtp);

            toast.success("OTP Sent", {
                description: `Demo OTP: ${demoOtp} (in production, this goes via SMS)`,
                duration: 10000,
            });
            setStep("otp");
        } catch {
            toast.error("Failed to send OTP");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (otp !== generatedOtp) {
            toast.error("Invalid OTP", { description: "Please check and try again" });
            return;
        }

        setLoading(true);
        try {
            const success = await login(citizenshipId, phone);
            if (success) {
                setStep("success");
                toast.success("Identity Verified", {
                    description: "Welcome to UPA Pay!",
                });
                setTimeout(() => router.push("/"), 1500);
            } else {
                toast.error("Verification Failed", {
                    description: "Please check your credentials",
                });
            }
        } catch {
            toast.error("Authentication failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div>
                <h2 className="text-2xl font-semibold">Identity Verification</h2>
                <p className="text-sm text-muted-foreground">
                    Verify your identity using your Nepali Citizenship ID and phone number
                </p>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center gap-2">
                {["Credentials", "OTP Verify", "Done"].map((label, i) => {
                    const stepIndex = ["credentials", "otp", "success"].indexOf(step);
                    const isActive = i === stepIndex;
                    const isDone = i < stepIndex;
                    return (
                        <div key={label} className="flex items-center gap-2 flex-1">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isDone
                                    ? "bg-success text-success-foreground"
                                    : isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground"
                                    }`}
                            >
                                {isDone ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                            </div>
                            <span className={`text-xs hidden sm:inline ${isActive ? "font-semibold" : "text-muted-foreground"}`}>
                                {label}
                            </span>
                            {i < 2 && <div className="flex-1 h-px bg-border" />}
                        </div>
                    );
                })}
            </div>

            {step === "credentials" && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            Enter Credentials
                        </CardTitle>
                        <CardDescription>
                            Provide your Nepali Citizenship ID and registered phone number
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="citizenshipId">Citizenship ID Number</Label>
                            <Input
                                id="citizenshipId"
                                placeholder="XX-XX-XX-XXXXX (e.g. 01-01-76-12345)"
                                value={citizenshipId}
                                onChange={(e) => setCitizenshipId(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                District-Ward-Year-Serial format
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <div className="flex gap-2">
                                <div className="flex items-center px-3 bg-muted rounded-md text-sm font-mono">
                                    +977
                                </div>
                                <Input
                                    id="phone"
                                    placeholder="98XXXXXXXX"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    type="tel"
                                    maxLength={10}
                                />
                            </div>
                        </div>
                        <Button
                            className="w-full"
                            onClick={handleSendOtp}
                            disabled={loading || !citizenshipId || !phone}
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Phone className="h-4 w-4 mr-2" />
                            )}
                            Send OTP
                        </Button>
                    </CardContent>
                </Card>
            )}

            {step === "otp" && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <KeyRound className="h-5 w-5" />
                            Verify OTP
                        </CardTitle>
                        <CardDescription>
                            Enter the 6-digit code sent to +977 {phone}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="otp">One-Time Password</Label>
                            <Input
                                id="otp"
                                placeholder="Enter 6-digit OTP"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                type="text"
                                maxLength={6}
                                className="text-center text-2xl tracking-[0.5em] font-mono"
                            />
                        </div>
                        <Button
                            className="w-full"
                            onClick={handleVerifyOtp}
                            disabled={loading || otp.length !== 6}
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <ArrowRight className="h-4 w-4 mr-2" />
                            )}
                            Verify & Login
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full text-muted-foreground"
                            onClick={() => setStep("credentials")}
                        >
                            Back to credentials
                        </Button>
                    </CardContent>
                </Card>
            )}

            {step === "success" && (
                <Card>
                    <CardContent className="p-8 text-center space-y-4">
                        <div className="mx-auto w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
                            <Shield className="h-10 w-10 text-success" />
                        </div>
                        <h3 className="text-xl font-bold">Identity Verified!</h3>
                        <p className="text-muted-foreground">Redirecting to payments...</p>
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                    </CardContent>
                </Card>
            )}

            {/* Security Info */}
            <Card className="bg-muted/30">
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div className="text-xs text-muted-foreground space-y-1">
                            <p className="font-medium text-foreground">Security Notice</p>
                            <p>Your private keys are stored in the device&apos;s secure enclave (iOS Keychain / Android Keystore). On web browsers, keys are encrypted with AES-256-GCM in IndexedDB.</p>
                            <p>Citizenship ID verification is powered by Nepal&apos;s national identity infrastructure.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
