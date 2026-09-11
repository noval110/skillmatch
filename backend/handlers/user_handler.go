package handlers

import (
	"context"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"skillmatch/models"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

const maxAvatarSize = 5 << 20

func avatarDirectory() string {
	if directory := os.Getenv("UPLOAD_DIR"); directory != "" {
		return filepath.Join(directory, "avatars")
	}
	return filepath.Join("uploads", "avatars")
}

func avatarURL(userID int64) string {
	matches, _ := filepath.Glob(filepath.Join(avatarDirectory(), "user-"+strconv.FormatInt(userID, 10)+".*"))
	if len(matches) == 0 {
		return ""
	}
	version := ""
	if info, err := os.Stat(matches[0]); err == nil {
		version = "?v=" + strconv.FormatInt(info.ModTime().UnixNano(), 10)
	}
	return "/uploads/avatars/" + filepath.Base(matches[0]) + version
}

// GetUser fetches all users from the database.
func GetUser(c echo.Context, conn *pgxpool.Pool) error {
	rows, err := conn.Query(
		context.Background(),
		"SELECT id, name, email FROM users",
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to fetch users",
		})
	}

	defer rows.Close()

	users := []models.User{}

	for rows.Next() {
		var user models.User

		err := rows.Scan(
			&user.ID,
			&user.Name,
			&user.Email,
		)

		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "Failed to read user data",
			})
		}
		users = append(users, user)
	}

	return c.JSON(http.StatusOK, users)
}

// GetUserProfile fetches the profile of the authenticated user.
func GetUserProfile(c echo.Context, conn *pgxpool.Pool) error {
	userID := c.Get("user_id").(int64)

	var user models.User

	err := conn.QueryRow(
		context.Background(),
		`
		SELECT
			id,
			name,
			email,
			COALESCE(bio, ''),
			COALESCE(experience_level, 'Beginner'), COALESCE(preferred_role, ''), COALESCE(availability, ''), COALESCE(project_interest, '')
		FROM users
		WHERE id = $1
		`,
		userID,
	).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.Bio,
		&user.ExperienceLevel, &user.PreferredRole, &user.Availability, &user.ProjectInterest,
	)

	if err != nil {
		fmt.Println("GET PROFILE ERROR:", err)

		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to fetch user profile",
		})
	}
	user.AvatarURL = avatarURL(userID)

	return c.JSON(http.StatusOK, user)

}

// UploadProfilePhoto validates and stores the authenticated user's profile photo.
func UploadProfilePhoto(c echo.Context, conn *pgxpool.Pool) error {
	userID := c.Get("user_id").(int64)
	c.Request().Body = http.MaxBytesReader(c.Response(), c.Request().Body, maxAvatarSize+(1<<20))
	fileHeader, err := c.FormFile("photo")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Photo is required"})
	}
	if fileHeader.Size > maxAvatarSize {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Photo must be 5 MB or smaller"})
	}

	source, err := fileHeader.Open()
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Unable to read photo"})
	}
	defer source.Close()

	header := make([]byte, 512)
	read, err := io.ReadFull(source, header)
	if err != nil && err != io.ErrUnexpectedEOF {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Unable to read photo"})
	}
	contentType := http.DetectContentType(header[:read])
	extension := ""
	switch contentType {
	case "image/jpeg":
		extension = ".jpg"
	case "image/png":
		extension = ".png"
	default:
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Photo must be a JPEG or PNG image"})
	}
	if _, err := source.Seek(0, io.SeekStart); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Unable to read photo"})
	}
	config, _, err := image.DecodeConfig(source)
	if err != nil || config.Width < 1 || config.Height < 1 || config.Width > 6000 || config.Height > 6000 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Photo dimensions are invalid or too large"})
	}
	if _, err := source.Seek(0, io.SeekStart); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Unable to read photo"})
	}

	directory := avatarDirectory()
	if err := os.MkdirAll(directory, 0755); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to prepare photo storage"})
	}
	baseName := "user-" + strconv.FormatInt(userID, 10)
	temporary, err := os.CreateTemp(directory, baseName+"-*.tmp")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save photo"})
	}
	temporaryName := temporary.Name()
	defer os.Remove(temporaryName)
	if _, err = io.Copy(temporary, io.LimitReader(source, maxAvatarSize+1)); err != nil {
		temporary.Close()
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save photo"})
	}
	if err = temporary.Close(); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save photo"})
	}

	existing, _ := filepath.Glob(filepath.Join(directory, baseName+".*"))
	for _, filename := range existing {
		if !strings.HasSuffix(filename, ".tmp") {
			_ = os.Remove(filename)
		}
	}
	destination := filepath.Join(directory, baseName+extension)
	if err = os.Rename(temporaryName, destination); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save photo"})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message":    "Profile photo updated successfully",
		"avatar_url": "/uploads/avatars/" + filepath.Base(destination) + "?v=" + strconv.FormatInt(time.Now().UnixNano(), 10),
	})
}

// UpdateProfile updates the user's profile information.
func UpdateProfile(c echo.Context, conn *pgxpool.Pool) error {
	userID := c.Get("user_id").(int64)

	var req models.UpdateProfileRequest

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request payload",
		})
	}

	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Name is required",
		})
	}

	switch normalized(req.ExperienceLevel) {
	case "beginner":
		req.ExperienceLevel = "Beginner"
	case "intermediate":
		req.ExperienceLevel = "Intermediate"
	case "advanced":
		req.ExperienceLevel = "Advanced"
	}
	for _, field := range []*string{req.PreferredRole, req.ProjectInterest} {
		if field != nil {
			*field = strings.TrimSpace(*field)
			if len([]rune(*field)) > 100 {
				return c.JSON(http.StatusBadRequest, map[string]string{"error": "Preferences must be 100 characters or fewer"})
			}
		}
	}
	if req.Availability != nil {
		*req.Availability = normalized(*req.Availability)
		switch *req.Availability {
		case "", "weekday", "weekend", "flexible":
		default:
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "Availability must be weekday, weekend, flexible, or empty"})
		}
	}
	if req.ExperienceLevel != "Beginner" &&
		req.ExperienceLevel != "Intermediate" &&
		req.ExperienceLevel != "Advanced" {

		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Experience level must be one of: Beginner, Intermediate, Advanced",
		})
	}

	result, err := conn.Exec(
		context.Background(),
		`
			UPDATE users
			SET name=$1, bio=$2, experience_level=$3,
 preferred_role=COALESCE($5, preferred_role), availability=COALESCE($6, availability), project_interest=COALESCE($7, project_interest)
			WHERE id=$4
		`,
		req.Name, req.Bio, req.ExperienceLevel, userID, req.PreferredRole, req.Availability, req.ProjectInterest,
	)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to update user profile",
		})
	}

	if result.RowsAffected() == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "User not found",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Profile updated successfully",
	})
}
