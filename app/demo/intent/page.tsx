"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    ArrowRight,
    ArrowLeftRight,
    FileText,
    Zap,
    Tag,
    Hash,
    User,
    Building2,
    Clock,
    XCircle,
    CheckCircle2,
    HelpCircle,
} from "lucide-react";

// Traditional payment example
const TRADITIONAL_PAYMENT = {
    label: "Traditional Payment",
    color: "border-red-500/30 bg-red-50/50 dark:bg-red-950/20",
    headerColor: "bg-red-500/10 text-red-700 dark:text-red-400",
    fields: [
        { key: "Transaction ID", value: "TXN-849271", icon: Hash },
        { key: "Amount", value: "NPR 2,500", icon: FileText },
        { key: "Sender", value: "Ram Thapa", icon: User },
        { key: "Receiver", value: "Acct: 12345678", icon: Building2 },
        { key: "Date", value: "2025-02-10", icon: Clock },
        { key: "Reference", value: "—", icon: HelpCircle },
    ],
    problems: [
        "No payment purpose — why was this paid?",
        "Manual matching to receipts required",
        "No metadata for audit trail",
        "Requires human review for reconciliation",
    ],
};

// SaralPay intent-based payment
const INTENT_PAYMENT = {
    label: "SaralPay Intent Payment",
    color: "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20",
    headerColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    fields: [
        { key: "UPA Address", value: "dotm.kathmandu@upa.np", icon: Building2, highlight: true },
        { key: "Amount", value: "NPR 2,500", icon: FileText },
        { key: "Intent", value: "license_renewal", icon: Tag, highlight: true },
        { key: "Intent Label", value: "Vehicle License Renewal", icon: Zap, highlight: true },
        { key: "Category", value: "government / transport", icon: Tag, highlight: true },
        { key: "Payer Name", value: "Ram Thapa", icon: User },
        { key: "License #", value: "LIC-ABC-1234", icon: Hash, highlight: true },
        { key: "Vehicle Type", value: "Motorcycle", icon: FileText, highlight: true },
        { key: "Nonce", value: "a3f8...b2c1", icon: Hash },
        { key: "Timestamp", value: "2025-02-10T14:32:00Z", icon: Clock },
    ],
    benefits: [
        "Self-describing payment — purpose is built in",
        "Auto-groups in dashboard by intent",
        "Structured metadata for audit",
        "100% reconciliation rate — zero manual work",
    ],
};

