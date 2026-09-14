package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/golang-jwt/jwt/v4"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"net/http/httptest"
	"os"
	"skillmatch/database"
	auth "skillmatch/middleware"
	"skillmatch/models"
	"strings"
	"sync"
	"testing"
	"time"
)

type communityTest struct {
	pool *pgxpool.Pool
	e    *echo.Echo
	t    *testing.T
}

func TestCommunityRoutesRequireAuthentication(t *testing.T) {
	e := echo.New()
	RegisterCommunityRoutes(e, nil)
	for _, route := range [][2]string{{"GET", "/notifications"}, {"GET", "/notifications/unread-count"}, {"PUT", "/notifications/1/read"}, {"PUT", "/notifications/read-all"}, {"GET", "/profile/showcase"}, {"POST", "/profile/portfolio"}, {"PUT", "/profile/portfolio/1"}, {"DELETE", "/profile/portfolio/1"}, {"POST", "/profile/achievements"}, {"PUT", "/profile/achievements/1"}, {"DELETE", "/profile/achievements/1"}, {"POST", "/conversations"}, {"GET", "/conversations"}, {"GET", "/conversations/1"}, {"GET", "/conversations/1/messages"}, {"POST", "/conversations/1/messages"}, {"PUT", "/conversations/1/read"}, {"GET", "/teams/recommended"}, {"GET", "/teams/1/milestones"}, {"POST", "/teams/1/milestones"}, {"PUT", "/teams/1/milestones/1"}, {"DELETE", "/teams/1/milestones/1"}} {
		w := httptest.NewRecorder()
		e.ServeHTTP(w, httptest.NewRequest(route[0], "/api"+route[1], nil))
		if w.Code != 401 {
			t.Errorf("%v: missing authentication", route)
		}
	}
}

func newCommunityTest(t *testing.T) *communityTest {
	t.Helper()
	if os.Getenv("SKILLMATCH_INTEGRATION") != "1" {
		t.Skip("set SKILLMATCH_INTEGRATION=1 with local/test DATABASE_URL")
	}
	_ = godotenv.Load("../.env")
	ctx := context.Background()
	config, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal("invalid test database URL")
	}
	admin, err := pgxpool.NewWithConfig(ctx, config.Copy())
	if err != nil {
		t.Fatal(err)
	}
	schema := pgx.Identifier{fmt.Sprintf("skillmatch_community_test_%d", time.Now().UnixNano())}.Sanitize()
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		admin.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() {
		defer admin.Close()
		if _, err := admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Error(err)
		}
	})
	config.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if err = database.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	if _, err = pool.Exec(ctx, `INSERT INTO users(id,name,email,password,experience_level) VALUES (1,'Owner','owner@example.test','private-hash','intermediate'),(2,'Applicant','applicant@example.test','private-hash','beginner'),(3,'Stranger','stranger@example.test','private-hash','advanced'); INSERT INTO teams(id,name,owner_id,max_members) VALUES(1,'Community Team',1,4); INSERT INTO team_members(team_id,user_id,role) VALUES (1,1,'Owner');`); err != nil {
		t.Fatal(err)
	}
	t.Setenv("JWT_SECRET", "community-test-secret")
	e := echo.New()
	RegisterCommunityRoutes(e, pool)
	wrap := func(fn func(echo.Context, *pgxpool.Pool) error) echo.HandlerFunc {
		return func(c echo.Context) error { return fn(c, pool) }
	}
	api := e.Group("/api", auth.AuthMiddleware)
	api.POST("/teams/:id/join", wrap(JoinTeam))
	api.PUT("/join-requests/:id/accept", wrap(AcceptJoinRequest))
	api.PUT("/join-requests/:id/reject", wrap(RejectJoinRequest))
	api.DELETE("/teams/:id", wrap(DeleteTeam))
	api.GET("/users/:id/profile", wrap(GetPublicUserProfile))
	return &communityTest{pool, e, t}
}
func (s *communityTest) request(user int, method, path, body string, status int) []byte {
	s.t.Helper()
	r := httptest.NewRequest(method, "/api"+path, strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	if user > 0 {
		token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"user_id": user, "exp": time.Now().Add(time.Hour).Unix()}).SignedString([]byte(os.Getenv("JWT_SECRET")))
		if err != nil {
			s.t.Fatal(err)
		}
		r.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	s.e.ServeHTTP(w, r)
	if w.Code != status {
		s.t.Fatalf("%s %s as %d: got %d want %d: %s", method, path, user, w.Code, status, w.Body.String())
	}
	return w.Body.Bytes()
}
func decodeTest[T any](t *testing.T, b []byte) T {
	t.Helper()
	var v T
	if err := json.Unmarshal(b, &v); err != nil {
		t.Fatal(err)
	}
	return v
}

