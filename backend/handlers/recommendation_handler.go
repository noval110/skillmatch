package handlers

import (
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"math"
	"skillmatch/models"
	"sort"
	"strings"
)

type RecommendedTeam struct {
	Team             models.Team              `json:"team"`
	MemberCount      int                      `json:"member_count"`
	MatchScore       int                      `json:"match_score"`
	RecommendedRole  string                   `json:"recommended_role"`
	Match            models.RoleMatchResponse `json:"match"`
	Breakdown        map[string]int           `json:"breakdown"`
	MatchedSkills    []string                 `json:"matched_skills"`
	Reason           string                   `json:"reason"`
	AvailabilityNote string                   `json:"availability_note"`
}

func recommendationReason(match models.RoleMatchResponse) string {
	reasons := []string{}
	if len(match.MatchedSkills) > 0 && match.SkillScore >= 24 {
		reasons = append(reasons, "Strong skill compatibility")
	}
	if match.RoleInterestScore == 25 {
		reasons = append(reasons, "Matches your preferred role")
	}
	if match.ProjectInterestScore >= 12 {
		reasons = append(reasons, "Aligned competition interests")
	}
	if match.ExperiencePreference == "beginner" && match.ExperienceFitScore == 10 {
		reasons = append(reasons, "Role welcomes your beginner experience")
	}
	if len(reasons) == 0 {
		return "Open role with room for another teammate; review the match breakdown"
	}
	return strings.Join(reasons, " · ")
}
func GetRecommendedTeams(c echo.Context, pool *pgxpool.Pool) error {
	ctx := c.Request().Context()
	userID := c.Get("user_id").(int64)
	var user models.User
	err := pool.QueryRow(ctx, `SELECT COALESCE(experience_level,''),COALESCE(preferred_role,''),COALESCE(availability,''),COALESCE(project_interest,'') FROM users WHERE id=$1`, userID).Scan(&user.ExperienceLevel, &user.PreferredRole, &user.Availability, &user.ProjectInterest)
	if errors.Is(err, pgx.ErrNoRows) {
		return apiError(c, 404, "User not found")
	}
	if err != nil {
		return dbError(c, err)
	}
	// Fetch all candidate roles and requirements in one round trip; use the same
	// pure scorer as the existing per-role endpoint, never a second scoring system.
	rows, err := pool.Query(ctx, `SELECT
 jsonb_build_object('id',t.id,'name',t.name,'description',COALESCE(t.description,''),'project_idea',COALESCE(t.project_idea,''),'max_members',t.max_members,'owner_id',t.owner_id,'competition_category',COALESCE(t.competition_category,''),'competition_type',COALESCE(t.competition_type,''),'beginner_friendly',t.beginner_friendly,'willing_to_mentor',t.willing_to_mentor),
 jsonb_build_object('id',r.id,'team_id',t.id,'role_name',r.role_name,'status',r.status,'experience_preference',r.experience_preference),
 counts.members,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('Name',s.name,'RequiredLevel',rs.required_level,'UserLevel',us.level) ORDER BY s.name)
 FROM role_skills rs JOIN skills s ON s.id=rs.skill_id LEFT JOIN user_skills us ON us.skill_id=rs.skill_id AND us.user_id=$1 WHERE rs.role_id=r.id),'[]'::jsonb)
 FROM teams t JOIN team_roles r ON r.team_id=t.id AND r.status IN ('open','active')
 CROSS JOIN LATERAL (SELECT COUNT(*) AS members FROM team_members WHERE team_id=t.id) counts
 WHERE t.owner_id<>$1 AND counts.members<t.max_members
 AND NOT EXISTS(SELECT 1 FROM team_members WHERE team_id=t.id AND user_id=$1)
 ORDER BY t.id,r.id`, userID)
	if err != nil {
		return dbError(c, err)
	}
	defer rows.Close()
	best := map[int64]RecommendedTeam{}
	for rows.Next() {
		var item RecommendedTeam
		var role models.TeamRole
		var skills []matchSkill
		if err = rows.Scan(&item.Team, &role, &item.MemberCount, &skills); err != nil {
			return dbError(c, err)
		}
		item.Match = calculateRoleMatch(user, item.Team, role, skills)
		item.MatchScore = item.Match.MatchScore
		item.RecommendedRole = role.RoleName
		item.MatchedSkills = item.Match.MatchedSkills
		if existing, ok := best[item.Team.ID]; ok && existing.MatchScore >= item.MatchScore {
			continue
		}
		item.Breakdown = map[string]int{"skills": int(math.Round(float64(item.Match.SkillScore) * 100 / 30)), "role": item.Match.RoleInterestScore * 4, "availability": item.Match.AvailabilityScore * 5, "interest": int(math.Round(float64(item.Match.ProjectInterestScore) * 100 / 15)), "experience": item.Match.ExperienceFitScore * 10}
		item.Reason = recommendationReason(item.Match)
		item.AvailabilityNote = "Teams have no schedule requirement yet; availability is neutral."
		if normalized(user.Availability) == "flexible" {
			item.AvailabilityNote = "Your flexible availability contributes to this match; team schedules are not yet specified."
		}
		best[item.Team.ID] = item
	}
	if err = rows.Err(); err != nil {
		return dbError(c, err)
	}
	items := make([]RecommendedTeam, 0, len(best))
	for _, item := range best {
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].MatchScore != items[j].MatchScore {
			return items[i].MatchScore > items[j].MatchScore
		}
		return items[i].Team.ID < items[j].Team.ID
	})
	if len(items) > 12 {
		items = items[:12]
	}
	return c.JSON(200, items)
}
