// Package readiness measures a team's configuration and collective capabilities.
// It deliberately does not call or change the personal recommendation scorer.
package readiness

import (
	"fmt"
	"math"
	"sort"
	"strings"
)

type MemberSkill struct {
	SkillID int64  `json:"skill_id"`
	Level   string `json:"level"`
}
type Member struct {
	ID   int64
	Name string
	// Field presence only: no private profile contents enter the response.
	Bio, Experience, PreferredRole, Availability, ProjectInterest bool
	Skills                                                        []MemberSkill
}
type Requirement struct {
	SkillID int64  `json:"skill_id"`
	Name    string `json:"name"`
	Level   string `json:"level"`
}
type Role struct {
	ID           int64
	Name, Status string
	Skills       []Requirement
}
type Input struct {
	TeamID   int64
	Capacity int
	Members  []Member
	Roles    []Role
}
type Supporter struct {
	ID               int64  `json:"id"`
	Name             string `json:"name"`
	Level            string `json:"level"`
	MeetsRequirement bool   `json:"meets_requirement"`
}
type Skill struct {
	SkillID          int64       `json:"skill_id"`
	Name             string      `json:"name"`
	RequiredLevel    string      `json:"required_level"`
	HighestTeamLevel *string     `json:"highest_team_level"`
	Status           string      `json:"status"`
	Members          []Supporter `json:"members"`
	RoleIDs          []int64     `json:"role_ids"`
}
type RoleResult struct {
	ID             int64   `json:"id"`
	Name           string  `json:"name"`
	Status         string  `json:"status"`
	CoverageStatus string  `json:"coverage_status"`
	Skills         []Skill `json:"required_skills"`
}
type Gap struct {
	Type     string `json:"type"`
	Name     string `json:"name"`
	Severity string `json:"severity"`
	RoleID   int64  `json:"role_id,omitempty"`
	SkillID  int64  `json:"skill_id,omitempty"`
}
type Profile struct {
	ID        int64    `json:"id"`
	Name      string   `json:"name"`
	Completed int      `json:"completed_fields"`
	Total     int      `json:"total_fields"`
	Percent   float64  `json:"percent"`
	Missing   []string `json:"missing_fields"`
}
type Components struct {
	Composition *float64 `json:"team_composition"`
	Roles       *float64 `json:"role_coverage"`
	Skills      *float64 `json:"skill_coverage"`
	Profiles    *float64 `json:"profile_readiness"`
}
type Summary struct {
	MemberCount        int `json:"member_count"`
	Capacity           int `json:"capacity"`
	RoleCount          int `json:"role_count"`
	CoveredRoles       int `json:"covered_roles"`
	RequiredSkills     int `json:"required_skills"`
	CoveredSkills      int `json:"covered_skills"`
	PartialSkills      int `json:"partial_skills"`
	MissingSkills      int `json:"missing_skills"`
	IncompleteProfiles int `json:"incomplete_profiles"`
}
type Result struct {
	TeamID       int64          `json:"team_id"`
	Version      string         `json:"version"`
	Status       string         `json:"status"`
	Score        *int           `json:"readiness_score"`
	Message      string         `json:"message"`
	Components   Components     `json:"components"`
	Weights      map[string]int `json:"weights"`
	Summary      Summary        `json:"summary"`
	Strengths    []string       `json:"strengths"`
	PriorityGaps []Gap          `json:"priority_gaps"`
	Roles        []RoleResult   `json:"roles"`
	Skills       []Skill        `json:"skills"`
	Profiles     []Profile      `json:"member_profiles"`
	Actions      []string       `json:"recommended_actions"`
	Assumptions  []string       `json:"assumptions"`
}

func level(value string) int {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "beginner":
		return 1
	case "intermediate":
		return 2
	case "advanced":
		return 3
	}
	return 0
}
func levelName(value int) string {
	return []string{"unknown", "beginner", "intermediate", "advanced"}[value]
}
func rounded(value float64) *float64 { result := math.Round(value*100) / 100; return &result }

func analyzeSkill(req Requirement, members []Member) (Skill, bool) {
	required := level(req.Level)
	result := Skill{SkillID: req.SkillID, Name: req.Name, RequiredLevel: levelName(required), Status: "missing", Members: []Supporter{}, RoleIDs: []int64{}}
	highest, invalid := 0, required == 0
	for _, member := range members {
		for _, skill := range member.Skills {
			if skill.SkillID != req.SkillID {
				continue
			}
			current := level(skill.Level)
			if current == 0 {
				invalid = true
			}
			if current > highest {
				highest = current
			}
			result.Members = append(result.Members, Supporter{member.ID, member.Name, levelName(current), required > 0 && current >= required})
		}
	}
	if highest > 0 {
		name := levelName(highest)
		result.HighestTeamLevel = &name
	}
	if required > 0 && highest >= required {
		result.Status = "covered"
	} else if highest > 0 {
		result.Status = "partial"
	}
	if invalid {
		result.Status = "unknown"
	}
	sort.Slice(result.Members, func(i, j int) bool { return result.Members[i].ID < result.Members[j].ID })
	return result, invalid
}

