package handlers

import (
	"errors"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

type ChatUser struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
}

type Conversation struct {
	ID          int64     `json:"id"`
	Type        string    `json:"type"`
	TeamID      int64     `json:"team_id,omitempty"`
	TeamName    string    `json:"team_name,omitempty"`
	OtherUser   *ChatUser `json:"other_user,omitempty"`
	LastMessage string    `json:"last_message"`
	UpdatedAt   time.Time `json:"updated_at"`
	UnreadCount int       `json:"unread_count"`
	MemberCount int       `json:"member_count"`
}

type Message struct {
	ID              int64      `json:"id"`
	ConversationID  int64      `json:"conversation_id"`
	SenderID        int64      `json:"sender_id"`
	SenderName      string     `json:"sender_name"`
	SenderAvatarURL string     `json:"sender_avatar_url"`
	Content         string     `json:"content"`
	CreatedAt       time.Time  `json:"created_at"`
	ReadAt          *time.Time `json:"read_at"`
}

type conversationScanner interface {
	Scan(dest ...any) error
}

func CreateConversation(c echo.Context, pool *pgxpool.Pool) error {
	var body struct {
		UserID int64 `json:"user_id"`
	}

	if err := readBody(c, &body); err != nil {
		return err
	}

	userID := c.Get("user_id").(int64)

	if body.UserID <= 0 || body.UserID == userID {
		return apiError(c, 400, "Choose another SkillMatch member")
	}

	ctx := c.Request().Context()

	tx, err := pool.Begin(ctx)
	if err != nil {
		return dbError(c, err)
	}
	defer tx.Rollback(ctx)

	var exists bool

	err = tx.QueryRow(
		ctx,
		`SELECT EXISTS(
			SELECT 1
			FROM users
			WHERE id = $1
		)`,
		body.UserID,
	).Scan(&exists)

	if err != nil {
		return dbError(c, err)
	}

	if !exists {
		return apiError(c, 404, "User not found")
	}

	low, high := userID, body.UserID

	if low > high {
		low, high = high, low
	}

	var conversationID int64

	err = tx.QueryRow(
		ctx,
		`INSERT INTO conversations(
			direct_user_low,
			direct_user_high
		)
		VALUES($1, $2)
		ON CONFLICT(direct_user_low, direct_user_high)
		DO UPDATE SET direct_user_low = EXCLUDED.direct_user_low
		RETURNING id`,
		low,
		high,
	).Scan(&conversationID)

	if err != nil {
		return dbError(c, err)
	}

	_, err = tx.Exec(
		ctx,
		`INSERT INTO conversation_members(
			conversation_id,
			user_id
		)
		VALUES
			($1, $2),
			($1, $3)
		ON CONFLICT DO NOTHING`,
		conversationID,
		low,
		high,
	)

	if err != nil {
		return dbError(c, err)
	}

	if err = tx.Commit(ctx); err != nil {
		return dbError(c, err)
	}

	return c.JSON(200, map[string]any{
		"id":   conversationID,
		"type": "direct",
	})
}

func syncCurrentUserTeamConversations(
	c echo.Context,
	pool *pgxpool.Pool,
) error {
	ctx := c.Request().Context()
	userID := c.Get("user_id").(int64)

	_, err := pool.Exec(
		ctx,
		`INSERT INTO conversation_members(
			conversation_id,
			user_id,
			last_read_message_id
		)
		SELECT
			conv.id,
			$1,
			COALESCE(
				(
					SELECT MAX(m.id)
					FROM messages m
					WHERE m.conversation_id = conv.id
				),
				0
			)
		FROM conversations conv
		JOIN teams t ON t.id = conv.team_id
		WHERE conv.team_id IS NOT NULL
		  AND (
				t.owner_id = $1
				OR EXISTS(
					SELECT 1
					FROM team_members tm
					WHERE tm.team_id = t.id
					  AND tm.user_id = $1
				)
		  )
		ON CONFLICT(conversation_id, user_id)
		DO NOTHING`,
		userID,
	)

	return err
}

