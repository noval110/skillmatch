package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"
	"time"

	"skillmatch/database"
	auth "skillmatch/middleware"
	"skillmatch/models"

	"github.com/golang-jwt/jwt/v4"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
)

func TestPublicProfileInvalidID(t *testing.T) {
	for _, id := range []string{"abc", "0", "-1", "99999999999999999999999"} {
		e := echo.New()
		e.GET("/users/:id/profile", func(c echo.Context) error { return GetPublicUserProfile(c, nil) })
		response := httptest.NewRecorder()
		e.ServeHTTP(response, httptest.NewRequest("GET", "/users/"+id+"/profile", nil))
		if response.Code != 400 {
			t.Fatalf("%s: got %d", id, response.Code)
		}
	}
}

// Uses only a newly created isolated schema; existing application data is untouched.
func TestPublicProfileIntegration(t *testing.T) {
	if os.Getenv("SKILLMATCH_INTEGRATION") != "1" {
		t.Skip("set SKILLMATCH_INTEGRATION=1 with a test DATABASE_URL")
	}
	_ = godotenv.Load("../.env")
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	config, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal("invalid test DATABASE_URL")
	}
	admin, err := pgxpool.NewWithConfig(ctx, config.Copy())
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := pgx.Identifier{fmt.Sprintf("skillmatch_public_profile_test_%d", time.Now().UnixNano())}.Sanitize()
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer func() {
		if _, err := admin.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Error(err)
		}
	}()
	config.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if err := database.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	_, err = pool.Exec(ctx, `
 INSERT INTO users(id,name,email,password,experience_level,bio,preferred_role,availability,project_interest,created_at) VALUES
 (101,'Budi','private-budi@example.test','secret-password-hash','intermediate','Enjoy building together','Frontend Developer','weekend','Hackathon','2025-01-02'),
 (102,'Viewer','private-viewer@example.test','other-secret-hash','beginner',NULL,NULL,NULL,NULL,NULL);
 INSERT INTO skills(id,name,category) VALUES (10001,'Profile Speaking','Communication'),(10002,'Profile React','Technical'),(10003,'Profile Custom','');
 INSERT INTO user_skills(user_id,skill_id,level) VALUES (101,10001,'beginner'),(101,10002,'advanced'),(102,10003,'beginner');
 INSERT INTO teams(id,name,owner_id,max_members) VALUES (101,'Alpha',101,5),(102,'Beta',102,5),(103,'Pending Only',102,5);
 INSERT INTO team_members(team_id,user_id,role) VALUES (101,101,'Owner'),(102,101,'Frontend Developer'),(102,102,'Owner');
 INSERT INTO join_requests(team_id,user_id,status) VALUES (103,101,'pending');`)
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("JWT_SECRET", "public-profile-test-secret")
	upload := t.TempDir()
	t.Setenv("UPLOAD_DIR", upload)
	if err := os.MkdirAll(filepath.Join(upload, "avatars"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(upload, "avatars", "user-101.png"), []byte("test-photo"), 0600); err != nil {
		t.Fatal(err)
	}
	token := func(id int) string {
		t.Helper()
		value, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"user_id": id, "exp": time.Now().Add(time.Hour).Unix()}).SignedString([]byte(os.Getenv("JWT_SECRET")))
		if err != nil {
			t.Fatal(err)
		}
		return value
	}
	e := echo.New()
	e.GET("/api/users/:id/profile", func(c echo.Context) error { return GetPublicUserProfile(c, pool) }, auth.AuthMiddleware)
	request := func(id, credential string, status int) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest("GET", "/api/users/"+id+"/profile", nil)
		if credential != "" {
			r.Header.Set("Authorization", "Bearer "+credential)
		}
		w := httptest.NewRecorder()
		e.ServeHTTP(w, r)
		if w.Code != status {
			t.Fatalf("%s: got %d, want %d: %s", id, w.Code, status, w.Body.String())
		}
		return w
	}
	for _, viewer := range []int{101, 102} {
		w := request("101", token(viewer), 200)
		if w.Header().Get("Cache-Control") != "private, no-store" {
			t.Fatal("public profile must not enter shared caches")
		}
		var profile models.PublicProfile
		if err := json.Unmarshal(w.Body.Bytes(), &profile); err != nil {
			t.Fatal(err)
		}
		if profile.Name != "Budi" || profile.Bio != "Enjoy building together" || profile.Availability != "weekend" || profile.PreferredRole != "Frontend Developer" || profile.ProjectInterest != "Hackathon" || profile.ExperienceLevel != "intermediate" || profile.CreatedAt == nil {
			t.Fatalf("incorrect profile: %+v", profile)
		}
		if !strings.HasPrefix(profile.ProfilePhotoURL, "/uploads/avatars/user-101.png?v=") {
			t.Fatalf("incorrect photo URL: %s", profile.ProfilePhotoURL)
		}
		if len(profile.Skills) != 2 || profile.Skills[0].Name != "Profile React" || profile.Skills[1].Category != "Communication" || profile.Skills[0].Level != "advanced" {
			t.Fatalf("incorrect skills: %+v", profile.Skills)
		}
		if len(profile.Teams) != 2 || profile.Teams[0].Name != "Alpha" || profile.Teams[0].Role != "Owner" || profile.Teams[1].ID != 102 {
			t.Fatalf("incorrect memberships: %+v", profile.Teams)
		}
		var body map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		assertKeys := func(object map[string]any, allowed ...string) {
			t.Helper()
			keys := make([]string, 0, len(object))
			for key := range object {
				keys = append(keys, key)
			}
			sort.Strings(keys)
			sort.Strings(allowed)
			if !reflect.DeepEqual(keys, allowed) {
				t.Fatalf("unexpected public keys: %v, want %v", keys, allowed)
			}
		}
		assertKeys(body, "id", "name", "bio", "experience_level", "profile_photo_url", "preferred_role", "availability", "project_interest", "created_at", "skills", "teams", "portfolio", "achievements")
		for _, skill := range body["skills"].([]any) {
			assertKeys(skill.(map[string]any), "id", "name", "category", "level")
		}
		for _, team := range body["teams"].([]any) {
			assertKeys(team.(map[string]any), "id", "name", "role")
		}
		for _, secret := range []string{"private-budi", "private-viewer", "secret-password", "other-secret", os.Getenv("JWT_SECRET"), token(viewer)} {
			if strings.Contains(w.Body.String(), secret) {
				t.Fatal("sensitive value leaked")
			}
		}
	}
	request("101", "", 401)
	request("101", "invalid", 401)
	missing := request("999999", token(102), 404)
	if !strings.Contains(missing.Body.String(), "User not found") {
		t.Fatal("missing clear 404")
	}
	// Optional legacy fields and empty collections remain valid JSON, without null arrays.
	if _, err := pool.Exec(ctx, "DELETE FROM user_skills WHERE user_id=102; DELETE FROM team_members WHERE user_id=102"); err != nil {
		t.Fatal(err)
	}
	blank := request("102", token(102), 200)
	var empty models.PublicProfile
	if err := json.Unmarshal(blank.Body.Bytes(), &empty); err != nil {
		t.Fatal(err)
	}
	if empty.Skills == nil || empty.Teams == nil || len(empty.Skills) != 0 || len(empty.Teams) != 0 || empty.Bio != "" || empty.CreatedAt != nil || empty.ProfilePhotoURL != "" {
		t.Fatalf("incorrect empty profile: %+v", empty)
	}
	pool.Close()
	failure := request("101", token(102), 500)
	if strings.Contains(failure.Body.String(), "pool") || !strings.Contains(failure.Body.String(), "Please try again") {
		t.Fatal("database error must be generic")
	}
}
