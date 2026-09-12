package handlers

import (
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"sort"
	"strconv"
	"strings"
	"time"
)

type ChatUser struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
}
type Conversation struct {
	ID          int64     `json:"id"`
	OtherUser   ChatUser  `json:"other_user"`
	LastMessage string    `json:"last_message"`
	UpdatedAt   time.Time `json:"updated_at"`
	UnreadCount int       `json:"unread_count"`
}
type Message struct {
	ID             int64      `json:"id"`
	ConversationID int64      `json:"conversation_id"`
	SenderID       int64      `json:"sender_id"`
	Content        string     `json:"content"`
	CreatedAt      time.Time  `json:"created_at"`
	ReadAt         *time.Time `json:"read_at"`
}

func CreateConversation(c echo.Context, pool *pgxpool.Pool) error {
	var body struct {
		UserID int64 `json:"user_id"`
	}
	if err := readBody(c, &body); err != nil {
		return err
	}
	user := c.Get("user_id").(int64)
	if body.UserID <= 0 || body.UserID == user {
		return apiError(c, 400, "Choose another SkillMatch member")
	}
	ctx := c.Request().Context()
	tx, err := pool.Begin(ctx)
	if err != nil {
		return dbError(c, err)
	}
	defer tx.Rollback(ctx)
	var exists bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE id=$1)`, body.UserID).Scan(&exists); err != nil {
		return dbError(c, err)
	}
	if !exists {
		return apiError(c, 404, "User not found")
	}
	low, high := user, body.UserID
	if low > high {
		low, high = high, low
	}
	var id int64
	// The unique pair handles simultaneous creates from either participant.
	err = tx.QueryRow(ctx, `INSERT INTO conversations(direct_user_low,direct_user_high) VALUES($1,$2) ON CONFLICT(direct_user_low,direct_user_high) DO UPDATE SET direct_user_low=EXCLUDED.direct_user_low RETURNING id`, low, high).Scan(&id)
	if err != nil {
		return dbError(c, err)
	}
	if _, err = tx.Exec(ctx, `INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2),($1,$3) ON CONFLICT DO NOTHING`, id, low, high); err != nil {
		return dbError(c, err)
	}
	if err = tx.Commit(ctx); err != nil {
		return dbError(c, err)
	}
	return c.JSON(200, map[string]int64{"id": id})
}

const conversationSelect = `SELECT c.id,jsonb_build_object('id',u.id,'name',u.name,'avatar_url',''),
 COALESCE((SELECT content FROM messages WHERE conversation_id=c.id ORDER BY id DESC LIMIT 1),''),c.updated_at,
 (SELECT count(*) FROM messages WHERE conversation_id=c.id AND sender_id<>$1 AND read_at IS NULL)
 FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id AND cm.user_id=$1
 JOIN users u ON u.id=CASE WHEN c.direct_user_low=$1 THEN c.direct_user_high ELSE c.direct_user_low END`

func GetConversations(c echo.Context, pool *pgxpool.Pool) error {
	offset := 0
	if c.QueryParam("offset") != "" {
		var err error
		offset, err = strconv.Atoi(c.QueryParam("offset"))
		if err != nil || offset < 0 || offset > 100000 {
			return apiError(c, 400, "Invalid offset")
		}
	}
	rows, err := pool.Query(c.Request().Context(), conversationSelect+` ORDER BY c.updated_at DESC,c.id DESC LIMIT 50 OFFSET $2`, c.Get("user_id"), offset)
	if err != nil {
		return dbError(c, err)
	}
	items, err := pgx.CollectRows(rows, pgx.RowToStructByPos[Conversation])
	if err != nil {
		return dbError(c, err)
	}
	for i := range items {
		items[i].OtherUser.AvatarURL = avatarURL(items[i].OtherUser.ID)
	}
	return c.JSON(200, items)
}
func GetConversation(c echo.Context, pool *pgxpool.Pool) error {
	id, err := resourceID(c)
	if err != nil {
		return err
	}
	var item Conversation
	err = pool.QueryRow(c.Request().Context(), conversationSelect+` WHERE c.id=$2`, c.Get("user_id"), id).Scan(&item.ID, &item.OtherUser, &item.LastMessage, &item.UpdatedAt, &item.UnreadCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return apiError(c, 404, "Conversation not found")
	}
	if err != nil {
		return dbError(c, err)
	}
	item.OtherUser.AvatarURL = avatarURL(item.OtherUser.ID)
	return c.JSON(200, item)
}
func chatMembership(c echo.Context, pool *pgxpool.Pool, id int64) error {
	var exists bool
	if err := pool.QueryRow(c.Request().Context(), `SELECT EXISTS(SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND user_id=$2)`, id, c.Get("user_id")).Scan(&exists); err != nil {
		return echo.NewHTTPError(500, "Unable to load conversation")
	}
	if !exists {
		return echo.NewHTTPError(404, "Conversation not found")
	}
	return nil
}
func GetMessages(c echo.Context, pool *pgxpool.Pool) error {
	id, err := resourceID(c)
	if err != nil {
		return err
	}
	if err = chatMembership(c, pool, id); err != nil {
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
	rows, err := pool.Query(c.Request().Context(), `SELECT id,conversation_id,sender_id,content,created_at,read_at FROM messages WHERE conversation_id=$1 AND ($2::bigint=0 OR id<$2) AND ($3::bigint=0 OR id>$3) ORDER BY id `+order+` LIMIT 50`, id, before, after)
	if err != nil {
		return dbError(c, err)
	}
	items, err := pgx.CollectRows(rows, pgx.RowToStructByPos[Message])
	if err != nil {
		return dbError(c, err)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return c.JSON(200, items)
}
func SendMessage(c echo.Context, pool *pgxpool.Pool) error {
	id, err := resourceID(c)
	if err != nil {
		return err
	}
	if err = chatMembership(c, pool, id); err != nil {
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
	if body.Content == "" || !shortText(body.Content, 4000) || len(body.ClientMessageID) > 80 {
		return apiError(c, 400, "Message must contain 1–4000 characters")
	}
	ctx := c.Request().Context()
	user := c.Get("user_id")
	tx, err := pool.Begin(ctx)
	if err != nil {
		return dbError(c, err)
	}
	defer tx.Rollback(ctx)
	// Serialize send/read for this conversation, preventing lost unread updates.
	if _, err = tx.Exec(ctx, `SELECT id FROM conversations WHERE id=$1 FOR UPDATE`, id); err != nil {
		return dbError(c, err)
	}
	var item Message
	err = tx.QueryRow(ctx, `INSERT INTO messages(conversation_id,sender_id,content,client_message_id) VALUES($1,$2,$3,NULLIF($4,'')) ON CONFLICT(conversation_id,sender_id,client_message_id) DO NOTHING RETURNING id,conversation_id,sender_id,content,created_at,read_at`, id, user, body.Content, body.ClientMessageID).Scan(&item.ID, &item.ConversationID, &item.SenderID, &item.Content, &item.CreatedAt, &item.ReadAt)
	if errors.Is(err, pgx.ErrNoRows) {
		err = tx.QueryRow(ctx, `SELECT id,conversation_id,sender_id,content,created_at,read_at FROM messages WHERE conversation_id=$1 AND sender_id=$2 AND client_message_id=$3`, id, user, body.ClientMessageID).Scan(&item.ID, &item.ConversationID, &item.SenderID, &item.Content, &item.CreatedAt, &item.ReadAt)
		if err != nil {
			return dbError(c, err)
		}
		if item.Content != body.Content {
			return apiError(c, 409, "Message key already used for different content")
		}
		return c.JSON(200, item)
	}
	if err != nil {
		return dbError(c, err)
	}
	if _, err = tx.Exec(ctx, `UPDATE conversations SET updated_at=NOW() WHERE id=$1`, id); err != nil {
		return dbError(c, err)
	}
	_, err = tx.Exec(ctx, `INSERT INTO notifications(user_id,type,title,message,related_user_id,related_conversation_id)
 SELECT cm.user_id,'new_message','New message','You have a new message from ' || u.name || '.',u.id,$1
 FROM conversation_members cm JOIN users u ON u.id=$2 WHERE cm.conversation_id=$1 AND cm.user_id<>$2
 ON CONFLICT(user_id,related_conversation_id) WHERE type='new_message' AND NOT is_read DO NOTHING`, id, user)
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
	if err = chatMembership(c, pool, id); err != nil {
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
	tx, err := pool.Begin(ctx)
	if err != nil {
		return dbError(c, err)
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT id FROM conversations WHERE id=$1 FOR UPDATE`, id); err != nil {
		return dbError(c, err)
	}
	if body.LastMessageID == 0 {
		if err = tx.QueryRow(ctx, `SELECT COALESCE(MAX(id),0) FROM messages WHERE conversation_id=$1`, id).Scan(&body.LastMessageID); err != nil {
			return dbError(c, err)
		}
	}
	if _, err = tx.Exec(ctx, `UPDATE messages SET read_at=NOW() WHERE conversation_id=$1 AND sender_id<>$2 AND read_at IS NULL AND id<=$3`, id, c.Get("user_id"), body.LastMessageID); err != nil {
		return dbError(c, err)
	}
	_, err = tx.Exec(ctx, `UPDATE notifications SET is_read=TRUE WHERE user_id=$1 AND related_conversation_id=$2 AND type='new_message' AND NOT EXISTS(SELECT 1 FROM messages WHERE conversation_id=$2 AND sender_id<>$1 AND read_at IS NULL)`, c.Get("user_id"), id)
	if err != nil {
		return dbError(c, err)
	}
	if err = tx.Commit(ctx); err != nil {
		return dbError(c, err)
	}
	return c.NoContent(204)
}
