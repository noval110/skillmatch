package models

type Portfolio struct {
	ID            int64    `json:"id"`
	Title         string   `json:"title"`
	Description   string   `json:"description"`
	Role          string   `json:"role"`
	ProjectURL    string   `json:"project_url"`
	RepositoryURL string   `json:"repository_url"`
	Technologies  []string `json:"technologies"`
}
type Achievement struct {
	ID              int64  `json:"id"`
	Title           string `json:"title"`
	Organization    string `json:"organization"`
	AchievementType string `json:"achievement_type"`
	Date            string `json:"date"`
	Description     string `json:"description"`
	CredentialURL   string `json:"credential_url"`
}
type Showcase struct {
	Portfolio    []Portfolio   `json:"portfolio"`
	Achievements []Achievement `json:"achievements"`
}
