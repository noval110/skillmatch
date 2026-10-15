# Build backend Go
FROM golang:1.27-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o server .

# Runtime
FROM alpine:3.22

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/server ./server
COPY --from=builder /app/database ./database

RUN mkdir -p /app/uploads

EXPOSE 8080

CMD ["./server"]
