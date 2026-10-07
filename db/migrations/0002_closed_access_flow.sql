ALTER TABLE signup_tokens ADD COLUMN invitation_type TEXT NOT NULL DEFAULT 'staff';
ALTER TABLE signup_tokens ADD COLUMN access_request_id INTEGER;
ALTER TABLE signup_tokens ADD COLUMN verification_code_hash TEXT;
ALTER TABLE signup_tokens ADD COLUMN verification_expires_at TEXT;
ALTER TABLE signup_tokens ADD COLUMN verification_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE signup_tokens ADD COLUMN verified_at TEXT;

CREATE TABLE IF NOT EXISTS access_requests (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    local_agency_name TEXT,
    staff_id TEXT,
    note TEXT NOT NULL,
    requested_member_type TEXT NOT NULL CHECK (requested_member_type IN ('agency', 'internal')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')) DEFAULT 'pending',
    reviewed_by INTEGER,
    reviewed_at TEXT,
    denial_reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
