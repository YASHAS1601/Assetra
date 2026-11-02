# Assetra — Tokenized Asset Management System

Assetra is an institutional real-world asset (RWA) management platform for registering, auditing, verifying, and tokenizing assets on the Ethereum blockchain, backed by Supabase PostgreSQL, Supabase Auth, Row Level Security (RLS), and private Supabase Storage.

The project is structured as a decoupled, full-stack blockchain repository:

```
Assetra/
├── frontend/             # React + Vite (Institutional Theme, Supabase Auth & Storage client, ethers.js)
├── backend/              # Node.js + Express (Supabase Admin API, Event Indexer, server-side RBAC)
├── smart-contracts/      # Hardhat Solidity (AssetRegistry.sol with verification gating & ERC-721 token)
├── supabase/             # Version-controlled Supabase SQL migrations & RLS policies
│   └── migrations/
│       └── 20261011000000_assetra_supabase_schema.sql
├── docs/                 # Architecture, API specifications, & deployment guides
├── .gitignore
└── README.md
```

---

## ⚡ Supabase Integration & Setup

Assetra is connected to the following Supabase project:
- **Project URL:** `https://ofdzzynjlyigoliqfgbl.supabase.co`

### Step 1: Run the Database Migration

Open the **Supabase Dashboard** for project `https://ofdzzynjlyigoliqfgbl.supabase.co` -> **SQL Editor** -> **New Query**, and execute the migration script:

File: [`supabase/migrations/20261011000000_assetra_supabase_schema.sql`](supabase/migrations/20261011000000_assetra_supabase_schema.sql)

This script creates:
1. `public.profiles` (linked to `auth.users(id)`) with auto-provisioning trigger `handle_new_user()` (enforcing `USER` role) and `prevent_role_escalation()` trigger.
2. `public.assets` (with review states: `PENDING_REVIEW`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `MORE_INFO_REQUESTED`, `TOKENIZED`).
3. `public.asset_documents` (private evidence metadata linking to `storage.objects`).
4. `public.audit_logs` (immutable audit trail of admin review actions).
5. `public.transactions` (on-chain transaction hashes, chain IDs, token IDs, block numbers).
6. Comprehensive **Row Level Security (RLS)** policies on all 5 tables.
7. Private Supabase Storage bucket **`asset-documents`** with authenticated user and admin RLS policies.

### Step 2: Configure Frontend Environment

In `frontend/.env.local`:

```env
VITE_SUPABASE_URL=https://ofdzzynjlyigoliqfgbl.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE
```

Replace `PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE` with your actual publishable key from **Supabase Dashboard -> Project Settings -> API Keys** (`anon` or publishable key).

### Step 3: Configure Backend Environment

In `backend/.env` (or copy from `backend/.env.example`):

```env
PORT=5000
SUPABASE_URL=https://ofdzzynjlyigoliqfgbl.supabase.co
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
JWT_SECRET=assetra_secret_jwt_key_2026
```

> **Security Note:** Never place the server secret (`service_role` key) in frontend `.env.local` or client bundles.

### Step 4: Provision an Administrator Account

#### Method A: Supabase SQL Editor (Recommended)
Open the **Supabase Dashboard** for project `https://ofdzzynjlyigoliqfgbl.supabase.co` -> **SQL Editor** -> **New Query**, and execute [`supabase/provision_admin.sql`](supabase/provision_admin.sql):

```sql
-- 1. Confirm the email in auth.users
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE LOWER(email) = 'admin@assetra.io';

-- 2. Authorize administrator in public.profiles with role = 'ADMIN'
INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', 'Assetra System Admin'), 'ADMIN'
FROM auth.users
WHERE LOWER(email) = 'admin@assetra.io'
ON CONFLICT (id) DO UPDATE
SET role = 'ADMIN',
    email = EXCLUDED.email;
```

#### Method B: Server-Side CLI Setup
With `SUPABASE_SECRET_KEY` configured in `backend/.env`:
```bash
cd backend
node src/scripts/createAdmin.js admin@assetra.io "YourAdminPassword123!" "System Administrator"
```

---

## 🚀 Running the Platform

### 1. Smart Contracts (`smart-contracts/`)

```bash
cd smart-contracts
npm install
npm test
npm run deploy:local
```

### 2. Backend REST API (`backend/`)

```bash
cd backend
npm install
npm test
npm start
```
Runs at `http://localhost:5000`. Check health at `http://localhost:5000/api/health`.

### 3. Frontend Web App (`frontend/`)

```bash
cd frontend
npm install
npm run dev
```
Runs at `http://localhost:5173`. Automatically routes root `/` to `/login`.

---

## 🔒 Security Architecture Highlights

- **Separate Portals:** Distinct portals for regular users (`/user/login`, `/user/dashboard`) and compliance administrators (`/admin/login`, `/admin/dashboard`).
- **No Client Privilege Escalation:** Registration strictly assigns `role = 'USER'` via database trigger. Updating profile `role` directly is blocked by `prevent_role_escalation()`.
- **Row Level Security (RLS):** Users can only access their own submissions and documents. Approved/tokenized assets are publicly verifiable. Audit logs are append-only.
- **Private Storage:** Document evidence is stored in private `asset-documents` bucket. Downloads use authenticated 5-minute signed URLs.
- **Verification Gating:** Smart contract tokenization cannot proceed until the asset is approved by an administrator in the compliance queue.
