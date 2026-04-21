import "dotenv/config";
import type { Server } from "http";
import { createApp } from "./app";
import { initDb } from "./services/db";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

export async function startServer(port = PORT): Promise<Server> {
  const app = createApp();

  try {
    await initDb();
    return app.listen(port, () => {
      console.log(`[server] Ollama connector listening on port ${port}`);
    });
  } catch (err) {
    console.error("[db] Failed to initialize — check MYSQL_* env vars:", (err as Error).message);
    // Optionally: decide if we still start the server if DB fails.
    // For now we'll start it anyway to avoid downtime.
    return app.listen(port, () => {
      console.log(`[server] Ollama connector listening on port ${port} (warning: DB failed)`);
    });
  }
}

if (require.main === module) {
  void startServer();
}
