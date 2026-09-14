package handlers

import (
	"context"
	"encoding/json"
	"github.com/labstack/echo/v4"
	"net/http/httptest"
	"skillmatch/readiness"
	"strings"
	"testing"
)

func TestReadinessRequiresAuthentication(t *testing.T) {
	e := echo.New()
	RegisterCommunityRoutes(e, nil)
	for _, token := range []string{"", "Bearer invalid"} {
		w := httptest.NewRecorder()
		r := httptest.NewRequest("GET", "/api/teams/1/readiness", nil)
		r.Header.Set("Authorization", token)
		e.ServeHTTP(w, r)
		if w.Code != 401 {
			t.Fatalf("expected 401 got %d", w.Code)
		}
	}
	c := e.NewContext(httptest.NewRequest("GET", "/api/teams/1/readiness", nil), httptest.NewRecorder())
	if err := GetTeamReadiness(c, nil); err != nil {
		t.Fatal(err)
	}
	if c.Response().Status != 401 {
		t.Fatal("handler must reject absent claims")
	}
}
func TestReadinessAPIIntegration(t *testing.T) {
	s := newCommunityTest(t)
	ctx := context.Background()
	s.request(0, "GET", "/teams/1/readiness", "", 401)
	s.request(3, "GET", "/teams/1/readiness", "", 403)
	s.request(1, "GET", "/teams/not-a-number/readiness", "", 400)
	s.request(1, "GET", "/teams/999/readiness", "", 404)
	empty := decodeTest[readiness.Result](t, s.request(1, "GET", "/teams/1/readiness", "", 200))
	if empty.Status != "setup_required" || empty.Score != nil {
		t.Fatal("unconfigured team must not get a numeric score")
	}
	_, err := s.pool.Exec(ctx, `INSERT INTO team_members(team_id,user_id,role) VALUES(1,2,'Member');
 UPDATE users SET bio='Private biography',preferred_role='Frontend',availability='weekend',project_interest='Hackathon' WHERE id IN(1,2);
 INSERT INTO skills(id,name) VALUES(90001,'Readiness React'),(90002,'Readiness Git'),(90003,'Readiness Speaking');
 INSERT INTO user_skills(user_id,skill_id,level) VALUES(1,90001,'advanced'),(2,90002,'beginner'),(3,90003,'advanced');
 INSERT INTO team_roles(id,team_id,role_name,status) VALUES(90001,1,'Frontend','filled'),(90002,1,'Presenter','open');
 INSERT INTO role_skills(role_id,skill_id,required_level) VALUES(90001,90001,'advanced'),(90001,90002,'intermediate'),(90002,90003,'intermediate');`)
	if err != nil {
		t.Fatal(err)
	}
	body := s.request(2, "GET", "/teams/1/readiness", "", 200)
	var r readiness.Result
	if err = json.Unmarshal(body, &r); err != nil {
		t.Fatal(err)
	}
	if r.Status != "ready" || *r.Components.Composition != 50 || *r.Components.Skills != 50 || r.Skills[2].Status != "missing" {
		t.Fatalf("real SQL data not reflected: %s", body)
	}
	for _, private := range []string{"private-hash", "@example.test", "Private biography", "JWT", "password"} {
		if strings.Contains(string(body), private) {
			t.Fatalf("private data leaked: %s", private)
		}
	}
	if len(r.Skills[2].Members) != 0 {
		t.Fatal("nonmember skill counted")
	}
	if _, err = s.pool.Exec(ctx, "DELETE FROM team_members WHERE team_id=1 AND user_id=2"); err != nil {
		t.Fatal(err)
	}
	s.request(2, "GET", "/teams/1/readiness", "", 403)
	updated := decodeTest[readiness.Result](t, s.request(1, "GET", "/teams/1/readiness", "", 200))
	if *updated.Components.Composition != 25 || updated.Skills[1].Status != "missing" {
		t.Fatal("readiness did not refresh after membership change")
	}
}
