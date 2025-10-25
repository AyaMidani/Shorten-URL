package routes

import (
	"os"
	"strconv"
	"time"

	"github.com/AyaMidani/Shorten-URL/api/database"
	helpers "github.com/AyaMidani/Shorten-URL/api/helpers"
	govalidator "github.com/asaskevich/govalidator"
	"github.com/go-redis/redis/v8"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type request struct {
	URL         string        `json:"url"`
	CustomShort string        `json:"short"`
	Expiry      time.Duration `json:"expiry"` // hours
}

type response struct {
	URL             string        `json:"url"`
	CustomShort     string        `json:"short"`
	Expiry          time.Duration `json:"expiry"`
	XRateRemaining  int           `json:"rate_limit"`
	XRateLimitReset time.Duration `json:"rate_limit_reset"` // minutes
}

// ---- Config ----
var rlWindow = 30 * time.Minute // change if you like via env

func getQuota() int64 {
	q := os.Getenv("API_QUOTA")
	if q == "" {
		return 10
	}
	n, err := strconv.Atoi(q)
	if err != nil || n <= 0 {
		return 10
	}
	return int64(n)
}

func ShortenURL(c *fiber.Ctx) error {
	body := new(request)
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "cannot parse JSON"})
	}

	// ---------- Rate limit (per client IP) ----------
	ip := c.IP()
	key := "rl:" + ip
	quota := getQuota()

	pipe := database.RDB.TxPipeline()
	ctr := pipe.Incr(database.Ctx, key)
	pipe.Expire(database.Ctx, key, rlWindow)
	_, err := pipe.Exec(database.Ctx)

	if err != nil {
		// Redis problem — DO NOT rate-limit users; let request pass (or return 500 if you prefer)
		// continue to handler logic
	} else {
		count := ctr.Val()
		ttl, _ := database.RDB.TTL(database.Ctx, key).Result()
		reset := ttl
		if reset < 0 {
			reset = 0
		}

		// Helpful headers
		c.Set("X-RateLimit-Limit", strconv.FormatInt(quota, 10))
		c.Set("X-RateLimit-Remaining", strconv.FormatInt(quota-count, 10))
		c.Set("X-RateLimit-Reset", strconv.FormatInt(int64(reset.Seconds()), 10))

		if count > quota {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error":            "Rate limit exceeded",
				"rate_limit_reset": reset / time.Minute,
			})
		}
	}

	// ---------- Validate URL ----------
	if !govalidator.IsURL(body.URL) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid URL"})
	}
	if !helpers.RemoveDomainError(body.URL) {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "You cannot access the system"})
	}

	// Enforce scheme
	body.URL = helpers.EnforceHTTP(body.URL)

	// Short code
	var id string
	if body.CustomShort == "" {
		id = uuid.New().String()[:6]
	} else {
		id = body.CustomShort
	}

	// Check collision
	existing, err := database.RDB.Get(database.Ctx, id).Result()
	if err != nil && err != redis.Nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "db error"})
	}
	if existing != "" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "URL custom short is already in use"})
	}

	// Default expiry = 24 hours (your original behavior)
	if body.Expiry == 0 {
		body.Expiry = 24
	}

	// Save mapping with expiry in seconds
	if err := database.RDB.Set(database.Ctx, id, body.URL, body.Expiry*3600*time.Second).Err(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Unable to connect to server"})
	}

	// Decrement remaining in the rate bucket (only if limiter worked)
	if database.RDB != nil {
		_ = database.RDB.Decr(database.Ctx, key).Err()
	}

	// Build response
	resp := response{
		URL:             body.URL,
		CustomShort:     os.Getenv("DOMAIN") + "/" + id,
		Expiry:          body.Expiry,
		XRateRemaining:  0,
		XRateLimitReset: 0,
	}

	// Populate rate headers in body (optional)
	if rem, err := database.RDB.Get(database.Ctx, key).Result(); err == nil {
		resp.XRateRemaining, _ = strconv.Atoi(rem)
	}
	if ttl, err := database.RDB.TTL(database.Ctx, key).Result(); err == nil && ttl > 0 {
		resp.XRateLimitReset = ttl / time.Minute
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}
