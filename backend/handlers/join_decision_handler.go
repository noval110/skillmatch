package handlers

import (
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

// Serialize decisions and capacity checks so competing accept/reject actions
// cannot produce contradictory memberships and notifications.
func decideJoinRequest(c echo.Context, pool *pgxpool.Pool, decision string) error {
	id, err := resourceID(c)
	if err != nil {
		return err
	}
	ctx := c.Request().Context()
	tx, err := pool.Begin(ctx)
	if err != nil {
		return dbError(c, err)
	}
	defer tx.Rollback(ctx)
	var teamID, requester, owner int64
	var status string
	var capacity, members int
	err = tx.QueryRow(ctx, `SELECT team_id FROM join_requests WHERE id=$1`, id).Scan(&teamID)
	if errors.Is(err, pgx.ErrNoRows) {
		return apiError(c, 404, "Join request not found")
	}
	if err != nil {
		return dbError(c, err)
	}
	err = tx.QueryRow(ctx, `SELECT owner_id,max_members FROM teams WHERE id=$1 FOR UPDATE`, teamID).Scan(&owner, &capacity)
	if errors.Is(err, pgx.ErrNoRows) {
		return apiError(c, 404, "Team not found")
	}
	if err != nil {
		return dbError(c, err)
	}
	if owner != c.Get("user_id").(int64) {
		return apiError(c, 403, "Only team owner can process join requests")
	}
	err = tx.QueryRow(ctx, `SELECT user_id,status FROM join_requests WHERE id=$1 FOR UPDATE`, id).Scan(&requester, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return apiError(c, 404, "Join request not found")
	}
	if err != nil {
		return dbError(c, err)
	}
	if status != "pending" {
		return apiError(c, 400, "Join request has already been processed")
	}
	if decision == "accepted" {
		if err = tx.QueryRow(ctx, `SELECT COUNT(*) FROM team_members WHERE team_id=$1`, teamID).Scan(&members); err != nil {
			return dbError(c, err)
		}
		if members >= capacity {
			return apiError(c, 400, "Team is full")
		}
		result, err := tx.Exec(ctx, `INSERT INTO team_members(team_id,user_id,role) VALUES($1,$2,'Member') ON CONFLICT(team_id,user_id) DO NOTHING`, teamID, requester)
		if err != nil {
			return dbError(c, err)
		}
		if result.RowsAffected() == 0 {
			return apiError(c, 400, "User is already a team member")
		}
	}
	if _, err = tx.Exec(ctx, `UPDATE join_requests SET status=$1 WHERE id=$2`, decision, id); err != nil {
		return dbError(c, err)
	}
	if err = tx.Commit(ctx); err != nil {
		return dbError(c, err)
	}
	return c.JSON(200, map[string]string{"message": "Join request " + decision + " successfully"})
}
