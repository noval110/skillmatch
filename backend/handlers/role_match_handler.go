package handlers

import (
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"net/http"
	"skillmatch/models"
	"strconv"
)

func GetRoleMatch(c echo.Context, pool *pgxpool.Pool) error {
	ctx := c.Request().Context()
	userID := c.Get("user_id").(int64)
	roleID, err := strconv.ParseInt(c.Param("role_id"), 10, 64)
	if err != nil || roleID <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid role ID"})
	}
	teamID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || teamID <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid team ID"})
	}
	var role models.TeamRole
	var team models.Team
	err = pool.QueryRow(ctx, `SELECT r.id, r.role_name, r.experience_preference,
  t.name, COALESCE(t.description, ''), COALESCE(t.project_idea, ''), t.beginner_friendly, t.willing_to_mentor, COALESCE(t.competition_category, ''), COALESCE(t.competition_type, '')
  FROM team_roles r JOIN teams t ON t.id=r.team_id WHERE r.id=$1 AND r.team_id=$2`, roleID, teamID).Scan(
		&role.ID, &role.RoleName, &role.ExperiencePreference, &team.Name, &team.Description, &team.ProjectIdea, &team.BeginnerFriendly, &team.WillingToMentor, &team.CompetitionCategory, &team.CompetitionType)
	if errors.Is(err, pgx.ErrNoRows) {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Team role not found"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch role"})
	}
	var user models.User
	err = pool.QueryRow(ctx, `SELECT COALESCE(experience_level, ''), COALESCE(preferred_role, ''),
  COALESCE(availability, ''), COALESCE(project_interest, '') FROM users WHERE id=$1`, userID).Scan(
		&user.ExperienceLevel, &user.PreferredRole, &user.Availability, &user.ProjectInterest)
	if errors.Is(err, pgx.ErrNoRows) {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
	}
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch matching preferences"})
	}
	rows, err := pool.Query(ctx, `SELECT s.name, rs.required_level, us.level
  FROM role_skills rs JOIN skills s ON s.id=rs.skill_id
  LEFT JOIN user_skills us ON us.skill_id=rs.skill_id AND us.user_id=$1
  WHERE rs.role_id=$2 ORDER BY s.name`, userID, roleID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to calculate role match"})
	}
	defer rows.Close()
	skills := []matchSkill{}
	for rows.Next() {
		var skill matchSkill
		if err := rows.Scan(&skill.Name, &skill.RequiredLevel, &skill.UserLevel); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to read matching data"})
		}
		skills = append(skills, skill)
	}
	if rows.Err() != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to read matching data"})
	}
	return c.JSON(http.StatusOK, calculateRoleMatch(user, team, role, skills))
}
