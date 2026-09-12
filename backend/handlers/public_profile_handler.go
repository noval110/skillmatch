package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"skillmatch/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

// GetPublicUserProfile returns only the allowlisted fields for a signed-in viewer.
func GetPublicUserProfile(c echo.Context, pool *pgxpool.Pool) error {
	userID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || userID <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid user ID"})
	}

	var profile models.PublicProfile
	// One round trip with independent aggregates avoids both N+1 queries and
	// duplicated skills/teams from joining two one-to-many relationships together.
	err = pool.QueryRow(c.Request().Context(), `
SELECT u.id, u.name, COALESCE(u.bio, ''), COALESCE(u.experience_level, ''),
       COALESCE(u.preferred_role, ''), COALESCE(u.availability, ''),
       COALESCE(u.project_interest, ''), u.created_at,
       COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
               'id', s.id, 'name', s.name,
               'category', COALESCE(NULLIF(TRIM(s.category), ''), 'Other'),
               'level', us.level
           ) ORDER BY s.name, s.id)
           FROM user_skills us JOIN skills s ON s.id = us.skill_id
           WHERE us.user_id = u.id
       ), '[]'::jsonb),
       COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
               'id', t.id, 'name', t.name, 'role', tm.role
           ) ORDER BY t.name, t.id)
           FROM team_members tm JOIN teams t ON t.id = tm.team_id
           WHERE tm.user_id = u.id
       ), '[]'::jsonb)
FROM users u WHERE u.id = $1`, userID).Scan(
		&profile.ID, &profile.Name, &profile.Bio, &profile.ExperienceLevel,
		&profile.PreferredRole, &profile.Availability, &profile.ProjectInterest,
		&profile.CreatedAt, &profile.Skills, &profile.Teams,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
	}
	if err != nil {
		c.Logger().Error("Failed to load public profile: ", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Unable to load this profile. Please try again."})
	}
	profile.ProfilePhotoURL = avatarURL(userID)
	profile.Showcase, err = loadShowcase(c.Request().Context(), pool, userID)
	if err != nil {
		return dbError(c, err)
	}
	c.Response().Header().Set(echo.HeaderCacheControl, "private, no-store")
	return c.JSON(http.StatusOK, profile)
}
