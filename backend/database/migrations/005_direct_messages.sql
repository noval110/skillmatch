CREATE TABLE IF NOT EXISTS conversations (
    id BIGSERIAL PRIMARY KEY,
    direct_user_low BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    direct_user_high BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK(direct_user_low < direct_user_high),
    UNIQUE(direct_user_low,direct_user_high)
);
CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY(conversation_id,user_id)
);
CREATE INDEX IF NOT EXISTS conversation_members_user_idx ON conversation_members(user_id,conversation_id);
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK(length(trim(content)) BETWEEN 1 AND 4000),
    client_message_id VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    FOREIGN KEY(conversation_id,sender_id) REFERENCES conversation_members(conversation_id,user_id) ON DELETE CASCADE,
    UNIQUE(conversation_id,sender_id,client_message_id)
);
CREATE INDEX IF NOT EXISTS messages_conversation_page_idx ON messages(conversation_id,id DESC);
CREATE INDEX IF NOT EXISTS messages_unread_idx ON messages(conversation_id,sender_id) WHERE read_at IS NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_conversation_id BIGINT REFERENCES conversations(id) ON DELETE CASCADE;
-- At most one outstanding message notification per recipient/conversation.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_unread_conversation_idx
    ON notifications(user_id,related_conversation_id) WHERE type='new_message' AND NOT is_read;
