-- ==============================================================================
-- Assetra Protocol: Secure Off-Chain Document Storage & Compliance Policies
-- Phase: Secure Document Storage, Access Control & Review Integrity
-- ==============================================================================

-- 1. Ensure schema prerequisites on public.assets exist (in case 20261015 migration was not run yet)
ALTER TABLE public.assets
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'PENDING'
    CHECK (verification_status IN ('PENDING', 'APPROVED', 'REJECTED', 'MORE_INFO_REQUESTED')),
ADD COLUMN IF NOT EXISTS token_status TEXT DEFAULT 'NOT_TOKENIZED'
    CHECK (token_status IN ('NOT_TOKENIZED', 'PENDING', 'TOKENIZED', 'FAILED')),
ADD COLUMN IF NOT EXISTS listing_status TEXT DEFAULT 'UNLISTED'
    CHECK (listing_status IN ('LISTED', 'UNLISTED')),
ADD COLUMN IF NOT EXISTS listing_price_eth NUMERIC(18, 6) DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_owner_address TEXT,
ADD COLUMN IF NOT EXISTS marketplace_contract_address TEXT;

-- Populate verification_status from legacy columns if needed
UPDATE public.assets
SET verification_status = CASE 
        WHEN is_verified = TRUE OR status IN ('APPROVED', 'TOKENIZED') THEN 'APPROVED'
        WHEN status = 'REJECTED' THEN 'REJECTED'
        WHEN status = 'MORE_INFO_REQUESTED' THEN 'MORE_INFO_REQUESTED'
        ELSE 'PENDING'
    END
WHERE verification_status IS NULL;

-- 2. Ensure Private Supabase Storage Bucket for Sensitive Asset Dossiers
-- Ensures public access is strictly disabled, with a 10MB file limit and restricted MIME types
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'asset-documents',
    'asset-documents',
    FALSE,
    10485760, -- 10MB maximum file size
    ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE
SET public = FALSE,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

-- 3. Prevent unauthorized replacement or deletion of documents used in completed reviews
-- Adds a database trigger on public.asset_documents to prevent deleting/updating documents for APPROVED assets
CREATE OR REPLACE FUNCTION public.prevent_reviewed_document_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_verification_status TEXT;
    v_status TEXT;
    v_is_verified BOOLEAN;
BEGIN
    SELECT verification_status, status, is_verified 
    INTO v_verification_status, v_status, v_is_verified
    FROM public.assets
    WHERE id = OLD.asset_id;

    IF v_verification_status = 'APPROVED' OR v_status IN ('APPROVED', 'TOKENIZED') OR v_is_verified = TRUE THEN
        RAISE EXCEPTION 'Security Policy Violation: Supporting custody documents for approved assets are legally binding records and cannot be modified or deleted.';
    END IF;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_reviewed_document_tampering ON public.asset_documents;
CREATE TRIGGER trg_prevent_reviewed_document_tampering
    BEFORE DELETE OR UPDATE ON public.asset_documents
    FOR EACH ROW EXECUTE FUNCTION public.prevent_reviewed_document_tampering();

-- 4. Storage Level RLS: Least-Privilege Policies on storage.objects

-- A. Insert Policy: Scoped strictly to the authenticated user's folder namespace
DROP POLICY IF EXISTS "Asset Documents Upload Policy" ON storage.objects;
CREATE POLICY "Asset Documents Upload Policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'asset-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- B. Select Policy: The document owner OR an authenticated admin can read/create signed URLs
DROP POLICY IF EXISTS "Asset Documents Select Policy" ON storage.objects;
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

-- C. Delete Policy: Prohibit deletion if referenced asset is approved
DROP POLICY IF EXISTS "Asset Documents Delete Policy" ON storage.objects;
CREATE POLICY "Asset Documents Delete Policy"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'asset-documents' AND
    (
        (storage.foldername(name))[1] = auth.uid()::text OR
        public.is_admin()
    ) AND
    NOT EXISTS (
        SELECT 1
        FROM public.asset_documents d
        JOIN public.assets a ON a.id = d.asset_id
        WHERE d.storage_path = name
          AND (a.verification_status = 'APPROVED' OR a.status IN ('APPROVED', 'TOKENIZED') OR a.is_verified = TRUE)
    )
);

-- D. Update Policy: Prohibit overwriting/replacing if referenced asset is approved
DROP POLICY IF EXISTS "Asset Documents Update Policy" ON storage.objects;
CREATE POLICY "Asset Documents Update Policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'asset-documents' AND
    (
        (storage.foldername(name))[1] = auth.uid()::text OR
        public.is_admin()
    ) AND
    NOT EXISTS (
        SELECT 1
        FROM public.asset_documents d
        JOIN public.assets a ON a.id = d.asset_id
        WHERE d.storage_path = name
          AND (a.verification_status = 'APPROVED' OR a.status IN ('APPROVED', 'TOKENIZED') OR a.is_verified = TRUE)
    )
);

-- 5. Audit Log Helper for Document Vault Access Events
CREATE OR REPLACE FUNCTION public.log_document_access(
    p_document_id UUID,
    p_action TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_asset_id TEXT;
    v_user_email TEXT;
BEGIN
    SELECT asset_id INTO v_asset_id
    FROM public.asset_documents
    WHERE id = p_document_id;

    SELECT email INTO v_user_email
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_asset_id IS NOT NULL THEN
        INSERT INTO public.audit_logs (
            asset_id,
            admin_id,
            admin_email,
            action,
            notes
        ) VALUES (
            v_asset_id,
            auth.uid(),
            COALESCE(v_user_email, 'authenticated_user'),
            p_action,
            'Document vault event: ' || p_action || ' on document ' || p_document_id::text
        );
    END IF;
END;
$$;
