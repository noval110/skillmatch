package googleauth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestVerifyGoogleIdentity(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	publicKey, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	if err != nil {
		t.Fatal(err)
	}
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		w.Header().Set("Cache-Control", "public, max-age=3600")
		json.NewEncoder(w).Encode(map[string]string{"test-key": string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: publicKey}))})
	}))
	defer server.Close()
	v := &Verifier{client: server.Client(), certURL: server.URL}
	for _, tc := range []struct {
		name   string
		change func(jwt.MapClaims)
		valid  bool
	}{
		{"valid", func(c jwt.MapClaims) {}, true},
		{"legacy issuer", func(c jwt.MapClaims) { c["iss"] = "accounts.google.com" }, true},
		{"wrong audience", func(c jwt.MapClaims) { c["aud"] = "attacker-client" }, false},
		{"wrong issuer", func(c jwt.MapClaims) { c["iss"] = "https://attacker.test" }, false},
		{"expired", func(c jwt.MapClaims) { c["exp"] = time.Now().Add(-time.Minute).Unix() }, false},
		{"missing expiry", func(c jwt.MapClaims) { delete(c, "exp") }, false},
		{"future issued", func(c jwt.MapClaims) { c["iat"] = time.Now().Add(time.Hour).Unix() }, false},
		{"unverified email", func(c jwt.MapClaims) { c["email_verified"] = false }, false},
		{"missing subject", func(c jwt.MapClaims) { delete(c, "sub") }, false},
		{"missing email", func(c jwt.MapClaims) { delete(c, "email") }, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			claims := jwt.MapClaims{"iss": "https://accounts.google.com", "aud": "skillmatch-client", "sub": "google-123", "email": "User@Gmail.com", "email_verified": true, "name": "Google User", "iat": time.Now().Unix(), "exp": time.Now().Add(time.Hour).Unix()}
			tc.change(claims)
			token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
			token.Header["kid"] = "test-key"
			credential, err := token.SignedString(key)
			if err != nil {
				t.Fatal(err)
			}
			identity, err := v.Verify(context.Background(), credential, "skillmatch-client")
			if (err == nil) != tc.valid {
				t.Fatalf("valid=%v, error=%v", tc.valid, err)
			}
			if tc.valid && (identity.Email != "user@gmail.com" || identity.Subject != "google-123") {
				t.Fatalf("unexpected identity: %+v", identity)
			}
		})
	}
	// A forged signature and HS256 algorithm confusion must both fail.
	otherKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	for _, method := range []jwt.SigningMethod{jwt.SigningMethodRS256, jwt.SigningMethodHS256} {
		token := jwt.NewWithClaims(method, jwt.MapClaims{"aud": "skillmatch-client", "exp": time.Now().Add(time.Hour).Unix()})
		token.Header["kid"] = "test-key"
		var signingKey any = otherKey
		if method == jwt.SigningMethodHS256 {
			signingKey = publicKey
		}
		credential, err := token.SignedString(signingKey)
		if err != nil {
			t.Fatal(err)
		}
		if _, err = v.Verify(context.Background(), credential, "skillmatch-client"); err == nil {
			t.Fatalf("accepted forged %s token", method.Alg())
		}
	}
	if requests.Load() != 1 {
		t.Fatalf("signing keys were not cached: %d requests", requests.Load())
	}
	v.lastRefresh = time.Now().Add(-2 * time.Minute)
	if _, err := v.key(context.Background(), "unknown"); err == nil {
		t.Fatal("accepted unknown key")
	}
	if _, err := v.key(context.Background(), "another-unknown"); err == nil {
		t.Fatal("accepted another unknown key")
	}
	if requests.Load() != 2 {
		t.Fatalf("unknown signing keys bypassed refresh limit: %d requests", requests.Load())
	}
	if _, err := v.key(context.Background(), "test-key"); err != nil {
		t.Fatalf("unknown key invalidated a valid cached key: %v", err)
	}
}

func TestCanLinkByEmail(t *testing.T) {
	for _, tc := range []struct {
		email    string
		hd       string
		verified bool
		want     bool
	}{
		{"user@gmail.com", "", true, true},
		{"user@company.test", "company.test", true, true},
		{"user@company.test", "", true, false},
		{"user@gmail.com.attacker.test", "", true, false},
		{"user@gmail.com", "", false, false},
		{"user@company.test", "company.test", false, false},
	} {
		identity := Identity{Email: tc.email, HostedDomain: tc.hd, EmailVerified: tc.verified}
		if got := identity.CanLinkByEmail(); got != tc.want {
			t.Errorf("%s hd=%s verified=%v: got %v", tc.email, tc.hd, tc.verified, got)
		}
	}
}
