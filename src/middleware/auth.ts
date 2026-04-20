import { Request, Response, NextFunction } from "express";

const API_KEY = process.env.VERCEL_SHARED_API_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!API_KEY) {
    console.error("[auth] VERCEL_SHARED_API_KEY is not configured");
    res.status(500).json({ error: "Server misconfiguration" });
    return;
  }

  const providedKey = req.headers["x-api-key"];
  if (!providedKey || providedKey !== API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Origin check is optional: only enforced when ALLOWED_ORIGIN is set and
  // the request includes an Origin header (browser or explicit header).
  if (ALLOWED_ORIGIN) {
    const origin = req.headers["origin"];
    if (origin && origin !== ALLOWED_ORIGIN) {
      console.warn(`[auth] Rejected origin: ${origin}`);
      res.status(403).json({ error: "Forbidden origin" });
      return;
    }
  }

  next();
}
