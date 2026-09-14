package handlers

import (
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"io"
	"net/http"
	auth "skillmatch/middleware"
	"strconv"
)

func RegisterCommunityRoutes(e *echo.Echo, pool *pgxpool.Pool) {
	api := e.Group("/api", auth.AuthMiddleware)
	wrap := func(fn func(echo.Context, *pgxpool.Pool) error) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Response().Header().Set("Cache-Control", "private, no-store")
			return fn(c, pool)
		}
	}
	api.GET("/notifications", wrap(GetNotifications))
	api.GET("/notifications/unread-count", wrap(GetUnreadCount))
	api.PUT("/notifications/:id/read", wrap(ReadNotification))
	api.PUT("/notifications/read-all", wrap(ReadAllNotifications))
	api.GET("/profile/showcase", wrap(GetShowcase))
	api.POST("/profile/portfolio", wrap(SavePortfolio))
	api.PUT("/profile/portfolio/:id", wrap(SavePortfolio))
	api.DELETE("/profile/portfolio/:id", wrap(DeleteShowcaseItem))
	api.POST("/profile/achievements", wrap(SaveAchievement))
	api.PUT("/profile/achievements/:id", wrap(SaveAchievement))
	api.DELETE("/profile/achievements/:id", wrap(DeleteShowcaseItem))
	api.POST("/conversations", wrap(CreateConversation))
	api.GET("/conversations", wrap(GetConversations))
	api.GET("/conversations/:id", wrap(GetConversation))
	api.GET("/conversations/:id/messages", wrap(GetMessages))
	api.POST("/conversations/:id/messages", wrap(SendMessage))
	api.PUT("/conversations/:id/read", wrap(ReadConversation))
	api.GET("/teams/recommended", wrap(GetRecommendedTeams))
	api.GET("/teams/:id/readiness", wrap(GetTeamReadiness))
	api.GET("/teams/:id/milestones", wrap(GetTeamMilestones))
	api.POST("/teams/:id/milestones", wrap(CreateTeamMilestone))
	api.PUT("/teams/:id/milestones/:milestone_id", wrap(UpdateTeamMilestone))
	api.DELETE("/teams/:id/milestones/:milestone_id", wrap(DeleteTeamMilestone))
}

func apiError(c echo.Context, status int, message string) error {
	return c.JSON(status, map[string]string{"error": message})
}
func dbError(c echo.Context, err error) error {
	c.Logger().Error(err)
	return apiError(c, 500, "Unable to complete this request. Please try again.")
}
func resourceID(c echo.Context) (int64, error) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		return 0, echo.NewHTTPError(400, "Invalid ID")
	}
	return id, nil
}
func pageCursor(c echo.Context, name string) (int64, error) {
	if c.QueryParam(name) == "" {
		return 0, nil
	}
	id, err := strconv.ParseInt(c.QueryParam(name), 10, 64)
	if err != nil || id <= 0 {
		return 0, echo.NewHTTPError(400, "Invalid pagination cursor")
	}
	return id, nil
}
func readBody(c echo.Context, body any) error {
	decoder := json.NewDecoder(http.MaxBytesReader(c.Response(), c.Request().Body, 64<<10))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(body); err != nil {
		return echo.NewHTTPError(400, "Invalid request body")
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return echo.NewHTTPError(400, "Invalid request body")
	}
	return nil
}
