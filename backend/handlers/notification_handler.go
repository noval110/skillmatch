package handlers

import (
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"time"
)

type Notification struct {
	ID                    int64     `json:"id"`
	Type                  string    `json:"type"`
	Title                 string    `json:"title"`
	Message               string    `json:"message"`
	RelatedTeamID         *int64    `json:"related_team_id"`
	RelatedUserID         *int64    `json:"related_user_id"`
	RelatedConversationID *int64    `json:"related_conversation_id"`
	IsRead                bool      `json:"is_read"`
	CreatedAt             time.Time `json:"created_at"`
}

func GetNotifications(c echo.Context, pool *pgxpool.Pool) error {
	before, err := pageCursor(c, "before")
	if err != nil {
		return err
	}
	rows, err := pool.Query(c.Request().Context(), `SELECT id,type,title,message,related_team_id,related_user_id,related_conversation_id,is_read,created_at FROM notifications WHERE user_id=$1 AND ($2::bigint=0 OR id<$2) ORDER BY id DESC LIMIT 50`, c.Get("user_id"), before)
	if err != nil {
		return dbError(c, err)
	}
	items, err := pgx.CollectRows(rows, pgx.RowToStructByPos[Notification])
	if err != nil {
		return dbError(c, err)
	}
	return c.JSON(200, items)
}
func GetUnreadCount(c echo.Context, pool *pgxpool.Pool) error {
	var count int
	if err := pool.QueryRow(c.Request().Context(), `SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND NOT is_read`, c.Get("user_id")).Scan(&count); err != nil {
		return dbError(c, err)
	}
	return c.JSON(200, map[string]int{"unread_count": count})
}
func ReadNotification(c echo.Context, pool *pgxpool.Pool) error {
	id, err := resourceID(c)
	if err != nil {
		return err
	}
	result, err := pool.Exec(c.Request().Context(), `UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2`, id, c.Get("user_id"))
	if err != nil {
		return dbError(c, err)
	}
	if result.RowsAffected() == 0 {
		return apiError(c, 404, "Notification not found")
	}
	return c.NoContent(204)
}
func ReadAllNotifications(c echo.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(c.Request().Context(), `UPDATE notifications SET is_read=TRUE WHERE user_id=$1 AND NOT is_read`, c.Get("user_id")); err != nil {
		return dbError(c, err)
	}
	return c.NoContent(204)
}
