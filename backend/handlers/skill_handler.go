package handlers

import (
	"context"
	"net/http"

	"skillmatch/models"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

func GetSkills(c echo.Context, conn *pgxpool.Pool) error {
	rows, err := conn.Query(
		context.Background(),
		`
		SELECT id, name, COALESCE(NULLIF(TRIM(category), ''), 'Other')
		FROM skills
 WHERE ($1 = '' OR LOWER(COALESCE(NULLIF(TRIM(category), ''), 'Other')) = LOWER($1))
			ORDER BY name
		`, c.QueryParam("category"),
	)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to fetch skills",
		})
	}

	defer rows.Close()

	skills := []models.Skill{}

	for rows.Next() {
		var skill models.Skill

		if err := rows.Scan(
			&skill.ID,
			&skill.Name, &skill.Category,
		); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "Failed to read skill data",
			})
		}

		skills = append(skills, skill)
	}

	if rows.Err() != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to read skill data"})
	}
	return c.JSON(http.StatusOK, skills)
}

func AddProfileSkill(c echo.Context, conn *pgxpool.Pool) error {
	userID := c.Get("user_id").(int64)

	var req models.AddSkillRequest

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request",
		})
	}

	if req.SkillID <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid skill ID",
		})
	}

	if req.Level != "beginner" &&
		req.Level != "intermediate" &&
		req.Level != "advanced" {

		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid skill level",
		})
	}

	_, err := conn.Exec(
		context.Background(),
		`
		INSERT INTO user_skills (user_id, skill_id, level)
		VALUES ($1, $2, $3)
		`,
		userID,
		req.SkillID,
		req.Level,
	)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to add skill",
		})
	}

	return c.JSON(http.StatusCreated, map[string]string{
		"message": "Skill added successfully",
	})
}

func GetProfileSkills(c echo.Context, conn *pgxpool.Pool) error {
	userID := c.Get("user_id").(int64)

	rows, err := conn.Query(
		context.Background(),
		`
		SELECT skills.id, skills.name, COALESCE(NULLIF(TRIM(skills.category), ''), 'Other'), user_skills.level
		FROM user_skills
		JOIN skills
			ON user_skills.skill_id = skills.id
		WHERE user_skills.user_id = $1
		ORDER BY skills.name
		`,
		userID,
	)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to fetch user skills",
		})
	}

	defer rows.Close()

	skills := []models.UserSkill{}

	for rows.Next() {
		var skill models.UserSkill

		if err := rows.Scan(
			&skill.ID,
			&skill.Name, &skill.Category,
			&skill.Level,
		); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "Failed to read user skill data",
			})
		}

		skills = append(skills, skill)
	}

	if rows.Err() != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to read user skill data"})
	}
	return c.JSON(http.StatusOK, skills)
}

func UpdateProfileSkill(c echo.Context, conn *pgxpool.Pool) error {
	userID := c.Get("user_id").(int64)
	skillID := c.Param("skill_id")

	var req models.UpdateSkillRequest

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request",
		})
	}

	if req.Level != "beginner" &&
		req.Level != "intermediate" &&
		req.Level != "advanced" {

		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid skill level",
		})
	}

	result, err := conn.Exec(
		context.Background(),
		`
		UPDATE user_skills
		SET level = $1
		WHERE user_id = $2
		AND skill_id = $3
		`,
		req.Level,
		userID,
		skillID,
	)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to update skill",
		})
	}

	if result.RowsAffected() == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Skill not found",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Skill updated successfully",
	})
}

func DeleteProfileSkill(c echo.Context, conn *pgxpool.Pool) error {
	userID := c.Get("user_id").(int64)
	skillID := c.Param("skill_id")

	result, err := conn.Exec(
		context.Background(),
		`
		DELETE FROM user_skills
		WHERE user_id = $1
		AND skill_id = $2
		`,
		userID,
		skillID,
	)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete skill",
		})
	}

	if result.RowsAffected() == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Skill not found",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Skill deleted successfully",
	})
}
