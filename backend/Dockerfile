FROM golang:1.24-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git gcc musl-dev

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=1 GOOS=linux go build -o kv-tube .

FROM alpine:latest

RUN apk add --no-cache ca-certificates ffmpeg curl python3 py3-pip && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY --from=builder /app/kv-tube .

RUN addgroup -S kvtube && adduser -S kvtube -G kvtube && chown -R kvtube:kvtube /app

USER kvtube

EXPOSE 8080

ENV KVTUBE_DATA_DIR=/app/data
ENV GIN_MODE=release

CMD ["./kv-tube"]