const conversationSelect = `
SELECT
	c.id,
	CASE
		WHEN c.team_id IS NULL THEN 'direct'
		ELSE 'team'
	END,
	COALESCE(c.team_id, 0),
	COALESCE(t.name, ''),
	COALESCE(u.id, 0),
	COALESCE(u.name, ''),
	COALESCE(
		(
			SELECT m.content
			FROM messages m
			WHERE m.conversation_id = c.id
			ORDER BY m.id DESC
			LIMIT 1
		),
		''
	),
	c.updated_at,
	(
		SELECT COUNT(*)
		FROM messages unread
		WHERE unread.conversation_id = c.id
		  AND unread.sender_id <> $1
		  AND unread.id > cm.last_read_message_id
	),
	CASE
		WHEN c.team_id IS NULL THEN 2
		ELSE (
			SELECT COUNT(*)
			FROM (
				SELECT owner_team.owner_id AS user_id
				FROM teams owner_team
				WHERE owner_team.id = c.team_id

				UNION

				SELECT tm.user_id
				FROM team_members tm
				WHERE tm.team_id = c.team_id
			) members
		)
	END
FROM conversations c
JOIN conversation_members cm
	ON cm.conversation_id = c.id
	AND cm.user_id = $1
LEFT JOIN teams t
	ON t.id = c.team_id
LEFT JOIN users u
	ON c.team_id IS NULL
	AND u.id = CASE
		WHEN c.direct_user_low = $1
			THEN c.direct_user_high
		ELSE c.direct_user_low
	END
WHERE (
	c.team_id IS NULL
	OR EXISTS(
		SELECT 1
		FROM teams active_team
		WHERE active_team.id = c.team_id
		  AND (
				active_team.owner_id = $1
				OR EXISTS(
					SELECT 1
					FROM team_members active_member
					WHERE active_member.team_id = active_team.id
					  AND active_member.user_id = $1
				)
		  )
	)
)
`

func scanConversation(row conversationScanner) (Conversation, error) {
	var item Conversation

	var teamID int64
	var teamName string
	var otherUserID int64
	var otherUserName string
	var unreadCount int64
	var memberCount int64

	err := row.Scan(
		&item.ID,
		&item.Type,
		&teamID,
		&teamName,
		&otherUserID,
		&otherUserName,
		&item.LastMessage,
		&item.UpdatedAt,
		&unreadCount,
		&memberCount,
	)

	if err != nil {
		return Conversation{}, err
	}

	item.UnreadCount = int(unreadCount)
	item.MemberCount = int(memberCount)

	if item.Type == "team" {
		item.TeamID = teamID
		item.TeamName = teamName
	} else {
		item.OtherUser = &ChatUser{
			ID:        otherUserID,
			Name:      otherUserName,
			AvatarURL: avatarURL(otherUserID),
		}
	}

	return item, nil
}

func GetConversations(c echo.Context, pool *pgxpool.Pool) error {
	if err := syncCurrentUserTeamConversations(c, pool); err != nil {
		return dbError(c, err)
	}

	offset := 0

	if c.QueryParam("offset") != "" {
		var err error

		offset, err = strconv.Atoi(c.QueryParam("offset"))

		if err != nil || offset < 0 || offset > 100000 {
			return apiError(c, 400, "Invalid offset")
		}
	}

	rows, err := pool.Query(
		c.Request().Context(),
		conversationSelect+`
		ORDER BY c.updated_at DESC, c.id DESC
		LIMIT 50 OFFSET $2`,
		c.Get("user_id"),
		offset,
	)

	if err != nil {
		return dbError(c, err)
	}
	defer rows.Close()

	items := make([]Conversation, 0)

	for rows.Next() {
		item, err := scanConversation(rows)
		if err != nil {
			return dbError(c, err)
		}

		items = append(items, item)
	}

	if err = rows.Err(); err != nil {
		return dbError(c, err)
	}

	return c.JSON(200, items)
}

func GetConversation(c echo.Context, pool *pgxpool.Pool) error {
	id, err := resourceID(c)

	if err != nil {
		return err
	}

	if _, _, err = chatMembership(c, pool, id); err != nil {
		return err
	}

	item, err := scanConversation(
		pool.QueryRow(
			c.Request().Context(),
			conversationSelect+` AND c.id = $2`,
			c.Get("user_id"),
			id,
		),
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return apiError(c, 404, "Conversation not found")
	}

	if err != nil {
		return dbError(c, err)
	}

	return c.JSON(200, item)
}

