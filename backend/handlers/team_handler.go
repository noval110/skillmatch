package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"skillmatch/models"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

// CreateTeam creates a new team and adds the creator as the owner.
func CreateTeam(c echo.Context, conn *pgxpool.Pool) error {
	userID := c.Get("user_id").(int64)

	var req models.CreateTeamRequest

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request",
		})
	}

	if !normalizeCompetition(&req.CompetitionCategory, &req.CompetitionType) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Competition category must be at most 50 characters and type at most 100 characters"})
	}

	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Team name is required",
		})
	}

	if req.ProjectIdea == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Project idea is required",
		})
	}

	if req.MaxMembers < 2 {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Team must have at least 2 members",
		})
	}

	if req.MaxMembers > 10 {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Team cannot have more than 10 members",
		})
	}

	var teamID int64

	tx, err := conn.Begin(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create team"})
	}
	defer tx.Rollback(c.Request().Context())
	err = tx.QueryRow(
		context.Background(),
		`
							INSERT INTO teams (name, description, project_idea, max_members, owner_id, beginner_friendly, willing_to_mentor, competition_category, competition_type)
							VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
							RETURNING id
							`,
		req.Name,
		req.Description,
		req.ProjectIdea,
		req.MaxMembers,
		userID, req.BeginnerFriendly, req.WillingToMentor, req.CompetitionCategory, req.CompetitionType,
	).Scan(&teamID)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to create team",
		})
	}

	_, err = tx.Exec(
		context.Background(),
		`
							INSERT INTO team_members (team_id, user_id, role)
							VALUES ($1, $2, $3)
							`,
		teamID,
		userID,
		"Owner",
	)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to create team with owner membership",
		})
	}
	if err := tx.Commit(c.Request().Context()); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save team"})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"message": "Team created successfully",
		"team_id": teamID,
	})
}

// get all teams endpoint
func GetTeams(c echo.Context, conn *pgxpool.Pool) error {
	rows, err := conn.Query(
		context.Background(),
		`SELECT id, name, COALESCE(description, ''), COALESCE(project_idea, ''), max_members, owner_id, beginner_friendly, willing_to_mentor, COALESCE(competition_category, ''), COALESCE(competition_type, '') 
							FROM teams
							ORDER BY id DESC`,
	)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to fetch teams",
		})
	}

	defer rows.Close()

	teams := []models.Team{}

	for rows.Next() {
		var team models.Team

		if err := rows.Scan(
			&team.ID,
			&team.Name,
			&team.Description,
			&team.ProjectIdea,
			&team.MaxMembers,
			&team.OwnerID, &team.BeginnerFriendly, &team.WillingToMentor, &team.CompetitionCategory, &team.CompetitionType,
		); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "Failed to read team data",
			})
		}

		teams = append(teams, team)
	}

	if rows.Err() != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to read team data"})
	}
	return c.JSON(http.StatusOK, teams)
}

