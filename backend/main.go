package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"skillmatch/database"
	"skillmatch/handlers"
	authmiddleware "skillmatch/middleware"

	"github.com/labstack/echo/v4"
	echomiddleware "github.com/labstack/echo/v4/middleware"
)

func main() {
	conn := database.Connect()
	defer conn.Close()
	config, err := serverConfigFromEnv()
	if err != nil {
		log.Fatal(err)
	}
	if err := database.Migrate(context.Background(), conn); err != nil {
		log.Fatal("Database migration failed: ", err)
	}

	e := echo.New()
	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "uploads"
	}
	e.Static("/uploads", uploadDir)

	e.Use(echomiddleware.CORSWithConfig(echomiddleware.CORSConfig{
		AllowOrigins: config.allowedOrigins,
		AllowMethods: []string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodDelete,
			http.MethodOptions,
		},
		AllowHeaders: []string{
			echo.HeaderOrigin,
			echo.HeaderContentType,
			echo.HeaderAccept,
			echo.HeaderAuthorization,
		},
	}))

	// Health
	handlers.RegisterCommunityRoutes(e, conn)

	e.GET("/api/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{
			"status": "ok",
			"app":    "skillmatch",
		})
	})

	// Auth
	e.POST("/api/register", func(c echo.Context) error {
		return handlers.Register(c, conn)
	})

	e.POST("/api/login", func(c echo.Context) error {
		return handlers.Login(c, conn)
	})

	// Users
	e.GET("/api/users", func(c echo.Context) error {
		return handlers.GetUser(c, conn)
	})

	e.GET("/api/profile", func(c echo.Context) error {
		return handlers.GetUserProfile(c, conn)
	}, authmiddleware.AuthMiddleware)

	e.GET("/api/users/:id/profile", func(c echo.Context) error {
		return handlers.GetPublicUserProfile(c, conn)
	}, authmiddleware.AuthMiddleware)

	e.POST("/api/profile/photo", func(c echo.Context) error {
		return handlers.UploadProfilePhoto(c, conn)
	}, authmiddleware.AuthMiddleware)

	// Skills
	e.GET("/api/skills", func(c echo.Context) error {
		return handlers.GetSkills(c, conn)
	})

	e.POST("/api/profile/skills", func(c echo.Context) error {
		return handlers.AddProfileSkill(c, conn)
	}, authmiddleware.AuthMiddleware)

	e.GET("/api/profile/skills", func(c echo.Context) error {
		return handlers.GetProfileSkills(c, conn)
	}, authmiddleware.AuthMiddleware)

	e.PUT("/api/profile/skills/:skill_id", func(c echo.Context) error {
		return handlers.UpdateProfileSkill(c, conn)
	}, authmiddleware.AuthMiddleware)

	e.DELETE("/api/profile/skills/:skill_id", func(c echo.Context) error {
		return handlers.DeleteProfileSkill(c, conn)
	}, authmiddleware.AuthMiddleware)

	// Teams
	e.POST("/api/teams", func(c echo.Context) error {
		return handlers.CreateTeam(c, conn)
	}, authmiddleware.AuthMiddleware)

	e.GET("/api/teams", func(c echo.Context) error {
		return handlers.GetTeams(c, conn)
	})

	e.GET("/api/teams/search", func(c echo.Context) error {
		return handlers.SearchTeams(c, conn)
	})

	e.GET("/api/teams/:id", func(c echo.Context) error {
		return handlers.GetTeamDetail(c, conn)
	})

	e.PUT("/api/teams/:id", func(c echo.Context) error {
		return handlers.UpdateTeam(c, conn)
	}, authmiddleware.AuthMiddleware)

	e.POST("/api/teams/:id/cover", func(c echo.Context) error {
		return handlers.UploadTeamCover(c, conn)
	}, authmiddleware.AuthMiddleware)

	e.DELETE("/api/teams/:id/cover", func(c echo.Context) error {
		return handlers.DeleteTeamCover(c, conn)
	}, authmiddleware.AuthMiddleware)

	e.DELETE("/api/teams/:id", func(c echo.Context) error {
		return handlers.DeleteTeam(c, conn)
	}, authmiddleware.AuthMiddleware)

	// Join Team
	e.POST("/api/teams/:id/join", func(c echo.Context) error {
		return handlers.JoinTeam(c, conn)
	}, authmiddleware.AuthMiddleware)

	e.DELETE("/api/teams/:id/leave", func(c echo.Context) error {
		return handlers.LeaveTeam(c, conn)
	}, authmiddleware.AuthMiddleware)

	e.DELETE("/api/teams/:id/members/:user_id", func(c echo.Context) error {
		return handlers.RemoveTeamMember(c, conn)
	}, authmiddleware.AuthMiddleware)

	// Get Join Requests
	e.GET("/api/teams/:id/join-requests", func(c echo.Context) error {
		return handlers.GetJoinRequests(c, conn)
	}, authmiddleware.AuthMiddleware)
	// Accept Join Request
	e.PUT("/api/join-requests/:id/accept", func(c echo.Context) error {
		return handlers.AcceptJoinRequest(c, conn)
	}, authmiddleware.AuthMiddleware)
	// Reject Join Request
	e.PUT("/api/join-requests/:id/reject", func(c echo.Context) error {
		return handlers.RejectJoinRequest(c, conn)
	}, authmiddleware.AuthMiddleware)

	// Team Roles
	e.POST("/api/teams/:id/roles", func(c echo.Context) error {
		return handlers.CreateTeamRole(c, conn)
	}, authmiddleware.AuthMiddleware)

	// Get Team Roles
	e.GET("/api/teams/:id/roles", func(c echo.Context) error {
		return handlers.GetTeamRoles(c, conn)
	})

	// Update Team Role
	e.PUT("/api/teams/:id/roles/:role_id", func(c echo.Context) error {
		return handlers.UpdateTeamRole(c, conn)
	}, authmiddleware.AuthMiddleware)

	// Delete Team Role
	e.DELETE("/api/teams/:id/roles/:role_id", func(c echo.Context) error {
		return handlers.DeleteTeamRole(c, conn)
	}, authmiddleware.AuthMiddleware)

	// Add Role Skill
	e.POST("/api/teams/:id/roles/:role_id/skills", func(c echo.Context) error {
		return handlers.AddRoleSkill(c, conn)
	}, authmiddleware.AuthMiddleware)

	// Get Role Skills
	e.GET("/api/teams/:id/roles/:role_id/skills", func(c echo.Context) error {
		return handlers.GetRoleSkills(c, conn)
	})

	// Delete Role Skill
	e.DELETE("/api/teams/:id/roles/:role_id/skills/:skill_id", func(c echo.Context) error {
		return handlers.DeleteRoleSkill(c, conn)
	}, authmiddleware.AuthMiddleware)

	// Get Role Match
	e.GET("/api/teams/:id/roles/:role_id/match", func(c echo.Context) error {
		return handlers.GetRoleMatch(c, conn)
	}, authmiddleware.AuthMiddleware)

	// Update Profile
	e.PUT("/api/profile", func(c echo.Context) error {
		return handlers.UpdateProfile(c, conn)
	}, authmiddleware.AuthMiddleware)

	e.Logger.Fatal(e.Start(":" + config.port))
}
