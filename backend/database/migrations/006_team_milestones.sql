-- Private competition-preparation workspace for each team.
-- A calendar date is intentional: milestones do not currently track a due time,
-- and DATE avoids shifting the displayed deadline across client time zones.
CREATE TABLE IF NOT EXISTS team_milestones (
    id BIGSERIAL PRIMARY KEY,
    team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
    description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
    status VARCHAR(20) NOT NULL DEFAULT 'not_started'
        CHECK (status IN ('not_started', 'in_progress', 'completed')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    due_date DATE,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS team_milestones_team_due_idx
    ON team_milestones(team_id, due_date, id) WHERE status <> 'completed';
CREATE INDEX IF NOT EXISTS team_milestones_team_completed_idx
    ON team_milestones(team_id, updated_at DESC, id DESC) WHERE status = 'completed';
