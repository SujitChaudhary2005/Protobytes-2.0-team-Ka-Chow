"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
    ArrowRight,
    FileWarning,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Zap,
    Shield,
    Globe,
    WifiOff,
    ChevronRight,
    BarChart3,
} from "lucide-react";

const PROBLEMS = [
    {
        icon: FileWarning,
        title: "Manual Reconciliation",
        stat: "~70%",
        desc: "of Nepal's government payments still reconciled manually — NRB Annual Report, 2023",
        color: "text-red-500",
        bg: "bg-red-500/10",
    },
    {
        icon: Clock,
        title: "Settlement Delays",
        stat: "3-7 days",
        desc: "avg. settlement for non-digital government payments — World Bank Financial Inclusion Data",
        color: "text-amber-500",
        bg: "bg-amber-500/10",
    },
    {
        icon: AlertTriangle,
        title: "Reconciliation Errors",
        stat: "~12%",
        desc: "of municipal payments require manual dispute resolution — simulated from municipal volume data",
        color: "text-orange-500",
        bg: "bg-orange-500/10",
    },
];

const SOLUTIONS = [
    {
        icon: Zap,
        title: "Intent-Tagged Payments",
        desc: "Every payment carries structured purpose — no guessing during reconciliation",
        color: "text-emerald-500",
    },
    {
        icon: Shield,
        title: "Ed25519 Cryptographic Signing",
        desc: "Offline payments verified locally with zero server contact",
        color: "text-blue-500",
    },
    {
        icon: WifiOff,
        title: "Offline-First Architecture",
        desc: "Works in zero-connectivity areas, auto-syncs when online",
        color: "text-purple-500",
    },
    {
        icon: BarChart3,
        title: "Auto-Reconciliation Dashboard",
        desc: "Real-time grouping by intent and entity — 100% reconciliation rate",
        color: "text-cyan-500",
    },
];

