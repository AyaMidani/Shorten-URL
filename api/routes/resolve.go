package routes

import (
	"github.com/AyaMidani/Shorten-URL/api/database"
	"github.com/go-redis/redis/v8"
	"github.com/gofiber/fiber/v2"
)

func ResolveURL(c *fiber.Ctx) error {
	url := c.Params("url")

	value, err := database.RDB.Get(database.Ctx, url).Result()
	if err == redis.Nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "short not found in the database"})
	} else if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "cannot connect to db"})
	}

	// simple visit counter (optional)
	_ = database.RDB.Incr(database.Ctx, "counter").Err()

	return c.Redirect(value, 301)
}
