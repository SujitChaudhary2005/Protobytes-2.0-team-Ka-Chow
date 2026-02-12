# UPA Pay - Super Finance App Nepal

A comprehensive financial application that provides unified payment solutions for Nepal, connecting all banks and online payment systems through a single platform.

## Features

- **Unified QR Payment**: Generate and scan QR codes that work with any payment system in Nepal
- **Cost Optimization**: Automatically routes payments through the gateway with the lowest transfer fee
- **Offline Payments**: Cryptographic offline payment system that validates transactions when device reconnects
- **Aggregated Banking Hub**: View and manage all e-banking accounts in one place
- **Smart QR Detection**: Detects receiver's QR type and suggests zero-cost payment methods
- **KYC & Authentication**: Secure login with National ID verification

## Tech Stack

- **Framework**: Next.js 15 & React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **Mobile**: Capacitor (iOS & Android)
- **Backend**: Supabase (PostgreSQL, Realtime)
- **Cryptography**: Ed25519 signatures
- **Offline Storage**: IndexedDB (Dexie.js)

## Project Structure

```
super-finance-app/
├── app/                    # Next.js app router pages
│   ├── pay/               # UPA Pay (Citizen) app
│   │   ├── page.tsx      # Wallet dashboard
│   │   ├── scan/         # QR scanner
│   │   ├── confirm/      # Payment confirmation
│   │   ├── success/      # Payment success
│   │   └── queued/       # Offline queued payments
│   ├── officer/          # Officer portal (QR generation)
│   ├── dashboard/        # Reconciliation dashboard
│   └── auth/             # Authentication & KYC
├── components/           # React components
│   └── ui/              # shadcn/ui components
├── lib/                 # Utilities and helpers
│   ├── crypto.ts        # Ed25519 signing/verification
│   ├── db.ts            # IndexedDB offline storage
│   └── supabase.ts      # Supabase client
├── contexts/            # React contexts
├── hooks/               # Custom React hooks
├── types/               # TypeScript types
└── capacitor.config.ts  # Capacitor configuration
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Supabase account (for backend)
- iOS/Android development environment (for mobile builds)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd super-finance-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up Supabase**
   - Create a new Supabase project
   - Run the SQL migrations (see `supabase/migrations.sql`)
   - Enable Realtime for the `transactions` table

5. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Mobile App Setup (Capacitor)

### iOS

1. **Build the Next.js app**
   ```bash
   npm run build
   ```

2. **Sync with iOS**
   ```bash
   npm run sync:ios
   ```

3. **Open in Xcode**
   ```bash
   npm run open:ios
   ```

4. **Configure in Xcode**
   - Set your development team
   - Configure signing & capabilities
   - Build and run on simulator/device

### Android

1. **Build the Next.js app**
   ```bash
   npm run build
   ```

2. **Sync with Android**
   ```bash
   npm run sync:android
   ```

3. **Open in Android Studio**
   ```bash
   npm run open:android
   ```

4. **Build and run**
   - Configure signing
   - Build APK or run on emulator/device

## Database Schema

### Tables

**transactions**
- `id` (uuid, primary key)
- `recipient` (text)
- `amount` (numeric)
- `intent` (text)
- `metadata` (jsonb)
- `status` (text: pending/settled/failed)
- `signature` (text)
- `public_key` (text)
- `timestamp` (bigint)
- `nonce` (text)
- `created_at` (timestamp)
- `updated_at` (timestamp)

**payment_requests**
- `id` (uuid, primary key)
- `recipient` (text)
- `recipient_name` (text)
- `amount` (numeric)
- `intent` (text)
- `metadata` (jsonb)
- `qr_data` (text)
- `signature` (text)
- `public_key` (text)
- `expires_at` (timestamp)
- `created_at` (timestamp)

## Key Features Implementation

### Offline Payments

The app uses IndexedDB (via Dexie.js) to queue transactions when offline. When the device comes back online, transactions are automatically synced to Supabase.

**Flow:**
1. User scans QR and confirms payment
2. Payment is cryptographically signed with Ed25519
3. If offline, transaction is stored in IndexedDB with status "queued"
4. When online, background sync uploads queued transactions
5. Status updates to "settled" after successful sync

### QR Code Generation

Officers can generate payment request QR codes with:
- Recipient information
- Amount and intent
- Custom metadata (license, violation, etc.)
- Cryptographic signature for tamper-proofing

### Payment Verification

All payments are verified using Ed25519 signatures:
- QR codes contain signed payloads
- Signatures are verified locally before payment
- Public keys are included for verification
- Nonces prevent replay attacks

## Design System

### Colors
- **Primary**: `#2563EB` (Blue-600) - Trust, government
- **Accent**: `#10B981` (Emerald-500) - Success, money
- **Warning**: `#F59E0B` (Amber-500) - Queued, offline
- **Danger**: `#EF4444` (Red-500) - Failed, error
- **Background**: `#FAFAFA` (Light)
- **Surface**: `#FFFFFF` (Cards)

### Typography
- **Headings/Body**: Inter
- **Monospace**: JetBrains Mono (for transaction IDs, signatures)

### Responsive Breakpoints
- **Mobile**: < 640px (Primary: UPA Pay)
- **Tablet**: 640-1024px (Officer portal)
- **Desktop**: > 1024px (Dashboard)

## API Integration

### Endpoints

**POST /api/transactions**
Submit a new transaction (signed payload)

**POST /api/sync**
Sync queued offline transactions

**GET /api/payment-requests/:id**
Get payment request by ID

**POST /api/payment-requests**
Create a new payment request

## Security Considerations

1. **Private Keys**: In production, use secure key storage (Keychain on iOS, Keystore on Android)
2. **API Keys**: Never commit `.env.local` files
3. **HTTPS**: Always use HTTPS in production
4. **Signature Verification**: Always verify signatures before processing payments
5. **Rate Limiting**: Implement rate limiting on API endpoints

## Development

### Code Style
- Use TypeScript for type safety
- Follow Next.js 15 app router conventions
- Use shadcn/ui components for consistency
- Implement proper error handling

### Testing
```bash
npm run lint
```

## Deployment

### Web (Vercel)
1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Mobile
1. Build production Next.js app
2. Sync with Capacitor
3. Build iOS/Android apps
4. Submit to App Store/Play Store

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

[Your License Here]

## Support

For issues and questions, please open an issue on GitHub.

