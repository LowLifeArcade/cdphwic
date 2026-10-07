CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
    member_type TEXT NOT NULL CHECK (member_type IN ('internal', 'agency')),
    password_hash_stub TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agencies (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    preferred_internal_member_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agency_members (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    agency_id INTEGER NOT NULL,
    preferred_internal_member_id INTEGER,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS internal_members (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_agency_assignments (
    id INTEGER PRIMARY KEY,
    internal_member_id INTEGER NOT NULL,
    agency_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (internal_member_id, agency_id)
);

CREATE TABLE IF NOT EXISTS staff_rep_assignments (
    id INTEGER PRIMARY KEY,
    internal_member_id INTEGER NOT NULL,
    agency_member_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (internal_member_id, agency_member_id)
);

CREATE TABLE IF NOT EXISTS signup_tokens (
    id INTEGER PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    member_type TEXT NOT NULL,
    agency_id INTEGER,
    expires_at TEXT NOT NULL,
    used_at TEXT
);

CREATE TABLE IF NOT EXISTS participants (
    family_id INTEGER PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    dob TEXT NOT NULL,
    benefits_cycle_date TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    form TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('standard', 'exempt', 'nutritional')),
    units_per_case INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY,
    participant_family_id INTEGER,
    agency_id INTEGER NOT NULL,
    agency_member_id INTEGER NOT NULL,
    assigned_internal_member_id INTEGER,
    product_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'approved', 'denied')),
    submission_date TEXT,
    approval_date TEXT,
    denial_date TEXT,
    eta TEXT,
    benefits_months_start TEXT,
    benefits_months_end TEXT,
    medical_status TEXT CHECK (medical_status IN ('yes', 'no', 'pending')),
    diagnosis TEXT,
    request_kind TEXT,
    units_requested INTEGER,
    surplus_units INTEGER DEFAULT 0,
    surplus_expiration_date TEXT,
    tracking_number TEXT,
    delivery_status TEXT,
    replacement_requested INTEGER NOT NULL DEFAULT 0,
    comments TEXT,
    internal_comments TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS request_attachments (
    id INTEGER PRIMARY KEY,
    request_id INTEGER NOT NULL,
    attachment_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    storage_key_stub TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mckesson_logs (
    id INTEGER PRIMARY KEY,
    request_id INTEGER,
    generic_reference TEXT,
    quantity INTEGER,
    status TEXT,
    logged_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_requests_agency ON requests (agency_id);
CREATE INDEX IF NOT EXISTS idx_requests_rep ON requests (agency_member_id);
CREATE INDEX IF NOT EXISTS idx_requests_staff ON requests (assigned_internal_member_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests (status);
CREATE INDEX IF NOT EXISTS idx_requests_submission ON requests (submission_date);
