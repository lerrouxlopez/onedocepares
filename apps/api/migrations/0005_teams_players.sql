-- Teams: public competitor groups
CREATE TABLE teams (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    slug         TEXT NOT NULL UNIQUE,
    description  TEXT,
    logo_url     TEXT,
    city         TEXT,
    country      TEXT,
    founded_year INT,
    website      TEXT,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users who manage a team (can register it and edit team info)
CREATE TABLE team_managers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (team_id, user_id)
);

-- Players: public competitor profiles, distinct from user login accounts
CREATE TABLE players (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    slug          TEXT NOT NULL UNIQUE,
    bio           TEXT,
    photo_url     TEXT,
    date_of_birth DATE,
    nationality   TEXT,
    belt_rank     TEXT,
    weight_class  TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Team membership: which players belong to which team (historical, left_at NULL = current)
CREATE TABLE team_members (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    is_captain BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at  DATE,
    left_at    DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (team_id, player_id)
);

-- Links a user account to a player profile so the user can manage that player
CREATE TABLE user_player_links (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, player_id)
);

-- Player social media links
CREATE TABLE player_social_links (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    platform   TEXT NOT NULL,
    url        TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Team stats per season (populated by the leaderboard service)
CREATE TABLE team_stats (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    season     TEXT NOT NULL,
    wins       INT NOT NULL DEFAULT 0,
    losses     INT NOT NULL DEFAULT 0,
    draws      INT NOT NULL DEFAULT 0,
    points     INT NOT NULL DEFAULT 0,
    rank       INT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (team_id, season)
);

-- Player stats per season (populated by the leaderboard service)
CREATE TABLE player_stats (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    season     TEXT NOT NULL,
    wins       INT NOT NULL DEFAULT 0,
    losses     INT NOT NULL DEFAULT 0,
    draws      INT NOT NULL DEFAULT 0,
    points     INT NOT NULL DEFAULT 0,
    rank       INT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (player_id, season)
);
