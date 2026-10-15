package handlers

import (
	"context"
	"errors"
	"mime"
	"net/http"
	"strings"
	"time"

	"skillmatch/googleauth"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

type googleTokenVerifier func(context.Context, string, string) (*googleauth.Identity, error)

func NewGoogleAuthHandler(conn *pgxpool.Pool, clientID string) echo.HandlerFunc {
	return googleAuthHandler(conn, strings.TrimSpace(clientID), googleauth.NewVerifier().Verify)
}

func googleAuthHandler(conn *pgxpool.Pool, clientID string, verify googleTokenVerifier) echo.HandlerFunc {
	return func(c echo.Context) error {
		if clientID == "" {
			return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "Login Google belum diaktifkan. Silakan gunakan email dan password."})
		}
		// JSON requests require a CORS preflight from other origins and prevent
		// cross-site HTML form submissions from initiating a login.
		mediaType, _, err := mime.ParseMediaType(c.Request().Header.Get(echo.HeaderContentType))
		if err != nil || mediaType != echo.MIMEApplicationJSON {
			return c.JSON(http.StatusUnsupportedMediaType, map[string]string{"error": "Gunakan Content-Type application/json."})
		}
		c.Request().Body = http.MaxBytesReader(c.Response(), c.Request().Body, 20<<10)
		var req struct {
			Credential      string `json:"credential"`
			ExperienceLevel string `json:"experience_level"`
		}
		if err := c.Bind(&req); err != nil || req.Credential == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "Kredensial Google diperlukan."})
		}
		if req.ExperienceLevel == "" {
			req.ExperienceLevel = "beginner"
		}
		if req.ExperienceLevel != "beginner" && req.ExperienceLevel != "intermediate" && req.ExperienceLevel != "advanced" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "Experience level tidak valid."})
		}
		ctx, cancel := context.WithTimeout(c.Request().Context(), 15*time.Second)
		defer cancel()
		identity, err := verify(ctx, req.Credential, clientID)
		if err != nil {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Verifikasi Google gagal. Silakan masuk dengan Google kembali."})
		}
		user, err := findOrCreateGoogleUser(ctx, conn, identity, req.ExperienceLevel)
		if errors.Is(err, errGoogleAccountConflict) {
			return c.JSON(http.StatusConflict, map[string]string{"error": "Email sudah digunakan akun lain dan belum dapat dihubungkan dengan Google. Silakan masuk menggunakan email dan password."})
		}
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				return c.JSON(http.StatusConflict, map[string]string{"error": "Akun sedang diperbarui. Silakan coba masuk kembali."})
			}
			c.Logger().Error("Failed to resolve Google account: ", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal menyiapkan akun Google. Silakan coba lagi."})
		}
		return authSession(c, user.ID, user.Name, user.Email)
	}
}

var errGoogleAccountConflict = errors.New("Google account cannot be linked by email")

type googleUser struct {
	ID    int64
	Name  string
	Email string
}

func findOrCreateGoogleUser(ctx context.Context, conn *pgxpool.Pool, identity *googleauth.Identity, experience string) (googleUser, error) {
	var user googleUser
	tx, err := conn.Begin(ctx)
	if err != nil {
		return user, err
	}
	defer tx.Rollback(ctx)
	// Serialize concurrent first logins for this identity across server instances.
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(734821, hashtext($1))`, identity.Subject); err != nil {
		return user, err
	}
	err = tx.QueryRow(ctx, `SELECT id, name, email FROM users WHERE google_subject=$1`, identity.Subject).
		Scan(&user.ID, &user.Name, &user.Email)
	if err == nil {
		return user, tx.Commit(ctx)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return user, err
	}
	// Reject ambiguous case variants in legacy data rather than choosing an account.
	rows, err := tx.Query(ctx, `SELECT id, name, email, COALESCE(google_subject, '') FROM users WHERE lower(email)=$1 ORDER BY id LIMIT 2 FOR UPDATE`, identity.Email)
	if err != nil {
		return user, err
	}
	count, subject := 0, ""
	for rows.Next() {
		count++
		if err = rows.Scan(&user.ID, &user.Name, &user.Email, &subject); err != nil {
			rows.Close()
			return user, err
		}
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return user, err
	}
	if count > 1 || (count == 1 && (subject != "" || !identity.CanLinkByEmail())) {
		return user, errGoogleAccountConflict
	}
	if count == 1 {
		_, err = tx.Exec(ctx, `UPDATE users SET google_subject=$1 WHERE id=$2`, identity.Subject, user.ID)
	} else {
		name := strings.TrimSpace(identity.Name)
		if name == "" {
			name = strings.SplitN(identity.Email, "@", 2)[0]
		}
		err = tx.QueryRow(ctx, `INSERT INTO users (name,email,password,experience_level,google_subject) VALUES ($1,$2,'',$3,$4) RETURNING id,name,email`,
			name, identity.Email, experience, identity.Subject).Scan(&user.ID, &user.Name, &user.Email)
	}
	if err != nil {
		return user, err
	}
	return user, tx.Commit(ctx)
}
