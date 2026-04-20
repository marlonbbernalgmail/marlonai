# marlonai-connector

Local Ollama connector for Marlon's portfolio chatbot.

## Architecture

```
marlonbbernal.com (Vercel) → /api/ask-me (Vercel function) → https://marlonai.aiautomated.uk/ask-me (this server) → Ollama
```

## Knowledge base — update these two files

### `data/profile-context.md`
**What the AI knows about Marlon.** This is the single source of truth the LLM reads before answering any question. Edit this to add or update: skills, projects, work experience, availability, contact details, education, certifications, or anything else visitors might ask about.

Structure inside the file:
- Identity & contact
- Professional summary
- Career timeline (reverse chronological, with company names and dates)
- Technical skills (grouped by category)
- Projects & products (name, description, stack)
- Applied AI work
- Engineering approach
- Availability & engagement types

### `prompts/system-prompt.md`
**How the AI behaves.** Controls tone, rules, what topics to answer, how to handle off-topic questions, and when to redirect to email. Only edit this if you want to change the assistant's personality or rules — not for adding factual information about yourself.

## Running the server

```bash
npm run dev       # development (ts-node, auto-reload)
npm run build     # compile TypeScript → dist/
npm start         # run compiled build (production)
```

The server reads both markdown files on every request — no restart needed after editing them.

## Environment variables

See `.env.example`. Key ones:

| Variable | Purpose |
|---|---|
| `OLLAMA_MODEL` | Which local model to use (e.g. `gemma4`, `llama3.2`) |
| `VERCEL_SHARED_API_KEY` | Must match `LOCAL_AI_API_KEY` in the Vercel portfolio project |
| `SYSTEM_PROMPT_FILE` | Path to system prompt (default: `prompts/system-prompt.md`) |
| `PROFILE_CONTEXT_FILE` | Path to knowledge base (default: `data/profile-context.md`) |

## Source layout

```
src/
  server.ts          — Express entry point, rate limiting, body limit
  routes/chat.ts     — POST /ask-me handler
  services/ollama.ts — Ollama API call, timeout, error mapping
  middleware/auth.ts — x-api-key + optional origin check
  utils/loadTextFile.ts — reads prompt/context files safely
data/
  profile-context.md — ← EDIT THIS to update the AI's knowledge about Marlon
prompts/
  system-prompt.md   — ← EDIT THIS to change the AI's behavior/rules
```
