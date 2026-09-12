CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(60) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    related_team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL,
    related_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_user_page_idx ON notifications(user_id, id DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications(user_id) WHERE NOT is_read;

-- The event and notification commit together, including resubmitted requests.
-- Repeated status writes and migration replays never duplicate notifications.
CREATE OR REPLACE FUNCTION notify_join_request() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE team_name text; owner bigint; applicant text;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
    SELECT name, owner_id INTO team_name, owner FROM teams WHERE id=NEW.team_id;
    SELECT name INTO applicant FROM users WHERE id=NEW.user_id;
    IF NEW.status = 'pending' THEN
        INSERT INTO notifications(user_id,type,title,message,related_team_id,related_user_id)
        VALUES(owner,'join_request_received','New join request',applicant || ' requested to join ' || team_name || '.',NEW.team_id,NEW.user_id);
    ELSIF NEW.status IN ('accepted','rejected') THEN
        INSERT INTO notifications(user_id,type,title,message,related_team_id,related_user_id)
        VALUES(NEW.user_id,'join_request_' || NEW.status,'Join request ' || NEW.status,
          CASE WHEN NEW.status='accepted' THEN 'You have been accepted into ' || team_name || '.'
          ELSE 'Your request to join ' || team_name || ' was declined.' END, NEW.team_id,owner);
    END IF;
    RETURN NEW;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='join_requests'::regclass AND tgname='join_request_notification') THEN
        CREATE TRIGGER join_request_notification AFTER INSERT OR UPDATE OF status ON join_requests
        FOR EACH ROW EXECUTE FUNCTION notify_join_request();
    END IF;
END $$;