// SearchTeams searches teams by team name, role name, and skill name.
func SearchTeams(c echo.Context, conn *pgxpool.Pool) error {
	name := c.QueryParam("name")
	role := c.QueryParam("role")
	skill := c.QueryParam("skill")
	var beginnerFriendly *bool
	if value := c.QueryParam("beginner_friendly"); value != "" {
		parsed, err := strconv.ParseBool(value)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "beginner_friendly must be true or false"})
		}
		beginnerFriendly = &parsed
	}

	query := `
		SELECT DISTINCT
			t.id,
			t.name,
			COALESCE(t.description, ''),
			COALESCE(t.project_idea, ''),
			t.max_members,
			t.owner_id, t.beginner_friendly, t.willing_to_mentor, COALESCE(t.competition_category, ''), COALESCE(t.competition_type, '')
		FROM teams t

		LEFT JOIN team_roles tr
			ON tr.team_id = t.id

		LEFT JOIN role_skills rs
			ON rs.role_id = tr.id

		LEFT JOIN skills s
			ON s.id = rs.skill_id

		WHERE
			($1 = '' OR LOWER(t.name) LIKE LOWER('%' || $1 || '%'))
			AND
			($2 = '' OR LOWER(tr.role_name) LIKE LOWER('%' || $2 || '%'))
			AND
			($3 = '' OR LOWER(s.name) LIKE LOWER('%' || $3 || '%'))
 AND ($4::boolean IS NULL OR t.beginner_friendly = $4)
 AND ($5 = '' OR LOWER(t.competition_category) = LOWER($5))
 AND ($6 = '' OR LOWER(t.competition_type) = LOWER($6))

		ORDER BY t.id DESC
	`

	rows, err := conn.Query(
		context.Background(),
		query,
		name,
		role,
		skill, beginnerFriendly, strings.TrimSpace(c.QueryParam("competition_category")), strings.TrimSpace(c.QueryParam("competition_type")),
	)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to search teams",
		})
	}

	defer rows.Close()

	teams := []models.Team{}

	for rows.Next() {
		var team models.Team

		if err := rows.Scan(
			&team.ID,
			&team.Name,
			&team.Description,
			&team.ProjectIdea,
			&team.MaxMembers,
			&team.OwnerID, &team.BeginnerFriendly, &team.WillingToMentor, &team.CompetitionCategory, &team.CompetitionType,
		); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "Failed to read team data",
			})
		}

		teams = append(teams, team)
	}

	if rows.Err() != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to read team data"})
	}
	return c.JSON(http.StatusOK, teams)
}

// get team by id endpoint
func GetTeamDetail(c echo.Context, conn *pgxpool.Pool) error {
	teamID := c.Param("id")

	var team models.Team

	err := conn.QueryRow(
		context.Background(),
		`SELECT id, name, COALESCE(description, ''), COALESCE(project_idea, ''), max_members, owner_id, beginner_friendly, willing_to_mentor, COALESCE(competition_category, ''), COALESCE(competition_type, '')
							FROM teams
							WHERE id=$1`,
		teamID,
	).Scan(
		&team.ID,
		&team.Name,
		&team.Description,
		&team.ProjectIdea,
		&team.MaxMembers,
		&team.OwnerID, &team.BeginnerFriendly, &team.WillingToMentor, &team.CompetitionCategory, &team.CompetitionType,
	)

	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Team not found",
		})
	}

	rows, err := conn.Query(
		context.Background(),
		`SELECT users.id, users.name, team_members.role
							FROM team_members
							JOIN users ON team_members.user_id = users.id
							WHERE team_members.team_id=$1`,
		teamID,
	)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to fetch team members",
		})
	}

	defer rows.Close()

	members := []models.TeamMember{}

	for rows.Next() {
		var member models.TeamMember

		if err := rows.Scan(
			&member.ID,
			&member.Name,
			&member.Role,
		); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "Failed to read team member data",
			})
		}
		member.AvatarURL = avatarURL(member.ID)

		members = append(members, member)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"team":    team,
		"members": members,
	})
}

// UpdateTeam allows the team owner to update their team.
func UpdateTeam(c echo.Context, conn *pgxpool.Pool) error {
	userID := c.Get("user_id").(int64)
	teamID := c.Param("id")

	var req models.UpdateTeamRequest

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request",
		})
	}

	if !normalizeCompetition(req.CompetitionCategory, req.CompetitionType) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Competition category must be at most 50 characters and type at most 100 characters"})
	}

	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Team name is required",
		})
	}

	if req.ProjectIdea == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Project idea is required",
		})
	}

	if req.MaxMembers < 2 || req.MaxMembers > 10 {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Max members must be between 2 and 10",
		})
	}

	var ownerID int64

	err := conn.QueryRow(
		context.Background(),
		`
		SELECT owner_id
		FROM teams
		WHERE id = $1
		`,
		teamID,
	).Scan(&ownerID)

	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Team not found",
		})
	}

	if ownerID != userID {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "Only team owner can update team",
		})
	}

	_, err = conn.Exec(
		context.Background(),
		`
		UPDATE teams
		SET
			name = $1,
			description = $2,
			project_idea = $3,
			max_members = $4, beginner_friendly = $6, willing_to_mentor = $7,
 competition_category = COALESCE($8, competition_category), competition_type = COALESCE($9, competition_type)
		WHERE id = $5
		`,
		req.Name,
		req.Description,
		req.ProjectIdea,
		req.MaxMembers,
		teamID, req.BeginnerFriendly, req.WillingToMentor, req.CompetitionCategory, req.CompetitionType,
	)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to update team",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Team updated successfully",
	})
}

