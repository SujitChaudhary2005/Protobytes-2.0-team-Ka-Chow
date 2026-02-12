"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowLeft, Loader2 } from "lucide-react";

function SuccessContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const txId = searchParams.get("txId") || "—";
    const amount = searchParams.get("amount") || "0";
    const intent = searchParams.get("intent") || "—";
    const recipient = searchParams.get("recipient") || "—";

    return (
        <div className="p-4 md:p-6 space-y-6">
            <Card>
                <CardContent className="p-8 text-center space-y-6">
                    <div className="mx-auto w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
                        <CheckCircle2 className="h-10 w-10 text-success" />
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold">Payment Successful!</h2>
                        <p className="text-muted-foreground mt-1">
                            Your transaction has been settled
                        </p>
                    </div>

                    <div className="space-y-3 text-left bg-muted/30 rounded-lg p-4">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Transaction ID</span>
                            <span className="font-mono text-xs">{txId.slice(0, 12)}...</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Amount</span>
                            <span className="font-bold">NPR {amount}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Intent</span>
                            <span className="capitalize">{intent}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Recipient</span>
                            <span className="font-mono text-sm">{recipient}</span>
                        </div>
                    </div>

                    <Button className="w-full" onClick={() => router.push("/pay")}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Home
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

export default function SuccessPage() {
    return (
        <Suspense fallback={
            <div className="p-4 md:p-6 flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        }>
            <SuccessContent />
        </Suspense>
    );
}