// Calculate is deterministic and side-effect free. Components are percentages;
// the final score uses unrounded component fractions, rounded once to an integer.
func Calculate(input Input) Result {
	result := Result{TeamID: input.TeamID, Version: "v1", Status: "setup_required", Message: "Add team roles and required skills to calculate readiness.", Weights: map[string]int{"team_composition": 25, "role_coverage": 30, "skill_coverage": 35, "profile_readiness": 10}, Strengths: []string{}, PriorityGaps: []Gap{}, Roles: []RoleResult{}, Skills: []Skill{}, Profiles: []Profile{}, Actions: []string{}, Assumptions: []string{
		"Team capacity is used as a target size in V1, although max_members is an upper limit.",
		"A covered role must be marked filled by its owner and all its required skills must be covered collectively. No member-role assignments are inferred.",
		"Each unique required skill counts once at its highest required level: covered = 1, partial = 0.5, missing = 0.",
		"Member profile completeness averages six checks: bio, experience, preferred role, availability, competition interest, and at least one valid skill.",
		"Skills are self-reported; collective skill coverage does not measure workload, proficiency verification, or competition outcomes.",
	}}
	result.Summary = Summary{MemberCount: len(input.Members), Capacity: input.Capacity, RoleCount: len(input.Roles)}
	composition, profileAverage := 0.0, 0.0
	setup := input.Capacity <= 0 || len(input.Roles) == 0 || len(input.Members) == 0
	if input.Capacity > 0 {
		composition = math.Min(1, float64(len(input.Members))/float64(input.Capacity))
		result.Components.Composition = rounded(composition * 100)
	}
	for _, member := range input.Members {
		hasSkill := false
		for _, skill := range member.Skills {
			if level(skill.Level) > 0 {
				hasSkill = true
			}
		}
		values := []bool{member.Bio, member.Experience, member.PreferredRole, member.Availability, member.ProjectInterest, hasSkill}
		labels := []string{"Bio", "Experience level", "Preferred role", "Availability", "Competition interests", "At least one skill"}
		p := Profile{ID: member.ID, Name: member.Name, Total: 6, Missing: []string{}}
		for i, valid := range values {
			if valid {
				p.Completed++
			} else {
				p.Missing = append(p.Missing, labels[i])
			}
		}
		p.Percent = *rounded(float64(p.Completed) / 6 * 100)
		profileAverage += float64(p.Completed) / 6
		if p.Completed < 6 {
			result.Summary.IncompleteProfiles++
		}
		result.Profiles = append(result.Profiles, p)
	}
	sort.Slice(result.Profiles, func(i, j int) bool { return result.Profiles[i].ID < result.Profiles[j].ID })
	if len(input.Members) > 0 {
		profileAverage /= float64(len(input.Members))
		result.Components.Profiles = rounded(profileAverage * 100)
	}
	roles := append([]Role(nil), input.Roles...)
	sort.Slice(roles, func(i, j int) bool { return roles[i].ID < roles[j].ID })
	unique := map[int64]Requirement{}
	skillRoles := map[int64][]int64{}
	rolesConfigured, levelsValid := len(roles) > 0, true
	for _, role := range roles {
		row := RoleResult{ID: role.ID, Name: role.Name, Status: role.Status, CoverageStatus: "missing", Skills: []Skill{}}
		allCovered, someCoverage, invalid := len(role.Skills) > 0, false, false
		for _, req := range role.Skills {
			skill, badLevel := analyzeSkill(req, input.Members)
			skill.RoleIDs = append(skill.RoleIDs, role.ID)
			row.Skills = append(row.Skills, skill)
			invalid = invalid || badLevel
			if skill.Status != "covered" {
				allCovered = false
			}
			if skill.Status == "covered" || skill.Status == "partial" {
				someCoverage = true
			}
			previous, exists := unique[req.SkillID]
			if !exists || level(req.Level) > level(previous.Level) {
				unique[req.SkillID] = req
			}
			skillRoles[req.SkillID] = append(skillRoles[req.SkillID], role.ID)
		}
		sort.Slice(row.Skills, func(i, j int) bool { return row.Skills[i].SkillID < row.Skills[j].SkillID })
		statusValid := role.Status == "filled" || role.Status == "active" || role.Status == "open"
		if len(role.Skills) == 0 || invalid || !statusValid {
			row.CoverageStatus = "setup_required"
			setup = true
			rolesConfigured = false
			if len(role.Skills) == 0 {
				result.Actions = append(result.Actions, fmt.Sprintf("Define the skills required for %s", role.Name))
			}
			if invalid {
				levelsValid = false
				result.Actions = append(result.Actions, fmt.Sprintf("Confirm valid proficiency levels for %s", role.Name))
			}
			if !statusValid {
				result.Actions = append(result.Actions, fmt.Sprintf("Confirm the status of the %s role", role.Name))
			}
		} else if role.Status != "filled" {
			// Without member-to-role assignments, the owner-controlled filled state is
			// the only explicit evidence that responsibility for this role is covered.
			row.CoverageStatus = "missing"
		} else if allCovered {
			row.CoverageStatus = "covered"
			result.Summary.CoveredRoles++
		} else if someCoverage {
			row.CoverageStatus = "partial"
		}
		result.Roles = append(result.Roles, row)
	}
	ids := make([]int64, 0, len(unique))
	for id := range unique {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	skillPoints := 0.0
	for _, id := range ids {
		skill, bad := analyzeSkill(unique[id], input.Members)
		skill.RoleIDs = skillRoles[id]
		result.Skills = append(result.Skills, skill)
		if bad {
			levelsValid = false
			setup = true
		}
		switch skill.Status {
		case "covered":
			skillPoints++
			result.Summary.CoveredSkills++
		case "partial":
			skillPoints += .5
			result.Summary.PartialSkills++
		case "missing":
			result.Summary.MissingSkills++
		}
	}
	result.Summary.RequiredSkills = len(result.Skills)
	// Stable priority ordering: missing roles, missing skills, partial skills, role
	// confirmation, incomplete profiles. Setup actions are presented first.
	for _, role := range result.Roles {
		if role.CoverageStatus == "missing" {
			result.PriorityGaps = append(result.PriorityGaps, Gap{Type: "role", Name: role.Name, Severity: "missing", RoleID: role.ID})
			result.Actions = append(result.Actions, fmt.Sprintf("Find a teammate for the %s role", role.Name))
		}
	}
	for _, severity := range []string{"missing", "partial"} {
		for _, skill := range result.Skills {
			if skill.Status != severity {
				continue
			}
			result.PriorityGaps = append(result.PriorityGaps, Gap{Type: "skill", Name: skill.Name, Severity: severity, SkillID: skill.SkillID})
			if severity == "missing" {
				result.Actions = append(result.Actions, fmt.Sprintf("Find a teammate with %s", skill.Name))
			} else {
				result.Actions = append(result.Actions, fmt.Sprintf("Strengthen %s from %s to %s", skill.Name, *skill.HighestTeamLevel, skill.RequiredLevel))
			}
		}
	}
	if result.Summary.IncompleteProfiles > 0 {
		profileGap := fmt.Sprintf("%d members have incomplete profiles", result.Summary.IncompleteProfiles)
		if result.Summary.IncompleteProfiles == 1 {
			profileGap = "1 member has an incomplete profile"
		}
		result.PriorityGaps = append(result.PriorityGaps, Gap{Type: "profile", Name: profileGap, Severity: "incomplete"})
		result.Actions = append(result.Actions, "Ask teammates to complete their own profiles and skills")
	}
	strengths := append([]Skill(nil), result.Skills...)
	supportCount := func(s Skill) int {
		n := 0
		for _, m := range s.Members {
			if m.MeetsRequirement {
				n++
			}
		}
		return n
	}
	sort.SliceStable(strengths, func(i, j int) bool { return supportCount(strengths[i]) > supportCount(strengths[j]) })
	for _, skill := range strengths {
		if skill.Status == "covered" {
			result.Strengths = append(result.Strengths, skill.Name)
		}
	}
	roleFraction, skillFraction := 0.0, 0.0
	if rolesConfigured {
		roleFraction = float64(result.Summary.CoveredRoles) / float64(len(roles))
		result.Components.Roles = rounded(roleFraction * 100)
	}
	if len(result.Skills) > 0 && levelsValid {
		skillFraction = skillPoints / float64(len(result.Skills))
		result.Components.Skills = rounded(skillFraction * 100)
	} else {
		setup = true
	}
	if len(input.Roles) == 0 {
		result.Actions = append([]string{"Add team roles and their required skills"}, result.Actions...)
	}
	if input.Capacity <= 0 {
		result.Actions = append(result.Actions, "Set a valid team capacity")
	}
	if len(input.Members) == 0 {
		result.Actions = append(result.Actions, "Add team members to calculate readiness")
	}
	if !setup {
		score := int(math.Round(composition*25 + roleFraction*30 + skillFraction*35 + profileAverage*10))
		result.Score = &score
		result.Status = "ready" // means analysis available, not a promise of competition success
		result.Message = fmt.Sprintf("%d of %d roles covered; %d of %d required skills meet the target level.", result.Summary.CoveredRoles, len(roles), result.Summary.CoveredSkills, len(result.Skills))
	} else if len(input.Roles) > 0 {
		result.Message = "Complete role requirements, proficiency levels, and team setup to calculate readiness."
	}
	return result
}