func DeleteTeam(c echo.Context, conn *pgxpool.Pool) error {
	userID := c.Get("user_id").(int64)
	teamID := c.Param("id")

	var ownerID int64

	err := conn.QueryRow(
		context.Background(),
		`
		SELECT owner_id
		FROM teams
		WHERE id = $1
		`,
		teamID,
	).Scan(&ownerID)

	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Team not found",
		})
	}

	if ownerID != userID {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "Only team owner can delete team",
		})
	}

	tx, err := conn.Begin(context.Background())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to start transaction",
		})
	}

	defer tx.Rollback(context.Background())

	_, err = tx.Exec(
		context.Background(),
		`
		DELETE FROM role_skills
		WHERE role_id IN (
			SELECT id
			FROM team_roles
			WHERE team_id = $1
		)
		`,
		teamID,
	)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete role skills",
		})
	}

	_, err = tx.Exec(
		context.Background(),
		`DELETE FROM team_roles WHERE team_id = $1`,
		teamID,
	)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete team roles",
		})
	}

	_, err = tx.Exec(
		context.Background(),
		`DELETE FROM join_requests WHERE team_id = $1`,
		teamID,
	)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete join requests",
		})
	}

	_, err = tx.Exec(
		context.Background(),
		`DELETE FROM team_members WHERE team_id = $1`,
		teamID,
	)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete team members",
		})
	}

	_, err = tx.Exec(
		context.Background(),
		`DELETE FROM teams WHERE id = $1`,
		teamID,
	)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete team",
		})
	}

	if err := tx.Commit(context.Background()); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to commit transaction",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Team deleted successfully",
	})
}

// accept join request endpoint
func AcceptJoinRequest(c echo.Context, conn *pgxpool.Pool) error {
	return decideJoinRequest(c, conn, "accepted")
}

func RejectJoinRequest(c echo.Context, conn *pgxpool.Pool) error {
	return decideJoinRequest(c, conn, "rejected")
}

// JoinTeam creates a pending request to join a team.
func JoinTeam(c echo.Context, conn *pgxpool.Pool) error {
	userID := c.Get("user_id").(int64)
	teamID := c.Param("id")

	var req models.JoinTeamRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	var ownerID int64
	if err := conn.QueryRow(context.Background(),
		`SELECT owner_id FROM teams WHERE id=$1`, teamID,
	).Scan(&ownerID); err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Team not found"})
	}
	if ownerID == userID {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Team owner is already a member"})
	}

	var exists bool
	if err := conn.QueryRow(context.Background(),
		`SELECT EXISTS(SELECT 1 FROM team_members WHERE team_id=$1 AND user_id=$2)`,
		teamID, userID,
	).Scan(&exists); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to check team membership"})
	}
	if exists {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "User is already a team member"})
	}

	var existingRequestID int64
	var existingStatus string
	err := conn.QueryRow(context.Background(),
		`SELECT id, status
		 FROM join_requests
		 WHERE team_id=$1 AND user_id=$2
		 ORDER BY id DESC
		 LIMIT 1`,
		teamID, userID,
	).Scan(&existingRequestID, &existingStatus)
	if err == nil {
		if existingStatus == "pending" {
			return c.JSON(http.StatusConflict, map[string]string{"error": "Join request already exists"})
		}
		if _, err := conn.Exec(context.Background(),
			`UPDATE join_requests
			 SET message=$1, status='pending'
			 WHERE id=$2`,
			req.Message, existingRequestID,
		); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to resubmit join request"})
		}
		return c.JSON(http.StatusOK, map[string]string{"message": "Join request resubmitted"})
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to check join request"})
	}

	if _, err := conn.Exec(context.Background(),
		`INSERT INTO join_requests (team_id, user_id, message, status) VALUES ($1, $2, $3, 'pending')`,
		teamID, userID, req.Message,
	); err != nil {
		var pgErr *pgconn.PgError

		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return c.JSON(http.StatusConflict, map[string]string{
				"error": "Join request already exists",
			})
		}

		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create join request"})
	}

	return c.JSON(http.StatusCreated, map[string]string{"message": "Join request submitted"})
}

