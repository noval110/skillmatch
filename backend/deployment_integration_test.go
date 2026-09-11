package main

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

// Exercise the actual binary with environment-only configuration and an empty schema.
func TestDeploymentStartupIntegration(t *testing.T) {
	if os.Getenv("SKILLMATCH_INTEGRATION") != "1" {
		t.Skip("set SKILLMATCH_INTEGRATION=1 to test against PostgreSQL")
	}
	_ = godotenv.Load()
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	admin, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("skillmatch_deploy_test_%d", time.Now().UnixNano())
	quoted := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+quoted); err != nil {
		t.Fatal(err)
	}
	defer func() {
		if _, err := admin.Exec(context.Background(), "DROP SCHEMA "+quoted+" CASCADE"); err != nil {
			t.Error(err)
		}
	}()
	databaseURL, err := url.Parse(os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal("DATABASE_URL must be a PostgreSQL URL for this test")
	}
	query := databaseURL.Query()
	query.Set("search_path", schema)
	databaseURL.RawQuery = query.Encode()

	binary := filepath.Join(t.TempDir(), "server")
	if runtime.GOOS == "windows" {
		binary += ".exe"
	}
	build := exec.CommandContext(ctx, "go", "build", "-o", binary, ".")
	if output, err := build.CombinedOutput(); err != nil {
		t.Fatalf("build failed: %v\n%s", err, output)
	}
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	listener.Close()
	server := exec.CommandContext(ctx, binary)
	server.Dir = t.TempDir() // Deliberately contains no .env or migration SQL files.
	server.Env = append(os.Environ(),
		"DATABASE_URL="+databaseURL.String(),
		"JWT_SECRET=deployment-test-secret",
		"FRONTEND_URL=https://skillmatch.example.test",
		fmt.Sprintf("PORT=%d", port),
		"UPLOAD_DIR="+filepath.Join(server.Dir, "uploads"),
	)
	if err := server.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = server.Process.Kill(); _ = server.Wait() }()
	client := &http.Client{Timeout: time.Second}
	endpoint := fmt.Sprintf("http://127.0.0.1:%d/api/health", port)
	ready := false
	for deadline := time.Now().Add(15 * time.Second); time.Now().Before(deadline); {
		response, err := client.Get(endpoint)
		if err == nil {
			response.Body.Close()
			ready = response.StatusCode == http.StatusOK
			if ready {
				break
			}
		}
		time.Sleep(100 * time.Millisecond)
	}
	if !ready {
		t.Fatal("server did not become healthy with environment-only configuration")
	}
	for _, test := range []struct {
		origin string
		allow  bool
	}{
		{"http://localhost:5173", true},
		{"http://127.0.0.1:5173", true},
		{"https://skillmatch.example.test", true},
		{"https://unrelated.example.test", false},
		{"https://skillmatch.example.test.attacker.test", false},
	} {
		request, _ := http.NewRequest(http.MethodOptions, endpoint, nil)
		request.Header.Set("Origin", test.origin)
		request.Header.Set("Access-Control-Request-Method", "POST")
		request.Header.Set("Access-Control-Request-Headers", "authorization,content-type")
		response, err := client.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		response.Body.Close()
		want := ""
		if test.allow {
			want = test.origin
		}
		if got := response.Header.Get("Access-Control-Allow-Origin"); got != want {
			t.Errorf("CORS for %s: got %q, want %q", test.origin, got, want)
		}
		if response.Header.Get("Access-Control-Allow-Credentials") != "" {
			t.Error("unexpected credentialed CORS")
		}
	}
}
