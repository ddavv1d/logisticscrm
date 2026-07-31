#!/bin/bash
# 21st.dev get_component — full component CODE + demo + install (PAID; unlimited on paid tier).
# Usage: get21.sh <demo_id>   (id comes from s21.sh search results)
# Set PROJECT_DIR to your project's key in ~/.claude.json.
PROJECT_DIR="${PROJECT_DIR:-/Users/dato/Desktop/LogisticsCRM}"

KEY=$(python3 -c "import json,os; d=json.load(open(os.path.expanduser('~/.claude.json'))); print(d['projects']['$PROJECT_DIR']['mcpServers']['21st']['headers']['x-api-key'])")
ID="$1"

curl -s -X POST https://21st.dev/api/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -H "x-api-key: $KEY" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"get_component\",\"arguments\":{\"id\":$ID}}}" \
  --max-time 60 2>/dev/null | python3 -c "
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
if sc.get('locked'): print('LOCKED (paywall) — check get_usage'); sys.exit()
if sc.get('found') is False: print('NOT FOUND'); sys.exit()
for c in r.get('content',[]):
    if c.get('type')=='text': print(c['text'])
"