// LeaveTeam allows a non-owner member to leave a team.
func LeaveTeam(c echo.Context, conn *pgxpool.Pool) error {
	userID := c.Get("user_id").(int64)
	teamID := c.Param("id")

	var ownerID int64

	err := conn.QueryRow(
		context.Background(),
		`
		SELECT owner_id
		FROM teams
		WHERE id = $1
		`,
		teamID,
	).Scan(&ownerID)

	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Team not found",
		})
	}

	if ownerID == userID {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Team owner cannot leave the team",
		})
	}

	result, err := conn.Exec(
		context.Background(),
		`
		DELETE FROM team_members
		WHERE team_id = $1
		AND user_id = $2
		`,
		teamID,
		userID,
	)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to leave team",
		})
	}

	if result.RowsAffected() == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "You are not a member of this team",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Left team successfully",
	})
}

// RemoveTeamMember allows the team owner to remove a member.
func RemoveTeamMember(c echo.Context, conn *pgxpool.Pool) error {
	currentUserID := c.Get("user_id").(int64)
	teamID := c.Param("id")
	targetUserID := c.Param("user_id")

	var ownerID int64

	err := conn.QueryRow(
		context.Background(),
		`
		SELECT owner_id
		FROM teams
		WHERE id = $1
		`,
		teamID,
	).Scan(&ownerID)

	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Team not found",
		})
	}

	if ownerID != currentUserID {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "Only team owner can remove members",
		})
	}

	if targetUserID == fmt.Sprintf("%d", ownerID) {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Team owner cannot remove themselves",
		})
	}

	result, err := conn.Exec(
		context.Background(),
		`
		DELETE FROM team_members
		WHERE team_id = $1
		AND user_id = $2
		`,
		teamID,
		targetUserID,
	)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to remove team member",
		})
	}

	if result.RowsAffected() == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Team member not found",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Team member removed successfully",
	})
}

// GetJoinRequests lets the team owner view requests for that team.
func GetJoinRequests(c echo.Context, conn *pgxpool.Pool) error {
	userID := c.Get("user_id").(int64)
	teamID := c.Param("id")

	var ownerID int64
	if err := conn.QueryRow(context.Background(),
		`SELECT owner_id FROM teams WHERE id=$1`, teamID,
	).Scan(&ownerID); err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Team not found"})
	}
	if ownerID != userID {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Only team owner can view join requests"})
	}

	rows, err := conn.Query(context.Background(),
		`SELECT join_requests.id, join_requests.user_id, join_requests.message,
					users.name, join_requests.status
			FROM join_requests
			JOIN users ON join_requests.user_id = users.id
			WHERE join_requests.team_id=$1
			ORDER BY join_requests.id DESC`,
		teamID,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch join requests"})
	}
	defer rows.Close()

	requests := []models.JoinRequestResponse{}
	for rows.Next() {
		var request models.JoinRequestResponse
		if err := rows.Scan(&request.ID, &request.UserID, &request.Message, &request.Name, &request.Status); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to read join request data"})
		}
		request.AvatarURL = avatarURL(request.UserID)
		requests = append(requests, request)
	}

	return c.JSON(http.StatusOK, requests)

}

