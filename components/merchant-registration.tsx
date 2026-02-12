"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWallet } from "@/contexts/wallet-context";
import { toast } from "sonner";
import { Store, Building2, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";

const BUSINESS_TYPES = [
    "Restaurant & Cafe",
    "Retail & Shopping",
    "Technology & IT",
    "Tourism & Hospitality",
    "Health & Pharmacy",
    "Education & Training",
    "Transportation",
    "Manufacturing",
    "Services & Consulting",
    "Agriculture",
    "Other",
];

interface MerchantRegistrationProps {
    onRegistered: () => void;
}

export function MerchantRegistration({ onRegistered }: MerchantRegistrationProps) {
    const { registerMerchant, user } = useWallet();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [form, setForm] = useState({
        businessName: "",
        businessType: "",
        ward: "",
        address: "",
        phone: user?.phone ?? "",
        panNumber: "",
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!form.businessName.trim()) newErrors.businessName = "Business name is required";
        if (!form.businessType) newErrors.businessType = "Select a business type";
        if (!form.ward.trim()) newErrors.ward = "Ward number is required";
        else if (isNaN(Number(form.ward)) || Number(form.ward) < 1 || Number(form.ward) > 32)
            newErrors.ward = "Enter a valid ward number (1–32)";
        if (!form.address.trim()) newErrors.address = "Address is required";
        if (!form.phone.trim()) newErrors.phone = "Phone number is required";
        else if (!/^\+?977\d{10}$/.test(form.phone.replace(/\s/g, "")))
            newErrors.phone = "Enter a valid Nepali phone number";
        if (!form.panNumber.trim()) newErrors.panNumber = "PAN / VAT number is required";
        else if (!/^\d{9}$/.test(form.panNumber.trim()))
            newErrors.panNumber = "PAN must be 9 digits";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setIsSubmitting(true);
        // Simulate network delay for realistic feel
        await new Promise((r) => setTimeout(r, 800));

        const profile = registerMerchant({
            businessName: form.businessName.trim(),
            businessType: form.businessType,
            ward: form.ward.trim(),
            address: form.address.trim(),
            phone: form.phone.trim(),
            panNumber: form.panNumber.trim(),
        });

        setIsSubmitting(false);

        toast.success("Merchant Registered!", {
            description: `Your UPA address: ${profile.upaAddress}`,
        });

        onRegistered();
    };

    const updateField = (field: string, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] p-4 md:p-8">
            {/* Header */}
            <div className="text-center mb-8 max-w-lg">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
                    <Store className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Register Your Business</h1>
                <p className="text-muted-foreground mt-2">
                    Set up your merchant account to accept UPA payments. Fill in the details
                    below to get your unique merchant UPA address.
                </p>
            </div>

            {/* Form */}
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Building2 className="w-5 h-5" />
                        Business Details
                    </CardTitle>
                    <CardDescription>
                        All fields are required for merchant verification.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Business Name */}
                        <div className="space-y-2">
                            <Label htmlFor="businessName">Business Name</Label>
                            <Input
                                id="businessName"
                                placeholder="e.g. Himalayan Cafe & Restaurant"
                                value={form.businessName}
                                onChange={(e) => updateField("businessName", e.target.value)}
                                className={errors.businessName ? "border-red-500" : ""}
                            />
                            {errors.businessName && (
                                <p className="text-xs text-red-500">{errors.businessName}</p>
                            )}
                        </div>

                        {/* Business Type */}
                        <div className="space-y-2">
                            <Label htmlFor="businessType">Business Type</Label>
                            <Select
                                value={form.businessType}
                                onValueChange={(v) => updateField("businessType", v)}
                            >
                                <SelectTrigger className={errors.businessType ? "border-red-500" : ""}>
                                    <SelectValue placeholder="Select business category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {BUSINESS_TYPES.map((t) => (
                                        <SelectItem key={t} value={t}>
                                            {t}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.businessType && (
                                <p className="text-xs text-red-500">{errors.businessType}</p>
                            )}
                        </div>

                        {/* Ward + Phone — side by side */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="ward">Ward Number</Label>
                                <Input
                                    id="ward"
                                    placeholder="e.g. 10"
                                    value={form.ward}
                                    onChange={(e) => updateField("ward", e.target.value)}
                                    className={errors.ward ? "border-red-500" : ""}
                                />
                                {errors.ward && (
                                    <p className="text-xs text-red-500">{errors.ward}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input
                                    id="phone"
                                    placeholder="+9779841000000"
                                    value={form.phone}
                                    onChange={(e) => updateField("phone", e.target.value)}
                                    className={errors.phone ? "border-red-500" : ""}
                                />
                                {errors.phone && (
                                    <p className="text-xs text-red-500">{errors.phone}</p>
                                )}
                            </div>
                        </div>

                        {/* Address */}
                        <div className="space-y-2">
                            <Label htmlFor="address">Business Address</Label>
                            <Input
                                id="address"
                                placeholder="e.g. Thamel, Kathmandu"
                                value={form.address}
                                onChange={(e) => updateField("address", e.target.value)}
                                className={errors.address ? "border-red-500" : ""}
                            />
                            {errors.address && (
                                <p className="text-xs text-red-500">{errors.address}</p>
                            )}
                        </div>

                        {/* PAN / VAT */}
                        <div className="space-y-2">
                            <Label htmlFor="panNumber">PAN / VAT Number</Label>
                            <Input
                                id="panNumber"
                                placeholder="e.g. 123456789"
                                maxLength={9}
                                value={form.panNumber}
                                onChange={(e) => updateField("panNumber", e.target.value)}
                                className={errors.panNumber ? "border-red-500" : ""}
                            />
                            {errors.panNumber && (
                                <p className="text-xs text-red-500">{errors.panNumber}</p>
                            )}
                        </div>

                        {/* Generated UPA Preview */}
                        {form.businessName.trim() && (
                            <div className="rounded-lg border bg-muted/50 p-3">
                                <p className="text-xs text-muted-foreground mb-1">Your merchant UPA will be:</p>
                                <p className="text-sm font-mono font-medium text-primary">
                                    {form.businessName
                                        .toLowerCase()
                                        .replace(/[^a-z0-9]+/g, "-")
                                        .replace(/^-|-$/g, "")}
                                    @merchant.np
                                </p>
                            </div>
                        )}

                        {/* Submit */}
                        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Registering…
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Register Business
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Info footer */}
            <p className="text-xs text-muted-foreground text-center mt-6 max-w-md">
                By registering, you agree to comply with Nepal Rastra Bank&apos;s merchant
                guidelines. Your business details will be verified by local ward authorities.
            </p>
        </div>
    );
}
