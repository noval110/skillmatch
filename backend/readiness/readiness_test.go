package readiness

import (
	"encoding/json"
	"reflect"
	"testing"
)

func fixture() Input {
	return Input{TeamID: 1, Capacity: 2, Members: []Member{{ID: 1, Name: "Noval", Bio: true, Experience: true, PreferredRole: true, Availability: true, ProjectInterest: true, Skills: []MemberSkill{{1, "Advanced"}, {2, "intermediate"}}}, {ID: 2, Name: "Budi", Bio: true, Experience: true, PreferredRole: true, Availability: true, ProjectInterest: true, Skills: []MemberSkill{{3, "intermediate"}}}}, Roles: []Role{{ID: 1, Name: "Frontend", Status: "filled", Skills: []Requirement{{1, "React", "advanced"}, {2, "JavaScript", "advanced"}, {3, "Git", "intermediate"}}}}}
}
func TestSkillGapsRespectLevels(t *testing.T) {
	in := fixture()
	r := Calculate(in)
	if r.Skills[0].Status != "covered" || r.Skills[1].Status != "partial" || r.Skills[2].Status != "covered" {
		t.Fatalf("bad skill analysis: %+v", r.Skills)
	}
	if *r.Components.Skills != 83.33 || r.Roles[0].CoverageStatus != "partial" {
		t.Fatalf("partial role: %+v", r)
	}
	if r.Score == nil || *r.Score != 64 {
		t.Fatalf("formula: %+v", r.Score)
	}
	in.Members[0].Skills[1].Level = "advanced"
	r = Calculate(in)
	if *r.Score != 100 || r.Roles[0].CoverageStatus != "covered" {
		t.Fatal("fully covered team should reach 100")
	}
	in.Members[0].Skills = in.Members[0].Skills[:1]
	r = Calculate(in)
	if r.Skills[1].Status != "missing" || r.Skills[1].HighestTeamLevel != nil || len(r.Skills[1].Members) != 0 {
		t.Fatal("missing skill misrepresented")
	}
}
func TestNoInferredRoleAssignments(t *testing.T) {
	in := fixture()
	in.Members[0].Skills[1].Level = "advanced"
	in.Roles[0].Status = "open"
	r := Calculate(in)
	if *r.Components.Roles != 0 || r.Roles[0].CoverageStatus != "missing" {
		t.Fatal("collective skills do not imply a filled role")
	}
	in.Roles[0].Skills = []Requirement{{9, "Public Speaking", "intermediate"}}
	r = Calculate(in)
	if r.Roles[0].CoverageStatus != "missing" || r.PriorityGaps[0].Type != "role" || r.PriorityGaps[1].Type != "skill" {
		t.Fatal("missing role must be first priority")
	}
	in.Roles[0].Status = "filled"
	if Calculate(in).Roles[0].CoverageStatus == "covered" {
		t.Fatal("filled status alone must not cover a role")
	}
}
func TestSetupAndInvalidLevels(t *testing.T) {
	for _, mutate := range []func(*Input){func(i *Input) { i.Roles = nil }, func(i *Input) { i.Roles[0].Skills = nil }, func(i *Input) { i.Capacity = 0 }, func(i *Input) { i.Members = nil }, func(i *Input) { i.Roles[0].Skills[0].Level = "expert" }, func(i *Input) { i.Members[0].Skills[0].Level = "unknown" }} {
		in := fixture()
		mutate(&in)
		r := Calculate(in)
		if r.Status != "setup_required" || r.Score != nil {
			t.Fatalf("setup must not fabricate zero: %+v", r)
		}
	}
}
func TestCompositionAndProfiles(t *testing.T) {
	in := fixture()
	in.Capacity = 4
	in.Members[0].Bio = false
	in.Members[1].Availability = false
	r := Calculate(in)
	if *r.Components.Composition != 50 || *r.Components.Profiles != 83.33 || r.Summary.IncompleteProfiles != 2 {
		t.Fatalf("incorrect components: %+v", r.Components)
	}
	if r.Profiles[0].Completed != 5 || r.Profiles[0].Missing[0] != "Bio" {
		t.Fatal("profile checklist wrong")
	}
	if r.PriorityGaps[len(r.PriorityGaps)-1].Name != "2 members have incomplete profiles" {
		t.Fatal("profile gap count should use readable plural copy")
	}
	in.Members[1].Availability = true
	if got := Calculate(in).PriorityGaps[len(Calculate(in).PriorityGaps)-1].Name; got != "1 member has an incomplete profile" {
		t.Fatalf("profile gap count should use singular copy: %s", got)
	}
	in.Capacity = 1
	if *Calculate(in).Components.Composition != 100 {
		t.Fatal("composition should cap at 100")
	}
}
func TestUniqueSkillsUseHighestRequirementAndKeepRoleContext(t *testing.T) {
	in := fixture()
	in.Roles = []Role{{ID: 1, Name: "Research", Status: "filled", Skills: []Requirement{{2, "JavaScript", "beginner"}}}, {ID: 2, Name: "Frontend", Status: "filled", Skills: []Requirement{{2, "JavaScript", "advanced"}}}}
	r := Calculate(in)
	if len(r.Skills) != 1 || r.Skills[0].RequiredLevel != "advanced" || *r.Components.Skills != 50 {
		t.Fatal("duplicate requirement inflated score")
	}
	if r.Roles[0].CoverageStatus != "covered" || r.Roles[1].CoverageStatus != "partial" || len(r.Skills[0].RoleIDs) != 2 {
		t.Fatal("individual role requirements lost")
	}
}
func TestDeterministicAcrossInputOrdering(t *testing.T) {
	in := fixture()
	in.Roles = append(in.Roles, Role{ID: 2, Name: "Presenter", Status: "open", Skills: []Requirement{{4, "Speaking", "intermediate"}}})
	expected := Calculate(in)
	in.Roles[0], in.Roles[1] = in.Roles[1], in.Roles[0]
	in.Members[0], in.Members[1] = in.Members[1], in.Members[0]
	actual := Calculate(in)
	if !reflect.DeepEqual(expected, actual) {
		a, _ := json.Marshal(expected)
		b, _ := json.Marshal(actual)
		t.Fatalf("nondeterministic\n%s\n%s", a, b)
	}
}