func chatMembership(
	c echo.Context,
	pool *pgxpool.Pool,
	conversationID int64,
) (int64, bool, error) {
	ctx := c.Request().Context()
	userID := c.Get("user_id").(int64)

	var teamID int64
	var allowed bool

	err := pool.QueryRow(
		ctx,
		`SELECT
			COALESCE(c.team_id, 0),
			CASE
				WHEN c.team_id IS NULL THEN EXISTS(
					SELECT 1
					FROM conversation_members cm
					WHERE cm.conversation_id = c.id
					  AND cm.user_id = $2
				)
				ELSE EXISTS(
					SELECT 1
					FROM teams t
					WHERE t.id = c.team_id
					  AND (
							t.owner_id = $2
							OR EXISTS(
								SELECT 1
								FROM team_members tm
								WHERE tm.team_id = t.id
								  AND tm.user_id = $2
							)
					  )
				)
			END
		FROM conversations c
		WHERE c.id = $1`,
		conversationID,
		userID,
	).Scan(
		&teamID,
		&allowed,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return 0, false, apiError(c, 404, "Conversation not found")
	}

	if err != nil {
		return 0, false, dbError(c, err)
	}

	isTeam := teamID > 0

	if !allowed {
		if isTeam {
			return teamID, true, apiError(
				c,
				403,
				"You no longer have access to this team conversation",
			)
		}

		return 0, false, apiError(c, 404, "Conversation not found")
	}

	if isTeam {
		_, err = pool.Exec(
			ctx,
			`INSERT INTO conversation_members(
				conversation_id,
				user_id,
				last_read_message_id
			)
			VALUES(
				$1,
				$2,
				COALESCE(
					(
						SELECT MAX(id)
						FROM messages
						WHERE conversation_id = $1
					),
					0
				)
			)
			ON CONFLICT(conversation_id, user_id)
			DO NOTHING`,
			conversationID,
			userID,
		)

		if err != nil {
			return 0, false, dbError(c, err)
		}
	}

	return teamID, isTeam, nil
}

func GetMessages(c echo.Context, pool *pgxpool.Pool) error {
	id, err := resourceID(c)

	if err != nil {
		return err
	}

	if _, _, err = chatMembership(c, pool, id); err != nil {
		return err
	}

	before, err := pageCursor(c, "before")

	if err != nil {
		return err
	}

	after, err := pageCursor(c, "after")

	if err != nil {
		return err
	}

	if before > 0 && after > 0 {
		return apiError(c, 400, "Use either before or after")
	}

	order := "DESC"

	if after > 0 {
		order = "ASC"
	}

	rows, err := pool.Query(
		c.Request().Context(),
		`SELECT
			m.id,
			m.conversation_id,
			m.sender_id,
			u.name,
			m.content,
			m.created_at,
			m.read_at
		FROM messages m
		JOIN users u ON u.id = m.sender_id
		WHERE m.conversation_id = $1
		  AND ($2::bigint = 0 OR m.id < $2)
		  AND ($3::bigint = 0 OR m.id > $3)
		ORDER BY m.id `+order+`
		LIMIT 50`,
		id,
		before,
		after,
	)

	if err != nil {
		return dbError(c, err)
	}
	defer rows.Close()

	items := make([]Message, 0)

	for rows.Next() {
		var item Message

		err = rows.Scan(
			&item.ID,
			&item.ConversationID,
			&item.SenderID,
			&item.SenderName,
			&item.Content,
			&item.CreatedAt,
			&item.ReadAt,
		)

		if err != nil {
			return dbError(c, err)
		}

		item.SenderAvatarURL = avatarURL(item.SenderID)

		items = append(items, item)
	}

	if err = rows.Err(); err != nil {
		return dbError(c, err)
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].ID < items[j].ID
	})

	return c.JSON(200, items)
}

