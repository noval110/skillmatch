CREATE TABLE IF NOT EXISTS user_portfolios (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL CHECK (length(trim(title)) > 0),
    description TEXT NOT NULL DEFAULT '',
    role VARCHAR(120) NOT NULL DEFAULT '',
    project_url TEXT NOT NULL DEFAULT '',
    repository_url TEXT NOT NULL DEFAULT '',
    technologies TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_portfolios_owner_idx ON user_portfolios(user_id, id DESC);
CREATE TABLE IF NOT EXISTS user_achievements (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL CHECK (length(trim(title)) > 0),
    organization VARCHAR(200) NOT NULL DEFAULT '',
    achievement_type VARCHAR(30) NOT NULL CHECK (achievement_type IN ('competition','certification','award','other')),
    date DATE,
    description TEXT NOT NULL DEFAULT '',
    credential_url TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_achievements_owner_idx ON user_achievements(user_id, id DESC);
