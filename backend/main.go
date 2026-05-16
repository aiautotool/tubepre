package main

import (
	"log"
	"os"

	"kvtube-go/models"
	"kvtube-go/routes"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables (ignore if not found)
	_ = godotenv.Load()

	// Initialize Database
	models.InitDB()

	// Setup Gin Engine
	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := routes.SetupRouter()

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("KV-Tube Go Backend starting on port %s...", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
