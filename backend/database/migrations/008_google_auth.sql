-- Keep password accounts intact. Google-only users have an empty password hash,
-- which bcrypt rejects; Google identity is always matched by its stable subject.
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_subject VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS users_google_subject_unique
    ON users (google_subject) WHERE google_subject IS NOT NULL;
