package handlers

import (
	"errors"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

const maxTeamCoverSize = 5 << 20

func teamCoverDirectory() string {
	if directory := os.Getenv("UPLOAD_DIR"); directory != "" {
		return filepath.Join(directory, "team-covers")
	}
	return filepath.Join("uploads", "team-covers")
}

func teamCoverBaseName(teamID int64) string {
	return "team-" + strconv.FormatInt(teamID, 10)
}

func teamCoverURL(teamID int64) string {
	matches, _ := filepath.Glob(filepath.Join(teamCoverDirectory(), teamCoverBaseName(teamID)+".*"))
	if len(matches) == 0 {
		return ""
	}
	version := ""
	if info, err := os.Stat(matches[0]); err == nil {
		version = "?v=" + strconv.FormatInt(info.ModTime().UnixNano(), 10)
	}
	return "/uploads/team-covers/" + filepath.Base(matches[0]) + version
}

func removeTeamCoverFiles(teamID int64) error {
	matches, err := filepath.Glob(filepath.Join(teamCoverDirectory(), teamCoverBaseName(teamID)+".*"))
	if err != nil {
		return err
	}
	for _, filename := range matches {
		if err := os.Remove(filename); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}
	return nil
}

func ownedTeamID(c echo.Context, conn *pgxpool.Pool) (int64, error) {
	teamID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || teamID <= 0 {
		return 0, echo.NewHTTPError(http.StatusBadRequest, "Invalid team ID")
	}
	var ownerID int64
	err = conn.QueryRow(c.Request().Context(), `SELECT owner_id FROM teams WHERE id=$1`, teamID).Scan(&ownerID)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, echo.NewHTTPError(http.StatusNotFound, "Team not found")
	}
	if err != nil {
		return 0, err
	}
	if ownerID != c.Get("user_id").(int64) {
		return 0, echo.NewHTTPError(http.StatusForbidden, "Only team owner can update the team image")
	}
	return teamID, nil
}

// UploadTeamCover validates and stores a team image. Only the team owner may call it.
func UploadTeamCover(c echo.Context, conn *pgxpool.Pool) error {
	teamID, err := ownedTeamID(c, conn)
	if err != nil {
		if httpError, ok := err.(*echo.HTTPError); ok {
			return c.JSON(httpError.Code, map[string]string{"error": httpError.Message.(string)})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to verify team owner"})
	}

	c.Request().Body = http.MaxBytesReader(c.Response(), c.Request().Body, maxTeamCoverSize+(1<<20))
	fileHeader, err := c.FormFile("cover")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Team image is required"})
	}
	if fileHeader.Size > maxTeamCoverSize {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Team image must be 5 MB or smaller"})
	}

	source, err := fileHeader.Open()
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Unable to read team image"})
	}
	defer source.Close()

	header := make([]byte, 512)
	read, err := io.ReadFull(source, header)
	if err != nil && err != io.ErrUnexpectedEOF {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Unable to read team image"})
	}
	contentType := http.DetectContentType(header[:read])
	extension := ""
	switch contentType {
	case "image/jpeg":
		extension = ".jpg"
	case "image/png":
		extension = ".png"
	default:
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Team image must be a JPEG or PNG image"})
	}
	if _, err := source.Seek(0, io.SeekStart); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Unable to read team image"})
	}
	config, _, err := image.DecodeConfig(source)
	if err != nil || config.Width < 1 || config.Height < 1 || config.Width > 6000 || config.Height > 6000 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Team image dimensions are invalid or too large"})
	}
	if _, err := source.Seek(0, io.SeekStart); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Unable to read team image"})
	}

	directory := teamCoverDirectory()
	if err := os.MkdirAll(directory, 0755); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to prepare team image storage"})
	}
	baseName := teamCoverBaseName(teamID)
	temporary, err := os.CreateTemp(directory, baseName+"-*.tmp")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save team image"})
	}
	temporaryName := temporary.Name()
	defer os.Remove(temporaryName)
	if _, err = io.Copy(temporary, io.LimitReader(source, maxTeamCoverSize+1)); err != nil {
		temporary.Close()
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save team image"})
	}
	if err = temporary.Close(); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save team image"})
	}
	if err := removeTeamCoverFiles(teamID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to replace team image"})
	}
	destination := filepath.Join(directory, baseName+extension)
	if err = os.Rename(temporaryName, destination); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save team image"})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message":   "Team image updated successfully",
		"cover_url": "/uploads/team-covers/" + filepath.Base(destination) + "?v=" + strconv.FormatInt(time.Now().UnixNano(), 10),
	})
}

// DeleteTeamCover removes a custom image and restores the generated fallback.
func DeleteTeamCover(c echo.Context, conn *pgxpool.Pool) error {
	teamID, err := ownedTeamID(c, conn)
	if err != nil {
		if httpError, ok := err.(*echo.HTTPError); ok {
			return c.JSON(httpError.Code, map[string]string{"error": httpError.Message.(string)})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to verify team owner"})
	}
	if err := removeTeamCoverFiles(teamID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to remove team image"})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "Team image removed successfully"})
}
