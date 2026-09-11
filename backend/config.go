package main

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
)

type serverConfig struct {
	port           string
	allowedOrigins []string
}

// database.Connect loads the optional local .env before this is called.
func serverConfigFromEnv() (serverConfig, error) {
	config := serverConfig{
		port: strings.TrimSpace(os.Getenv("PORT")),
		allowedOrigins: []string{
			"http://localhost:5173",
			"http://127.0.0.1:5173",
		},
	}
	if strings.TrimSpace(os.Getenv("JWT_SECRET")) == "" {
		return config, fmt.Errorf("JWT_SECRET is not set")
	}
	if config.port == "" {
		config.port = "8080"
	}
	port, err := strconv.Atoi(config.port)
	if err != nil || port < 1 || port > 65535 {
		return config, fmt.Errorf("PORT must be a number between 1 and 65535")
	}
	if frontendURL := strings.TrimSpace(os.Getenv("FRONTEND_URL")); frontendURL != "" {
		origin, err := url.Parse(frontendURL)
		if err != nil || (origin.Scheme != "https" && origin.Scheme != "http") ||
			origin.Hostname() == "" || origin.User != nil || strings.Contains(frontendURL, "*") ||
			(origin.Path != "" && origin.Path != "/") || origin.RawQuery != "" || origin.Fragment != "" {
			return config, fmt.Errorf("FRONTEND_URL must be a single http(s) origin without a path, query, fragment, or wildcard")
		}
		config.allowedOrigins = append(config.allowedOrigins, origin.Scheme+"://"+origin.Host)
	}
	return config, nil
}
