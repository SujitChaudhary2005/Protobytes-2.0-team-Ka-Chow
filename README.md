# UPA-NP — Unified Payment Address for Nepal (SaralPay)

## Team Information

**Team Name:** Ka-Chow

**Team Members:**

| Name | Email | GitHub Username |
|------|-------|-----------------|
| Sujit Chaudhary | chaudharysujit765@gmail.com | [@sujitchaudhary2005](https://github.com/sujitchaudhary2005) |
| Kismat Dhakal | d.kismat45@gmail.com | [@D10kismat](https://github.com/D10kismat) |
| Rupesh Pal | palrupesh292@gmail.com | [@Rupeshpal](https://github.com/Rupeshpal) |
| Shrijal Sigdel | pckoho@gmail.com | [@babatude1](https://github.com/babatude1) |

---

## Project Details

**Project Title:** UPA-NP (Unified Payment Address for Nepal) (SaralPay)

**Category:** [x] FinTech [ ] EdTech [ ] E-Governance [ ] IoT [ ] Open Innovation

**Problem Statement:**
Nepal's digital payment ecosystem suffers from severe fragmentation — multiple platforms (eSewa, Khalti, IME Pay, fonepay, Connect IPS) operate in isolation with no interoperability. Government offices receive hundreds of payments daily with zero structured metadata, requiring hours of manual reconciliation. All digital payments require internet, failing in rural Nepal and during outages.

**Solution Overview:**
UPA-NP is a unified payment intelligence layer that transforms raw money transfers into structured, intent-locked, auditable transactions purpose-built for Nepal's ecosystem. It provides a protocol-level solution through three interconnected interfaces: an Officer Portal for generating cryptographically signed QR codes (online + offline), a reference Wallet App (SaralPay) that demonstrates how any wallet can scan, verify, and settle intent-locked payments, and a Reconciliation Dashboard for real-time auto-reconciliation and analytics. The system uses Ed25519 digital signatures for offline verification, ensuring payments carry full context (purpose, payer identity, metadata) and can be processed even without internet connectivity. UPA-NP doesn't replace existing wallets — it creates the interoperability layer that connects them all while adding intelligence and resilience.

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| **Backend** | Next.js API Routes + Server Actions |
| **Database** | LocalStorage (IndexedDB via Dexie.js) |
| **Cryptography** | @noble/ed25519 (Ed25519 signing & verification) |
| **Offline Storage** | Dexie.js (IndexedDB) |
| **QR Code** | qrcode (generation) |
| **State Management** | React Context API |
| **Validation** | Zod |
| **Deployment** | Vercel |
| **Package Manager** | npm |

---

## Installation & Setup

### Prerequisites

- Node.js 18+ installed
- npm installed

### Steps

```bash
# Clone the repository
git clone https://github.com/SujitChaudhary2005/Protobytes-2.0-team-Ka-Chow.git

# Navigate to the project folder
cd Protobytes-2.0-team-Ka-Chow

# Install dependencies
npm install --legacy-peer-deps

# Start the development server
npm run dev
```

The app will be running at `http://localhost:3000`

### Environment Variables

No environment variables required for local development. The app uses localStorage for data persistence.

---

## Demo Credentials (if applicable)

| Role | Access |
|------|--------|
| Officer Portal | Navigate to `/officer` — no login required for demo |
| UPA Pay (Citizen Wallet) | Navigate to `/pay` — pre-loaded with NPR 50,000 demo balance |
| Admin Dashboard | Navigate to `/admin` — no login required for demo |
| Reconciliation Dashboard | Navigate to `/dashboard` — no login required for demo |

---

## Demo Flow

### Online Payment Flow

1. **Officer** opens `/officer` → fills payment form → generates QR code
2. **Citizen** opens `/pay` → taps "Scan & Pay" → scans QR
3. QR payload is verified → citizen confirms payment → settlement succeeds
4. **Dashboard** at `/dashboard` or `/admin` shows the new transaction (auto-reconciled)

### Offline Payment Flow

1. **Officer** generates a **signed** QR code (Ed25519 offline mode)
2. **Both parties go offline** (toggle switch in UI)
3. **Citizen** scans QR → signature is verified **locally** (no server needed)
4. Payment is **queued** in IndexedDB
5. When internet returns → auto-syncs → dashboard updates

---

## Screenshots/Demo

> Screenshots and demo video will be added during the hackathon.

---

## Project Structure

```
upa-np/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Landing page (redirects to /pay)
│   ├── officer/page.tsx        # Officer QR generator portal
│   ├── pay/page.tsx            # UPA Pay (mock wallet)
│   ├── pay/scan/page.tsx       # QR scanner
│   ├── pay/confirm/page.tsx    # Payment confirmation
│   ├── pay/success/page.tsx    # Payment success
│   ├── pay/queued/page.tsx     # Offline queued payments
│   ├── admin/page.tsx          # Admin dashboard
│   ├── dashboard/page.tsx      # Reconciliation dashboard
│   └── auth/page.tsx           # Authentication & KYC
├── components/                 # Reusable UI components
│   ├── ui/                     # shadcn/ui components
│   ├── qr-code.tsx             # QR code display
│   ├── network-status.tsx       # Network status indicator
│   ├── offline-toggle.tsx      # Offline toggle switch
│   └── verification-panel.tsx  # Cryptographic verification panel
├── lib/                        # Utilities
│   ├── crypto.ts               # Ed25519 signing & verification
│   ├── db.ts                   # IndexedDB offline storage
│   ├── storage.ts              # LocalStorage data management
│   └── utils.ts                # Helper functions
├── contexts/                   # React contexts
│   └── wallet-context.tsx      # Wallet state management
├── hooks/                      # Custom React hooks
│   ├── use-network.ts          # Network status hook
│   └── use-toast.ts            # Toast notification hook
├── types/                      # TypeScript type definitions
├── capacitor.config.ts         # Capacitor configuration
├── next.config.mjs
├── tailwind.config.ts
├── package.json
└── README.md
```

---

## License

This project was built for **Protobytes Hackathon 2.0**.