func SendMessage(c echo.Context, pool *pgxpool.Pool) error {
	id, err := resourceID(c)

	if err != nil {
		return err
	}

	_, isTeam, err := chatMembership(c, pool, id)

	if err != nil {
		return err
	}

	var body struct {
		Content         string `json:"content"`
		ClientMessageID string `json:"client_message_id"`
	}

	if err = readBody(c, &body); err != nil {
		return err
	}

	body.Content = strings.TrimSpace(body.Content)

	if body.Content == "" ||
		!shortText(body.Content, 4000) ||
		len(body.ClientMessageID) > 80 {
		return apiError(
			c,
			400,
			"Message must contain 1-4000 characters",
		)
	}

	ctx := c.Request().Context()
	userID := c.Get("user_id").(int64)

	tx, err := pool.Begin(ctx)

	if err != nil {
		return dbError(c, err)
	}
	defer tx.Rollback(ctx)

	if _, err = tx.Exec(
		ctx,
		`SELECT id
		 FROM conversations
		 WHERE id = $1
		 FOR UPDATE`,
		id,
	); err != nil {
		return dbError(c, err)
	}

	var item Message

	err = tx.QueryRow(
		ctx,
		`INSERT INTO messages(
			conversation_id,
			sender_id,
			content,
			client_message_id
		)
		VALUES(
			$1,
			$2,
			$3,
			NULLIF($4, '')
		)
		ON CONFLICT(
			conversation_id,
			sender_id,
			client_message_id
		)
		DO NOTHING
		RETURNING
			id,
			conversation_id,
			sender_id,
			content,
			created_at,
			read_at`,
		id,
		userID,
		body.Content,
		body.ClientMessageID,
	).Scan(
		&item.ID,
		&item.ConversationID,
		&item.SenderID,
		&item.Content,
		&item.CreatedAt,
		&item.ReadAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		if body.ClientMessageID == "" {
			return apiError(c, 409, "Unable to retry message")
		}

		err = tx.QueryRow(
			ctx,
			`SELECT
				id,
				conversation_id,
				sender_id,
				content,
				created_at,
				read_at
			FROM messages
			WHERE conversation_id = $1
			  AND sender_id = $2
			  AND client_message_id = $3`,
			id,
			userID,
			body.ClientMessageID,
		).Scan(
			&item.ID,
			&item.ConversationID,
			&item.SenderID,
			&item.Content,
			&item.CreatedAt,
			&item.ReadAt,
		)

		if err != nil {
			return dbError(c, err)
		}

		if item.Content != body.Content {
			return apiError(
				c,
				409,
				"Message key already used for different content",
			)
		}

		var senderName string

		if err = tx.QueryRow(
			ctx,
			`SELECT name
			 FROM users
			 WHERE id = $1`,
			userID,
		).Scan(&senderName); err != nil {
			return dbError(c, err)
		}

		item.SenderName = senderName
		item.SenderAvatarURL = avatarURL(userID)

		return c.JSON(200, item)
	}

	if err != nil {
		return dbError(c, err)
	}

	err = tx.QueryRow(
		ctx,
		`SELECT name
		 FROM users
		 WHERE id = $1`,
		userID,
	).Scan(&item.SenderName)

	if err != nil {
		return dbError(c, err)
	}

	item.SenderAvatarURL = avatarURL(userID)

	if _, err = tx.Exec(
		ctx,
		`UPDATE conversations
		 SET updated_at = NOW()
		 WHERE id = $1`,
		id,
	); err != nil {
		return dbError(c, err)
	}

	if isTeam {
		_, err = tx.Exec(
			ctx,
			`INSERT INTO notifications(
				user_id,
				type,
				title,
				message,
				related_user_id,
				related_conversation_id
			)
			SELECT
				recipients.user_id,
				'new_message',
				'New team message',
				'You have a new message from ' || sender.name || '.',
				sender.id,
				$1
			FROM (
				SELECT t.owner_id AS user_id
				FROM conversations c
				JOIN teams t ON t.id = c.team_id
				WHERE c.id = $1

				UNION

				SELECT tm.user_id
				FROM conversations c
				JOIN team_members tm ON tm.team_id = c.team_id
				WHERE c.id = $1
			) recipients
			JOIN users sender ON sender.id = $2
			WHERE recipients.user_id <> $2
			ON CONFLICT(user_id, related_conversation_id)
			WHERE type = 'new_message' AND NOT is_read
			DO NOTHING`,
			id,
			userID,
		)
	} else {
		_, err = tx.Exec(
			ctx,
			`INSERT INTO notifications(
				user_id,
				type,
				title,
				message,
				related_user_id,
				related_conversation_id
			)
			SELECT
				cm.user_id,
				'new_message',
				'New message',
				'You have a new message from ' || u.name || '.',
				u.id,
				$1
			FROM conversation_members cm
			JOIN users u ON u.id = $2
			WHERE cm.conversation_id = $1
			  AND cm.user_id <> $2
			ON CONFLICT(user_id, related_conversation_id)
			WHERE type = 'new_message' AND NOT is_read
			DO NOTHING`,
			id,
			userID,
		)
	}

	if err != nil {
		return dbError(c, err)
	}

	if err = tx.Commit(ctx); err != nil {
		return dbError(c, err)
	}

	return c.JSON(201, item)
}