func TestNotificationsIntegration(t *testing.T) {
	s := newCommunityTest(t)
	s.request(0, "GET", "/notifications", "", 401)
	s.request(2, "POST", "/teams/1/join", `{"message":"Interested"}`, 201)
	items := decodeTest[[]Notification](t, s.request(1, "GET", "/notifications", "", 200))
	if len(items) != 1 || items[0].Type != "join_request_received" || items[0].IsRead {
		t.Fatalf("unexpected owner notification: %+v", items)
	}
	id := fmt.Sprint(items[0].ID)
	s.request(3, "PUT", "/notifications/"+id+"/read", "", 404)
	s.request(1, "PUT", "/notifications/"+id+"/read", "", 204)
	s.request(1, "PUT", "/notifications/"+id+"/read", "", 204)
	count := decodeTest[map[string]int](t, s.request(1, "GET", "/notifications/unread-count", "", 200))
	if count["unread_count"] != 0 {
		t.Fatal(count)
	}
	s.request(1, "PUT", "/join-requests/1/reject", "", 200)
	items = decodeTest[[]Notification](t, s.request(2, "GET", "/notifications", "", 200))
	if len(items) != 1 || items[0].Type != "join_request_rejected" {
		t.Fatal(items)
	}
	s.request(2, "POST", "/teams/1/join", `{"message":"Try again"}`, 200)
	s.request(1, "PUT", "/join-requests/1/accept", "", 200)
	s.request(1, "PUT", "/join-requests/1/accept", "", 400)
	items = decodeTest[[]Notification](t, s.request(2, "GET", "/notifications", "", 200))
	if len(items) != 2 || items[0].Type != "join_request_accepted" {
		t.Fatal(items)
	}
	s.request(2, "PUT", "/notifications/read-all", "", 204)
	if err := database.Migrate(context.Background(), s.pool); err != nil {
		t.Fatal(err)
	}
	items = decodeTest[[]Notification](t, s.request(2, "GET", "/notifications", "", 200))
	if len(items) != 2 || !items[0].IsRead {
		t.Fatal("migration replay changed notifications")
	}
	tx, err := s.pool.Begin(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if _, err = tx.Exec(context.Background(), `INSERT INTO join_requests(team_id,user_id) VALUES(1,3)`); err != nil {
		t.Fatal(err)
	}
	tx.Rollback(context.Background())
	items = decodeTest[[]Notification](t, s.request(1, "GET", "/notifications", "", 200))
	if len(items) != 2 {
		t.Fatal("rolled-back request left a notification")
	}
}

func TestShowcaseIntegration(t *testing.T) {
	s := newCommunityTest(t)
	for _, kind := range []string{"portfolio", "achievements"} {
		body := `{"title":"SkillMatch","description":"Built together","role":"Developer","project_url":"https://example.test","repository_url":"https://example.test/repo","technologies":["React","Go","React"]}`
		if kind == "achievements" {
			body = `{"title":"Award","organization":"Community","achievement_type":"competition","date":"2026-09-12","description":"Second place","credential_url":"https://example.test/award"}`
		}
		s.request(0, "POST", "/profile/"+kind, body, 401)
		created := decodeTest[map[string]any](t, s.request(2, "POST", "/profile/"+kind, body, 201))
		id := fmt.Sprint(created["id"])
		s.request(3, "PUT", "/profile/"+kind+"/"+id, body, 404)
		s.request(3, "DELETE", "/profile/"+kind+"/"+id, "", 404)
		s.request(2, "PUT", "/profile/"+kind+"/"+id, strings.Replace(body, `"title":"`, `"title":"Updated `, 1), 200)
		public := decodeTest[map[string]any](t, s.request(1, "GET", "/users/2/profile", "", 200))
		entries := public[kind].([]any)
		if len(entries) != 1 {
			t.Fatal(public)
		}
		item := entries[0].(map[string]any)
		if !strings.HasPrefix(item["title"].(string), "Updated") {
			t.Fatal(item)
		}
		if _, exists := item["user_id"]; exists {
			t.Fatal("internal ownership field leaked")
		}
		if kind == "portfolio" && len(item["technologies"].([]any)) != 2 {
			t.Fatal("technology normalization failed")
		}
		if err := database.Migrate(context.Background(), s.pool); err != nil {
			t.Fatal(err)
		}
		s.request(2, "DELETE", "/profile/"+kind+"/"+id, "", 204)
		s.request(2, "DELETE", "/profile/"+kind+"/"+id, "", 404)
	}
	for _, body := range []string{`{"title":"X","project_url":"javascript:alert(1)"}`, `{"title":"X","repository_url":"https://user:password@example.test"}`, `{"title":" "}`, `{"title":"X","user_id":3}`} {
		s.request(2, "POST", "/profile/portfolio", body, 400)
	}
	s.request(2, "POST", "/profile/achievements", `{"title":"X","achievement_type":"award","date":"2026-02-30"}`, 400)
	s.request(2, "POST", "/profile/achievements", `{"title":"X","achievement_type":"invalid"}`, 400)
	result := decodeTest[map[string]any](t, s.request(2, "GET", "/profile/showcase", "", 200))
	if len(result["portfolio"].([]any)) != 0 || len(result["achievements"].([]any)) != 0 {
		t.Fatal(result)
	}
}

func TestChatIntegration(t *testing.T) {
	s := newCommunityTest(t)
	s.request(0, "POST", "/conversations", `{"user_id":2}`, 401)
	s.request(1, "POST", "/conversations", `{"user_id":1}`, 400)
	s.request(1, "POST", "/conversations", `{"user_id":9999}`, 404)
	created := decodeTest[map[string]int64](t, s.request(1, "POST", "/conversations", `{"user_id":2}`, 200))
	id := created["id"]
	path := "/conversations/" + fmt.Sprint(id)
	reverse := decodeTest[map[string]int64](t, s.request(2, "POST", "/conversations", `{"user_id":1}`, 200))
	if reverse["id"] != id {
		t.Fatal("duplicate direct conversation")
	}
	// Exercise simultaneous pair creation through the real HTTP handler.
	var wg sync.WaitGroup
	results := make(chan *httptest.ResponseRecorder, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r := httptest.NewRequest("POST", "/api/conversations", strings.NewReader(`{"user_id":3}`))
			r.Header.Set("Content-Type", "application/json")
			token, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"user_id": 1}).SignedString([]byte(os.Getenv("JWT_SECRET")))
			r.Header.Set("Authorization", "Bearer "+token)
			w := httptest.NewRecorder()
			s.e.ServeHTTP(w, r)
			results <- w
		}()
	}
	wg.Wait()
	close(results)
	var concurrentID int64
	for w := range results {
		if w.Code != 200 {
			t.Fatal(w.Body.String())
		}
		item := decodeTest[map[string]int64](t, w.Body.Bytes())
		if concurrentID != 0 && concurrentID != item["id"] {
			t.Fatal("concurrent duplicates")
		}
		concurrentID = item["id"]
	}
	for _, route := range []string{path, path + "/messages"} {
		s.request(3, "GET", route, "", 404)
	}
	s.request(3, "POST", path+"/messages", `{"content":"intrusion"}`, 404)
	s.request(3, "PUT", path+"/read", "", 404)
	s.request(1, "POST", path+"/messages", `{"content":" "}`, 400)
	s.request(1, "POST", path+"/messages", `{"content":"x","sender_id":2}`, 400)
	s.request(1, "POST", path+"/messages", fmt.Sprintf(`{"content":%q}`, strings.Repeat("x", 4001)), 400)
	first := decodeTest[Message](t, s.request(1, "POST", path+"/messages", `{"content":"Hello","client_message_id":"retry-key"}`, 201))
	duplicate := decodeTest[Message](t, s.request(1, "POST", path+"/messages", `{"content":"Hello","client_message_id":"retry-key"}`, 200))
	if first.ID != duplicate.ID {
		t.Fatal("retry duplicated a message")
	}
	s.request(1, "POST", path+"/messages", `{"content":"Different","client_message_id":"retry-key"}`, 409)
	s.request(1, "POST", path+"/messages", `{"content":"Still looking?"}`, 201)
	info := decodeTest[Conversation](t, s.request(2, "GET", path, "", 200))
	listed := decodeTest[[]Conversation](t, s.request(2, "GET", "/conversations", "", 200))
	if len(listed) != 1 || listed[0].ID != id || listed[0].OtherUser.ID != 1 {
		t.Fatal("conversation list is not scoped to its member")
	}
	outsider := decodeTest[[]Conversation](t, s.request(3, "GET", "/conversations", "", 200))
	for _, item := range outsider {
		if item.ID == id {
			t.Fatal("private conversation appeared in another user's list")
		}
	}
	if info.UnreadCount != 2 || info.OtherUser.Name != "Owner" || info.LastMessage != "Still looking?" {
		t.Fatal(info)
	}
	notifications := decodeTest[[]Notification](t, s.request(2, "GET", "/notifications", "", 200))
	if len(notifications) != 1 || notifications[0].RelatedConversationID == nil {
		t.Fatal("message notifications not coalesced")
	}
	s.request(2, "PUT", path+"/read", fmt.Sprintf(`{"last_message_id":%d}`, first.ID), 204)
	info = decodeTest[Conversation](t, s.request(2, "GET", path, "", 200))
	if info.UnreadCount != 1 {
		t.Fatal("read watermark consumed a newer message")
	}
	s.request(2, "PUT", path+"/read", "", 204)
	notifications = decodeTest[[]Notification](t, s.request(2, "GET", "/notifications", "", 200))
	if !notifications[0].IsRead {
		t.Fatal("reading chat did not clear notification")
	}
	all := decodeTest[[]Message](t, s.request(2, "GET", path+"/messages", "", 200))
	if len(all) != 2 || all[0].ReadAt == nil {
		t.Fatal(all)
	}
	newer := decodeTest[[]Message](t, s.request(2, "GET", path+"/messages?after="+fmt.Sprint(first.ID), "", 200))
	if len(newer) != 1 || newer[0].ID == first.ID {
		t.Fatal("incremental cursor failed")
	}
	if _, err := s.pool.Exec(context.Background(), `INSERT INTO messages(conversation_id,sender_id,content) SELECT $1,1,'history ' || n FROM generate_series(1,55) n`, id); err != nil {
		t.Fatal(err)
	}
	latest := decodeTest[[]Message](t, s.request(2, "GET", path+"/messages", "", 200))
	if len(latest) != 50 {
		t.Fatal("unbounded message page")
	}
	older := decodeTest[[]Message](t, s.request(2, "GET", path+"/messages?before="+fmt.Sprint(latest[0].ID), "", 200))
	if len(older) != 7 {
		t.Fatal("older history missing")
	}
	if err := database.Migrate(context.Background(), s.pool); err != nil {
		t.Fatal(err)
	}
	info = decodeTest[Conversation](t, s.request(2, "GET", path, "", 200))
	if info.UnreadCount != 55 {
		t.Fatal("migration changed unread history")
	}
}

