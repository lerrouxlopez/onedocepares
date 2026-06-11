CREATE TABLE IF NOT EXISTS media (
    id UUID PRIMARY KEY,
    filename TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    alt_text TEXT,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    url TEXT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cms_posts (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    body TEXT NOT NULL,
    excerpt TEXT,
    cover_image_id UUID REFERENCES media (id) ON DELETE SET NULL,
    seo_title TEXT,
    seo_description TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users (id),
    updated_by UUID NOT NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT cms_posts_status_check CHECK (status IN ('draft', 'published'))
);

CREATE TABLE IF NOT EXISTS homepage_sections (
    id UUID PRIMARY KEY,
    section_key TEXT NOT NULL UNIQUE,
    title TEXT,
    body TEXT,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    updated_by UUID REFERENCES users (id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menus (
    id UUID PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY,
    menu_id UUID NOT NULL REFERENCES menus (id) ON DELETE CASCADE,
    parent_id UUID REFERENCES menu_items (id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    opens_new_tab BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_by UUID REFERENCES users (id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO site_settings (key, value)
VALUES
    ('site_name', 'One Doce Pares'),
    ('site_tagline', ''),
    ('contact_email', ''),
    ('social_facebook', ''),
    ('social_instagram', '')
ON CONFLICT (key) DO NOTHING;

INSERT INTO homepage_sections (id, section_key, title, sort_order)
VALUES
    (gen_random_uuid(), 'hero', 'Welcome', 0),
    (gen_random_uuid(), 'tournaments', 'Upcoming Tournaments', 1),
    (gen_random_uuid(), 'leaderboard', 'Top Players', 2),
    (gen_random_uuid(), 'news', 'Latest News', 3)
ON CONFLICT (section_key) DO NOTHING;
