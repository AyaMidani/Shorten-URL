// api/routes/shorten.go
package routes

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net/url"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	// add your redis import / client
	// e.g. "github.com/redis/go-redis/v9"
)

type shortenReq struct {
	URL    string `json:"url"`
	Expiry int    `json:"expiry"` // hours
	Alias  string `json:"alias"`  // optional
}

func ShortenURL(c *fiber.Ctx) error {
	// 1) Parse JSON body
	var req shortenReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "invalid JSON body",
		})
	}

	// 2) Validate URL
	if _, err := url.ParseRequestURI(req.URL); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "invalid url",
		})
	}

	if req.Expiry <= 0 {
		req.Expiry = 24
	}

	// 3) Choose short ID (alias or random)
	shortID := strings.TrimSpace(req.Alias)
	if shortID == "" {
		b := make([]byte, 4)
		if _, err := rand.Read(b); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"message": "could not generate id",
			})
		}
		shortID = base64.RawURLEncoding.EncodeToString(b) // e.g. "d2880c"
	}

	// 4) Save to Redis (pseudo-code; replace with your actual code)
	// err := redisClient.Set(ctx, "short:"+shortID, req.URL, time.Duration(req.Expiry)*time.Hour).Err()
	// if err != nil {
	//     // collision or storage error
	//     return c.Status(fiber.StatusConflict).JSON(fiber.Map{"message": "alias already exists"})
	// }

	// 5) Build absolute short URL
	domain := os.Getenv("DOMAIN")
	if domain == "" {
		// fallback to the request's base URL if DOMAIN not set
		domain = c.BaseURL()
	} else if !strings.HasPrefix(domain, "http") {
		domain = "https://" + domain
	}
	shortURL := fmt.Sprintf("%s/%s", strings.TrimRight(domain, "/"), shortID)

	// 6) Return JSON (frontend expects this)
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"short_url": shortURL,
		"code":      shortID,
		"expiry":    req.Expiry,
	})
}
