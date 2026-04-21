const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const shouldRun = process.env.RUN_DB_INTEGRATION_TESTS === "1";

function configureEnvironment() {
  process.env.VERCEL_SHARED_API_KEY ||= "db-logging-test-key";
  process.env.ADMIN_PASSWORD ||= "db-logging-test-admin";
  process.env.OLLAMA_MODEL ||= "db-logging-test";

  process.env.MYSQL_HOST ||= process.env.POP2_MYSQL_HOST || "192.168.18.5";
  process.env.MYSQL_PORT ||= process.env.POP2_MYSQL_PORT || "3308";
  process.env.MYSQL_USER ||= process.env.POP2_MYSQL_USER || "root";
  process.env.MYSQL_DATABASE ||= process.env.POP2_MYSQL_DATABASE || "marlonai_logs";
  process.env.MYSQL_PASSWORD ||= process.env.POP2_MYSQL_PASSWORD;

  assert.ok(
    process.env.MYSQL_PASSWORD,
    "Set MYSQL_PASSWORD or POP2_MYSQL_PASSWORD before running RUN_DB_INTEGRATION_TESTS=1 npm run test:db"
  );
}

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

test(
  "POST /ask-me saves the question and answer to MySQL",
  shouldRun ? {} : { skip: "Set RUN_DB_INTEGRATION_TESTS=1 to run the POP2 database integration test" },
  async () => {
    configureEnvironment();

    const { createApp } = require("../dist/app");
    const { closeDb, getPool, initDb } = require("../dist/services/db");

    await initDb();

    const externalApiUrl = process.env.API_UNDER_TEST_URL;
    let server;

    try {
      let apiUrl = externalApiUrl;

      if (!apiUrl) {
        const app = createApp();
        server = await listen(app);
        const address = server.address();
        const port = typeof address === "object" && address ? address.port : undefined;

        assert.ok(port, "test server did not expose a port");
        apiUrl = `http://127.0.0.1:${port}/ask-me`;
      }

      const marker = `tdd-db-log-${randomUUID()}`;
      const question = `${marker} what is your name?`;
      const referer = `https://test.local/${marker}`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.VERCEL_SHARED_API_KEY,
          "user-agent": `marlonai-db-logging-test/${marker}`,
          "referer": referer,
          "x-forwarded-for": "203.0.113.42",
        },
        body: JSON.stringify({
          message: question,
          history: [],
        }),
      });

      const body = await response.json();

      assert.equal(response.status, 200);

      const [rows] = await getPool().execute(
        `SELECT question, answer, ip_address, forwarded_ips, user_agent, referer, model, status, accuracy
           FROM interactions
          WHERE question = ?
          ORDER BY id DESC
          LIMIT 1`,
        [question]
      );

      assert.equal(rows.length, 1, `Expected one interactions row for ${marker}`);
      assert.equal(body.reply, "My name is Marlon B. Bernal.");
      assert.equal(rows[0].question, question);
      assert.equal(rows[0].answer, "My name is Marlon B. Bernal.");
      if (!externalApiUrl) {
        assert.equal(rows[0].ip_address, "203.0.113.42");
        assert.equal(rows[0].forwarded_ips, "203.0.113.42");
        assert.equal(rows[0].referer, referer);
        assert.equal(rows[0].model, "db-logging-test");
      }
      assert.equal(rows[0].status, "success");
      assert.equal(rows[0].accuracy, "unreviewed");
    } finally {
      if (server) await closeServer(server);
      await closeDb();
    }
  }
);
