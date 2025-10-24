package main

import (
	"fmt"
	"log"
	"os"

	routes "github.com/AyaMidani/Shorten-URL/api/routes"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"
)

func setupRoutes(app *fiber.App) {
	// health check (useful on Render & for curl)
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "ok"})
	})

	// API
	app.Post("/api/v1", routes.ShortenURL) // NOTE: no trailing slash

	// redirect
	app.Get("/:url", routes.ResolveURL)
}

func main() {
	// Load .env in local dev; on Render there may be no .env and that's fine
	_ = godotenv.Load()

	app := fiber.New()

	// Nice-to-haves
	app.Use(recover.New())
	app.Use(logger.New())

	// If your frontend will be on a different domain (Vercel/Netlify), keep this.
	// If you proxy /api through the same origin, you can remove it.
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,OPTIONS",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
	}))

	setupRoutes(app)

	// Render sets PORT. Fallback to 3000 locally.
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
	addr := ":" + port
	fmt.Println("Listening on", addr)
	log.Fatal(app.Listen(addr))
}
