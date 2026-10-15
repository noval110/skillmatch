package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestMissingAuthRouteIsNotMaskedByCommunityAuthentication(t *testing.T) {
	e := echo.New()
	RegisterCommunityRoutes(e, nil)
	// A server without Google support must report an absent endpoint, rather
	// than imply that the user must already be logged in to start a login.
	response := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/google", strings.NewReader(`{}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	e.ServeHTTP(response, req)
	if response.Code != http.StatusNotFound {
		t.Fatalf("missing Google endpoint: got %d %s, want 404", response.Code, response.Body.String())
	}
}

func TestGoogleRouteIsPublicAlongsideProtectedCommunityRoutes(t *testing.T) {
	for _, tc := range []struct {
		clientID string
		status   int
	}{
		{"", http.StatusServiceUnavailable},
		{"configured-client", http.StatusBadRequest},
	} {
		e := echo.New()
		RegisterCommunityRoutes(e, nil)
		e.POST("/api/auth/google", NewGoogleAuthHandler(nil, tc.clientID))
		response := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/api/auth/google", strings.NewReader(`{}`))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		e.ServeHTTP(response, req)
		if response.Code != tc.status || strings.Contains(response.Body.String(), "Missing Authorization") {
			t.Fatalf("Google login demanded an existing session: got %d %s", response.Code, response.Body.String())
		}
	}
}