func ReadConversation(c echo.Context, pool *pgxpool.Pool) error {
	id, err := resourceID(c)

	if err != nil {
		return err
	}

	_, isTeam, err := chatMembership(c, pool, id)

	if err != nil {
		return err
	}

	var body struct {
		LastMessageID int64 `json:"last_message_id"`
	}

	if c.Request().ContentLength != 0 {
		if err = readBody(c, &body); err != nil {
			return err
		}
	}

	if body.LastMessageID < 0 {
		return apiError(c, 400, "Invalid message ID")
	}

	ctx := c.Request().Context()
	userID := c.Get("user_id").(int64)

	tx, err := pool.Begin(ctx)

	if err != nil {
		return dbError(c, err)
	}
	defer tx.Rollback(ctx)

	if _, err = tx.Exec(
		ctx,
		`SELECT id
		 FROM conversations
		 WHERE id = $1
		 FOR UPDATE`,
		id,
	); err != nil {
		return dbError(c, err)
	}

	var latestMessageID int64

	if err = tx.QueryRow(
		ctx,
		`SELECT COALESCE(MAX(id), 0)
		 FROM messages
		 WHERE conversation_id = $1`,
		id,
	).Scan(&latestMessageID); err != nil {
		return dbError(c, err)
	}

	if body.LastMessageID == 0 ||
		body.LastMessageID > latestMessageID {
		body.LastMessageID = latestMessageID
	}

	_, err = tx.Exec(
		ctx,
		`UPDATE conversation_members
		 SET last_read_message_id = GREATEST(
			last_read_message_id,
			$3
		 )
		 WHERE conversation_id = $1
		   AND user_id = $2`,
		id,
		userID,
		body.LastMessageID,
	)

	if err != nil {
		return dbError(c, err)
	}

	if !isTeam {
		_, err = tx.Exec(
			ctx,
			`UPDATE messages
			 SET read_at = NOW()
			 WHERE conversation_id = $1
			   AND sender_id <> $2
			   AND read_at IS NULL
			   AND id <= $3`,
			id,
			userID,
			body.LastMessageID,
		)

		if err != nil {
			return dbError(c, err)
		}
	}

	var unreadCount int64

	err = tx.QueryRow(
		ctx,
		`SELECT COUNT(*)
		 FROM messages m
		 JOIN conversation_members cm
		   ON cm.conversation_id = m.conversation_id
		  AND cm.user_id = $2
		 WHERE m.conversation_id = $1
		   AND m.sender_id <> $2
		   AND m.id > cm.last_read_message_id`,
		id,
		userID,
	).Scan(&unreadCount)

	if err != nil {
		return dbError(c, err)
	}

	if unreadCount == 0 {
		_, err = tx.Exec(
			ctx,
			`UPDATE notifications
			 SET is_read = TRUE
			 WHERE user_id = $1
			   AND related_conversation_id = $2
			   AND type = 'new_message'
			   AND NOT is_read`,
			userID,
			id,
		)

		if err != nil {
			return dbError(c, err)
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return dbError(c, err)
	}

	return c.NoContent(204)
}
