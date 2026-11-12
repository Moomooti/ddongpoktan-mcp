#!/usr/bin/env bash
# Boots the built server and makes the same HTTP calls PlayMCP makes:
# health check, MCP tools/list, one tools/call, and fetching the image URL it returns.
# No X-Forwarded-Proto header on purpose: image URLs must work without a proxy too.
set -euo pipefail

PORT="${PORT:-3999}"
export PORT DB_PATH="$(mktemp -d)/smoke.db"
node dist/index.js > /tmp/smoke-server.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  curl -sf "http://localhost:$PORT/health" > /dev/null && break
  sleep 0.2
done

mcp() {
  curl -sf "http://localhost:$PORT/mcp" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -d "$1"
}

TOOLS=$(mcp '{"jsonrpc":"2.0","id":1,"method":"tools/list"}')
COUNT=$(echo "$TOOLS" | grep -o '"name":"[a-z_]*"' | sort -u | wc -l)
echo "tools/list -> $COUNT tools"
[ "$COUNT" -eq 8 ] || { echo "expected 8 tools"; exit 1; }

CALL=$(mcp '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"check_status","arguments":{"room_code":"smoke","nickname":"ci"}}}')
URL=$(echo "$CALL" | grep -o "http://localhost:$PORT/assets/[^\\\" ]*" | head -1)
echo "check_status image -> $URL"
[ -n "$URL" ] || { echo "no image URL in response"; exit 1; }
curl -sf -o /dev/null "$URL" || { echo "image URL is not served"; exit 1; }

echo "smoke test passed"
