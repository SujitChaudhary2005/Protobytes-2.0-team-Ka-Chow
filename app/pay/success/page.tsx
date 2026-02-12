"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowLeft, Loader2, Download, Printer } from "lucide-react";
import { openReceipt, downloadReceipt } from "@/lib/receipt";
import { toast } from "sonner";

function SuccessContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const txId = searchParams.get("txId") || "—";
    const amount = searchParams.get("amount") || "0";
    const intent = searchParams.get("intent") || "—";
    const recipient = searchParams.get("recipient") || "—";

    const receiptData = {
        txId,
        recipient,
        amount: parseFloat(amount),
        intent,
        mode: "online" as const,
        timestamp: Date.now(),
        settledAt: Date.now(),
    };

    const handlePrint = () => {
        openReceipt(receiptData);
    };

    const handleDownload = () => {
        downloadReceipt(receiptData);
        toast.success("Receipt downloaded");
    };

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

                    {/* Receipt Actions */}
                    <div className="grid grid-cols-2 gap-3">
                        <Button variant="outline" className="w-full" onClick={handlePrint}>
                            <Printer className="h-4 w-4 mr-2" />
                            Print Receipt
                        </Button>
                        <Button variant="outline" className="w-full" onClick={handleDownload}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                        </Button>
                    </div>

                    <Button className="w-full" onClick={() => router.push("/")}>
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

