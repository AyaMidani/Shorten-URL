# syntax=docker/dockerfile:1

### Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o main .

### Runtime stage
FROM alpine:3.20

RUN apk add --no-cache ca-certificates

WORKDIR /app

COPY --from=builder /build/main /app/main

RUN chmod +x /app/main

EXPOSE 10000

CMD ["/app/main"]