export default function LandingPage() {
    const router = useRouter();
    const [step, setStep] = useState(0); // 0: problem, 1: solution, 2: action
    const [animatedProblems, setAnimatedProblems] = useState<number[]>([]);
    const [animatedSolutions, setAnimatedSolutions] = useState<number[]>([]);

    // Stagger problem card animations
    useEffect(() => {
        if (step === 0) {
            PROBLEMS.forEach((_, i) => {
                setTimeout(() => {
                    setAnimatedProblems((prev) => [...prev, i]);
                }, (i + 1) * 400);
            });
        }
    }, [step]);

    // Stagger solution card animations
    useEffect(() => {
        if (step === 1) {
            setAnimatedSolutions([]);
            SOLUTIONS.forEach((_, i) => {
                setTimeout(() => {
                    setAnimatedSolutions((prev) => [...prev, i]);
                }, (i + 1) * 300);
            });
        }
    }, [step]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
            <div className="max-w-2xl mx-auto px-4 py-8 md:py-16">
                {/* Step Indicator */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    {[0, 1, 2].map((s) => (
                        <button
                            key={s}
                            onClick={() => setStep(s)}
                            className={`h-2 rounded-full transition-all duration-500 ${s === step ? "w-8 bg-primary" : s < step ? "w-2 bg-primary/50" : "w-2 bg-muted-foreground/20"
                                }`}
                        />
                    ))}
                </div>

                {/* STEP 0: The Problem */}
                {step === 0 && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="text-center space-y-3">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-600 text-xs font-medium mb-2">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                THE PROBLEM
                            </div>
                            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                                Nepal&apos;s Payment
                                <br />
                                <span className="text-red-500">Reconciliation Crisis</span>
                            </h1>
                            <p className="text-muted-foreground max-w-md mx-auto">
                                Government entities collect thousands of payments daily.
                                Without structured data, matching payments to their purpose
                                is a manual, error-prone nightmare.
                            </p>
                        </div>

                        {/* Animated problem cards */}
                        <div className="space-y-3">
                            {PROBLEMS.map((problem, i) => (
                                <div
                                    key={i}
                                    className={`flex items-start gap-4 p-4 rounded-xl border bg-card transition-all duration-700 ${animatedProblems.includes(i)
                                        ? "opacity-100 translate-x-0"
                                        : "opacity-0 -translate-x-8"
                                        }`}
                                >
                                    <div className={`p-2.5 rounded-lg ${problem.bg} shrink-0`}>
                                        <problem.icon className={`h-5 w-5 ${problem.color}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <h3 className="font-semibold text-sm">{problem.title}</h3>
                                            <span className={`text-xl font-bold ${problem.color} tabular-nums`}>
                                                {problem.stat}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">{problem.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Source attribution */}
                        <p className="text-[10px] text-muted-foreground/60 text-center italic">
                            Sources: NRB Annual Report 2023, World Bank FINDEX, municipal transaction volume estimates
                        </p>

                        {/* Traditional flow visualization */}
                        <div className="p-4 rounded-xl border bg-card/50 space-y-3">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                Traditional Payment Flow
                            </h3>
                            <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1">
                                {[
                                    "Citizen Pays",
                                    "Bank Receives",
                                    "Paper Receipt",
                                    "Manual Entry",
                                    "Excel File",
                                    "Reconciliation",
                                ].map((step, i) => (
                                    <div key={i} className="flex items-center gap-2 shrink-0">
                                        <span className="px-2.5 py-1.5 rounded-md bg-red-500/10 text-red-700 dark:text-red-400 font-medium whitespace-nowrap">
                                            {step}
                                        </span>
                                        {i < 5 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                                ⚠ 6 steps, 3–7 days, high error rate, zero real-time visibility
                            </p>
                        </div>

                        <Button
                            className="w-full h-12 text-base"
                            onClick={() => setStep(1)}
                        >
                            See Our Solution <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                )}

                {/* STEP 1: The Solution */}
                {step === 1 && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="text-center space-y-3">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-medium mb-2">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                THE SOLUTION
                            </div>
                            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                                SaralPay
                                <br />
                                <span className="bg-gradient-to-r from-emerald-500 to-blue-500 bg-clip-text text-transparent">
                                    Intent-Based UPA
                                </span>
                            </h1>
                            <p className="text-muted-foreground max-w-md mx-auto">
                                Every payment carries its purpose. Reconciliation becomes
                                automatic. Works online and offline. Cryptographically secure.
                            </p>
                        </div>

                        {/* Solution cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {SOLUTIONS.map((solution, i) => (
                                <div
                                    key={i}
                                    className={`p-4 rounded-xl border bg-card transition-all duration-500 ${animatedSolutions.includes(i)
                                        ? "opacity-100 translate-y-0 scale-100"
                                        : "opacity-0 translate-y-4 scale-95"
                                        }`}
                                >
                                    <solution.icon className={`h-6 w-6 ${solution.color} mb-2`} />
                                    <h3 className="font-semibold text-sm">{solution.title}</h3>
                                    <p className="text-xs text-muted-foreground mt-1">{solution.desc}</p>
                                </div>
                            ))}
                        </div>

                        {/* SaralPay flow */}
                        <div className="p-4 rounded-xl border bg-card/50 space-y-3">
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                SaralPay Flow
                            </h3>
                            <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1">
                                {[
                                    "Citizen Scans QR",
                                    "Intent Auto-Tagged",
                                    "Settled",
                                ].map((s, i) => (
                                    <div key={i} className="flex items-center gap-2 shrink-0">
                                        <span className="px-2.5 py-1.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium whitespace-nowrap">
                                            {s}
                                        </span>
                                        {i < 2 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                ✅ 3 steps, instant settlement, 100% reconciliation, works offline
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(0)}>
                                Back
                            </Button>
                            <Button className="flex-1 h-12 text-base" onClick={() => setStep(2)}>
                                Get Started <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 2: Role Selection */}
                {step === 2 && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="text-center space-y-3">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-2">
                                <Globe className="h-3.5 w-3.5" />
                                GET STARTED
                            </div>
                            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                                Experience
                                <br />
                                <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                                    SaralPay in Action
                                </span>
                            </h1>
                            <p className="text-muted-foreground max-w-md mx-auto">
                                Choose a role to explore the system from different perspectives.
                            </p>
                        </div>

                        <div className="space-y-3">
                            {/* Citizen */}
                            <button
                                onClick={() => router.push("/")}
                                className="w-full flex items-center gap-4 p-5 rounded-xl border bg-card hover:border-primary/50 hover:shadow-md transition-all group"
                            >
                                <div className="p-3 rounded-lg bg-blue-500/10 shrink-0">
                                    <Globe className="h-6 w-6 text-blue-500" />
                                </div>
                                <div className="flex-1 text-left">
                                    <h3 className="font-semibold">👤 Citizen</h3>
                                    <p className="text-xs text-muted-foreground">
                                        Scan QR, pay online or offline, view transaction history
                                    </p>
                                </div>
                                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </button>

                            {/* Officer */}
                            <button
                                onClick={() => router.push("/officer")}
                                className="w-full flex items-center gap-4 p-5 rounded-xl border bg-card hover:border-primary/50 hover:shadow-md transition-all group"
                            >
                                <div className="p-3 rounded-lg bg-amber-500/10 shrink-0">
                                    <Shield className="h-6 w-6 text-amber-500" />
                                </div>
                                <div className="flex-1 text-left">
                                    <h3 className="font-semibold">🏛 Officer</h3>
                                    <p className="text-xs text-muted-foreground">
                                        Generate intent-tagged QR codes, sign QR with Ed25519
                                    </p>
                                </div>
                                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </button>

                            {/* Admin */}
                            <button
                                onClick={() => router.push("/admin")}
                                className="w-full flex items-center gap-4 p-5 rounded-xl border bg-card hover:border-primary/50 hover:shadow-md transition-all group"
                            >
                                <div className="p-3 rounded-lg bg-purple-500/10 shrink-0">
                                    <BarChart3 className="h-6 w-6 text-purple-500" />
                                </div>
                                <div className="flex-1 text-left">
                                    <h3 className="font-semibold">📊 Admin Dashboard</h3>
                                    <p className="text-xs text-muted-foreground">
                                        View auto-grouped reconciliation, settlement stats
                                    </p>
                                </div>
                                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </button>
                        </div>

                        <Button variant="outline" className="w-full h-12" onClick={() => setStep(1)}>
                            Back to Solution
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
