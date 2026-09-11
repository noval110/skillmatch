package handlers

import (
	"skillmatch/models"
	"testing"
)

func TestExperienceFit(t *testing.T) {
	for _, tt := range []struct {
		preference, level string
		want              int
	}{
		{"beginner", "Beginner", 10}, {"beginner", "Advanced", 5}, {"advanced", "Beginner", 3},
		{"beginner", "Intermediate", 7}, {"intermediate", "Beginner", 6}, {"intermediate", "Intermediate", 10},
		{"intermediate", "Advanced", 8}, {"advanced", "Intermediate", 6}, {"advanced", "Advanced", 10},
		{"open", "Beginner", 10}, {"open", "Intermediate", 10}, {"open", "Advanced", 10}, {"open", "", 10},
		{"beginner", "", 5}, {" BEGINNER ", " beginner ", 10},
	} {
		if got := ExperienceFit(tt.preference, tt.level); got != tt.want {
			t.Errorf("%s/%s: got %d want %d", tt.preference, tt.level, got, tt.want)
		}
	}
}

func TestBeginnerCompatibility(t *testing.T) {
	level := "beginner"
	skills := []matchSkill{{"React", "intermediate", &level}, {"JavaScript", "beginner", &level}, {"TypeScript", "beginner", nil}}
	team := models.Team{Name: "Web Development", BeginnerFriendly: true, WillingToMentor: true}
	role := models.TeamRole{ID: 2, RoleName: "Frontend Developer", ExperiencePreference: "beginner"}
	beginner := models.User{ExperienceLevel: "Beginner", PreferredRole: "frontend developer", Availability: "flexible", ProjectInterest: "web development"}
	result := calculateRoleMatch(beginner, team, role, skills)
	if result.MatchScore != 88 || result.ExperienceFitScore != 10 || result.SkillScore != 18 {
		t.Fatalf("unexpected beginner result: %+v", result)
	}
	if !result.BeginnerFriendly || !result.WillingToMentor || len(result.MatchedSkills) != 2 || len(result.MissingSkills) != 1 || len(result.SkillsToImprove) != 1 {
		t.Fatalf("wrong indicators: %+v", result)
	}
	advanced := beginner
	advanced.ExperienceLevel = "Advanced"
	if other := calculateRoleMatch(advanced, team, role, skills); other.MatchScore >= result.MatchScore {
		t.Fatal("seniority should not outrank contextual fit")
	}
	role.ExperiencePreference = "advanced"
	if other := calculateRoleMatch(beginner, team, role, skills); other.ExperienceFitScore != 3 || other.MatchScore != 81 {
		t.Fatalf("interests must still contribute: %+v", other)
	}
	team.BeginnerFriendly, team.WillingToMentor = false, false
	role.ExperiencePreference = "beginner"
	if other := calculateRoleMatch(beginner, team, role, skills); other.MatchScore != result.MatchScore {
		t.Fatal("badges must not add hidden points")
	}
}

func TestMissingProfileAndBounds(t *testing.T) {
	result := calculateRoleMatch(models.User{}, models.Team{}, models.TeamRole{}, nil)
	if !result.ProfileIncomplete || result.RoleInterestScore != 13 || result.AvailabilityScore != 10 || result.ProjectInterestScore != 8 || result.ExperienceFitScore != 10 {
		t.Fatalf("invalid fallback: %+v", result)
	}
	if result.MatchedSkills == nil || result.MissingSkills == nil {
		t.Fatal("empty skill arrays must serialize as []")
	}
	for _, level := range []string{"beginner", "intermediate", "advanced", "", "unknown"} {
		for _, preference := range []string{"beginner", "intermediate", "advanced", "open"} {
			for _, availability := range []string{"flexible", "weekday", "weekend", ""} {
				r := calculateRoleMatch(models.User{ExperienceLevel: level, PreferredRole: "Frontend", ProjectInterest: "Web", Availability: availability}, models.Team{Name: "Web"}, models.TeamRole{RoleName: "Frontend Developer", ExperiencePreference: preference}, []matchSkill{{"React", "advanced", &level}})
				if r.SkillScore < 0 || r.SkillScore > 30 || r.RoleInterestScore < 0 || r.RoleInterestScore > 25 || r.AvailabilityScore < 0 || r.AvailabilityScore > 20 || r.ProjectInterestScore < 0 || r.ProjectInterestScore > 15 || r.ExperienceFitScore < 0 || r.ExperienceFitScore > 10 || r.MatchScore > 100 {
					t.Fatalf("out of bounds: %+v", r)
				}
				if r.MatchScore != r.SkillScore+r.RoleInterestScore+r.AvailabilityScore+r.ProjectInterestScore+r.ExperienceFitScore {
					t.Fatal("components must sum to displayed score")
				}
			}
		}
	}
}

func TestKeywordsAndSkills(t *testing.T) {
	if keywordCoverage("AI", "retail platform") != 0 {
		t.Fatal("AI must be a whole keyword")
	}
	if keywordCoverage("Web Education", "WEB app") != 0.5 {
		t.Fatal("partial keyword coverage")
	}
	if AvailabilityScore("weekend") != AvailabilityScore("") {
		t.Fatal("unknown schedules must be neutral")
	}
	level := "Beginner"
	score, _, _, _ := skillCompatibility([]matchSkill{{"React", "beginner", &level}, {"JS", "beginner", &level}, {"TS", "beginner", nil}})
	if score != 20 {
		t.Fatalf("2 of 3 skills should contribute 20/30, got %d", score)
	}
}
