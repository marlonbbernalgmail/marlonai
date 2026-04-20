import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import { ipBlockMiddleware, extractClientIp } from "../middleware/ipBlock";
import { askOllama, OllamaError, ChatMessage } from "../services/ollama";
import { getDirectReply, sanitizeReply } from "../services/directReplies";
import { logInteraction } from "../services/db";

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

router.post("/ask-me", ipBlockMiddleware, authMiddleware, async (req: Request, res: Response): Promise<void> => {
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

  const clientIp    = extractClientIp(req);
  const userAgent   = req.headers["user-agent"] ?? undefined;
  const referer     = (req.headers["referer"] ?? req.headers["referrer"] ?? undefined) as string | undefined;
  const fwdIps      = req.headers["x-forwarded-for"] ? String(req.headers["x-forwarded-for"]) : undefined;
  const startTime   = Date.now();

  try {
    const trimmedMessage = message.trim();
    const requestHistory = history ?? [];
    const directReply = getDirectReply(trimmedMessage, requestHistory);
    const reply =
      directReply ??
      sanitizeReply(trimmedMessage, await askOllama(trimmedMessage, requestHistory), requestHistory);
    const response_ms = Date.now() - startTime;

    logInteraction({
      question: trimmedMessage,
      answer: reply,
      ip_address: clientIp,
      forwarded_ips: fwdIps,
      user_agent: userAgent,
      referer,
      response_ms,
      status: "success",
    });

    res.json({ reply });
  } catch (err) {
    const response_ms = Date.now() - startTime;
    let errorMsg = "Internal server error";
    let statusCode = 500;

    if (err instanceof OllamaError) {
      console.error(`[chat] OllamaError (${err.status}): ${err.message}`);
      errorMsg = err.message;
      statusCode = err.status;
    } else {
      console.error("[chat] Unexpected error:", err);
    }

    logInteraction({
      question: message.trim(),
      answer: `ERROR: ${errorMsg}`,
      ip_address: clientIp,
      forwarded_ips: fwdIps,
      user_agent: userAgent,
      referer,
      response_ms,
      status: "error",
    });

    res.status(statusCode).json({ error: errorMsg });
  }
});

export default router;
