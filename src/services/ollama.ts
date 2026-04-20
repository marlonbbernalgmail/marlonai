import { loadTextFile } from "../utils/loadTextFile";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";
const SYSTEM_PROMPT_FILE = process.env.SYSTEM_PROMPT_FILE ?? "prompts/system-prompt.md";
const PROFILE_CONTEXT_FILE = process.env.PROFILE_CONTEXT_FILE ?? "data/profile-context.md";
const REQUEST_TIMEOUT_MS = 60_000;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaChatResponse {
  message: { role: string; content: string };
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

export async function askOllama(
  message: string,
  history: ChatMessage[] = []
): Promise<string> {
  const systemContent = buildSystemContent();

  const messages: OllamaMessage[] = [
    { role: "system", content: systemContent },
    ...history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, messages, stream: false }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[ollama] Non-OK response: ${response.status} ${body}`);
      throw new OllamaError(`Ollama responded with status ${response.status}`, 502);
    }

    const data = (await response.json()) as OllamaChatResponse;
    return data.message.content;
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
