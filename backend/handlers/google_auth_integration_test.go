package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"skillmatch/database"
	"skillmatch/googleauth"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

func TestGoogleAuthIntegration(t *testing.T) {
	if os.Getenv("SKILLMATCH_INTEGRATION") != "1" {
		t.Skip("set SKILLMATCH_INTEGRATION=1 with a development DATABASE_URL")
	}
	_ = godotenv.Load("../.env")
	t.Setenv("JWT_SECRET", "google-integration-test-secret")
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	config, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal("invalid development DATABASE_URL")
	}
	admin, err := pgxpool.NewWithConfig(ctx, config.Copy())
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := pgx.Identifier{fmt.Sprintf("skillmatch_google_test_%d", time.Now().UnixNano())}.Sanitize()
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer func() {
		cleanup, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if _, err := admin.Exec(cleanup, "DROP SCHEMA "+schema+" CASCADE"); err != nil {
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
	identities := map[string]googleauth.Identity{
		"new":       {RegisteredClaims: jwt.RegisteredClaims{Subject: "new-sub"}, Email: "new@gmail.com", EmailVerified: true, Name: "New Google User"},
		"returning": {RegisteredClaims: jwt.RegisteredClaims{Subject: "new-sub"}, Email: "changed@gmail.com", EmailVerified: true, Name: "Changed Name"},
		"legacy":    {RegisteredClaims: jwt.RegisteredClaims{Subject: "legacy-sub"}, Email: "legacy@gmail.com", EmailVerified: true, Name: "Google Name"},
		"collision": {RegisteredClaims: jwt.RegisteredClaims{Subject: "different-sub"}, Email: "legacy@gmail.com", EmailVerified: true},
		"external":  {RegisteredClaims: jwt.RegisteredClaims{Subject: "external-sub"}, Email: "legacy@example.test", EmailVerified: true},
		"ambiguous": {RegisteredClaims: jwt.RegisteredClaims{Subject: "ambiguous-sub"}, Email: "ambiguous@gmail.com", EmailVerified: true},
		"parallel":  {RegisteredClaims: jwt.RegisteredClaims{Subject: "parallel-sub"}, Email: "parallel@gmail.com", EmailVerified: true},
	}
	e := echo.New()
	e.POST("/google", googleAuthHandler(pool, "test-client", func(_ context.Context, credential, clientID string) (*googleauth.Identity, error) {
		identity, ok := identities[credential]
		if !ok || clientID != "test-client" {
			return nil, fmt.Errorf("invalid test credential")
		}
		return &identity, nil
	}))
	e.POST("/login", func(c echo.Context) error { return Login(c, pool) })
	request := func(path, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		response := httptest.NewRecorder()
		e.ServeHTTP(response, req)
		return response
	}
	response := request("/google", `{"credential":"new","experience_level":"advanced"}`)
	if response.Code != http.StatusOK {
		t.Fatalf("new Google user: %d %s", response.Code, response.Body.String())
	}
	var session struct {
		Token string `json:"token"`
		User  struct {
			ID    int64  `json:"id"`
			Name  string `json:"name"`
			Email string `json:"email"`
		} `json:"user"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &session); err != nil {
		t.Fatal(err)
	}
	token, err := jwt.Parse(session.Token, func(token *jwt.Token) (any, error) {
		return []byte(os.Getenv("JWT_SECRET")), nil
	}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())
	if err != nil || !token.Valid || int64(token.Claims.(jwt.MapClaims)["user_id"].(float64)) != session.User.ID {
		t.Fatalf("Google login did not issue a valid SkillMatch session: %v", err)
	}
	if session.User.Name != "New Google User" || session.User.Email != "new@gmail.com" {
		t.Fatalf("wrong session user: %+v", session.User)
	}
	for _, credential := range []string{"new", "returning"} {
		if response := request("/google", fmt.Sprintf(`{"credential":%q}`, credential)); response.Code != 200 {
			t.Fatalf("returning Google user: %d %s", response.Code, response.Body.String())
		}
	}
	var count int
	var name, email, experience, password string
	if err := pool.QueryRow(ctx, `SELECT name,email,experience_level,password FROM users WHERE id=$1`, session.User.ID).Scan(&name, &email, &experience, &password); err != nil {
		t.Fatal(err)
	}
	if name != "New Google User" || email != "new@gmail.com" || experience != "advanced" || password != "" {
		t.Fatalf("returning login replaced account data: %q/%q/%q", name, email, experience)
	}
	if response := request("/login", `{"email":"new@gmail.com","password":""}`); response.Code != 401 {
		t.Fatal("Google-only account accepted password login")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte("original-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	var legacyID int64
	if err := pool.QueryRow(ctx, `INSERT INTO users (name,email,password,experience_level) VALUES ('Original Name','LEGACY@gmail.com',$1,'intermediate') RETURNING id`, string(hash)).Scan(&legacyID); err != nil {
		t.Fatal(err)
	}
	if response := request("/google", `{"credential":"legacy"}`); response.Code != 200 {
		t.Fatalf("legacy Gmail linking: %d %s", response.Code, response.Body.String())
	}
	if err := pool.QueryRow(ctx, `SELECT name,password,experience_level FROM users WHERE id=$1 AND google_subject='legacy-sub'`, legacyID).Scan(&name, &password, &experience); err != nil {
		t.Fatal(err)
	}
	if name != "Original Name" || password != string(hash) || experience != "intermediate" {
		t.Fatal("linking Google replaced original profile or password")
	}
	if response := request("/login", `{"email":"LEGACY@gmail.com","password":"original-password"}`); response.Code != 200 {
		t.Fatal("original password stopped working after linking Google")
	}
	if _, err := pool.Exec(ctx, `INSERT INTO users(name,email,password,experience_level) VALUES ('External','legacy@example.test',$1,'beginner'),('A','ambiguous@gmail.com',$1,'beginner'),('B','Ambiguous@gmail.com',$1,'beginner')`, string(hash)); err != nil {
		t.Fatal(err)
	}
	for _, credential := range []string{"collision", "external", "ambiguous"} {
		if response := request("/google", fmt.Sprintf(`{"credential":%q}`, credential)); response.Code != 409 {
			t.Fatalf("unsafe linking %s accepted: %d %s", credential, response.Code, response.Body.String())
		}
	}
	var wg sync.WaitGroup
	responses := make(chan *httptest.ResponseRecorder, 4)
	for range 4 {
		wg.Go(func() { responses <- request("/google", `{"credential":"parallel"}`) })
	}
	wg.Wait()
	close(responses)
	for response := range responses {
		if response.Code != 200 {
			t.Fatalf("concurrent Google login: %d %s", response.Code, response.Body.String())
		}
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM users WHERE google_subject='parallel-sub'`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("concurrent login created duplicate accounts: count=%d err=%v", count, err)
	}
	if err := database.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	if response := request("/google", `{"credential":"legacy"}`); response.Code != 200 {
		t.Fatal("reapplying migrations broke an existing Google account")
	}
}
