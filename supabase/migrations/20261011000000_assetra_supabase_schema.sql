-- ==============================================================================
-- Assetra Protocol: Comprehensive Supabase Schema Migration
-- Includes: Profiles, Assets, Asset Documents, Audit Logs, Transactions,
-- Automated Triggers, Role-Based Access Control, and Row Level Security (RLS)
-- ==============================================================================

-- 1. PROFILES TABLE (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
    wallet_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Helper function to check if authenticated caller has ADMIN role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
$$;

-- Trigger to automatically populate profile when a user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, wallet_address)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'USER', -- Mandatory: Public signup always assigns USER role
    NEW.raw_user_meta_data->>'wallet_address'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to prevent non-admins from escalating their role
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role <> OLD.role AND auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Users cannot change their own administrative role.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_role_update ON public.profiles;
CREATE TRIGGER on_profile_role_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

-- 2. ASSETS TABLE
CREATE TABLE IF NOT EXISTS public.assets (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    location TEXT,
    valuation NUMERIC(18, 2) NOT NULL CHECK (valuation >= 0),
    currency TEXT DEFAULT 'INR' NOT NULL,
    appraisal_date DATE,
    custodian TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (
        status IN ('PENDING_REVIEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'MORE_INFO_REQUESTED', 'TOKENIZED')
    ),
    is_verified BOOLEAN DEFAULT FALSE NOT NULL,
    review_notes TEXT,
    rejection_reason TEXT,
    verifier_address TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    token_standard TEXT DEFAULT 'ERC-721',
    contract_address TEXT,
    token_id TEXT,
    token_symbol TEXT,
    total_supply BIGINT DEFAULT 1,
    owner_address TEXT NOT NULL,
    ipfs_hash TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_user_id ON public.assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_category ON public.assets(category);

-- 3. ASSET DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS public.asset_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id TEXT REFERENCES public.assets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    storage_path TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    is_private BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_asset_id ON public.asset_documents(asset_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.asset_documents(user_id);

-- 4. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id TEXT REFERENCES public.assets(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    admin_email TEXT NOT NULL,
    action TEXT NOT NULL, -- START_REVIEW, APPROVE, REJECT, REQUEST_MORE_INFO
    previous_status TEXT,
    new_status TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_asset_id ON public.audit_logs(asset_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.audit_logs(created_at DESC);

-- 5. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    asset_id TEXT REFERENCES public.assets(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    transaction_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED')),
    transaction_hash TEXT,
    chain_id TEXT,
    token_id TEXT,
    amount TEXT,
    block_number BIGINT,
    gas_fee TEXT,
    error_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tx_asset_id ON public.transactions(asset_id);
CREATE INDEX IF NOT EXISTS idx_tx_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_tx_hash ON public.transactions(transaction_hash);

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- PROFILES POLICIES
-- ------------------------------------------------------------------------------
-- Anyone authenticated can read their own profile, or admins can read all profiles
CREATE POLICY "Profiles read access" ON public.profiles
    FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

-- Users can update only their own profile details (full_name, wallet_address)
CREATE POLICY "Profiles update own profile" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- ASSETS POLICIES
-- ------------------------------------------------------------------------------
-- Read assets: Users can view their own submissions; all users can view approved/tokenized assets; admins can view all
CREATE POLICY "Assets select policy" ON public.assets
    FOR SELECT
    USING (
        auth.uid() = user_id OR
        status IN ('APPROVED', 'TOKENIZED') OR
        public.is_admin()
    );

-- Insert assets: Authenticated users can insert their own asset submissions with status PENDING_REVIEW
CREATE POLICY "Assets insert policy" ON public.assets
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND
        status = 'PENDING_REVIEW'
    );

-- Update assets:
-- 1. Applicants can update their asset ONLY if in MORE_INFO_REQUESTED state
CREATE POLICY "Assets applicant update policy" ON public.assets
    FOR UPDATE
    USING (
        auth.uid() = user_id AND
        status IN ('MORE_INFO_REQUESTED', 'PENDING_REVIEW')
    )
    WITH CHECK (
        auth.uid() = user_id AND
        (status = 'PENDING_REVIEW' OR status = 'MORE_INFO_REQUESTED') AND
        is_verified = FALSE
    );

-- 2. Administrators can update any asset (including approving, rejecting, review notes)
CREATE POLICY "Assets admin update policy" ON public.assets
    FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- ASSET DOCUMENTS POLICIES
-- ------------------------------------------------------------------------------
-- Read documents: Asset owner or admin
CREATE POLICY "Documents select policy" ON public.asset_documents
    FOR SELECT
    USING (
        auth.uid() = user_id OR
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.assets a
            WHERE a.id = asset_documents.asset_id AND a.user_id = auth.uid()
        )
    );

-- Insert documents: Asset owner
CREATE POLICY "Documents insert policy" ON public.asset_documents
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id OR
        public.is_admin()
    );

-- Delete documents: Asset owner or admin
CREATE POLICY "Documents delete policy" ON public.asset_documents
    FOR DELETE
    USING (
        auth.uid() = user_id OR
        public.is_admin()
    );

-- ------------------------------------------------------------------------------
-- AUDIT LOGS POLICIES
-- ------------------------------------------------------------------------------
-- Read audit logs: Admins can view all; applicants can view logs for their own assets
CREATE POLICY "Audit logs select policy" ON public.audit_logs
    FOR SELECT
    USING (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.assets a
            WHERE a.id = audit_logs.asset_id AND a.user_id = auth.uid()
        )
    );

-- Insert audit logs: Administrators only
CREATE POLICY "Audit logs insert policy" ON public.audit_logs
    FOR INSERT
    WITH CHECK (public.is_admin());

-- Notice: No UPDATE or DELETE policies on audit_logs => Immutable audit trail!

-- ------------------------------------------------------------------------------
-- TRANSACTIONS POLICIES
-- ------------------------------------------------------------------------------
-- Read transactions: Owner or admin, or public ledger events
CREATE POLICY "Transactions select policy" ON public.transactions
    FOR SELECT
    USING (
        auth.uid() = user_id OR
        public.is_admin() OR
        status = 'CONFIRMED'
    );

-- Insert transactions: Authenticated users or admins
CREATE POLICY "Transactions insert policy" ON public.transactions
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id OR
        public.is_admin()
    );

-- Update transactions: Admins or owner
CREATE POLICY "Transactions update policy" ON public.transactions
    FOR UPDATE
    USING (
        auth.uid() = user_id OR
        public.is_admin()
    );

-- ==============================================================================
-- 7. SUPABASE STORAGE BUCKET CONFIGURATION
-- ==============================================================================
-- Bucket: asset-documents (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'asset-documents',
    'asset-documents',
    FALSE,
    10485760, -- 10MB limit
    ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE
SET public = FALSE,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

-- Storage RLS Policies
CREATE POLICY "Asset Documents Upload Policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'asset-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Asset Documents Select Policy"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'asset-documents' AND
    (
        (storage.foldername(name))[1] = auth.uid()::text OR
        public.is_admin()
    )
);

CREATE POLICY "Asset Documents Delete Policy"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'asset-documents' AND
    (
        (storage.foldername(name))[1] = auth.uid()::text OR
        public.is_admin()
    )
);
