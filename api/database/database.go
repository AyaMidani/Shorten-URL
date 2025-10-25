package database

import (
	"context"
	"log"
	"os"
	"strings"

	"github.com/go-redis/redis/v8"
)

var (
	Ctx = context.Background()
	RDB *redis.Client
)

func Connect() {
	raw := os.Getenv("DB_ADDR")
	if raw == "" {
		log.Fatal("DB_ADDR is empty")
	}

	// If a full URL, parse it (works for redis:// and rediss://)
	if strings.HasPrefix(raw, "redis://") || strings.HasPrefix(raw, "rediss://") {
		opt, err := redis.ParseURL(raw)
		if err != nil {
			log.Fatalf("redis.ParseURL failed: %v", err)
		}
		RDB = redis.NewClient(opt)
	} else {
		// host:port style (local docker-compose: "db:6379")
		RDB = redis.NewClient(&redis.Options{
			Addr:     raw,
			Password: os.Getenv("DB_PASS"),
			DB:       0,
		})
	}

	// Sanity check
	if err := RDB.Ping(Ctx).Err(); err != nil {
		log.Fatalf("redis ping failed: %v", err)
	}
	log.Println("Connected to Redis")
}
