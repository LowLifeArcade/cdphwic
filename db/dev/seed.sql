INSERT OR IGNORE INTO users (id, email, name, role, member_type) VALUES
    (1, 'frank@cdphwic.org', 'Frank Browne', 'admin', 'internal'),
    (2, 'maria@mendocino.example', 'Maria Lopez', 'member', 'agency'),
    (3, 'james@cdphwic.org', 'James Kim', 'member', 'internal');

INSERT OR IGNORE INTO agencies (id, name, shipping_address, city, state, postal_code, preferred_internal_member_id) VALUES
    (10, 'Mendocino County', '123 Main Street', 'Ukiah', 'CA', '95482', 200),
    (11, 'Lake County', '45 Lakeview Drive', 'Lakeport', 'CA', '95453', 200),
    (12, 'Sonoma County', '88 County Center', 'Santa Rosa', 'CA', '95403', NULL);

INSERT OR IGNORE INTO products (id, name, form, category, units_per_case) VALUES
    (301, 'Nutramigen', 'Powder', 'nutritional', 6),
    (302, 'EleCare', 'Powder', 'exempt', 6),
    (303, 'Enfamil Infant', 'Powder', 'standard', 12),
    (304, 'Neocate Splash', 'Ready-to-feed', 'nutritional', 24);
