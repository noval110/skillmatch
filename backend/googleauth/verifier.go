package googleauth

import (
	"context"
	"crypto/rsa"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Identity struct {
	jwt.RegisteredClaims
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	HostedDomain  string `json:"hd"`
}

// Google is authoritative for Gmail and verified Google Workspace addresses.
// Other Google accounts must not take over an existing password account by email.
func (i Identity) CanLinkByEmail() bool {
	return i.EmailVerified && (strings.HasSuffix(strings.ToLower(i.Email), "@gmail.com") || i.HostedDomain != "")
}

type Verifier struct {
	client      *http.Client
	certURL     string
	mu          sync.Mutex
	keys        map[string]*rsa.PublicKey
	expires     time.Time
	lastRefresh time.Time
}

func NewVerifier() *Verifier {
	return &Verifier{
		client:  &http.Client{Timeout: 8 * time.Second},
		certURL: "https://www.googleapis.com/oauth2/v1/certs",
	}
}

func (v *Verifier) Verify(ctx context.Context, credential, clientID string) (*Identity, error) {
	if clientID == "" || credential == "" || len(credential) > 16384 {
		return nil, errors.New("missing Google credential or client ID")
	}
	identity := new(Identity)
	_, err := jwt.ParseWithClaims(credential, identity, func(token *jwt.Token) (any, error) {
		kid, ok := token.Header["kid"].(string)
		if !ok || kid == "" {
			return nil, errors.New("missing Google signing key ID")
		}
		return v.key(ctx, kid)
	}, jwt.WithValidMethods([]string{"RS256"}), jwt.WithAudience(clientID),
		jwt.WithExpirationRequired(), jwt.WithIssuedAt())
	if err != nil {
		return nil, err
	}
	if identity.Issuer != "https://accounts.google.com" && identity.Issuer != "accounts.google.com" {
		return nil, errors.New("invalid Google issuer")
	}
	if identity.Subject == "" || len(identity.Subject) > 255 || !identity.EmailVerified ||
		strings.TrimSpace(identity.Email) == "" || !strings.Contains(identity.Email, "@") {
		return nil, errors.New("Google identity requires a subject and verified email")
	}
	identity.Email = strings.ToLower(strings.TrimSpace(identity.Email))
	return identity, nil
}

func (v *Verifier) key(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	v.mu.Lock()
	defer v.mu.Unlock()
	now := time.Now()
	if now.Before(v.expires) && v.keys[kid] != nil {
		return v.keys[kid], nil
	}
	// Unknown IDs may trigger a rotation refresh, but cannot flood Google's server.
	if now.Sub(v.lastRefresh) < time.Minute {
		return nil, errors.New("Google signing key unavailable")
	}
	v.lastRefresh = now
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.certURL, nil)
	if err != nil {
		return nil, err
	}
	response, err := v.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, errors.New("failed to fetch Google signing keys")
	}
	var certificates map[string]string
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&certificates); err != nil {
		return nil, err
	}
	keys := make(map[string]*rsa.PublicKey, len(certificates))
	for id, pem := range certificates {
		key, err := jwt.ParseRSAPublicKeyFromPEM([]byte(pem))
		if err != nil {
			return nil, err
		}
		keys[id] = key
	}
	maxAge := 5 * time.Minute
	for _, directive := range strings.Split(response.Header.Get("Cache-Control"), ",") {
		if value, ok := strings.CutPrefix(strings.TrimSpace(directive), "max-age="); ok {
			if seconds, err := strconv.Atoi(value); err == nil && seconds >= 0 && seconds <= 86400 {
				maxAge = time.Duration(seconds) * time.Second
			}
		}
	}
	// Age represents time already spent in intermediary caches.
	if age, err := strconv.Atoi(response.Header.Get("Age")); err == nil && age > 0 && age <= 86400 {
		maxAge -= time.Duration(age) * time.Second
	}
	v.keys, v.expires = keys, now.Add(maxAge)
	if keys[kid] == nil {
		return nil, errors.New("unknown Google signing key")
	}
	return keys[kid], nil
}
