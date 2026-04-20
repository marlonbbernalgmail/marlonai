import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import { askOllama, OllamaError, ChatMessage } from "../services/ollama";

const router = Router();

function isValidHistory(history: unknown): history is ChatMessage[] {
  if (!Array.isArray(history)) return false;
  return history.every(
    (m) =>
      typeof m === "object" &&
      m !== null &&
      ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
      typeof (m as ChatMessage).content === "string"
  );
}

router.post("/ask-me", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { message, history } = req.body as { message: unknown; history: unknown };

  if (!message || typeof message !== "string" || message.trim() === "") {
    res.status(400).json({ error: "message is required and must be a non-empty string" });
    return;
  }

  if (history !== undefined && !isValidHistory(history)) {
    res.status(400).json({
      error: "history must be an array of { role: 'user'|'assistant', content: string }",
    });
    return;
  }

  try {
    const reply = await askOllama(message.trim(), history ?? []);
    res.json({ reply });
  } catch (err) {
    if (err instanceof OllamaError) {
      console.error(`[chat] OllamaError (${err.status}): ${err.message}`);
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("[chat] Unexpected error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
