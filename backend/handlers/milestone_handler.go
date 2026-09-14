package handlers

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

type TeamMilestone struct {
	ID          int64     `json:"id"`
	TeamID      int64     `json:"team_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	Progress    int       `json:"progress"`
	DueDate     *string   `json:"due_date"`
	CreatedBy   *int64    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type MilestoneSummary struct {
	Total           int            `json:"total"`
	Completed       int            `json:"completed"`
	InProgress      int            `json:"in_progress"`
	NotStarted      int            `json:"not_started"`
	OverallProgress *int           `json:"overall_progress"`
	NextMilestone   *TeamMilestone `json:"next_milestone"`
}

type milestoneList struct {
	Milestones []TeamMilestone  `json:"milestones"`
	Summary    MilestoneSummary `json:"summary"`
	CanManage  bool             `json:"can_manage"`
}

type milestonePayload struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Status      string  `json:"status"`
	Progress    *int    `json:"progress"`
	DueDate     *string `json:"due_date"`
}

func milestoneID(c echo.Context) (int64, error) {
	id, err := strconv.ParseInt(c.Param("milestone_id"), 10, 64)
	if err != nil || id <= 0 {
		return 0, echo.NewHTTPError(http.StatusBadRequest, "Invalid milestone ID")
	}
	return id, nil
}

func milestoneUser(c echo.Context) (int64, error) {
	userID, ok := c.Get("user_id").(int64)
	if !ok || userID <= 0 {
		return 0, echo.NewHTTPError(http.StatusUnauthorized, "Authentication required")
	}
	return userID, nil
}

func teamMilestoneAccess(ctx context.Context, pool *pgxpool.Pool, teamID, userID int64) (bool, bool, error) {
	var owner, member bool
	err := pool.QueryRow(ctx, `SELECT owner_id=$2,
		EXISTS(SELECT 1 FROM team_members WHERE team_id=teams.id AND user_id=$2)
		FROM teams WHERE id=$1`, teamID, userID).Scan(&owner, &member)
	return owner, member, err
}

func prepareMilestone(input milestonePayload) (milestonePayload, error) {
	input.Title = strings.TrimSpace(input.Title)
	input.Description = strings.TrimSpace(input.Description)
	input.Status = strings.ToLower(strings.TrimSpace(input.Status))
	if input.Status == "" {
		input.Status = "not_started"
	}
	if utf8.RuneCountInString(input.Title) < 1 || utf8.RuneCountInString(input.Title) > 120 {
		return input, errors.New("Title must be between 1 and 120 characters")
	}
	if utf8.RuneCountInString(input.Description) > 2000 {
		return input, errors.New("Description must be 2000 characters or fewer")
	}
	if input.Status != "not_started" && input.Status != "in_progress" && input.Status != "completed" {
		return input, errors.New("Status must be not_started, in_progress, or completed")
	}
	progress := 0
	if input.Progress != nil {
		progress = *input.Progress
	}
	if progress < 0 || progress > 100 {
		return input, errors.New("Progress must be between 0 and 100")
	}
	if input.Status == "completed" {
		progress = 100
	} else if progress == 100 {
		input.Status = "completed"
	} else if input.Status == "not_started" && progress > 0 {
		input.Status = "in_progress"
	}
	input.Progress = &progress
	if input.DueDate != nil {
		value := strings.TrimSpace(*input.DueDate)
		if value == "" {
			input.DueDate = nil
		} else {
			parsed, err := time.Parse("2006-01-02", value)
			if err != nil || parsed.Format("2006-01-02") != value {
				return input, errors.New("Due date must use YYYY-MM-DD")
			}
			input.DueDate = &value
		}
	}
	return input, nil
}

const milestoneColumns = `id,team_id,title,description,status,progress,
	CASE WHEN due_date IS NULL THEN NULL ELSE to_char(due_date,'YYYY-MM-DD') END,
	created_by,created_at,updated_at`

func scanMilestone(row pgx.Row) (TeamMilestone, error) {
	var milestone TeamMilestone
	err := row.Scan(&milestone.ID, &milestone.TeamID, &milestone.Title, &milestone.Description,
		&milestone.Status, &milestone.Progress, &milestone.DueDate, &milestone.CreatedBy,
		&milestone.CreatedAt, &milestone.UpdatedAt)
	return milestone, err
}

func GetTeamMilestones(c echo.Context, pool *pgxpool.Pool) error {
	teamID, err := resourceID(c)
	if err != nil {
		return err
	}
	userID, err := milestoneUser(c)
	if err != nil {
		return err
	}
	owner, member, err := teamMilestoneAccess(c.Request().Context(), pool, teamID, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return apiError(c, http.StatusNotFound, "Team not found")
	}
	if err != nil {
		return dbError(c, err)
	}
	if !owner && !member {
		return apiError(c, http.StatusForbidden, "Competition workspace is available to team members")
	}
	rows, err := pool.Query(c.Request().Context(), `SELECT `+milestoneColumns+` FROM team_milestones
		WHERE team_id=$1 ORDER BY (status='completed'), due_date IS NULL, due_date, created_at, id`, teamID)
	if err != nil {
		return dbError(c, err)
	}
	defer rows.Close()
	result := milestoneList{Milestones: []TeamMilestone{}, CanManage: owner}
	progressTotal := 0
	for rows.Next() {
		milestone, scanErr := scanMilestone(rows)
		if scanErr != nil {
			return dbError(c, scanErr)
		}
		result.Milestones = append(result.Milestones, milestone)
		progressTotal += milestone.Progress
		switch milestone.Status {
		case "completed":
			result.Summary.Completed++
		case "in_progress":
			result.Summary.InProgress++
		default:
			result.Summary.NotStarted++
		}
		if result.Summary.NextMilestone == nil && milestone.Status != "completed" {
			copy := milestone
			result.Summary.NextMilestone = &copy
		}
	}
	if err = rows.Err(); err != nil {
		return dbError(c, err)
	}
	result.Summary.Total = len(result.Milestones)
	if result.Summary.Total > 0 {
		overall := int(math.Round(float64(progressTotal) / float64(result.Summary.Total)))
		result.Summary.OverallProgress = &overall
	}
	return c.JSON(http.StatusOK, result)
}

func CreateTeamMilestone(c echo.Context, pool *pgxpool.Pool) error {
	teamID, err := resourceID(c)
	if err != nil {
		return err
	}
	userID, err := milestoneUser(c)
	if err != nil {
		return err
	}
	var body milestonePayload
	if err = readBody(c, &body); err != nil {
		return err
	}
	body, err = prepareMilestone(body)
	if err != nil {
		return apiError(c, http.StatusBadRequest, err.Error())
	}
	ctx := c.Request().Context()
	tx, err := pool.Begin(ctx)
	if err != nil {
		return dbError(c, err)
	}
	defer tx.Rollback(ctx)
	var ownerID int64
	if err = tx.QueryRow(ctx, `SELECT owner_id FROM teams WHERE id=$1 FOR KEY SHARE`, teamID).Scan(&ownerID); errors.Is(err, pgx.ErrNoRows) {
		return apiError(c, http.StatusNotFound, "Team not found")
	} else if err != nil {
		return dbError(c, err)
	}
	if ownerID != userID {
		return apiError(c, http.StatusForbidden, "Only the team owner can manage milestones")
	}
	milestone, err := scanMilestone(tx.QueryRow(ctx, `INSERT INTO team_milestones(team_id,title,description,status,progress,due_date,created_by)
		VALUES($1,$2,$3,$4,$5,$6::date,$7) RETURNING `+milestoneColumns,
		teamID, body.Title, body.Description, body.Status, *body.Progress, body.DueDate, userID))
	if err != nil {
		return dbError(c, err)
	}
	message := fmt.Sprintf("%s was added to the team competition workspace.", milestone.Title)
	if _, err = tx.Exec(ctx, `INSERT INTO notifications(user_id,type,title,message,related_team_id,related_user_id)
		SELECT user_id,'milestone_created','New team milestone',$2,$1,$3 FROM team_members
		WHERE team_id=$1 AND user_id<>$3`, teamID, message, userID); err != nil {
		return dbError(c, err)
	}
	if err = tx.Commit(ctx); err != nil {
		return dbError(c, err)
	}
	return c.JSON(http.StatusCreated, milestone)
}

func UpdateTeamMilestone(c echo.Context, pool *pgxpool.Pool) error {
	teamID, err := resourceID(c)
	if err != nil {
		return err
	}
	id, err := milestoneID(c)
	if err != nil {
		return err
	}
	userID, err := milestoneUser(c)
	if err != nil {
		return err
	}
	var body milestonePayload
	if err = readBody(c, &body); err != nil {
		return err
	}
	body, err = prepareMilestone(body)
	if err != nil {
		return apiError(c, http.StatusBadRequest, err.Error())
	}
	ctx := c.Request().Context()
	tx, err := pool.Begin(ctx)
	if err != nil {
		return dbError(c, err)
	}
	defer tx.Rollback(ctx)
	var ownerID int64
	if err = tx.QueryRow(ctx, `SELECT owner_id FROM teams WHERE id=$1 FOR KEY SHARE`, teamID).Scan(&ownerID); errors.Is(err, pgx.ErrNoRows) {
		return apiError(c, http.StatusNotFound, "Team not found")
	} else if err != nil {
		return dbError(c, err)
	}
	if ownerID != userID {
		return apiError(c, http.StatusForbidden, "Only the team owner can manage milestones")
	}
	var oldStatus string
	if err = tx.QueryRow(ctx, `SELECT status FROM team_milestones WHERE id=$1 AND team_id=$2 FOR UPDATE`, id, teamID).Scan(&oldStatus); errors.Is(err, pgx.ErrNoRows) {
		return apiError(c, http.StatusNotFound, "Milestone not found")
	} else if err != nil {
		return dbError(c, err)
	}
	milestone, err := scanMilestone(tx.QueryRow(ctx, `UPDATE team_milestones SET title=$1,description=$2,status=$3,progress=$4,due_date=$5::date,updated_at=NOW()
		WHERE id=$6 AND team_id=$7 RETURNING `+milestoneColumns,
		body.Title, body.Description, body.Status, *body.Progress, body.DueDate, id, teamID))
	if err != nil {
		return dbError(c, err)
	}
	if oldStatus != "completed" && milestone.Status == "completed" {
		message := fmt.Sprintf("%s was marked complete.", milestone.Title)
		if _, err = tx.Exec(ctx, `INSERT INTO notifications(user_id,type,title,message,related_team_id,related_user_id)
			SELECT user_id,'milestone_completed','Milestone completed',$2,$1,$3 FROM team_members
			WHERE team_id=$1 AND user_id<>$3`, teamID, message, userID); err != nil {
			return dbError(c, err)
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return dbError(c, err)
	}
	return c.JSON(http.StatusOK, milestone)
}

func DeleteTeamMilestone(c echo.Context, pool *pgxpool.Pool) error {
	teamID, err := resourceID(c)
	if err != nil {
		return err
	}
	id, err := milestoneID(c)
	if err != nil {
		return err
	}
	userID, err := milestoneUser(c)
	if err != nil {
		return err
	}
	ctx := c.Request().Context()
	var ownerID int64
	if err = pool.QueryRow(ctx, `SELECT owner_id FROM teams WHERE id=$1`, teamID).Scan(&ownerID); errors.Is(err, pgx.ErrNoRows) {
		return apiError(c, http.StatusNotFound, "Team not found")
	} else if err != nil {
		return dbError(c, err)
	}
	if ownerID != userID {
		return apiError(c, http.StatusForbidden, "Only the team owner can manage milestones")
	}
	result, err := pool.Exec(ctx, `DELETE FROM team_milestones WHERE id=$1 AND team_id=$2`, id, teamID)
	if err != nil {
		return dbError(c, err)
	}
	if result.RowsAffected() == 0 {
		return apiError(c, http.StatusNotFound, "Milestone not found")
	}
	return c.NoContent(http.StatusNoContent)
}
