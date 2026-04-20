import { Request, Response, NextFunction } from "express";
import { isIpBlocked } from "../services/db";

export function extractClientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) {
    const first = (Array.isArray(fwd) ? fwd[0] : fwd).split(",")[0].trim();
    if (first) return first;
  }
  const real = req.headers["x-real-ip"];
  if (real) return Array.isArray(real) ? real[0] : real;
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

export async function ipBlockMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const ip = extractClientIp(req);
  if (await isIpBlocked(ip)) {
    console.warn(`[ipBlock] Blocked request from ${ip}`);
    res.status(403).json({ error: "Access denied" });
    return;
  }
  next();
}
