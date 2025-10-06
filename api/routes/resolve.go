package routes

import "github.com/gofiber/fiber/v2"

func ResolveURL(c *fiber.Ctx) error {
	return c.SendStatus(1)
}
