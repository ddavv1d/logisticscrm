#!/bin/bash
# 21st.dev search — metadata only (FREE, unlimited). Prints id/name/description.
# Usage: s21.sh "<query>" [component|theme|template|all] [limit]
# Set PROJECT_DIR to your project's key in ~/.claude.json (where the 21st MCP config lives).
PROJECT_DIR="${PROJECT_DIR:-/Users/dato/Desktop/LogisticsCRM}"

KEY=$(python3 -c "import json,os; d=json.load(open(os.path.expanduser('~/.claude.json'))); print(d['projects']['$PROJECT_DIR']['mcpServers']['21st']['headers']['x-api-key'])")
Q="$1"; TYPE="${2:-component}"; LIM="${3:-8}"

curl -s -X POST https://21st.dev/api/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -H "x-api-key: $KEY" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"search\",\"arguments\":{\"query\":\"$Q\",\"type\":\"$TYPE\",\"limit\":$LIM}}}" \
  --max-time 40 2>/dev/null | python3 -c "
import sys,json
raw=sys.stdin.read()
try: d=json.loads(raw)
except:
    d={}
    for ln in raw.splitlines():
        ln=ln.strip()
        if ln.startswith('data:'):
            try: d=json.loads(ln[5:].strip())
            except: pass
r=d.get('result',{}); sc=r.get('structuredContent') or {}
for it in (sc.get('results') or []):
    print('id=%-6s [%s] %-34s | %s' % (it.get('id'), it.get('type'), (it.get('name') or '')[:34], (it.get('description') or '')[:66]))
    if it.get('previewUrl'): print('        preview:', it['previewUrl'])
"
