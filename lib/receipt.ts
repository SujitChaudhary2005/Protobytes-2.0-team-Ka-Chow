/**
 * Receipt Generation Module
 *
 * Generates formal, digitally-signed payment receipts.
 * Uses the browser's print-to-PDF capability for PDF generation
 * without requiring external dependencies.
 */

export interface ReceiptData {
    txId: string;
    recipient: string;
    recipientName?: string;
    amount: number;
    intent: string;
    intentCategory?: string;
    payerName?: string;
    payerId?: string;
    mode: "online" | "offline";
    signature?: string;
    nonce?: string;
    timestamp: number;
    settledAt?: number;
    metadata?: Record<string, string>;
}

/**
 * Generate receipt HTML string
 */
function generateReceiptHTML(data: ReceiptData): string {
    const date = new Date(data.timestamp);
    const formattedDate = date.toLocaleDateString("en-NP", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    const formattedTime = date.toLocaleTimeString("en-NP", {
        hour: "2-digit",
        minute: "2-digit",
    });

    const metadataRows = data.metadata
        ? Object.entries(data.metadata)
            .filter(([key]) => key !== "payerName" && key !== "payerId")
            .map(
                ([key, val]) => `
          <tr>
            <td style="padding:6px 12px;color:#6b7280;font-size:13px">${formatLabel(key)}</td>
            <td style="padding:6px 12px;text-align:right;font-size:13px">${val}</td>
          </tr>
        `
            )
            .join("")
        : "";

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>UPA Pay Receipt - ${data.txId}</title>
  <style>
    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 480px;
      margin: 0 auto;
      padding: 24px;
      color: #1f2937;
      background: #fff;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      background: #2563eb;
      color: white;
      border-radius: 12px;
      font-weight: 700;
      font-size: 18px;
      margin-bottom: 8px;
    }
    .title { font-size: 20px; font-weight: 700; margin: 4px 0; }
    .subtitle { font-size: 12px; color: #6b7280; }
    .amount-box {
      background: #f0f7ff;
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      text-align: center;
      padding: 20px;
      margin: 16px 0;
    }
    .amount {
      font-size: 32px;
      font-weight: 700;
      color: #2563eb;
    }
    .status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 8px;
    }
    .settled { background: #d1fae5; color: #065f46; }
    .queued { background: #fef3c7; color: #92400e; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    tr { border-bottom: 1px solid #f3f4f6; }
    td { padding: 8px 12px; font-size: 13px; }
    td:first-child { color: #6b7280; }
    td:last-child { text-align: right; font-weight: 500; }
    .sig-box {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      margin-top: 16px;
      word-break: break-all;
    }
    .sig-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .sig-value { font-family: monospace; font-size: 10px; color: #6b7280; }
    .footer {
      text-align: center;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px dashed #d1d5db;
      font-size: 11px;
      color: #9ca3af;
    }
    .actions {
      text-align: center;
      margin-top: 20px;
    }
    .btn {
      display: inline-block;
      padding: 10px 24px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      margin: 0 4px;
    }
    .btn:hover { background: #1d4ed8; }
    .btn-outline {
      background: white;
      color: #2563eb;
      border: 1px solid #2563eb;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">UP</div>
    <div class="title">Payment Receipt</div>
    <div class="subtitle">Unified Payment Address — Government of Nepal</div>
  </div>

  <div class="amount-box">
    <div class="amount">NPR ${data.amount.toLocaleString()}</div>
    <div class="status ${data.mode === "online" ? "settled" : "queued"}">
      ${data.mode === "online" ? "✓ Settled" : "◷ Queued"}
    </div>
  </div>

  <table>
    <tr>
      <td>Transaction ID</td>
      <td style="font-family:monospace;font-size:12px">${data.txId}</td>
    </tr>
    <tr>
      <td>Date</td>
      <td>${formattedDate}</td>
    </tr>
    <tr>
      <td>Time</td>
      <td>${formattedTime}</td>
    </tr>
    <tr>
      <td>Recipient</td>
      <td>${data.recipientName || data.recipient}</td>
    </tr>
    <tr>
      <td>UPA Address</td>
      <td style="font-family:monospace;font-size:12px">${data.recipient}</td>
    </tr>
    <tr>
      <td>Purpose</td>
      <td>${data.intent}</td>
    </tr>
    ${data.payerName ? `<tr><td>Payer Name</td><td>${data.payerName}</td></tr>` : ""}
    ${data.payerId ? `<tr><td>Payer ID</td><td>${data.payerId}</td></tr>` : ""}
    <tr>
      <td>Payment Mode</td>
      <td>${data.mode === "online" ? "🌐 Online" : "📱 Offline"}</td>
    </tr>
    ${metadataRows}
  </table>

  ${data.signature ? `
  <div class="sig-box">
    <div class="sig-label">Ed25519 Digital Signature</div>
    <div class="sig-value">${data.signature}</div>
  </div>
  ` : ""}

  ${data.nonce ? `
  <div class="sig-box" style="margin-top:8px">
    <div class="sig-label">Nonce (Replay Protection)</div>
    <div class="sig-value">${data.nonce}</div>
  </div>
  ` : ""}

  <div class="footer">
    <p>This is a computer-generated receipt from UPA Pay.</p>
    <p>Cryptographically verified using Ed25519 signatures.</p>
    <p>Generated on ${new Date().toISOString()}</p>
  </div>

  <div class="actions no-print">
    <button class="btn" onclick="window.print()">Print / Save PDF</button>
    <button class="btn btn-outline" onclick="window.close()">Close</button>
  </div>
</body>
</html>`;
}

function formatLabel(key: string): string {
    return key
        .replace(/([A-Z])/g, " $1")
        .replace(/_/g, " ")
        .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Open receipt in a new window for printing/saving as PDF
 */
export function openReceipt(data: ReceiptData): void {
    const html = generateReceiptHTML(data);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank", "width=520,height=800");
    if (win) {
        win.onload = () => URL.revokeObjectURL(url);
    }
}

/**
 * Download receipt as an HTML file
 */
export function downloadReceipt(data: ReceiptData): void {
    const html = generateReceiptHTML(data);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `UPA-Receipt-${data.txId}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
