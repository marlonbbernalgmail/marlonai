import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import chatRouter from "./routes/chat";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);

app.use(express.json({ limit: "16kb" }));

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

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`[server] Ollama connector listening on port ${PORT}`);
});