func TestRecommendedTeamsIntegration(t *testing.T) {
	s := newCommunityTest(t)
	_, err := s.pool.Exec(context.Background(), `
 UPDATE users SET preferred_role='Frontend Developer',availability='flexible',project_interest='Hackathon' WHERE id=2;
 INSERT INTO teams(id,name,owner_id,max_members,competition_type,beginner_friendly) VALUES
 (10,'Beginner Fit',1,4,'Hackathon',true),(11,'Advanced Fit',1,4,'Hackathon',false),
 (12,'Full Team',1,1,'Hackathon',true),(13,'Joined Team',1,4,'Hackathon',true),
 (14,'Closed Roles',1,4,'Hackathon',true),(15,'Owned Team',2,4,'Hackathon',true);
 INSERT INTO team_members(team_id,user_id,role) VALUES(12,1,'Owner'),(13,2,'Member');
 INSERT INTO team_roles(id,team_id,role_name,status,experience_preference) VALUES
 (10,10,'Frontend Developer','open','beginner'),(11,11,'Frontend Developer','active','advanced'),
 (12,12,'Frontend Developer','open','beginner'),(13,13,'Frontend Developer','open','beginner'),
 (14,14,'Frontend Developer','filled','beginner'),(15,15,'Frontend Developer','open','beginner'),
 (16,10,'Researcher','open','open');
 INSERT INTO user_skills(user_id,skill_id,level) SELECT 2,id,'beginner' FROM skills WHERE name='React';
 INSERT INTO role_skills(role_id,skill_id,required_level) SELECT 10,id,'beginner' FROM skills WHERE name='React';
 INSERT INTO role_skills(role_id,skill_id,required_level) SELECT 11,id,'advanced' FROM skills WHERE name='React';`)
	if err != nil {
		t.Fatal(err)
	}
	s.request(0, "GET", "/teams/recommended", "", 401)
	items := decodeTest[[]RecommendedTeam](t, s.request(2, "GET", "/teams/recommended", "", 200))
	if len(items) != 2 || items[0].Team.ID != 10 || items[0].MatchScore != 100 || items[0].RecommendedRole != "Frontend Developer" {
		t.Fatalf("unexpected recommendations: %+v", items)
	}
	if items[1].MatchScore >= items[0].MatchScore {
		t.Fatal("seniority outranked contextual fit")
	}
	if len(items[0].MatchedSkills) != 1 || items[0].MatchedSkills[0] != "React" || items[0].Breakdown["skills"] != 100 {
		t.Fatal("incorrect explanation data")
	}
	if !strings.Contains(items[0].Reason, "preferred role") {
		t.Fatal("missing derived explanation")
	}
	// The aggregate endpoint must exactly agree with the existing per-role algorithm.
	var role models.TeamRole
	role.ID = 10
	role.RoleName = "Frontend Developer"
	role.ExperiencePreference = "beginner"
	level := "beginner"
	expected := calculateRoleMatch(models.User{ExperienceLevel: "beginner", PreferredRole: "Frontend Developer", Availability: "flexible", ProjectInterest: "Hackathon"}, items[0].Team, role, []matchSkill{{Name: "React", RequiredLevel: "beginner", UserLevel: &level}})
	if expected.MatchScore != items[0].MatchScore {
		t.Fatal("recommendation score drifted from existing algorithm")
	}
	if _, err = s.pool.Exec(context.Background(), `INSERT INTO team_members(team_id,user_id,role) VALUES(10,2,'Member')`); err != nil {
		t.Fatal(err)
	}
	items = decodeTest[[]RecommendedTeam](t, s.request(2, "GET", "/teams/recommended", "", 200))
	if len(items) != 1 || items[0].Team.ID != 11 {
		t.Fatal("joined team remained recommended")
	}
}