export default function IntentVisualizationPage() {
    const [showAnimation, setShowAnimation] = useState(false);
    const [activeTab, setActiveTab] = useState<"side-by-side" | "overlay">("side-by-side");

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    INTENT VISUALIZATION
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                    Traditional vs Intent-Based Payments
                </h1>
                <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                    See the difference between a standard bank transfer and
                    a SaralPay intent-tagged payment. Every payment carries its purpose.
                </p>
            </div>

            {/* Tab switcher */}
            <div className="flex justify-center gap-1 p-1 bg-muted rounded-lg w-fit mx-auto">
                <button
                    onClick={() => setActiveTab("side-by-side")}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === "side-by-side"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                >
                    Side by Side
                </button>
                <button
                    onClick={() => setActiveTab("overlay")}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === "overlay"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                >
                    Data Comparison
                </button>
            </div>

            {activeTab === "side-by-side" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    {/* Traditional Payment */}
                    <Card className={`${TRADITIONAL_PAYMENT.color} border-2`}>
                        <CardHeader className="pb-3">
                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold w-fit ${TRADITIONAL_PAYMENT.headerColor}`}>
                                <FileText className="h-3.5 w-3.5" />
                                {TRADITIONAL_PAYMENT.label}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                {TRADITIONAL_PAYMENT.fields.map((field, i) => (
                                    <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-background/60 border border-border/50">
                                        <div className="flex items-center gap-2">
                                            <field.icon className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">{field.key}</span>
                                        </div>
                                        <span className="text-sm font-medium font-mono">{field.value}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t pt-3 space-y-2">
                                <h4 className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
                                    Problems
                                </h4>
                                {TRADITIONAL_PAYMENT.problems.map((p, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                        <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                                        <span>{p}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Arrow indicator (hidden on mobile) */}
                    <div className="hidden md:flex items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                        {/* This is just conceptual, handled by gap */}
                    </div>

                    {/* SaralPay Intent Payment */}
                    <Card className={`${INTENT_PAYMENT.color} border-2`}>
                        <CardHeader className="pb-3">
                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold w-fit ${INTENT_PAYMENT.headerColor}`}>
                                <Zap className="h-3.5 w-3.5" />
                                {INTENT_PAYMENT.label}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                {INTENT_PAYMENT.fields.map((field, i) => (
                                    <div
                                        key={i}
                                        className={`flex items-center justify-between py-1.5 px-3 rounded-lg border ${field.highlight
                                            ? "bg-emerald-500/5 border-emerald-500/30"
                                            : "bg-background/60 border-border/50"
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <field.icon className={`h-3.5 w-3.5 ${field.highlight ? "text-emerald-600" : "text-muted-foreground"}`} />
                                            <span className={`text-xs ${field.highlight ? "text-emerald-700 dark:text-emerald-400 font-medium" : "text-muted-foreground"}`}>
                                                {field.key}
                                            </span>
                                        </div>
                                        <span className={`text-sm font-medium font-mono ${field.highlight ? "text-emerald-700 dark:text-emerald-300" : ""}`}>
                                            {field.value}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t pt-3 space-y-2">
                                <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                    Benefits
                                </h4>
                                {INTENT_PAYMENT.benefits.map((b, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                        <span>{b}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === "overlay" && (
                <Card className="border-2">
                    <CardHeader>
                        <CardTitle className="text-base">Data Fields Comparison</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">Field</th>
                                        <th className="text-left py-2 px-3 text-xs font-semibold text-red-600 dark:text-red-400 uppercase">Traditional</th>
                                        <th className="text-left py-2 px-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase">SaralPay</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {[
                                        { field: "Payment Purpose", trad: "❌ Not included", saral: "✅ intent: license_renewal" },
                                        { field: "Category", trad: "❌ None", saral: "✅ government / transport" },
                                        { field: "Structured Address", trad: "❌ Account number only", saral: "✅ dotm.kathmandu@upa.np" },
                                        { field: "Custom Metadata", trad: "❌ Free-text reference", saral: "✅ Schema-validated fields" },
                                        { field: "Offline Support", trad: "❌ Requires connectivity", saral: "✅ Ed25519 signed QR" },
                                        { field: "Auto-Reconciliation", trad: "❌ Manual matching", saral: "✅ Groups by intent+entity" },
                                        { field: "Audit Trail", trad: "⚠ Partial", saral: "✅ Full crypto + metadata" },
                                        { field: "Reconciliation Rate", trad: "Varies", saral: "100% (auto-grouped)" },
                                    ].map((row, i) => (
                                        <tr key={i} className="hover:bg-muted/30 transition-colors">
                                            <td className="py-2 px-3 font-medium text-sm">{row.field}</td>
                                            <td className="py-2 px-3 text-sm text-red-600/80 dark:text-red-400/80">{row.trad}</td>
                                            <td className="py-2 px-3 text-sm text-emerald-600/80 dark:text-emerald-400/80 font-medium">{row.saral}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Impact summary */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "Traditional", value: "Varies", desc: "Reconciliation", color: "text-red-500 border-red-500/20 bg-red-500/5" },
                    { label: "SaralPay", value: "100%", desc: "Reconciliation", color: "text-emerald-500 border-emerald-500/20 bg-emerald-500/5" },
                    { label: "Time Saved", value: "~90%", desc: "Per payment (est.)", color: "text-blue-500 border-blue-500/20 bg-blue-500/5" },
                ].map((stat, i) => (
                    <div key={i} className={`rounded-xl border p-4 text-center ${stat.color}`}>
                        <p className="text-2xl md:text-3xl font-bold tabular-nums">{stat.value}</p>
                        <p className="text-xs font-medium mt-0.5">{stat.desc}</p>
                        <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                    </div>
                ))}
            </div>
            <p className="text-[10px] text-muted-foreground/60 text-center italic">
                SaralPay 100% is verifiable: every payment auto-groups by intent. Traditional rates are estimated.
            </p>
        </div>
    );
}
