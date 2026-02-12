"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [step, setStep] = useState<"login" | "register" | "kyc">("login");
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        nationalId: "",
        fullName: "",
        phone: "",
    });
    const [idFile, setIdFile] = useState<File | null>(null);
    const [idUploaded, setIdUploaded] = useState(false);

    const handleLogin = async () => {
        setLoading(true);
        // Mock login - in production, use Supabase Auth
        setTimeout(() => {
            toast({
                variant: "success",
                title: "Login Successful",
                description: "Welcome back!",
            });
            router.push("/pay");
            setLoading(false);
        }, 1000);
    };

    const handleRegister = async () => {
        if (!formData.email || !formData.password) {
            toast({
                variant: "destructive",
                title: "Missing Fields",
                description: "Please fill in all required fields",
            });
            return;
        }
        setStep("kyc");
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast({
                    variant: "destructive",
                    title: "File Too Large",
                    description: "Please upload a file smaller than 5MB",
                });
                return;
            }
            setIdFile(file);
            // Mock upload
            setTimeout(() => {
                setIdUploaded(true);
                toast({
                    variant: "success",
                    title: "ID Uploaded",
                    description: "Your ID will be verified shortly",
                });
            }, 1000);
        }
    };

    const handleKYCSubmit = async () => {
        if (!formData.nationalId || !idUploaded) {
            toast({
                variant: "destructive",
                title: "Incomplete KYC",
                description: "Please provide National ID and upload ID document",
            });
            return;
        }

        setLoading(true);
        // Mock KYC verification
        setTimeout(() => {
            toast({
                variant: "success",
                title: "KYC Submitted",
                description: "Your account will be activated after verification",
            });
            router.push("/pay");
            setLoading(false);
        }, 1500);
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {step === "login" && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Login</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) =>
                                        setFormData({ ...formData, email: e.target.value })
                                    }
                                    placeholder="user@example.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) =>
                                        setFormData({ ...formData, password: e.target.value })
                                    }
                                    placeholder="••••••••"
                                />
                            </div>
                            <Button
                                className="w-full"
                                onClick={handleLogin}
                                disabled={loading}
                            >
                                {loading ? "Logging in..." : "Login"}
                            </Button>
                            <Button
                                variant="link"
                                className="w-full"
                                onClick={() => setStep("register")}
                            >
                                Don't have an account? Register
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {step === "register" && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Register</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="fullName">Full Name</Label>
                                <Input
                                    id="fullName"
                                    value={formData.fullName}
                                    onChange={(e) =>
                                        setFormData({ ...formData, fullName: e.target.value })
                                    }
                                    placeholder="John Doe"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) =>
                                        setFormData({ ...formData, email: e.target.value })
                                    }
                                    placeholder="user@example.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input
                                    id="phone"
                                    value={formData.phone}
                                    onChange={(e) =>
                                        setFormData({ ...formData, phone: e.target.value })
                                    }
                                    placeholder="+977 98XXXXXXXX"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) =>
                                        setFormData({ ...formData, password: e.target.value })
                                    }
                                    placeholder="••••••••"
                                />
                            </div>
                            <Button
                                className="w-full"
                                onClick={handleRegister}
                                disabled={loading}
                            >
                                {loading ? "Processing..." : "Continue to KYC"}
                            </Button>
                            <Button
                                variant="link"
                                className="w-full"
                                onClick={() => setStep("login")}
                            >
                                Already have an account? Login
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {step === "kyc" && (
                    <Card>
                        <CardHeader>
                            <CardTitle>KYC Verification</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="nationalId">National ID Number</Label>
                                <Input
                                    id="nationalId"
                                    value={formData.nationalId}
                                    onChange={(e) =>
                                        setFormData({ ...formData, nationalId: e.target.value })
                                    }
                                    placeholder="Enter your National ID"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="idFile">Upload ID Document</Label>
                                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                                    <input
                                        type="file"
                                        id="idFile"
                                        accept="image/*,.pdf"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                    <label
                                        htmlFor="idFile"
                                        className="cursor-pointer flex flex-col items-center gap-2"
                                    >
                                        {idUploaded ? (
                                            <>
                                                <CheckCircle2 className="h-8 w-8 text-accent" />
                                                <p className="text-sm font-medium">ID Uploaded</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {idFile?.name}
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="h-8 w-8 text-muted-foreground" />
                                                <p className="text-sm font-medium">
                                                    Click to upload ID document
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    PNG, JPG, PDF up to 5MB
                                                </p>
                                            </>
                                        )}
                                    </label>
                                </div>
                            </div>

                            <Button
                                className="w-full"
                                onClick={handleKYCSubmit}
                                disabled={loading || !idUploaded}
                            >
                                {loading ? "Submitting..." : "Submit for Verification"}
                            </Button>
                            <Button
                                variant="link"
                                className="w-full"
                                onClick={() => setStep("register")}
                            >
                                Back
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}

