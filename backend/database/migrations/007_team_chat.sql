-- Add one durable conversation per team without replacing existing direct chats.
ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS team_id BIGINT REFERENCES teams(id) ON DELETE CASCADE;

-- Team conversations do not have a direct-user pair. Existing direct rows keep
-- their values and unique pair constraint.
ALTER TABLE conversations
    ALTER COLUMN direct_user_low DROP NOT NULL,
    ALTER COLUMN direct_user_high DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_team_unique_idx
    ON conversations(team_id) WHERE team_id IS NOT NULL;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'conversations_kind_check'
          AND conrelid = 'conversations'::regclass
    ) THEN
        ALTER TABLE conversations ADD CONSTRAINT conversations_kind_check CHECK (
            (team_id IS NOT NULL AND direct_user_low IS NULL AND direct_user_high IS NULL)
            OR
            (team_id IS NULL AND direct_user_low IS NOT NULL AND direct_user_high IS NOT NULL AND direct_user_low < direct_user_high)
        );
    END IF;
END $$;

-- A per-participant watermark supports correct unread counts for team chats.
-- Historical message.read_at remains populated for existing direct messages.
ALTER TABLE conversation_members
    ADD COLUMN IF NOT EXISTS last_read_message_id BIGINT NOT NULL DEFAULT 0;

UPDATE conversation_members cm
SET last_read_message_id = GREATEST(
    cm.last_read_message_id,
    COALESCE((
        SELECT MAX(m.id)
        FROM messages m
        WHERE m.conversation_id = cm.conversation_id
          AND m.sender_id <> cm.user_id
          AND m.read_at IS NOT NULL
    ), 0)
);

CREATE INDEX IF NOT EXISTS conversation_members_unread_idx
    ON conversation_members(user_id, conversation_id, last_read_message_id);
