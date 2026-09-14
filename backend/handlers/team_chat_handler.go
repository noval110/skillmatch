package handlers

import (
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

// GetTeamConversation returns the single conversation that belongs to a team.
//
// A team conversation is created lazily the first time an owner/member opens it.
// Current team members are inserted into conversation_members so they can send
// messages, but old conversation_members rows are intentionally preserved so
// historical messages are not deleted by the messages foreign key.
func GetTeamConversation(c echo.Context, pool *pgxpool.Pool) error {
	teamID, err := resourceID(c)
	if err != nil {
		return err
	}

	userID := c.Get("user_id").(int64)
	ctx := c.Request().Context()

	tx, err := pool.Begin(ctx)
	if err != nil {
		return dbError(c, err)
	}
	defer tx.Rollback(ctx)

	// Load team and owner first so nonexistent teams produce 404.
	var ownerID int64
	err = tx.QueryRow(
		ctx,
		`SELECT owner_id
		 FROM teams
		 WHERE id = $1`,
		teamID,
	).Scan(&ownerID)

	if errors.Is(err, pgx.ErrNoRows) {
		return apiError(c, 404, "Team not found")
	}
	if err != nil {
		return dbError(c, err)
	}

	// Owner always has access. Otherwise user must currently be a team member.
	if userID != ownerID {
		var isMember bool

		err = tx.QueryRow(
			ctx,
			`SELECT EXISTS(
				SELECT 1
				FROM team_members
				WHERE team_id = $1
				  AND user_id = $2
			)`,
			teamID,
			userID,
		).Scan(&isMember)

		if err != nil {
			return dbError(c, err)
		}

		if !isMember {
			return apiError(c, 403, "You are not a member of this team")
		}
	}

	// Exactly one conversation per team.
	// The partial unique index from 007_team_chat.sql prevents duplicates
	// even if two members open the chat at the same time.
	var conversationID int64

	err = tx.QueryRow(
		ctx,
		`INSERT INTO conversations(team_id)
		 VALUES($1)
		 ON CONFLICT (team_id) WHERE team_id IS NOT NULL
		 DO UPDATE SET team_id = EXCLUDED.team_id
		 RETURNING id`,
		teamID,
	).Scan(&conversationID)

	if err != nil {
		return dbError(c, err)
	}

	// Add the owner + every CURRENT team member to conversation_members.
	//
	// Important:
	// We deliberately do not delete old conversation_members rows here.
	// messages has a foreign key to conversation_members with ON DELETE CASCADE,
	// so deleting historical participant rows could delete their old messages.
	//
	// New participants start with the current highest message as their read
	// watermark. They can still see history, but old messages are not treated
	// as dozens of unread messages when they first join.
	_, err = tx.Exec(
		ctx,
		`INSERT INTO conversation_members(
			conversation_id,
			user_id,
			last_read_message_id
		)
		SELECT
			$1,
			members.user_id,
			COALESCE(
				(
					SELECT MAX(id)
					FROM messages
					WHERE conversation_id = $1
				),
				0
			)
		FROM (
			SELECT owner_id AS user_id
			FROM teams
			WHERE id = $2

			UNION

			SELECT user_id
			FROM team_members
			WHERE team_id = $2
		) AS members
		ON CONFLICT (conversation_id, user_id) DO NOTHING`,
		conversationID,
		teamID,
	)

	if err != nil {
		return dbError(c, err)
	}

	if err = tx.Commit(ctx); err != nil {
		return dbError(c, err)
	}

	return c.JSON(200, map[string]any{
		"id":      conversationID,
		"team_id": teamID,
		"type":    "team",
	})
}