// CreateTeamRole allows the team owner to create a new role for their team
func CreateTeamRole(c echo.Context, conn *pgxpool.Pool) error {
	userID := c.Get("user_id").(int64)
	teamID := c.Param("id")

	var req models.CreateTeamRoleRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	if req.ExperiencePreference == "" {
		req.ExperiencePreference = "open"
	}
	if !validExperiencePreference(req.ExperiencePreference) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Experience preference must be beginner, intermediate, advanced, or open"})
	}
	if req.RoleName == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Role name is required"})
	}

	var ownerID int64

	err := conn.QueryRow(context.Background(),
		`SELECT owner_id FROM teams WHERE id=$1`, teamID).Scan(&ownerID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Team not found"})
	}

	if ownerID != userID {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Only team owner can create roles"})
	}

	var roleID int64
	err = conn.QueryRow(context.Background(),
		`INSERT INTO team_roles (team_id, role_name, experience_preference) VALUES ($1, $2, $3) RETURNING id`, teamID, req.RoleName, req.ExperiencePreference).Scan(&roleID)

	if err != nil {
		var pgErr *pgconn.PgError

		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return c.JSON(http.StatusConflict, map[string]string{
				"error": "Role already exists in this team",
			})
		}

		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create team role"})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"message": "Role created successfully",
		"role_id": roleID,
	})
}

// GetTeamRoles retrieves all roles for a specific team
func GetTeamRoles(c echo.Context, conn *pgxpool.Pool) error {
	teamID := c.Param("id")

	rows, err := conn.Query(context.Background(),
		`SELECT id, role_name, team_id, status, experience_preference 
			FROM team_roles 
			WHERE team_id=$1 
			ORDER BY id ASC`,
		teamID)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to fetch team roles"})
	}

	defer rows.Close()

	roles := []models.TeamRole{}

	for rows.Next() {
		var role models.TeamRole

		if err := rows.Scan(&role.ID,
			&role.RoleName,
			&role.TeamID,
			&role.Status, &role.ExperiencePreference,
		); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to read team role data"})
		}
		roles = append(roles, role)
	}

	return c.JSON(http.StatusOK, roles)
}

// UpdateTeamRole allows the team owner to update the status of a role for their team
func UpdateTeamRole(c echo.Context, conn *pgxpool.Pool) error {
	userID := c.Get("user_id").(int64)
	teamID := c.Param("id")
	roleID := c.Param("role_id")

	var req models.UpdateTeamRoleRequest

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request",
		})
	}

	if req.ExperiencePreference != nil && !validExperiencePreference(*req.ExperiencePreference) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Experience preference must be beginner, intermediate, advanced, or open"})
	}
	if req.Status == "" && req.ExperiencePreference == nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Provide status or experience preference"})
	}
	if req.Status != "" && req.Status != "open" && req.Status != "active" && req.Status != "filled" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Status must be active or filled",
		})
	}

	var ownerID int64

	err := conn.QueryRow(
		context.Background(),
		`
			SELECT owner_id 
			FROM teams 
			WHERE id=$1`,
		teamID,
	).Scan(&ownerID)

	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Team not found",
		})
	}

	if ownerID != userID {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "Only team owner can update roles",
		})
	}

	result, err := conn.Exec(
		context.Background(),
		`
			UPDATE team_roles
			SET status=COALESCE(NULLIF($1, ''), status), experience_preference=COALESCE($4, experience_preference)
			WHERE id=$2 AND team_id=$3`,
		req.Status,
		roleID,
		teamID, req.ExperiencePreference,
	)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to update team role",
		})
	}

	if result.RowsAffected() == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Team role not found",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Team role updated successfully",
	})
}

// DeleteTeamRole allows the team owner to delete a role from their team
func DeleteTeamRole(c echo.Context, conn *pgxpool.Pool) error {
	userID := c.Get("user_id").(int64)
	teamID := c.Param("id")
	roleID := c.Param("role_id")

	var ownerID int64

	err := conn.QueryRow(
		context.Background(),
		`
			SELECT owner_id 
			FROM teams 
			WHERE id=$1`,
		teamID,
	).Scan(&ownerID)

	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Team not found",
		})
	}

	if ownerID != userID {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "Only team owner can delete roles",
		})
	}

	result, err := conn.Exec(
		context.Background(),
		`
			DELETE FROM team_roles
			WHERE id=$1 AND team_id=$2`,
		roleID,
		teamID,
	)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete team role",
		})
	}

	if result.RowsAffected() == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Team role not found",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Team role deleted successfully",
	})
}

