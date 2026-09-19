package models

type CreateTeamRequest struct {
	CompetitionCategory string `json:"competition_category"`
	CompetitionType     string `json:"competition_type"`
	BeginnerFriendly    bool   `json:"beginner_friendly"`
	WillingToMentor     bool   `json:"willing_to_mentor"`
	Name                string `json:"name"`
	Description         string `json:"description"`
	ProjectIdea         string `json:"project_idea"`
	MaxMembers          int    `json:"max_members"`
}

type UpdateTeamRequest struct {
	CompetitionCategory *string `json:"competition_category"`
	CompetitionType     *string `json:"competition_type"`
	BeginnerFriendly    bool    `json:"beginner_friendly"`
	WillingToMentor     bool    `json:"willing_to_mentor"`
	Name                string  `json:"name"`
	Description         string  `json:"description"`
	ProjectIdea         string  `json:"project_idea"`
	MaxMembers          int     `json:"max_members"`
}

type Team struct {
	CompetitionCategory string `json:"competition_category"`
	CompetitionType     string `json:"competition_type"`
	BeginnerFriendly    bool   `json:"beginner_friendly"`
	WillingToMentor     bool   `json:"willing_to_mentor"`
	ID                  int64  `json:"id"`
	Name                string `json:"name"`
	Description         string `json:"description"`
	ProjectIdea         string `json:"project_idea"`
	MaxMembers          int    `json:"max_members"`
	OwnerID             int64  `json:"owner_id"`
	CoverURL            string `json:"cover_url"`
}

type TeamMember struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Role      string `json:"role"`
	AvatarURL string `json:"avatar_url"`
}

type JoinTeamRequest struct {
	Message string `json:"message"`
}

type JoinRequestResponse struct {
	ID        int64  `json:"id"`
	UserID    int64  `json:"user_id"`
	Message   string `json:"message"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	AvatarURL string `json:"avatar_url"`
}

type TeamRole struct {
	ExperiencePreference string `json:"experience_preference"`
	ID                   int64  `json:"id"`
	TeamID               int64  `json:"team_id"`
	RoleName             string `json:"role_name"`
	Status               string `json:"status"`
}

type CreateTeamRoleRequest struct {
	ExperiencePreference string `json:"experience_preference"`
	RoleName             string `json:"role_name"`
}

type UpdateTeamRoleRequest struct {
	ExperiencePreference *string `json:"experience_preference"`
	Status               string  `json:"status"`
}

type RoleSkill struct {
	ID            int64  `json:"id"`
	SkillID       int64  `json:"skill_id"`
	SkillName     string `json:"skill_name"`
	RequiredLevel string `json:"required_level"`
}

type AddRoleSkillRequest struct {
	SkillID       int64  `json:"skill_id"`
	RequiredLevel string `json:"required_level"`
}

type RoleMatchResponse struct {
	SkillScore           int      `json:"skill_score"`
	RoleInterestScore    int      `json:"role_interest_score"`
	AvailabilityScore    int      `json:"availability_score"`
	ProjectInterestScore int      `json:"project_interest_score"`
	ExperienceFitScore   int      `json:"experience_fit_score"`
	BeginnerFriendly     bool     `json:"beginner_friendly"`
	WillingToMentor      bool     `json:"willing_to_mentor"`
	ExperiencePreference string   `json:"experience_preference"`
	ProfileIncomplete    bool     `json:"profile_incomplete"`
	SkillsToImprove      []string `json:"skills_to_improve"`
	RoleID               int64    `json:"role_id"`
	RoleName             string   `json:"role_name"`
	MatchScore           int      `json:"match_score"`
	MatchedSkills        []string `json:"matched_skills"`
	MissingSkills        []string `json:"missing_skills"`
}
