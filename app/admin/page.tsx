"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getTransactions, Transaction } from "@/lib/storage";
import {
  TrendingUp,
  TrendingDown,
  Users,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  DollarSign,
  CheckCircle2,
  Clock,
  XCircle,
  Filter,
  Download,
  Search,
  BarChart3,
  PieChart,
} from "lucide-react";
import { Input } from "@/components/ui/input";

export default function AdminDashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "settled" | "pending" | "failed">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadTransactions();
      setLoading(false);
    };
    load();
    // Auto-refresh every 5 seconds
    const interval = setInterval(loadTransactions, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadTransactions = async () => {
    try {
      // Try API first (includes fallback demo data)
      const res = await fetch("/api/transactions");
      if (res.ok) {
        const result = await res.json();
        if (result.data && Array.isArray(result.data) && result.data.length > 0) {
          setTransactions(result.data.map((tx: any) => ({
            id: tx.id || tx.tx_id,
            recipient: tx.recipient || tx.upa_address || tx.upa_id || "",
            recipientName: tx.recipientName || tx.entity_name || "",
            amount: tx.amount,
            intent: tx.intent || tx.intent_label || "",
            metadata: tx.metadata || {},
            status: tx.status,
            mode: tx.mode || "online",
            signature: tx.signature,
            publicKey: tx.publicKey,
            timestamp: tx.timestamp || new Date(tx.issued_at || tx.created_at || Date.now()).getTime(),
            nonce: tx.nonce,
            walletProvider: tx.walletProvider || tx.wallet_provider,
          })));
          return;
        }
      }
    } catch {
      // API failed, fall back to localStorage
    }

    try {
      const data = getTransactions();
      setTransactions(data);
    } catch (err) {
      console.error("Load error:", err);
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (filter !== "all" && tx.status !== filter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        tx.recipient?.toLowerCase().includes(query) ||
        tx.intent?.toLowerCase().includes(query) ||
        tx.id?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const stats = {
    total: transactions.length,
    settled: transactions.filter((t) => t.status === "settled").length,
    pending: transactions.filter((t) => t.status === "pending" || t.status === "queued").length,
    failed: transactions.filter((t) => t.status === "failed").length,
    totalAmount: transactions
      .filter((t) => t.status === "settled")
      .reduce((sum, t) => sum + t.amount, 0),
    todayAmount: transactions
      .filter((t) => {
        const txDate = new Date(t.timestamp);
        const today = new Date();
        return (
          t.status === "settled" &&
          txDate.getDate() === today.getDate() &&
          txDate.getMonth() === today.getMonth() &&
          txDate.getFullYear() === today.getFullYear()
        );
      })
      .reduce((sum, t) => sum + t.amount, 0),
  };

  // Group by intent
  const intentGroups = transactions.reduce((acc, tx) => {
    const intent = tx.intent || "Other";
    if (!acc[intent]) {
      acc[intent] = { count: 0, amount: 0 };
    }
    acc[intent].count++;
    acc[intent].amount += tx.amount;
    return acc;
  }, {} as Record<string, { count: number; amount: number }>);

  const reconciliationRate = stats.total > 0 ? Math.round((stats.settled / stats.total) * 100) : 100;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Admin Dashboard</h2>
          <p className="text-sm text-muted-foreground">UPA-NP Transaction Management</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={loadTransactions} disabled={loading} size="sm">
            <Activity className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <main className="space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-primary shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.settled} settled transactions
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-success shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Today&apos;s Revenue
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.todayAmount)}</div>
              <p className="text-xs text-success mt-1 flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" />
                Active today
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-warning shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
              </CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Awaiting settlement
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-accent shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Reconciliation
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reconciliationRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.settled}/{stats.total} transactions
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Intent Breakdown */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary" />
                Revenue by Intent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(intentGroups)
                  .sort((a, b) => b[1].amount - a[1].amount)
                  .slice(0, 5)
                  .map(([intent, data]) => {
                    const percentage = stats.totalAmount > 0 
                      ? Math.round((data.amount / stats.totalAmount) * 100) 
                      : 0;
                    return (
                      <div key={intent}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{intent}</span>
                          <span className="text-sm font-bold">{formatCurrency(data.amount)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-primary to-accent h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted-foreground">
                            {data.count} transactions
                          </span>
                          <span className="text-xs text-muted-foreground">{percentage}%</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          {/* Status Overview */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Transaction Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="font-medium">Settled</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{stats.settled}</p>
                    <p className="text-xs text-muted-foreground">
                      {stats.total > 0 ? Math.round((stats.settled / stats.total) * 100) : 0}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-warning/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-warning" />
                    <span className="font-medium">Pending</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{stats.pending}</p>
                    <p className="text-xs text-muted-foreground">
                      {stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-danger/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-danger" />
                    <span className="font-medium">Failed</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{stats.failed}</p>
                    <p className="text-xs text-muted-foreground">
                      {stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : 0}%
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Section */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>All Transactions</CardTitle>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search transactions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-full sm:w-64"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={filter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={filter === "settled" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("settled")}
                  >
                    Settled
                  </Button>
                  <Button
                    variant={filter === "pending" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("pending")}
                  >
                    Pending
                  </Button>
                  <Button
                    variant={filter === "failed" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("failed")}
                  >
                    Failed
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="h-8 w-8 animate-spin mx-auto mb-2" />
                Loading transactions...
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No transactions found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border border-border rounded-lg hover:bg-primary/5 hover:border-primary/20 transition-all group"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-semibold">{tx.intent}</p>
                        {tx.status === "settled" ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : tx.status === "pending" || tx.status === "queued" ? (
                          <Clock className="h-4 w-4 text-warning" />
                        ) : (
                          <XCircle className="h-4 w-4 text-danger" />
                        )}
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            tx.status === "settled"
                              ? "bg-success/10 text-success"
                              : tx.status === "pending" || tx.status === "queued"
                              ? "bg-warning/10 text-warning"
                              : "bg-danger/10 text-danger"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {tx.recipientName || tx.recipient}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatDate(new Date(tx.timestamp))}</span>
                        <span>•</span>
                        <span className="font-mono">{tx.id.slice(0, 12)}...</span>
                        {tx.walletProvider && (
                          <>
                            <span>•</span>
                            <span>{tx.walletProvider}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 sm:mt-0 sm:text-right">
                      <p className="text-xl font-bold text-primary">
                        {formatCurrency(tx.amount)}
                      </p>
                      {tx.mode && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {tx.mode === "offline" ? "📡 Offline" : "🌐 Online"}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

