#!/bin/bash

cd "$(dirname "$0")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Stopping KV-Tube...${NC}"

# Kill by PID files
if [ -f logs/backend.pid ]; then
    kill $(cat logs/backend.pid) 2>/dev/null
    rm -f logs/backend.pid
    echo -e "  ${GREEN}✓${NC} Backend stopped"
fi

if [ -f logs/frontend.pid ]; then
    kill $(cat logs/frontend.pid) 2>/dev/null
    rm -f logs/frontend.pid
    echo -e "  ${GREEN}✓${NC} Frontend stopped"
fi

if [ -f logs/tunnel.pid ]; then
    kill $(cat logs/tunnel.pid) 2>/dev/null
    rm -f logs/tunnel.pid
    echo -e "  ${GREEN}✓${NC} Tunnel stopped"
fi

# Kill any remaining processes
pkill -f "kvtube-go" 2>/dev/null
pkill -f "backend/bin/kv-tube" 2>/dev/null
pkill -f "next dev" 2>/dev/null
pkill -f "next start" 2>/dev/null
pkill -f "cloudflared" 2>/dev/null
pkill -f "ngrok" 2>/dev/null

# Kill processes on ports
fkill() {
    local port=$1
    local pid=$(lsof -t -i:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        kill -9 $pid 2>/dev/null
    fi
}

fkill 8080
fkill 3003

echo -e "${GREEN}KV-Tube stopped.${NC}"
