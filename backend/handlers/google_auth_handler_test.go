package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"skillmatch/googleauth"

	"github.com/labstack/echo/v4"
)

func TestGoogleAuthRejectsInvalidRequests(t *testing.T) {
	for _, tc := range []struct {
		name, clientID, contentType, body string
		status                            int
		verified                          bool
	}{
		{"not configured", "", "application/json", `{"credential":"token"}`, 503, false},
		{"form csrf", "client", "application/x-www-form-urlencoded", "credential=token", 415, false},
		{"text csrf", "client", "text/plain", `{"credential":"token"}`, 415, false},
		{"malformed json", "client", "application/json", `{`, 400, false},
		{"missing token", "client", "application/json", `{}`, 400, false},
		{"invalid experience", "client", "application/json", `{"credential":"token","experience_level":"admin"}`, 400, false},
		{"oversized", "client", "application/json", `{"credential":"` + strings.Repeat("a", 21<<10) + `"}`, 400, false},
		{"invalid token", "client", "application/json", `{"credential":"token"}`, 401, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			called := false
			handler := googleAuthHandler(nil, tc.clientID, func(_ context.Context, credential, audience string) (*googleauth.Identity, error) {
				called = true
				if credential != "token" || audience != "client" {
					t.Fatal("wrong credential or audience passed to verifier")
				}
				return nil, errors.New("invalid signature")
			})
			e := echo.New()
			e.POST("/auth/google", handler)
			req := httptest.NewRequest(http.MethodPost, "/auth/google", strings.NewReader(tc.body))
			req.Header.Set(echo.HeaderContentType, tc.contentType)
			response := httptest.NewRecorder()
			e.ServeHTTP(response, req)
			if response.Code != tc.status || called != tc.verified {
				t.Fatalf("status=%d verifierCalled=%v, want %d/%v: %s", response.Code, called, tc.status, tc.verified, response.Body.String())
			}
		})
	}
}
