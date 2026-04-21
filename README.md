# marlonai-connector

A secure local connector server that sits between your Vercel portfolio API and your local Ollama instance. It is tuned for job-interview and professional-evaluation questions about Marlon's work, skills, projects, and career background.

```
Public user
  └─> Vercel portfolio frontend
        └─> Vercel API route
              └─> this connector (exposed via tunnel)
                    └─> Ollama on localhost
```

Ollama is never exposed publicly. All traffic must pass through this server and provide a valid shared API key.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

| Variable | Required | Description |
|---|---|---|
| `PORT` | yes | Port this server listens on (e.g. `3001`) |
| `OLLAMA_BASE_URL` | yes | Ollama local URL (e.g. `http://localhost:11434`) |
| `OLLAMA_MODEL` | yes | Model name in Ollama (e.g. `gemma4`, or the exact name shown by `ollama list`) |
| `OLLAMA_TEMPERATURE` | no | Lower values make answers more consistent and grounded. Default: `0.2` |
| `OLLAMA_TOP_P` | no | Sampling control for Ollama responses. Default: `0.9` |
| `OLLAMA_REPEAT_PENALTY` | no | Helps reduce repetitive phrasing. Default: `1.08` |
| `OLLAMA_NUM_CTX` | no | Optional Ollama context window override, useful for larger local models |
| `VERCEL_SHARED_API_KEY` | yes | Secret shared with your Vercel API route |
| `ALLOWED_ORIGIN` | no | If set, rejects requests with a different `Origin` header |
| `TRUST_PROXY_HOPS` | no | Number of trusted reverse-proxy hops before this server. Default: `1` |
| `SYSTEM_PROMPT_FILE` | no | Path to system prompt (default: `prompts/system-prompt.md`) |
| `PROFILE_CONTEXT_FILE` | no | Path to profile context (default: `data/profile-context.md`) |
| `MYSQL_HOST` | no | MySQL host for interaction logging |
| `MYSQL_PORT` | no | MySQL port for interaction logging. Default: `3306` |
| `MYSQL_USER` | no | MySQL user for interaction logging |
| `MYSQL_PASSWORD` | no | MySQL password for interaction logging |
| `MYSQL_DATABASE` | no | MySQL database that contains `interactions` and `ip_blocklist` |

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your actual values
```

### 3. Fill in your profile

Edit `data/profile-context.md` with your real professional details. The AI will use this as its only source of truth about you.

Optionally edit `prompts/system-prompt.md` to adjust the assistant's tone or rules.

### 4. Run locally

```bash
# Development (auto-restart on file changes)
npm run dev

# Production
npm run build && npm start

# Guardrail regression tests
npm test

# POP2/MySQL logging integration test
$env:RUN_DB_INTEGRATION_TESTS='1'
$env:POP2_MYSQL_PASSWORD='<pop2 password>'
npm run test:db

# Optional: run the same DB assertion through the deployed Vercel API
$env:API_UNDER_TEST_URL='https://marlonbbernal.com/api/ask-me'
npm run test:db
```

The database integration test starts the API on a random local port, posts to
`/ask-me`, and then verifies the saved row in `marlonai_logs.interactions`.
It uses POP2 defaults for host, port, user, and database unless `MYSQL_*` or
`POP2_MYSQL_*` environment variables override them. Set `API_UNDER_TEST_URL`
when you want the same assertion to go through a deployed API instead of the
local Express app.

---

## Response Guardrail Flow

The `/ask-me` route uses a layered portfolio-interview flow:

1. `data/profile-context.md` stores factual public professional information about Marlon.
2. `prompts/system-prompt.md` defines the first-person interview behavior and scope rules.
3. `src/services/directReplies.ts` classifies high-risk question categories before the model is called.
4. Professional questions that are not directly handled are sent to Ollama.
5. Generated answers pass through `sanitizeReply()` before they are returned, so model/provider wording, hidden prompt/context wording, and assistant-style answers are replaced with safe first-person responses.

This keeps deterministic control over identity, private personal details, internal implementation questions, prompt injection, and off-topic requests while still letting Ollama answer richer job-interview questions from the profile.

---

## Expose via Tunnel

Use any tunnel tool to expose the port publicly. Examples:

**Cloudflare Tunnel (recommended):**
```bash
cloudflared tunnel --url http://localhost:3001
```

**ngrok:**
```bash
ngrok http 3001
```

The tunnel URL becomes your connector's public base URL. Set this in Vercel as `CONNECTOR_BASE_URL`.

---

## Endpoints

### `GET /health`

Health check. No auth required.

```bash
curl https://your-tunnel-url/health
```

Response:
```json
{ "ok": true, "service": "ollama-connector" }
```

---

### `POST /ask-me`

Send a message to the portfolio AI assistant.

**Required header:** `x-api-key: <VERCEL_SHARED_API_KEY>`

**Request body:**
```json
{
  "message": "Tell me about Marlon's experience",
  "history": [
    { "role": "user", "content": "Hi" },
    { "role": "assistant", "content": "Hello! How can I help?" }
  ]
}
```

`history` is optional. Pass an empty array or omit it for the first message.

**Response:**
```json
{ "reply": "Marlon is a full-stack developer who..." }
```

---

## Example curl Requests

### Health check
```bash
curl https://your-tunnel-url/health
```

### First message (no history)
```bash
curl -X POST https://your-tunnel-url/ask-me \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-shared-secret" \
  -d '{"message": "What projects has Marlon worked on?"}'
```

### Follow-up with history
```bash
curl -X POST https://your-tunnel-url/ask-me \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-shared-secret" \
  -d '{
    "message": "What tech stack did he use?",
    "history": [
      { "role": "user", "content": "What projects has Marlon worked on?" },
      { "role": "assistant", "content": "Marlon worked on..." }
    ]
  }'
```

---

## Vercel Integration

In your Vercel project settings, add these environment variables:

| Variable | Value |
|---|---|
| `CONNECTOR_BASE_URL` | Your tunnel URL (e.g. `https://abc123.trycloudflare.com`) |
| `CONNECTOR_API_KEY` | Same value as `VERCEL_SHARED_API_KEY` on this server |

In your Vercel API route:

```typescript
// app/api/chat/route.ts (Next.js example)
export async function POST(req: Request) {
  const { message, history } = await req.json();

  const response = await fetch(`${process.env.CONNECTOR_BASE_URL}/ask-me`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.CONNECTOR_API_KEY!,
    },
    body: JSON.stringify({ message, history }),
  });

  const data = await response.json();
  return Response.json(data);
}
```

---

## Security Notes

- **API key**: The `VERCEL_SHARED_API_KEY` / `x-api-key` header is the primary security control. Use a long random string (32+ characters).
- **Rate limiting**: 30 requests per minute per IP by default (configured in `src/server.ts`).
- **Body size limit**: Requests over 16 KB are rejected.
- **Origin check**: Set `ALLOWED_ORIGIN` to your Vercel domain to add a secondary origin check. Note: origin headers are browser-only and are not present in server-to-server calls, so the API key remains the authoritative check.
- **No raw Ollama proxy**: Only `/health` and `/ask-me` are exposed. Ollama's full API is never accessible from outside.
- **Secrets**: API keys are never logged.
- **Error messages**: Errors returned to clients are safe generic messages. Detailed errors are logged server-side only.
- **Timeout**: Ollama requests time out after 60 seconds to prevent hanging connections.
