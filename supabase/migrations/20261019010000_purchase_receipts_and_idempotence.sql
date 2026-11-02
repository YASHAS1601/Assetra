-- ==============================================================================
-- Assetra Protocol: Purchase Receipts & Settlement Idempotency Migration
-- Creates purchase_receipts table, enforces RLS, guarantees tx idempotence,
-- and updates record_token_purchase RPC to return atomic receipt records.
-- ==============================================================================

-- 1. PURCHASE RECEIPTS TABLE
CREATE TABLE IF NOT EXISTS public.purchase_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number TEXT UNIQUE NOT NULL,
    asset_id TEXT NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    asset_name TEXT NOT NULL,
    token_id TEXT NOT NULL,
    buyer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    buyer_wallet TEXT NOT NULL,
    seller_wallet TEXT NOT NULL,
    price_eth NUMERIC(18, 6) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ETH',
    transaction_hash TEXT UNIQUE NOT NULL, -- Core idempotency key
    block_number BIGINT,
    chain_id TEXT NOT NULL DEFAULT '11155111',
    token_contract TEXT NOT NULL,
    marketplace_contract TEXT NOT NULL,
    gas_fee TEXT DEFAULT '0.0050 ETH',
    storage_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance and authorization lookups
CREATE INDEX IF NOT EXISTS idx_receipts_asset_id ON public.purchase_receipts(asset_id);
CREATE INDEX IF NOT EXISTS idx_receipts_buyer_id ON public.purchase_receipts(buyer_id);
CREATE INDEX IF NOT EXISTS idx_receipts_buyer_wallet ON public.purchase_receipts(buyer_wallet);
CREATE INDEX IF NOT EXISTS idx_receipts_tx_hash ON public.purchase_receipts(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_receipts_number ON public.purchase_receipts(receipt_number);

-- 2. Idempotency Constraint on Transactions table
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_hash 
ON public.transactions(transaction_hash) 
WHERE transaction_hash IS NOT NULL;

-- 3. Row Level Security on purchase_receipts
ALTER TABLE public.purchase_receipts ENABLE ROW LEVEL SECURITY;

-- Select Policy: ONLY the buyer or protocol administrator can read the receipt
DROP POLICY IF EXISTS "Receipts select policy" ON public.purchase_receipts;
CREATE POLICY "Receipts select policy" ON public.purchase_receipts
    FOR SELECT
    USING (
        auth.uid() = buyer_id OR
        LOWER(buyer_wallet) = LOWER(auth.jwt() ->> 'wallet_address') OR
        public.is_admin()
    );

-- Insert Policy: Authenticated buyer or admin can insert
DROP POLICY IF EXISTS "Receipts insert policy" ON public.purchase_receipts;
CREATE POLICY "Receipts insert policy" ON public.purchase_receipts
    FOR INSERT
    WITH CHECK (
        auth.uid() = buyer_id OR
        public.is_admin()
    );

-- 4. Atomic & Idempotent Purchase Recording Function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.record_token_purchase(
    p_asset_id TEXT,
    p_buyer_wallet TEXT,
    p_tx_hash TEXT,
    p_chain_id TEXT DEFAULT '11155111',
    p_price_eth NUMERIC DEFAULT 0,
    p_block_number BIGINT DEFAULT NULL,
    p_gas_fee TEXT DEFAULT '0.0050 ETH',
    p_seller_wallet TEXT DEFAULT NULL,
    p_token_contract TEXT DEFAULT '0x2F0d80D15773A473A00bE3B732D4B46974732501',
    p_marketplace_contract TEXT DEFAULT '0x517082aA429ED926BDbeC904a1879BaE1aFd05f7'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_asset public.assets%ROWTYPE;
    v_buyer_id UUID := auth.uid();
    v_existing_receipt public.purchase_receipts%ROWTYPE;
    v_prev_owner TEXT;
    v_receipt_no TEXT;
    v_tx_id TEXT;
    v_result JSONB;
BEGIN
    -- 1. Idempotency Check: Return existing receipt if this transaction hash was already processed
    SELECT * INTO v_existing_receipt
    FROM public.purchase_receipts
    WHERE transaction_hash = p_tx_hash;

    IF FOUND THEN
        SELECT to_jsonb(a) INTO v_result
        FROM public.assets a
        WHERE a.id = p_asset_id;

        RETURN jsonb_build_object(
            'asset', v_result,
            'receipt', to_jsonb(v_existing_receipt),
            'idempotent', true
        );
    END IF;

    -- 2. Validate asset existence
    SELECT * INTO v_asset
    FROM public.assets
    WHERE id = p_asset_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Asset with ID % not found.', p_asset_id;
    END IF;

    v_prev_owner := COALESCE(p_seller_wallet, v_asset.current_owner_address, v_asset.owner_address);

    -- 3. Atomic update to Asset record
    UPDATE public.assets
    SET 
        current_owner_address = p_buyer_wallet,
        listing_status = 'UNLISTED',
        last_purchased_at = timezone('utc'::text, now()),
        last_purchased_by = v_buyer_id,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_asset_id;

    -- 4. Generate unique institutional receipt number
    v_receipt_no := 'REC-' || to_char(now(), 'YYYY') || '-' || upper(substring(md5(p_tx_hash) from 1 for 6));

    -- 5. Insert into purchase_receipts (Idempotent with ON CONFLICT)
    INSERT INTO public.purchase_receipts (
        receipt_number,
        asset_id,
        asset_name,
        token_id,
        buyer_id,
        buyer_wallet,
        seller_wallet,
        price_eth,
        currency,
        transaction_hash,
        block_number,
        chain_id,
        token_contract,
        marketplace_contract,
        gas_fee
    ) VALUES (
        v_receipt_no,
        p_asset_id,
        v_asset.name,
        COALESCE(v_asset.token_id, '1'),
        v_buyer_id,
        p_buyer_wallet,
        v_prev_owner,
        p_price_eth,
        'ETH',
        p_tx_hash,
        p_block_number,
        p_chain_id,
        p_token_contract,
        p_marketplace_contract,
        p_gas_fee
    )
    ON CONFLICT (transaction_hash) DO NOTHING
    RETURNING * INTO v_existing_receipt;

    -- If another concurrent process inserted it, fetch it
    IF v_existing_receipt.id IS NULL THEN
        SELECT * INTO v_existing_receipt
        FROM public.purchase_receipts
        WHERE transaction_hash = p_tx_hash;
    END IF;

    -- 6. Insert into transactions table (Idempotent with ON CONFLICT)
    v_tx_id := 'TX-' || to_char(now(), 'YYYY') || '-' || upper(substring(md5(p_tx_hash) from 1 for 6));
    
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
    )
    ON CONFLICT (transaction_hash) DO NOTHING;

    -- 7. Audit log entry
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
        'Purchased on-chain by ' || p_buyer_wallet || ' from ' || v_prev_owner || ' for ' || p_price_eth || ' ETH. Receipt: ' || v_receipt_no || '. Tx: ' || p_tx_hash
    );

    -- 8. Return updated asset and receipt
    SELECT to_jsonb(a) INTO v_result
    FROM public.assets a
    WHERE a.id = p_asset_id;

    RETURN jsonb_build_object(
        'asset', v_result,
        'receipt', to_jsonb(v_existing_receipt),
        'idempotent', false
    );
END;
$$;
