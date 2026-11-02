-- Assetra Protocol PostgreSQL Database Schema with RBAC & Audit Trail

-- 1. Users & Roles
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'USER', -- 'USER' or 'ADMIN'
    status VARCHAR(32) DEFAULT 'ACTIVE',
    wallet_address VARCHAR(42),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Assets & Verification State
CREATE TABLE IF NOT EXISTS assets (
    id VARCHAR(64) PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(128) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    valuation NUMERIC(18, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    appraisal_date DATE,
    custodian VARCHAR(255),
    status VARCHAR(64) NOT NULL DEFAULT 'PENDING_REVIEW', -- PENDING_REVIEW, UNDER_REVIEW, APPROVED, REJECTED, MORE_INFO_REQUESTED, TOKENIZED
    is_verified BOOLEAN DEFAULT FALSE,
    review_notes TEXT,
    rejection_reason TEXT,
    verifier_address VARCHAR(42),
    approved_at TIMESTAMP WITH TIME ZONE,
    token_standard VARCHAR(32),
    contract_address VARCHAR(42),
    token_id VARCHAR(64),
    token_symbol VARCHAR(32),
    total_supply BIGINT DEFAULT 1,
    owner_address VARCHAR(42) NOT NULL,
    marketplace_contract_address VARCHAR(42),
    ipfs_hash VARCHAR(255),
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Supporting Documents
CREATE TABLE IF NOT EXISTS asset_documents (
    id SERIAL PRIMARY KEY,
    asset_id VARCHAR(64) REFERENCES assets(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    size_bytes BIGINT NOT NULL,
    is_private BOOLEAN DEFAULT TRUE,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Admin Audit History Log
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    asset_id VARCHAR(64) REFERENCES assets(id) ON DELETE CASCADE,
    admin_id INT REFERENCES users(id) ON DELETE SET NULL,
    admin_email VARCHAR(255) NOT NULL,
    action VARCHAR(64) NOT NULL, -- START_REVIEW, APPROVE, REJECT, REQUEST_MORE_INFO
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_audit_asset ON audit_logs(asset_id);
