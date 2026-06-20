-- Matches within a tournament (manual bracket entry)
CREATE TABLE matches (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID        NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    division_id   UUID        REFERENCES tournament_divisions(id) ON DELETE SET NULL,
    round         TEXT        NOT NULL DEFAULT 'Round 1',
    match_number  INT         NOT NULL DEFAULT 1,
    team1_id      UUID        REFERENCES teams(id) ON DELETE SET NULL,
    team2_id      UUID        REFERENCES teams(id) ON DELETE SET NULL,
    scheduled_at  TIMESTAMPTZ,
    status        TEXT        NOT NULL DEFAULT 'scheduled'
                              CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Results for completed matches
CREATE TABLE match_results (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id       UUID        NOT NULL UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
    winner_team_id UUID        REFERENCES teams(id) ON DELETE SET NULL,
    team1_score    INT,
    team2_score    INT,
    notes          TEXT,
    recorded_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_matches_tournament ON matches (tournament_id);

-- Additional ranking rules for match outcomes
INSERT INTO ranking_rules (event_type, points, description) VALUES
    ('match_win',  3, 'Points awarded to the winning team per match'),
    ('match_loss', 1, 'Participation points for the losing team per match');
