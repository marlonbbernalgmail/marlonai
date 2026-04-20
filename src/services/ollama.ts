import { loadTextFile } from "../utils/loadTextFile";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gemma4";
const SYSTEM_PROMPT_FILE = process.env.SYSTEM_PROMPT_FILE ?? "prompts/system-prompt.md";
const PROFILE_CONTEXT_FILE = process.env.PROFILE_CONTEXT_FILE ?? "data/profile-context.md";
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CONTENT_CHARS = 1_200;
const OLLAMA_TEMPERATURE = readNumberEnv("OLLAMA_TEMPERATURE", 0.2);
const OLLAMA_TOP_P = readNumberEnv("OLLAMA_TOP_P", 0.9);
const OLLAMA_REPEAT_PENALTY = readNumberEnv("OLLAMA_REPEAT_PENALTY", 1.08);
const OLLAMA_NUM_CTX = readOptionalNumberEnv("OLLAMA_NUM_CTX");

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaChatResponse {
  message?: { role?: string; content?: string };
}

export class OllamaError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "OllamaError";
  }
}

function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function readOptionalNumberEnv(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;

  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function buildSystemContent(): string {
  const systemPrompt = loadTextFile(
    SYSTEM_PROMPT_FILE,
    "You are a helpful portfolio assistant."
  );
  const profileContext = loadTextFile(PROFILE_CONTEXT_FILE, "");

  return profileContext
    ? `${systemPrompt}\n\n---\n\n## Profile Context\n\n${profileContext}`
    : systemPrompt;
}

function truncateHistoryContent(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= MAX_HISTORY_CONTENT_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_HISTORY_CONTENT_CHARS)}...`;
}

function buildHistoryMessages(history: ChatMessage[]): OllamaMessage[] {
  return history
    .slice(-MAX_HISTORY_MESSAGES)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role,
      content: truncateHistoryContent(m.content),
    }))
    .filter((m) => m.content.length > 0);
}

function buildUserContent(message: string): string {
  return [
    "Visitor question:",
    message,
    "",
    "Answer only if this is a job-interview or professional-evaluation question about Marlon. Use first person as Marlon's public professional profile. Follow the system rules and use only the provided professional profile.",
  ].join("\n");
}

function buildOllamaOptions(): Record<string, number> {
  const options: Record<string, number> = {
    temperature: OLLAMA_TEMPERATURE,
    top_p: OLLAMA_TOP_P,
    repeat_penalty: OLLAMA_REPEAT_PENALTY,
  };

  if (OLLAMA_NUM_CTX !== undefined) {
    options.num_ctx = OLLAMA_NUM_CTX;
  }

  return options;
}

export async function askOllama(
  message: string,
  history: ChatMessage[] = []
): Promise<string> {
  const systemContent = buildSystemContent();

  const messages: OllamaMessage[] = [
    { role: "system", content: systemContent },
    ...buildHistoryMessages(history),
    { role: "user", content: buildUserContent(message) },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        options: buildOllamaOptions(),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[ollama] Non-OK response: ${response.status} ${body}`);
      throw new OllamaError(`Ollama responded with status ${response.status}`, 502);
    }

    const data = (await response.json()) as OllamaChatResponse;
    const content = data.message?.content?.trim();
    if (!content) {
      console.error("[ollama] Empty response body:", data);
      throw new OllamaError("Ollama returned an empty response", 502);
    }

    return content;
  } catch (err) {
    if (err instanceof OllamaError) throw err;

    const error = err as Error;
    if (error.name === "AbortError") {
      console.error("[ollama] Request timed out");
      throw new OllamaError("Ollama request timed out", 504);
    }

    console.error("[ollama] Connection error:", error.message);
    throw new OllamaError("Ollama is unavailable", 503);
  } finally {
    clearTimeout(timeout);
  }
}
