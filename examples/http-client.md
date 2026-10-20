# Connecting over Streamable HTTP

The hosted endpoint is **stateless JSON-RPC** — every request is self-contained, no
session header, no API key:

```
https://atlas.marsaplatform.com/mcp
```

Locally, `bun run dev:worker` serves the same Worker on `http://localhost:8787/mcp`
(and `bun run dev:http` serves the web/REST service on `:3000`, with MCP when
`ATLAS_HTTP_MCP=1`).

## curl

```bash
MCP=https://atlas.marsaplatform.com/mcp
H=(-H 'content-type: application/json' -H 'accept: application/json, text/event-stream')

# initialize
curl -s "${H[@]}" $MCP -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{
  "protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'

# list the 21 tools
curl -s "${H[@]}" $MCP -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | jq '.result.tools[].name'

# Arabic place + English need
curl -s "${H[@]}" $MCP -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{
  "name":"find_services","arguments":{"need":"mental health","governorate":"القاهرة"}}}' \
  | jq '.result.structuredContent | {resolved, titles: [.items[].title], sources: [.sources[].url]}'

# referral sheet in English
curl -s "${H[@]}" $MCP -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{
  "name":"build_referral_sheet","arguments":{"need":"دعم نفسي","governorate":"Cairo","nationality":"Sudanese","locale":"en"}}}' \
  | jq -r '.result.structuredContent.markdown'
```

## TypeScript SDK

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({ name: "my-agent", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL("https://atlas.marsaplatform.com/mcp")));

const result = await client.callTool({
  name: "resolve_place",
  arguments: { query: "6 أكتوبر" },
});
console.log(result.structuredContent); // { best: { code: "EG-GZ", ar: "الجيزة", en: "Giza", … }, sources: [...] }
```

## Python

```python
import requests
MCP = "https://atlas.marsaplatform.com/mcp"
H = {"content-type": "application/json", "accept": "application/json, text/event-stream"}
r = requests.post(MCP, headers=H, json={"jsonrpc": "2.0", "id": 1, "method": "tools/call",
    "params": {"name": "export_records", "arguments": {"format": "csv", "type": "service"}}})
print(r.json()["result"]["structuredContent"]["content"])
```
