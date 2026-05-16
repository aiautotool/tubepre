# ---- Backend Builder ----
FROM golang:1.25-alpine AS backend-builder
ENV GOTOOLCHAIN=local
ENV GOPROXY=https://proxy.golang.org,direct
WORKDIR /app
RUN apk add --no-cache git gcc musl-dev
COPY backend/go.mod backend/go.sum ./
RUN (echo "module kvtube-go"; echo ""; echo "go 1.24.0"; tail -n +4 go.mod) > go.mod.new && mv go.mod.new go.mod && go mod tidy
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o kv-tube .

# ---- Frontend Builder ----
FROM node:20-alpine AS frontend-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY --from=frontend-deps /app/node_modules ./node_modules
COPY frontend/ ./
ARG NEXT_PUBLIC_API_BASE_URL=
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# ---- Final Unified Image ----
FROM alpine:latest

RUN apk add --no-cache nodejs ca-certificates ffmpeg curl python3 py3-pip supervisor \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Copy Backend Binary
COPY --from=backend-builder /app/kv-tube /app/kv-tube

# Copy Frontend Standalone App - include server.js for standalone mode
COPY --from=frontend-builder /app/.next/standalone /app/frontend/
COPY --from=frontend-builder /app/.next/static /app/frontend/.next/static
COPY --from=frontend-builder /app/public /app/frontend/public
COPY --from=frontend-builder /app/package.json /app/frontend/package.json
COPY --from=frontend-builder /app/next.config.mjs /app/frontend/next.config.mjs
COPY --from=frontend-builder /app/next-env.d.ts /app/frontend/next-env.d.ts

# Create required directories for Next.js
RUN mkdir -p /app/frontend/.next/cache

# Copy Supervisord Config
COPY supervisord.conf /etc/supervisord.conf

# Setup Environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV KVTUBE_DATA_DIR=/app/data
ENV GIN_MODE=release
RUN addgroup -S kvtube && adduser -S kvtube -G kvtube && chown -R kvtube:kvtube /app

USER kvtube

EXPOSE 3000 8080

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
