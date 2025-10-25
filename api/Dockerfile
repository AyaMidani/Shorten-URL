# syntax=docker/dockerfile:1

### Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /build
# cache deps
COPY go.mod go.sum ./
RUN go mod download

# app source
COPY . .
# produce static linux binary named "main"
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o main .

### Runtime stage
FROM alpine:3.20

# TLS roots for calling Upstash (HTTPS)
RUN apk add --no-cache ca-certificates

# non-root user
RUN adduser -S -D -H -h /app appuser
WORKDIR /app

# only copy the binary (not the whole repo)
COPY --from=builder /build/main /app/main

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser

# ensure it's executable and owned by the app user
RUN chmod +x /app/main && chown appuser:appuser /app/main

USER appuser

# Render sets PORT (typically 10000). Your app reads it in main.go.
# Expose is just documentation; Render ignores it, but it's fine to keep:
EXPOSE 10000

# start the app
CMD ["/app/main"]
