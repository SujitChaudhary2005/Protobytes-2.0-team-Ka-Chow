# UPA-NP — Unified Payment Address for Nepal

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

**Project Title:** UPA-NP (Unified Payment Address for Nepal)

**Category:** [x] FinTech [ ] EdTech [ ] E-Governance [ ] IoT [ ] Open Innovation

**Problem Statement:**
Nepal's digital payment ecosystem suffers from severe fragmentation — multiple platforms (eSewa, Khalti, IME Pay, fonepay, Connect IPS) operate in isolation with no interoperability. Government offices receive hundreds of payments daily with zero structured metadata, requiring hours of manual reconciliation. All digital payments require internet, failing in rural Nepal and during outages.

**Solution Overview:**
UPA-NP is a unified payment intelligence layer that transforms raw money transfers into structured, intent-locked, auditable transactions purpose-built for Nepal's ecosystem. It provides a protocol-level solution through three interconnected interfaces: an Officer Portal for generating cryptographically signed QR codes (online + offline), a reference Wallet App (UPA Pay) that demonstrates how any wallet can scan, verify, and settle intent-locked payments, and a Reconciliation Dashboard for real-time auto-reconciliation and analytics. The system uses Ed25519 digital signatures for offline verification, ensuring payments carry full context (purpose, payer identity, metadata) and can be processed even without internet connectivity. UPA-NP doesn't replace existing wallets — it creates the interoperability layer that connects them all while adding intelligence and resilience.

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| **Backend** | Next.js API Routes + Server Actions |
| **Database** | Supabase (PostgreSQL + Realtime) |
| **Cryptography** | @noble/ed25519 (Ed25519 signing & verification) |
| **Offline Storage** | Dexie.js (IndexedDB) |
| **QR Code** | next-qrcode (generation), html5-qrcode (scanning) |
| **State Management** | Zustand |
| **Validation** | Zod |
| **Deployment** | Vercel |
| **Package Manager** | pnpm |

---

## Installation & Setup

### Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- Supabase account (free tier)

### Steps

```bash
# Clone the repository
git clone https://github.com/sujitchaudhary2005/protobytes-2.0-team-ka-chow.git

# Navigate to the project folder
cd protobytes-2.0-team-ka-chow

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Fill in your Supabase URL and keys in .env.local

# Push database schema (if using Prisma)
pnpm prisma db push

# Seed the database
pnpm prisma db seed

# Start the development server
pnpm dev
```

The app will be running at `http://localhost:3000`

### Environment Variables

Create a `.env.local` file with the following:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Demo Credentials (if applicable)

| Role | Access |
|------|--------|
| Officer Portal | Navigate to `/officer` — no login required for demo |
| UPA Pay (Citizen Wallet) | Navigate to `/pay` — pre-loaded with NPR 50,000 demo balance |
| Reconciliation Dashboard | Navigate to `/dashboard` — no login required for demo |

---

## Demo Flow

### Online Payment Flow
1. **Officer** opens `/officer` → fills payment form → generates QR code
2. **Citizen** opens `/pay` → taps "Scan & Pay" → scans QR
3. QR payload is verified → citizen confirms payment → settlement succeeds
4. **Dashboard** at `/dashboard` shows the new transaction in real-time (auto-reconciled)

### Offline Payment Flow
1. **Officer** generates a **signed** QR code (Ed25519 offline mode)
2. **Both parties go offline** (toggle switch in UI)
3. **Citizen** scans QR → signature is verified **locally** (no server needed)
4. Payment is **queued** in IndexedDB
5. When internet returns → auto-syncs → dashboard updates

---

## Screenshots/Demo

<!-- Add screenshots or demo video link here -->

> Screenshots and demo video will be added during the hackathon.

---

## Project Structure

```
upa-np/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Landing page
│   │   ├── officer/page.tsx        # Officer QR generator portal
│   │   ├── pay/page.tsx            # UPA Pay (mock wallet)
│   │   ├── dashboard/page.tsx      # Reconciliation dashboard
│   │   └── api/                    # API routes
│   ├── components/                 # Reusable UI components
│   ├── lib/                        # Utilities (crypto, offline-db, supabase)
│   ├── store/                      # Zustand state management
│   └── types/                      # TypeScript type definitions
├── prisma/                         # Database schema & seed data
├── public/                         # Static assets & PWA manifest
├── .env.local                      # Environment variables
├── next.config.ts
├── tailwind.config.ts
├── package.json
└── README.md
```

---

## License

This project was built for **Protobytes Hackathon 2.0**.
