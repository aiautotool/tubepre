#!/bin/bash

cd "$(dirname "$0")"

# Add user local bin to PATH for yt-dlp and cloudflared
export PATH="$PATH:/config/.local/bin:$HOME/.local/bin:/config/docker-bin"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Mode: dev or prod
MODE=${1:-dev}

echo -e "${BLUE}╔═══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       KV-Tube Restart Script          ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Mode: ${MODE}${NC}"
echo ""

# Stop existing processes
echo -e "${YELLOW}[1/5] Stopping existing processes...${NC}"

# Kill backend processes
pkill -f "kvtube-go" 2>/dev/null
pkill -f "backend/bin/kv-tube" 2>/dev/null
pkill -f "go run.*backend" 2>/dev/null

# Kill frontend processes
pkill -f "next dev" 2>/dev/null
pkill -f "next start" 2>/dev/null
pkill -f "node.*next" 2>/dev/null

# Kill cloudflared/ngrok
pkill -f "cloudflared" 2>/dev/null
pkill -f "ngrok" 2>/dev/null

# Kill any processes on our ports
fkill() {
    local port=$1
    local pid=$(lsof -t -i:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        kill -9 $pid 2>/dev/null
        echo -e "  Killed process on port $port (PID: $pid)"
    fi
}

fkill 8080
fkill 3003

sleep 1

# Check if yt-dlp is installed
echo -e "${YELLOW}[2/5] Checking dependencies...${NC}"
if ! command -v yt-dlp &> /dev/null; then
    echo -e "${RED}Error: yt-dlp is not installed!${NC}"
    echo -e "Install with: ${YELLOW}pip install yt-dlp${NC} or ${YELLOW}brew install yt-dlp${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} yt-dlp: $(yt-dlp --version 2>/dev/null || echo 'installed')"

# Check cloudflared
if command -v cloudflared &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} cloudflared: available"
    TUNNEL_OK=true
else
    echo -e "  ${YELLOW}!${NC} cloudflared: not found (will skip tunnel)"
    TUNNEL_OK=false
fi

# Start backend
echo -e "${YELLOW}[3/5] Starting backend...${NC}"
cd backend

if [ "$MODE" = "prod" ]; then
    # Build and run production binary
    echo "  Building backend..."
    go build -o bin/kv-tube .
    GIN_MODE=release ./bin/kv-tube > ../logs/backend.log 2>&1 &
else
    go run main.go > ../logs/backend.log 2>&1 &
fi
BACKEND_PID=$!
cd ..

echo -e "  ${GREEN}✓${NC} Backend started (PID: $BACKEND_PID)"

# Wait for backend to be ready
echo -e "  Waiting for backend..."
for i in {1..15}; do
    if curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Backend is healthy"
        break
    fi
    if [ $i -eq 15 ]; then
        echo -e "${RED}Backend failed to start. Check logs/backend.log${NC}"
        exit 1
    fi
    sleep 1
done

# Start frontend
echo -e "${YELLOW}[4/5] Starting frontend...${NC}"
cd frontend

if [ "$MODE" = "prod" ]; then
    # Build and run production
    echo "  Building frontend..."
    npm run build > ../logs/frontend-build.log 2>&1
    PORT=3003 npm run start > ../logs/frontend.log 2>&1 &
else
    PORT=3003 npm run dev > ../logs/frontend.log 2>&1 &
fi
FRONTEND_PID=$!
cd ..

echo -e "  ${GREEN}✓${NC} Frontend started (PID: $FRONTEND_PID)"

# Save PIDs to file
echo "$BACKEND_PID" > logs/backend.pid
echo "$FRONTEND_PID" > logs/frontend.pid

# Start cloudflared tunnel
TUNNEL_URL=""
if [ "$TUNNEL_OK" = true ]; then
    echo -e "${YELLOW}[5/5] Starting cloudflare tunnel...${NC}"
    cloudflared tunnel --url http://localhost:3003 --no-autoupdate > logs/tunnel.log 2>&1 &
    TUNNEL_PID=$!
    echo "$TUNNEL_PID" > logs/tunnel.pid
    
    # Wait for tunnel to start and get URL
    sleep 5
    TUNNEL_URL=$(grep -o 'https://[^.]*\.trycloudflare\.com' logs/tunnel.log 2>/dev/null | head -1)
    
    if [ ! -z "$TUNNEL_URL" ]; then
        echo -e "  ${GREEN}✓${NC} Tunnel: ${CYAN}${TUNNEL_URL}${NC}"
    else
        echo -e "  ${YELLOW}!${NC} Tunnel started, check logs/tunnel.log for URL"
    fi
else
    echo -e "${YELLOW}[5/5] Skipping tunnel (cloudflared not installed)${NC}"
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        KV-Tube is running!            ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BLUE}Backend:${NC}  http://localhost:8080"
echo -e "  ${BLUE}Frontend:${NC} http://localhost:3003"
if [ ! -z "$TUNNEL_URL" ]; then
    echo -e "  ${CYAN}Public:${NC}   ${TUNNEL_URL}"
fi
echo ""
echo -e "  ${YELLOW}Logs:${NC}"
echo -e "    Backend:  logs/backend.log"
echo -e "    Frontend: logs/frontend.log"
if [ "$TUNNEL_OK" = true ]; then
    echo -e "    Tunnel:   logs/tunnel.log"
fi
echo ""
echo -e "  ${YELLOW}To stop:${NC} Ctrl+C or ./stop.sh"
echo ""

# Handle Ctrl+C gracefully
trap "echo ''; echo -e '${YELLOW}Stopping servers...${NC}'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; pkill -f cloudflared 2>/dev/null; rm -f logs/backend.pid logs/frontend.pid logs/tunnel.pid; echo -e '${GREEN}Stopped.${NC}'; exit 0" SIGINT SIGTERM

wait