func TestConcurrentJoinDecisions(t *testing.T) {
	s := newCommunityTest(t)
	s.request(2, "POST", "/teams/1/join", `{"message":"Interested"}`, 201)
	token, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"user_id": 1}).SignedString([]byte(os.Getenv("JWT_SECRET")))
	start := make(chan struct{})
	results := make(chan int, 2)
	for _, action := range []string{"accept", "reject"} {
		go func(action string) {
			<-start
			r := httptest.NewRequest("PUT", "/api/join-requests/1/"+action, nil)
			r.Header.Set("Authorization", "Bearer "+token)
			w := httptest.NewRecorder()
			s.e.ServeHTTP(w, r)
			results <- w.Code
		}(action)
	}
	close(start)
	a, b := <-results, <-results
	if !((a == 200 && b == 400) || (a == 400 && b == 200)) {
		t.Fatalf("decisions were not serialized: %d, %d", a, b)
	}
	var status string
	var member bool
	if err := s.pool.QueryRow(context.Background(), `SELECT status,EXISTS(SELECT 1 FROM team_members WHERE team_id=1 AND user_id=2) FROM join_requests WHERE id=1`).Scan(&status, &member); err != nil {
		t.Fatal(err)
	}
	if member != (status == "accepted") {
		t.Fatal("membership contradicts decision")
	}
	items := decodeTest[[]Notification](t, s.request(2, "GET", "/notifications", "", 200))
	if len(items) != 1 || items[0].Type != "join_request_"+status {
		t.Fatal("contradictory notifications")
	}
}