// AddRoleSkill allows the team owner to add a skill requirement to a role in their team
func AddRoleSkill(c echo.Context, conn *pgxpool.Pool) error {
	userID := c.Get("user_id").(int64)
	teamID := c.Param("id")
	roleID := c.Param("role_id")

	var req models.AddRoleSkillRequest

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request",
		})
	}

	if req.SkillID <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Skill ID is required",
		})
	}

	var ownerID int64

	err := conn.QueryRow(
		context.Background(),
		`
			SELECT owner_id 
			FROM teams 
			WHERE id=$1`,
		teamID,
	).Scan(&ownerID)

	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Team not found",
		})
	}

	if ownerID != userID {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "Only team owner can add members",
		})
	}

	var roleExists bool

	err = conn.QueryRow(
		context.Background(),
		`
			SELECT EXISTS(
				SELECT 1 
				FROM team_roles 
				WHERE id=$1 AND team_id=$2
			)`,
		roleID,
		teamID,
	).Scan(&roleExists)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to check role existence",
		})
	}

	if !roleExists {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Role not found",
		})
	}

	if req.RequiredLevel != "beginner" &&
		req.RequiredLevel != "intermediate" &&
		req.RequiredLevel != "advanced" {

		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Required level must be beginner, intermediate, or advanced",
		})
	}

	_, err = conn.Exec(
		context.Background(),
		`
			INSERT INTO role_skills 
			(role_id, skill_id, required_level)
			VALUES ($1, $2, $3)`,
		roleID,
		req.SkillID,
		req.RequiredLevel,
	)

	if err != nil {
		var pgErr *pgconn.PgError

		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return c.JSON(http.StatusConflict, map[string]string{
				"error": "Skill already exists in this role",
			})
		}

		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to add role skill",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Role skill added successfully",
	})

}

// GetRoleSkills retrieves all skills associated with a specific role in a team
func GetRoleSkills(c echo.Context, conn *pgxpool.Pool) error {
	roleID := c.Param("role_id")

	rows, err := conn.Query(
		context.Background(),
		`
			SELECT
			role_skills.id,
			skills.id, 
			skills.name,
			role_skills.required_level
			FROM role_skills
			JOIN skills
			ON role_skills.skill_id = skills.id
			WHERE role_skills.role_id=$1
			ORDER BY skills.name`,

		roleID,
	)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to fetch role skills",
		})
	}

	defer rows.Close()

	roleSkills := []models.RoleSkill{}

	for rows.Next() {
		var roleSkill models.RoleSkill

		if err := rows.Scan(
			&roleSkill.ID,
			&roleSkill.SkillID,
			&roleSkill.SkillName,
			&roleSkill.RequiredLevel,
		); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "Failed to read role skill data",
			})
		}

		roleSkills = append(roleSkills, roleSkill)
	}

	return c.JSON(http.StatusOK, roleSkills)
}

// DeleteRoleSkill allows the team owner to remove a skill requirement from a role in their team
func DeleteRoleSkill(c echo.Context, conn *pgxpool.Pool) error {
	userID := c.Get("user_id").(int64)
	teamID := c.Param("id")
	roleID := c.Param("role_id")
	skillID := c.Param("skill_id")

	var ownerID int64

	err := conn.QueryRow(
		context.Background(),
		`
		SELECT owner_id
		FROM teams
		WHERE id = $1
		`,
		teamID,
	).Scan(&ownerID)

	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Team not found",
		})
	}

	if ownerID != userID {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "Only team owner can delete role skills",
		})
	}

	result, err := conn.Exec(
		context.Background(),
		`
		DELETE FROM role_skills
		WHERE role_id = $1
		AND skill_id = $2
		`,
		roleID,
		skillID,
	)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to delete role skill",
		})
	}

	if result.RowsAffected() == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "Role skill not found",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Role skill deleted successfully",
	})
}

// GetRoleMatch calculates the match score for a user against a specific role in a team

// Nil fields on update preserve values sent by newer clients.
func normalizeCompetition(category, kind *string) bool {
	for _, field := range []struct {
		value *string
		limit int
	}{{category, 50}, {kind, 100}} {
		if field.value != nil {
			*field.value = strings.TrimSpace(*field.value)
			if utf8.RuneCountInString(*field.value) > field.limit {
				return false
			}
		}
	}
	return true
}
