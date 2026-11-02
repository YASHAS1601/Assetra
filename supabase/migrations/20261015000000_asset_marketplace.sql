-- ==============================================================================
-- Assetra Protocol: Cross-User Asset Discovery and Token Marketplace Migration
-- Decouples verification, tokenization, listing, and ownership states.
-- Adds secure RPC function for recording confirmed on-chain purchases.
-- ==============================================================================

-- 1. Extend public.assets with granular state columns
ALTER TABLE public.assets
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'PENDING'
    CHECK (verification_status IN ('PENDING', 'APPROVED', 'REJECTED', 'MORE_INFO_REQUESTED')),
ADD COLUMN IF NOT EXISTS token_status TEXT DEFAULT 'NOT_TOKENIZED'
    CHECK (token_status IN ('NOT_TOKENIZED', 'PENDING', 'TOKENIZED', 'FAILED')),
ADD COLUMN IF NOT EXISTS listing_status TEXT DEFAULT 'UNLISTED'
    CHECK (listing_status IN ('LISTED', 'UNLISTED')),
ADD COLUMN IF NOT EXISTS listing_price_eth NUMERIC(18, 6) DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_owner_address TEXT,
ADD COLUMN IF NOT EXISTS marketplace_contract_address TEXT,
ADD COLUMN IF NOT EXISTS last_purchased_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_purchased_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Populate new columns from legacy state
UPDATE public.assets
SET 
    verification_status = CASE 
        WHEN is_verified = TRUE OR status IN ('APPROVED', 'TOKENIZED') THEN 'APPROVED'
        WHEN status = 'REJECTED' THEN 'REJECTED'
        WHEN status = 'MORE_INFO_REQUESTED' THEN 'MORE_INFO_REQUESTED'
        ELSE 'PENDING'
    END,
    token_status = CASE 
        WHEN status = 'TOKENIZED' OR contract_address IS NOT NULL THEN 'TOKENIZED'
        ELSE 'NOT_TOKENIZED'
    END,
    current_owner_address = COALESCE(current_owner_address, owner_address)
WHERE verification_status IS NULL OR token_status IS NULL OR current_owner_address IS NULL;

-- Indexing for marketplace discovery queries
CREATE INDEX IF NOT EXISTS idx_assets_verification_status ON public.assets(verification_status);
CREATE INDEX IF NOT EXISTS idx_assets_listing_status ON public.assets(listing_status);
CREATE INDEX IF NOT EXISTS idx_assets_current_owner ON public.assets(current_owner_address);

-- 3. Update Row Level Security (RLS) Policies on public.assets
-- Ensure all authenticated users can discover APPROVED or listed assets, while unapproved submissions stay private.
DROP POLICY IF EXISTS "Assets select policy" ON public.assets;
CREATE POLICY "Assets select policy" ON public.assets
    FOR SELECT
    USING (
        auth.uid() = user_id OR
        verification_status = 'APPROVED' OR
        is_verified = TRUE OR
        status IN ('APPROVED', 'TOKENIZED') OR
        listing_status = 'LISTED' OR
        public.is_admin()
    );

-- Allow asset owners to list or update listing price on their own tokenized assets
DROP POLICY IF EXISTS "Assets owner listing update policy" ON public.assets;
CREATE POLICY "Assets owner listing update policy" ON public.assets
    FOR UPDATE
    USING (
        (auth.uid() = user_id OR LOWER(current_owner_address) = LOWER(auth.jwt() ->> 'wallet_address'))
        AND (verification_status = 'APPROVED' OR is_verified = TRUE)
    )
    WITH CHECK (
        (auth.uid() = user_id OR LOWER(current_owner_address) = LOWER(auth.jwt() ->> 'wallet_address'))
        AND (verification_status = 'APPROVED' OR is_verified = TRUE)
    );

-- 4. Function: Securely record confirmed on-chain token purchase (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.record_token_purchase(
    p_asset_id TEXT,
    p_buyer_wallet TEXT,
    p_tx_hash TEXT,
    p_chain_id TEXT DEFAULT '31337',
    p_price_eth NUMERIC DEFAULT 0,
    p_block_number BIGINT DEFAULT NULL,
    p_gas_fee TEXT DEFAULT '0.0050 ETH'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_asset public.assets%ROWTYPE;
    v_buyer_id UUID := auth.uid();
    v_prev_owner TEXT;
    v_tx_id TEXT;
    v_result JSONB;
BEGIN
    -- 1. Validate caller is authenticated
    IF v_buyer_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to execute purchase recording.';
    END IF;

    -- 2. Validate asset existence and approved status
    SELECT * INTO v_asset
    FROM public.assets
    WHERE id = p_asset_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Asset with ID % not found.', p_asset_id;
    END IF;

    IF v_asset.verification_status <> 'APPROVED' AND NOT v_asset.is_verified THEN
        RAISE EXCEPTION 'Asset % is not approved for marketplace transactions.', p_asset_id;
    END IF;

    v_prev_owner := COALESCE(v_asset.current_owner_address, v_asset.owner_address);

    -- 3. Atomic state update: Transfer ownership to buyer, delist from marketplace
    UPDATE public.assets
    SET 
        current_owner_address = p_buyer_wallet,
        listing_status = 'UNLISTED',
        last_purchased_at = timezone('utc'::text, now()),
        last_purchased_by = v_buyer_id,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_asset_id;

    -- 4. Record confirmed transaction in immutable ledger
    v_tx_id := 'TX-' || to_char(now(), 'YYYY') || '-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    
    INSERT INTO public.transactions (
        id,
        asset_id,
        user_id,
        transaction_type,
        status,
        transaction_hash,
        chain_id,
        token_id,
        amount,
        block_number,
        gas_fee
    ) VALUES (
        v_tx_id,
        p_asset_id,
        v_buyer_id,
        'Token Purchase (Marketplace)',
        'CONFIRMED',
        p_tx_hash,
        p_chain_id,
        COALESCE(v_asset.token_id, '1'),
        COALESCE(p_price_eth::text || ' ETH', '0.0000 ETH'),
        p_block_number,
        p_gas_fee
    );

    -- 5. Record audit log entry
    INSERT INTO public.audit_logs (
        asset_id,
        admin_id,
        admin_email,
        action,
        previous_status,
        new_status,
        notes
    ) VALUES (
        p_asset_id,
        v_buyer_id,
        COALESCE((SELECT email FROM public.profiles WHERE id = v_buyer_id), 'buyer@assetra.io'),
        'MARKETPLACE_PURCHASE',
        v_asset.listing_status,
        'UNLISTED',
        'Purchased on-chain by ' || p_buyer_wallet || ' from ' || v_prev_owner || ' for ' || p_price_eth || ' ETH. Tx: ' || p_tx_hash
    );

    -- 6. Return updated record
    SELECT to_jsonb(a) INTO v_result
    FROM public.assets a
    WHERE a.id = p_asset_id;

    RETURN v_result;
END;
$$;
