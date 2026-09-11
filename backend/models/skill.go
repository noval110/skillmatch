package models

type Skill struct {
	Category string `json:"category"`
	ID       int64  `json:"id"`
	Name     string `json:"name"`
}

type UserSkill struct {
	Category string `json:"category"`
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	Level    string `json:"level"`
}

type AddSkillRequest struct {
	SkillID int64  `json:"skill_id"`
	Level   string `json:"level"`
}

type UpdateSkillRequest struct {
	Level string `json:"level"`
}
