package handlers

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"net/url"
	"skillmatch/models"
	"strings"
	"time"
	"unicode/utf8"
)

func loadShowcase(ctx context.Context, pool *pgxpool.Pool, userID int64) (models.Showcase, error) {
	var result models.Showcase
	err := pool.QueryRow(ctx, `SELECT
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description,'role',role,'project_url',project_url,'repository_url',repository_url,'technologies',technologies) ORDER BY id DESC) FROM user_portfolios WHERE user_id=$1),'[]'::jsonb),
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'title',title,'organization',organization,'achievement_type',achievement_type,'date',COALESCE(to_char(date,'YYYY-MM-DD'),''),'description',description,'credential_url',credential_url) ORDER BY date DESC NULLS LAST,id DESC) FROM user_achievements WHERE user_id=$1),'[]'::jsonb)`, userID).Scan(&result.Portfolio, &result.Achievements)
	return result, err
}
func GetShowcase(c echo.Context, pool *pgxpool.Pool) error {
	result, err := loadShowcase(c.Request().Context(), pool, c.Get("user_id").(int64))
	if err != nil {
		return dbError(c, err)
	}
	return c.JSON(200, result)
}
func safePublicURL(value string) bool {
	if value == "" {
		return true
	}
	if len(value) > 2048 {
		return false
	}
	parsed, err := url.ParseRequestURI(value)
	return err == nil && (parsed.Scheme == "http" || parsed.Scheme == "https") && parsed.Hostname() != "" && parsed.User == nil
}
func shortText(value string, max int) bool { return utf8.RuneCountInString(value) <= max }

func SavePortfolio(c echo.Context, pool *pgxpool.Pool) error {
	var item models.Portfolio
	if err := readBody(c, &item); err != nil {
		return err
	}
	item.Title = strings.TrimSpace(item.Title)
	item.Role = strings.TrimSpace(item.Role)
	item.ProjectURL = strings.TrimSpace(item.ProjectURL)
	item.RepositoryURL = strings.TrimSpace(item.RepositoryURL)
	if item.Title == "" || !shortText(item.Title, 200) || !shortText(item.Role, 120) || !shortText(item.Description, 4000) || !safePublicURL(item.ProjectURL) || !safePublicURL(item.RepositoryURL) || len(item.Technologies) > 30 {
		return apiError(c, 400, "Provide a title, valid HTTP(S) links, and up to 30 technologies. Text exceeds allowed length or is invalid.")
	}
	technologies := []string{}
	seen := map[string]bool{}
	for _, technology := range item.Technologies {
		technology = strings.TrimSpace(technology)
		if !shortText(technology, 80) {
			return apiError(c, 400, "Technology names must be at most 80 characters")
		}
		if technology != "" && !seen[strings.ToLower(technology)] {
			technologies = append(technologies, technology)
			seen[strings.ToLower(technology)] = true
		}
	}
	item.Technologies = technologies
	user := c.Get("user_id")
	ctx := c.Request().Context()
	var err error
	status := 200
	if c.Request().Method == "POST" {
		status = 201
		err = pool.QueryRow(ctx, `INSERT INTO user_portfolios(user_id,title,description,role,project_url,repository_url,technologies) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`, user, item.Title, item.Description, item.Role, item.ProjectURL, item.RepositoryURL, item.Technologies).Scan(&item.ID)
	} else {
		item.ID, err = resourceID(c)
		if err != nil {
			return err
		}
		err = pool.QueryRow(ctx, `UPDATE user_portfolios SET title=$1,description=$2,role=$3,project_url=$4,repository_url=$5,technologies=$6,updated_at=NOW() WHERE id=$7 AND user_id=$8 RETURNING id`, item.Title, item.Description, item.Role, item.ProjectURL, item.RepositoryURL, item.Technologies, item.ID, user).Scan(&item.ID)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return apiError(c, 404, "Project not found")
	}
	if err != nil {
		return dbError(c, err)
	}
	return c.JSON(status, item)
}
func SaveAchievement(c echo.Context, pool *pgxpool.Pool) error {
	var item models.Achievement
	if err := readBody(c, &item); err != nil {
		return err
	}
	item.Title = strings.TrimSpace(item.Title)
	item.Organization = strings.TrimSpace(item.Organization)
	item.CredentialURL = strings.TrimSpace(item.CredentialURL)
	validType := item.AchievementType == "competition" || item.AchievementType == "certification" || item.AchievementType == "award" || item.AchievementType == "other"
	if item.Title == "" || !shortText(item.Title, 200) || !shortText(item.Organization, 200) || !shortText(item.Description, 4000) || !safePublicURL(item.CredentialURL) || !validType {
		return apiError(c, 400, "Provide a title, valid achievement type, and a valid HTTP(S) credential link. Text exceeds allowed length or is invalid.")
	}
	if item.Date != "" {
		if _, err := time.Parse("2006-01-02", item.Date); err != nil {
			return apiError(c, 400, "Date must be a valid YYYY-MM-DD date")
		}
	}
	user := c.Get("user_id")
	ctx := c.Request().Context()
	var err error
	status := 200
	if c.Request().Method == "POST" {
		status = 201
		err = pool.QueryRow(ctx, `INSERT INTO user_achievements(user_id,title,organization,achievement_type,date,description,credential_url) VALUES($1,$2,$3,$4,NULLIF($5,'')::date,$6,$7) RETURNING id`, user, item.Title, item.Organization, item.AchievementType, item.Date, item.Description, item.CredentialURL).Scan(&item.ID)
	} else {
		item.ID, err = resourceID(c)
		if err != nil {
			return err
		}
		err = pool.QueryRow(ctx, `UPDATE user_achievements SET title=$1,organization=$2,achievement_type=$3,date=NULLIF($4,'')::date,description=$5,credential_url=$6,updated_at=NOW() WHERE id=$7 AND user_id=$8 RETURNING id`, item.Title, item.Organization, item.AchievementType, item.Date, item.Description, item.CredentialURL, item.ID, user).Scan(&item.ID)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return apiError(c, 404, "Achievement not found")
	}
	if err != nil {
		return dbError(c, err)
	}
	return c.JSON(status, item)
}
func DeleteShowcaseItem(c echo.Context, pool *pgxpool.Pool) error {
	id, err := resourceID(c)
	if err != nil {
		return err
	}
	// Table name comes only from registered routes, never from user input.
	table := "user_portfolios"
	if strings.Contains(c.Path(), "/achievements/") {
		table = "user_achievements"
	}
	result, err := pool.Exec(c.Request().Context(), "DELETE FROM "+table+" WHERE id=$1 AND user_id=$2", id, c.Get("user_id"))
	if err != nil {
		return dbError(c, err)
	}
	if result.RowsAffected() == 0 {
		return apiError(c, 404, "Item not found")
	}
	return c.NoContent(204)
}
