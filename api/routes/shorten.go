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
	Expiry      time.Duration `json:"expiry"`
}

type response struct {
	URL             string        `json:"url"`
	CustomShort     string        `json:"short"`
	Expiry          time.Duration `json:"expiry"`
	XRateRemaining  int           `json:"rate_limit"`
	XRateLimitReset time.Duration `json:"rate_limit_reset"`
}

var rlWindow = 30 * time.Minute

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

	ip := c.IP()
	key := "rl:" + ip
	quota := getQuota()

	pipe := database.RDB.TxPipeline()
	ctr := pipe.Incr(database.Ctx, key)
	pipe.Expire(database.Ctx, key, rlWindow)
	_, err := pipe.Exec(database.Ctx)

	if err == nil {
		count := ctr.Val()
		ttl, _ := database.RDB.TTL(database.Ctx, key).Result()
		reset := ttl
		if reset < 0 {
			reset = 0
		}

		remaining := quota - count
		if remaining < 0 {
			remaining = 0
		}

		c.Set("X-RateLimit-Limit", strconv.FormatInt(quota, 10))
		c.Set("X-RateLimit-Remaining", strconv.FormatInt(remaining, 10))
		c.Set("X-RateLimit-Reset", strconv.FormatInt(int64(reset.Seconds()), 10))

		if count > quota {
			return c.Status(429).JSON(fiber.Map{
				"error":            "Rate limit exceeded",
				"rate_limit_reset": reset / time.Minute,
			})
		}
	}

	if !govalidator.IsURL(body.URL) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid URL"})
	}
	if !helpers.RemoveDomainError(body.URL) {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "You cannot access the system"})
	}

	body.URL = helpers.EnforceHTTP(body.URL)

	var id string
	if body.CustomShort == "" {
		id = uuid.New().String()[:6]
	} else {
		id = body.CustomShort
	}

	existing, err := database.RDB.Get(database.Ctx, id).Result()
	if err != nil && err != redis.Nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "db error"})
	}
	if existing != "" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "URL custom short is already in use"})
	}

	if body.Expiry == 0 {
		body.Expiry = 24
	}

	if err := database.RDB.Set(database.Ctx, id, body.URL, body.Expiry*3600*time.Second).Err(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Unable to connect to server"})
	}

	resp := response{
		URL:             body.URL,
		CustomShort:     os.Getenv("DOMAIN") + "/" + id,
		Expiry:          body.Expiry,
		XRateRemaining:  0,
		XRateLimitReset: 0,
	}

	if rem, err := database.RDB.Get(database.Ctx, key).Result(); err == nil {
		resp.XRateRemaining, _ = strconv.Atoi(rem)
	}
	if ttl, err := database.RDB.TTL(database.Ctx, key).Result(); err == nil && ttl > 0 {
		resp.XRateLimitReset = ttl / time.Minute
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}
