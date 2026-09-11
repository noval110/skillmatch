ALTER TABLE teams
    ADD COLUMN IF NOT EXISTS beginner_friendly BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS willing_to_mentor BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE team_roles
    ADD COLUMN IF NOT EXISTS experience_preference VARCHAR(30) NOT NULL DEFAULT 'open';

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS preferred_role VARCHAR(100),
    ADD COLUMN IF NOT EXISTS availability VARCHAR(30),
    ADD COLUMN IF NOT EXISTS project_interest VARCHAR(100);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_roles_experience_preference_check' AND conrelid = 'team_roles'::regclass) THEN
        ALTER TABLE team_roles ADD CONSTRAINT team_roles_experience_preference_check
            CHECK (experience_preference IN ('beginner', 'intermediate', 'advanced', 'open'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_availability_check' AND conrelid = 'users'::regclass) THEN
        ALTER TABLE users ADD CONSTRAINT users_availability_check
            CHECK (availability IS NULL OR availability IN ('', 'weekday', 'weekend', 'flexible'));
    END IF;
END $$;
