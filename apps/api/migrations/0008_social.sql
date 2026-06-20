-- Follows: a user follows a team or player
CREATE TABLE follows (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type TEXT        NOT NULL CHECK (entity_type IN ('team', 'player')),
    entity_id   UUID        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, entity_type, entity_id)
);

-- Likes on activity_feed items
CREATE TABLE likes (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feed_item_id UUID        NOT NULL REFERENCES activity_feed(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, feed_item_id)
);

-- Moderated comments on activity_feed items
CREATE TABLE comments (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feed_item_id UUID        NOT NULL REFERENCES activity_feed(id) ON DELETE CASCADE,
    body         TEXT        NOT NULL,
    status       TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Badge definitions
CREATE TABLE badges (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    slug        TEXT        NOT NULL UNIQUE,
    description TEXT,
    icon_url    TEXT,
    category    TEXT        NOT NULL DEFAULT 'general',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Player badge awards
CREATE TABLE player_badges (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id  UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    badge_id   UUID        NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    awarded_by UUID        REFERENCES users(id) ON DELETE SET NULL,
    notes      TEXT,
    UNIQUE (player_id, badge_id)
);

-- Team badge awards
CREATE TABLE team_badges (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id    UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    badge_id   UUID        NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    awarded_by UUID        REFERENCES users(id) ON DELETE SET NULL,
    notes      TEXT,
    UNIQUE (team_id, badge_id)
);

CREATE INDEX idx_follows_entity   ON follows  (entity_type, entity_id);
CREATE INDEX idx_likes_feed_item  ON likes    (feed_item_id);
CREATE INDEX idx_comments_feed    ON comments (feed_item_id, status);
CREATE INDEX idx_player_badges    ON player_badges (player_id);
CREATE INDEX idx_team_badges      ON team_badges   (team_id);
