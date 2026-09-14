package models

import "time"

// PublicProfile is an explicit allowlist, separate from the account/profile model.
type PublicProfile struct {
	Showcase
	ID              int64               `json:"id"`
	Name            string              `json:"name"`
	Bio             string              `json:"bio"`
	ExperienceLevel string              `json:"experience_level"`
	ProfilePhotoURL string              `json:"profile_photo_url"`
	PreferredRole   string              `json:"preferred_role"`
	Availability    string              `json:"availability"`
	ProjectInterest string              `json:"project_interest"`
	CreatedAt       *time.Time          `json:"created_at"`
	Skills          []UserSkill         `json:"skills"`
	Teams           []PublicProfileTeam `json:"teams"`
}

type PublicProfileTeam struct {
	ID              int64  `json:"id"`
	Name            string `json:"name"`
	Role            string `json:"role"`
	CompetitionType string `json:"competition_type"`
}
