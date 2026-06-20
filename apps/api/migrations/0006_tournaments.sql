-- Tournaments
CREATE TABLE tournaments (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  TEXT NOT NULL,
    slug                  TEXT NOT NULL UNIQUE,
    description           TEXT,
    location              TEXT,
    start_date            DATE,
    end_date              DATE,
    registration_open_at  TIMESTAMPTZ,
    registration_close_at TIMESTAMPTZ,
    status                TEXT NOT NULL DEFAULT 'upcoming',
    max_teams             INT,
    created_by            UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by            UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Divisions within a tournament (e.g., by weight class or belt level)
CREATE TABLE tournament_divisions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id    UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    description      TEXT,
    max_participants INT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Team registrations for a tournament
CREATE TABLE tournament_team_registrations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    division_id   UUID REFERENCES tournament_divisions(id) ON DELETE SET NULL,
    status        TEXT NOT NULL DEFAULT 'pending',
    registered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tournament_id, team_id)
);

-- Individual player entries within a team registration
CREATE TABLE tournament_player_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES tournament_team_registrations(id) ON DELETE CASCADE,
    player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    division_id     UUID REFERENCES tournament_divisions(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (registration_id, player_id)
);
