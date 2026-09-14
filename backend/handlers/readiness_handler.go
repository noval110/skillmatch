package handlers

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"net/http"
	"skillmatch/readiness"
	"time"
)

// GetTeamReadiness is owner/member-only. Authorization and all measurements use
// one read-only snapshot, so role, membership and skill edits cannot mix versions.
func GetTeamReadiness(c echo.Context, pool *pgxpool.Pool) error {
	c.Response().Header().Set("Cache-Control", "private, no-store")
	userID, ok := c.Get("user_id").(int64)
	if !ok || userID <= 0 {
		return apiError(c, http.StatusUnauthorized, "Authentication required")
	}
	teamID, err := resourceID(c)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()
	tx, err := pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return dbError(c, err)
	}
	defer tx.Rollback(context.Background())
	input := readiness.Input{TeamID: teamID, Members: []readiness.Member{}, Roles: []readiness.Role{}}
	var allowed bool
	err = tx.QueryRow(ctx, `SELECT max_members, owner_id=$2 OR EXISTS(SELECT 1 FROM team_members WHERE team_id=teams.id AND user_id=$2) FROM teams WHERE id=$1`, teamID, userID).Scan(&input.Capacity, &allowed)
	if errors.Is(err, pgx.ErrNoRows) {
		return apiError(c, 404, "Team not found")
	}
	if err != nil {
		return dbError(c, err)
	}
	if !allowed {
		return apiError(c, 403, "Only the team owner and current members can view readiness")
	}
	rows, err := tx.Query(ctx, `SELECT u.id,u.name,
 btrim(COALESCE(u.bio,''))<>'', lower(btrim(COALESCE(u.experience_level,''))) IN ('beginner','intermediate','advanced'),
 btrim(COALESCE(u.preferred_role,''))<>'',btrim(COALESCE(u.availability,''))<>'',btrim(COALESCE(u.project_interest,''))<>'',
 COALESCE((SELECT jsonb_agg(jsonb_build_object('skill_id',us.skill_id,'level',us.level) ORDER BY us.skill_id) FROM user_skills us WHERE us.user_id=u.id),'[]'::jsonb)
 FROM team_members tm JOIN users u ON u.id=tm.user_id WHERE tm.team_id=$1 ORDER BY u.id`, teamID)
	if err != nil {
		return dbError(c, err)
	}
	for rows.Next() {
		var m readiness.Member
		if err = rows.Scan(&m.ID, &m.Name, &m.Bio, &m.Experience, &m.PreferredRole, &m.Availability, &m.ProjectInterest, &m.Skills); err != nil {
			rows.Close()
			return dbError(c, err)
		}
		input.Members = append(input.Members, m)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return dbError(c, err)
	}
	rows, err = tx.Query(ctx, `SELECT r.id,r.role_name,r.status,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('skill_id',rs.skill_id,'name',s.name,'level',rs.required_level) ORDER BY rs.skill_id)
 FROM role_skills rs JOIN skills s ON s.id=rs.skill_id WHERE rs.role_id=r.id),'[]'::jsonb)
 FROM team_roles r WHERE r.team_id=$1 ORDER BY r.id`, teamID)
	if err != nil {
		return dbError(c, err)
	}
	for rows.Next() {
		var role readiness.Role
		if err = rows.Scan(&role.ID, &role.Name, &role.Status, &role.Skills); err != nil {
			rows.Close()
			return dbError(c, err)
		}
		input.Roles = append(input.Roles, role)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return dbError(c, err)
	}
	if err = tx.Commit(ctx); err != nil {
		return dbError(c, err)
	}
	return c.JSON(http.StatusOK, readiness.Calculate(input))
}
