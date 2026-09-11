package main

import (
	"slices"
	"testing"
)

func TestServerConfigFromEnv(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("PORT", "")
	t.Setenv("FRONTEND_URL", "")
	config, err := serverConfigFromEnv()
	if err != nil || config.port != "8080" {
		t.Fatalf("expected development port: %+v, %v", config, err)
	}
	for _, origin := range []string{"http://localhost:5173", "http://127.0.0.1:5173"} {
		if !slices.Contains(config.allowedOrigins, origin) {
			t.Fatalf("development origin missing: %s", origin)
		}
	}
	t.Setenv("PORT", "10000")
	t.Setenv("FRONTEND_URL", "https://skillmatch.example.com/")
	config, err = serverConfigFromEnv()
	if err != nil || config.port != "10000" || !slices.Contains(config.allowedOrigins, "https://skillmatch.example.com") {
		t.Fatalf("expected production settings: %+v, %v", config, err)
	}
}

func TestServerConfigRejectsInvalidSettings(t *testing.T) {
	for _, test := range []struct{ key, value string }{
		{"JWT_SECRET", ""},
		{"PORT", "invalid"},
		{"PORT", "0"},
		{"PORT", "65536"},
		{"FRONTEND_URL", "*"},
		{"FRONTEND_URL", "https://*.vercel.app"},
		{"FRONTEND_URL", "https://example.com/path"},
		{"FRONTEND_URL", "https://example.com?query=yes"},
		{"FRONTEND_URL", "https://example.com#fragment"},
		{"FRONTEND_URL", "https://user:password@example.com"},
		{"FRONTEND_URL", "example.com"},
	} {
		t.Run(test.key+"="+test.value, func(t *testing.T) {
			t.Setenv("JWT_SECRET", "test-secret")
			t.Setenv("PORT", "8080")
			t.Setenv("FRONTEND_URL", "https://example.com")
			t.Setenv(test.key, test.value)
			if _, err := serverConfigFromEnv(); err == nil {
				t.Fatal("invalid configuration accepted")
			}
		})
	}
}
