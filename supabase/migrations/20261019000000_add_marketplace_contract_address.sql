-- ==============================================================================
-- Assetra Protocol: Marketplace Schema Sync Migration
-- Purpose: Adds missing marketplace columns to public.assets and refreshes PostgREST schema cache
-- Target Project: Supabase PostgreSQL (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. Safely add marketplace_contract_address and related marketplace columns
ALTER TABLE public.assets
ADD COLUMN IF NOT EXISTS marketplace_contract_address TEXT,
ADD COLUMN IF NOT EXISTS last_purchased_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_purchased_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Optional index for marketplace queries
CREATE INDEX IF NOT EXISTS idx_assets_marketplace_contract ON public.assets(marketplace_contract_address);

-- 3. Notify PostgREST to immediately refresh its schema cache
NOTIFY pgrst, 'reload schema';
