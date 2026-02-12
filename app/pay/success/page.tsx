"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CheckCircle2, Download, Home } from "lucide-react";
import Link from "next/link";

export default function SuccessPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const amount = searchParams.get("amount");
    const intent = searchParams.get("intent");

    return (
        <div className="min-h-screen bg-background">
            <main className="container mx-auto px-4 py-12">
                <div className="max-w-md mx-auto space-y-6">
                    {/* Success Icon */}
                    <div className="flex justify-center">
                        <div className="p-4 bg-accent/10 rounded-full">
                            <CheckCircle2 className="h-16 w-16 text-accent" />
                        </div>
                    </div>

                    {/* Success Message */}
                    <div className="text-center space-y-2">
                        <h1 className="text-2xl font-semibold">Payment Successful</h1>
                        <p className="text-3xl font-bold">
                            {amount ? formatCurrency(parseFloat(amount)) : formatCurrency(0)}
                        </p>
                        <p className="text-muted-foreground">
                            {intent ? decodeURIComponent(intent) : "Payment"}
                        </p>
                    </div>

                    {/* Transaction Details */}
                    <Card>
                        <CardContent className="p-6 space-y-4">
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">
                                        Transaction ID:
                                    </span>
                                    <span className="text-sm font-mono">
                                        UPA-2026-{String(Date.now()).slice(-5)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Time:</span>
                                    <span className="text-sm">{formatDate(new Date())}</span>
                                </div>
                                <div className="pt-3 border-t border-border">
                                    <p className="text-xs text-muted-foreground">
                                        Receipt details will be available in your transaction
                                        history.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="space-y-2">
                        <Button variant="outline" className="w-full">
                            <Download className="h-4 w-4 mr-2" />
                            Download Receipt
                        </Button>
                        <Button className="w-full" asChild>
                            <Link href="/pay">
                                <Home className="h-4 w-4 mr-2" />
                                Back to Home
                            </Link>
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    );
}

