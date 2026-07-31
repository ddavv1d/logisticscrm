#!/bin/bash
# Environment sanity check — run BEFORE writing any code.
# Confirms: 21st MCP bridge alive, key present, skills installed, tools available.
# Set PROJECT_DIR to your project's key in ~/.claude.json.
PROJECT_DIR="${PROJECT_DIR:-/Users/dato/Desktop/LogisticsCRM}"

echo "=== 1. 21st API key present in ~/.claude.json for this project? ==="
python3 -c "
import json,os,sys
d=json.load(open(os.path.expanduser('~/.claude.json')))
try:
    k=d['projects']['$PROJECT_DIR']['mcpServers']['21st']['headers']['x-api-key']
    print('OK — key present, length', len(k))
except Exception as e:
    print('MISSING — add the 21st mcpServers block (see 02_21ST_MCP_GUIDE.md):', e); sys.exit(1)
"

echo ""
echo "=== 2. 21st MCP bridge alive (tools/list)? ==="
KEY=$(python3 -c "import json,os; d=json.load(open(os.path.expanduser('~/.claude.json'))); print(d['projects']['$PROJECT_DIR']['mcpServers']['21st']['headers']['x-api-key'])" 2>/dev/null)
if [ -n "$KEY" ]; then
  curl -s -X POST https://21st.dev/api/mcp -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" -H "x-api-key: $KEY" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' --max-time 30 \
    | python3 -c "import sys,json; d=json.load(sys.stdin); t=[x['name'] for x in d.get('result',{}).get('tools',[])]; print('OK — tools:', ', '.join(t[:8]), '...' if len(t)>8 else '')" 2>&1 | head -1
fi

echo ""
echo "=== 3. skills installed (~/.claude/skills)? ==="
for s in taste-skill 21st-dev security-scan react-component; do
  if [ -d "$HOME/.claude/skills/$s" ]; then echo "OK  $s"; else echo "MISSING  $s"; fi
done

echo ""
echo "=== 4. tooling on PATH? ==="
for t in gitleaks node npm python3; do
  command -v "$t" >/dev/null 2>&1 && echo "OK  $t ($($t --version 2>&1 | head -1))" || echo "MISSING  $t"
done

echo ""
echo "=== 5. 21st tier (paid = unlimited get_component)? ==="
if [ -n "$KEY" ]; then
  curl -s -X POST https://21st.dev/api/mcp -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" -H "x-api-key: $KEY" \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_usage","arguments":{}}}' --max-time 30 \
    | python3 -c "
import sys,json
for ln in sys.stdin.read().splitlines():
    ln=ln.strip()
    if ln.startswith('data:'): ln=ln[5:].strip()
    if not ln: continue
    try:
        d=json.loads(ln); sc=d.get('result',{}).get('structuredContent') or {}
        print('tier:', sc.get('tier','?'))
    except: pass
" 2>&1 | head -1
fi
