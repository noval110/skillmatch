package handlers

import (
	"math"
	"skillmatch/models"
	"strings"
	"unicode"
)

func normalized(value string) string { return strings.ToLower(strings.TrimSpace(value)) }

func validExperiencePreference(value string) bool {
	switch value {
	case "open", "beginner", "intermediate", "advanced":
		return true
	}
	return false
}

// ExperienceFit evaluates suitability for this role, never seniority in isolation.
func ExperienceFit(preference, experience string) int {
	preference, experience = normalized(preference), normalized(experience)
	if preference == "" || preference == "open" {
		return 10
	}
	scores := map[string]map[string]int{
		"beginner":     {"beginner": 10, "intermediate": 7, "advanced": 5},
		"intermediate": {"beginner": 6, "intermediate": 10, "advanced": 8},
		"advanced":     {"beginner": 3, "intermediate": 6, "advanced": 10},
	}
	if score, ok := scores[preference][experience]; ok {
		return score
	}
	return 5 // Unknown historical experience is neutral.
}

func keywords(value string) map[string]bool {
	words := strings.FieldsFunc(normalized(value), func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsNumber(r) })
	result := map[string]bool{}
	for _, word := range words {
		switch word {
		case "and", "or", "the", "a", "an", "to", "for", "of", "in", "dan", "untuk":
			continue
		}
		result[word] = true
	}
	return result
}

// Keyword coverage uses whole words: interest "AI" must not match "retail".
func keywordCoverage(interest, text string) float64 {
	wanted, available := keywords(interest), keywords(text)
	if len(wanted) == 0 {
		return 0.5
	}
	matches := 0
	for word := range wanted {
		if available[word] {
			matches++
		}
	}
	return float64(matches) / float64(len(wanted))
}

func roleInterestScore(preference, role string) int {
	if normalized(preference) == "" {
		return 13
	}
	if normalized(preference) == normalized(role) {
		return 25
	}
	// Partial wording gets partial credit, capped below an exact role match.
	return int(math.Round(20 * keywordCoverage(preference, role)))
}

// AvailabilityScore is schedule-agnostic until teams have scheduling requirements.
// Weekday, weekend and unspecified availability are neutral, not confirmed overlap.
func AvailabilityScore(availability string) int {
	if normalized(availability) == "flexible" {
		return 20
	}
	return 10
}

type matchSkill struct {
	Name          string
	RequiredLevel string
	UserLevel     *string
}

func skillCompatibility(skills []matchSkill) (int, []string, []string, []string) {
	matched, missing, improve := []string{}, []string{}, []string{}
	if len(skills) == 0 {
		return 30, matched, missing, improve
	}
	levels := map[string]int{"beginner": 1, "intermediate": 2, "advanced": 3}
	coverage := 0.0
	for _, skill := range skills {
		if skill.UserLevel == nil {
			missing = append(missing, skill.Name)
			continue
		}
		// Relevant skills retain 80% credit at one level below, 60% at two below.
		gap := levels[normalized(skill.RequiredLevel)] - levels[normalized(*skill.UserLevel)]
		credit := 1.0
		if gap > 0 {
			credit = math.Max(0.6, 1-0.2*float64(gap))
			improve = append(improve, skill.Name)
		}
		coverage += credit
		matched = append(matched, skill.Name)
	}
	return int(math.Round(30 * coverage / float64(len(skills)))), matched, missing, improve
}

func calculateRoleMatch(user models.User, team models.Team, role models.TeamRole, skills []matchSkill) models.RoleMatchResponse {
	skillScore, matched, missing, improve := skillCompatibility(skills)
	preference := role.ExperiencePreference
	if preference == "" {
		preference = "open"
	}
	result := models.RoleMatchResponse{
		RoleID: role.ID, RoleName: role.RoleName,
		SkillScore:           skillScore,
		RoleInterestScore:    roleInterestScore(user.PreferredRole, role.RoleName),
		AvailabilityScore:    AvailabilityScore(user.Availability),
		ProjectInterestScore: int(math.Round(15 * keywordCoverage(user.ProjectInterest, team.Name+" "+team.ProjectIdea+" "+team.Description+" "+team.CompetitionCategory+" "+team.CompetitionType))),
		ExperienceFitScore:   ExperienceFit(preference, user.ExperienceLevel),
		BeginnerFriendly:     team.BeginnerFriendly, WillingToMentor: team.WillingToMentor,
		ExperiencePreference: preference, MatchedSkills: matched, MissingSkills: missing, SkillsToImprove: improve,
		ProfileIncomplete: normalized(user.PreferredRole) == "" || normalized(user.Availability) == "" || normalized(user.ProjectInterest) == "",
	}
	result.MatchScore = result.SkillScore + result.RoleInterestScore + result.AvailabilityScore + result.ProjectInterestScore + result.ExperienceFitScore
	return result
}
