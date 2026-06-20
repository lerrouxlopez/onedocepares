-- Ranking rules: configurable point values per event type
CREATE TABLE ranking_rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type  TEXT NOT NULL UNIQUE,
    points      INT  NOT NULL DEFAULT 0,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO ranking_rules (event_type, points, description) VALUES
    ('tournament_participation', 5,  'Points awarded when a team''s registration is approved'),
    ('tournament_completion',    10, 'Points awarded when a team completes a tournament (checked in)');

-- Leaderboard snapshots: each rebuild creates an immutable snapshot
CREATE TABLE leaderboard_snapshots (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label       TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('player', 'team')),
    built_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    built_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Individual ranked entries within a snapshot
CREATE TABLE leaderboard_entries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES leaderboard_snapshots(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id   UUID NOT NULL,
    entity_name TEXT NOT NULL,
    entity_slug TEXT NOT NULL,
    rank        INT  NOT NULL,
    points      INT  NOT NULL DEFAULT 0,
    wins        INT  NOT NULL DEFAULT 0,
    losses      INT  NOT NULL DEFAULT 0,
    draws       INT  NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leaderboard_entries_snapshot ON leaderboard_entries (snapshot_id, rank);

-- Activity feed: auto-generated events surfaced publicly
CREATE TABLE activity_feed (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type  TEXT NOT NULL,
    entity_type TEXT,
    entity_id   UUID,
    entity_slug TEXT,
    actor_type  TEXT,
    actor_id    UUID,
    actor_slug  TEXT,
    title       TEXT NOT NULL,
    body        TEXT,
    is_visible  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_feed_created    ON activity_feed (created_at DESC);
CREATE INDEX idx_activity_feed_entity     ON activity_feed (entity_type, entity_id);
CREATE INDEX idx_activity_feed_actor      ON activity_feed (actor_type, actor_id);
CREATE INDEX idx_activity_feed_visibility ON activity_feed (is_visible, created_at DESC);

-- Audit log: every admin write action is recorded here
CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    action      TEXT NOT NULL,
    entity_type TEXT,
    entity_id   UUID,
    details     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_created ON audit_log (created_at DESC);
CREATE INDEX idx_audit_log_user    ON audit_log (user_id);
