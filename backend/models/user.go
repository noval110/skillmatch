package models

type User struct {
	PreferredRole   string `json:"preferred_role"`
	Availability    string `json:"availability"`
	ProjectInterest string `json:"project_interest"`
	ID              int64  `json:"id"`
	Name            string `json:"name"`
	Email           string `json:"email"`
	Bio             string `json:"bio"`
	ExperienceLevel string `json:"experience_level"`
	AvatarURL       string `json:"avatar_url"`
}

type RegisterRequest struct {
	Name            string `json:"name"`
	Email           string `json:"email"`
	Password        string `json:"password"`
	ExperienceLevel string `json:"experience_level"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type UpdateProfileRequest struct {
	PreferredRole   *string `json:"preferred_role"`
	Availability    *string `json:"availability"`
	ProjectInterest *string `json:"project_interest"`
	Name            string  `json:"name"`
	Bio             string  `json:"bio"`
	ExperienceLevel string  `json:"experience_level"`
}
