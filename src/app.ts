import express from "express";
import rateLimit from "express-rate-limit";
import chatRouter from "./routes/chat";
import adminRouter from "./routes/admin";

function readTrustProxyHops(): number {
  const raw = process.env.TRUST_PROXY_HOPS ?? "1";
  const hops = Number(raw);
  return Number.isInteger(hops) && hops >= 0 ? hops : 1;
}

export function createApp() {
  const app = express();

  app.set("trust proxy", readTrustProxyHops());

  app.use(express.json({ limit: "16kb" }));
  app.use(express.urlencoded({ extended: false }));

  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Too many requests — please slow down" },
    })
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "ollama-connector" });
  });

  app.use("/", chatRouter);
  app.use("/admin", adminRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}
