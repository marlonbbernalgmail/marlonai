import { Router, Request, Response, NextFunction } from "express";
import {
  getStats,
  getInteractions,
  getBlocklist,
  getIpStats,
  blockIp,
  unblockIp,
  updateAccuracy,
} from "../services/db";

const router = Router();

// ── Basic Auth ───────────────────────────────────────────────────────────────

function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) {
    res.status(500).send("ADMIN_PASSWORD not set");
    return;
  }
  const auth = req.headers.authorization ?? "";
  if (auth.startsWith("Basic ")) {
    const decoded = Buffer.from(auth.slice(6), "base64").toString();
    const colon = decoded.indexOf(":");
    const user = decoded.slice(0, colon);
    const pass = decoded.slice(colon + 1);
    if (user === "admin" && pass === pw) {
      next();
      return;
    }
  }
  res.set("WWW-Authenticate", 'Basic realm="Marlon AI Admin"');
  res.status(401).send("Authentication required");
}

router.use(adminAuth);

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function trunc(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function fmtDate(d: Date | string): string {
  return new Date(d).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function accuracyBadge(v: string): string {
  if (v === "accurate")   return `<span class="badge bg-success">Accurate</span>`;
  if (v === "inaccurate") return `<span class="badge bg-danger">Inaccurate</span>`;
  return `<span class="badge bg-secondary">Unreviewed</span>`;
}

// ── Dashboard ────────────────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const page       = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const filterIp   = (req.query.ip   as string) || "";
    const filterFlag = (req.query.flag as string) || "";
    const perPage    = 25;

    const [stats, { rows, total }, blocklist, ipStats] = await Promise.all([
      getStats(),
      getInteractions(page, perPage, filterIp || undefined, filterFlag || undefined),
      getBlocklist(),
      getIpStats(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const qstr = `ip=${esc(filterIp)}&flag=${esc(filterFlag)}`;

    // Pagination
    const pagLinks = (() => {
      const start = Math.max(1, page - 4);
      const end   = Math.min(totalPages, start + 9);
      let html = "";
      for (let p = start; p <= end; p++) {
        html += `<li class="page-item ${p === page ? "active" : ""}">
          <a class="page-link" href="?${qstr}&page=${p}">${p}</a></li>`;
      }
      return html;
    })();

    // Interaction rows
    const interactionRows = rows.map((r) => `
      <tr>
        <td class="text-nowrap small">${esc(fmtDate(r.created_at))}</td>
        <td>
          <code class="small">${esc(r.ip_address)}</code>
          ${r.forwarded_ips ? `<br><small class="text-muted">${esc(trunc(r.forwarded_ips, 50))}</small>` : ""}
        </td>
        <td class="small text-muted" style="max-width:160px;overflow:hidden;word-break:break-all">${esc(trunc(r.user_agent, 80))}</td>
        <td style="max-width:400px">
          <div class="mb-1"><span class="fw-semibold">Q:</span> ${esc(trunc(r.question, 150))}</div>
          <div class="text-muted small"><span class="fw-semibold">A:</span> ${esc(trunc(r.answer, 250))}</div>
          ${r.notes ? `<div class="text-info small mt-1">Note: ${esc(r.notes)}</div>` : ""}
        </td>
        <td class="text-center small">${r.response_ms != null ? `${r.response_ms}ms` : "—"}</td>
        <td class="text-center">${r.status === "error" ? '<span class="badge bg-danger">Error</span>' : ""}</td>
        <td class="text-center">${accuracyBadge(r.accuracy)}</td>
        <td>
          <div class="d-flex flex-column gap-1" style="min-width:130px">
            <form method="POST" action="/admin/flag">
              <input type="hidden" name="id" value="${r.id}">
              <input type="hidden" name="back" value="?${qstr}&page=${page}">
              <select name="flag" class="form-select form-select-sm" onchange="this.form.submit()">
                <option value="unreviewed" ${r.accuracy === "unreviewed" ? "selected" : ""}>Unreviewed</option>
                <option value="accurate"   ${r.accuracy === "accurate"   ? "selected" : ""}>Accurate</option>
                <option value="inaccurate" ${r.accuracy === "inaccurate" ? "selected" : ""}>Inaccurate</option>
              </select>
            </form>
            <a href="/admin?ip=${esc(r.ip_address)}" class="btn btn-outline-secondary btn-sm">Filter IP</a>
            <form method="POST" action="/admin/block">
              <input type="hidden" name="ip"     value="${esc(r.ip_address)}">
              <input type="hidden" name="reason" value="Flagged from #${r.id}">
              <input type="hidden" name="back"   value="?${qstr}&page=${page}">
              <button class="btn btn-outline-danger btn-sm w-100" type="submit">Block IP</button>
            </form>
          </div>
        </td>
      </tr>`).join("");

    // Blocklist rows
    const blocklistRows = blocklist.map((b) => `
      <tr>
        <td><code>${esc(b.ip_address)}</code></td>
        <td class="small">${esc(b.reason || "—")}</td>
        <td class="small text-muted text-nowrap">${esc(fmtDate(b.blocked_at))}</td>
        <td>
          <form method="POST" action="/admin/unblock">
            <input type="hidden" name="ip"   value="${esc(b.ip_address)}">
            <input type="hidden" name="back" value="/admin#ips">
            <button class="btn btn-sm btn-outline-success">Unblock</button>
          </form>
        </td>
      </tr>`).join("");

    // IP stats rows
    const ipStatsRows = ipStats.map((r) => `
      <tr class="${r.is_blocked ? "table-danger" : ""}">
        <td><code>${esc(r.ip_address)}</code></td>
        <td><strong>${r.request_count}</strong></td>
        <td class="small text-muted text-nowrap">${esc(fmtDate(r.last_seen))}</td>
        <td>${r.is_blocked
          ? '<span class="badge bg-danger">Blocked</span>'
          : '<span class="badge bg-secondary">Active</span>'}</td>
        <td class="d-flex gap-1">
          <a href="/admin?ip=${esc(r.ip_address)}" class="btn btn-sm btn-outline-secondary">View</a>
          ${r.is_blocked
            ? `<form method="POST" action="/admin/unblock">
                <input type="hidden" name="ip" value="${esc(r.ip_address)}">
                <input type="hidden" name="back" value="/admin#ips">
                <button class="btn btn-sm btn-outline-success">Unblock</button>
               </form>`
            : `<form method="POST" action="/admin/block">
                <input type="hidden" name="ip" value="${esc(r.ip_address)}">
                <input type="hidden" name="back" value="/admin#ips">
                <button class="btn btn-sm btn-outline-danger">Block</button>
               </form>`}
        </td>
      </tr>`).join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Marlon AI — Admin</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <style>
    body { background:#f5f6fa; font-size:0.9rem; }
    .stat-card { border:none; border-radius:14px; }
    .table th { font-size:.75rem; text-transform:uppercase; letter-spacing:.05em; color:#6c757d; font-weight:600; }
    .table td { vertical-align:middle; }
    .navbar-brand { font-weight:800; letter-spacing:-.5px; }
    code { background:#e9ecef; padding:1px 4px; border-radius:4px; font-size:.85em; }
  </style>
</head>
<body>

<nav class="navbar navbar-dark bg-dark mb-4 px-4">
  <span class="navbar-brand">Marlon AI Admin</span>
  <span class="navbar-text text-muted small">Portfolio Chatbot Monitor</span>
</nav>

<div class="container-fluid px-4">

  <!-- Stats -->
  <div class="row g-3 mb-4">
    <div class="col-6 col-sm-4 col-md-2">
      <div class="card stat-card shadow-sm text-center py-3">
        <div class="fs-2 fw-bold text-primary">${stats.total}</div>
        <div class="small text-muted">Total Queries</div>
      </div>
    </div>
    <div class="col-6 col-sm-4 col-md-2">
      <div class="card stat-card shadow-sm text-center py-3">
        <div class="fs-2 fw-bold text-info">${stats.today}</div>
        <div class="small text-muted">Today</div>
      </div>
    </div>
    <div class="col-6 col-sm-4 col-md-2">
      <div class="card stat-card shadow-sm text-center py-3">
        <div class="fs-2 fw-bold text-secondary">${stats.unique_ips}</div>
        <div class="small text-muted">Unique IPs</div>
      </div>
    </div>
    <div class="col-6 col-sm-4 col-md-2">
      <div class="card stat-card shadow-sm text-center py-3">
        <div class="fs-2 fw-bold text-danger">${stats.blocked_ips}</div>
        <div class="small text-muted">Blocked IPs</div>
      </div>
    </div>
    <div class="col-6 col-sm-4 col-md-2">
      <div class="card stat-card shadow-sm text-center py-3">
        <div class="fs-2 fw-bold text-warning">${stats.unreviewed}</div>
        <div class="small text-muted">Pending Review</div>
      </div>
    </div>
  </div>

  <!-- Tabs -->
  <ul class="nav nav-tabs mb-3" id="mainTabs" role="tablist">
    <li class="nav-item">
      <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-interactions">
        Interactions <span class="badge bg-primary ms-1">${total}</span>
      </button>
    </li>
    <li class="nav-item">
      <button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-ips">
        IP Management <span class="badge bg-danger ms-1">${stats.blocked_ips}</span>
      </button>
    </li>
  </ul>

  <div class="tab-content">

    <!-- Interactions Tab -->
    <div class="tab-pane fade show active" id="tab-interactions">

      <div class="card shadow-sm mb-3">
        <div class="card-body py-2">
          <form method="GET" class="row g-2 align-items-center">
            <div class="col-auto">
              <input type="text" name="ip" class="form-control form-control-sm" placeholder="Filter by IP" value="${esc(filterIp)}">
            </div>
            <div class="col-auto">
              <select name="flag" class="form-select form-select-sm">
                <option value=""            ${!filterFlag                    ? "selected" : ""}>All accuracy</option>
                <option value="unreviewed"  ${filterFlag === "unreviewed"    ? "selected" : ""}>Unreviewed</option>
                <option value="accurate"    ${filterFlag === "accurate"      ? "selected" : ""}>Accurate</option>
                <option value="inaccurate"  ${filterFlag === "inaccurate"    ? "selected" : ""}>Inaccurate</option>
              </select>
            </div>
            <div class="col-auto">
              <button class="btn btn-sm btn-primary" type="submit">Filter</button>
              <a href="/admin" class="btn btn-sm btn-outline-secondary ms-1">Clear</a>
            </div>
            <div class="col-auto ms-auto text-muted small">${total} row${total !== 1 ? "s" : ""}</div>
          </form>
        </div>
      </div>

      <div class="card shadow-sm">
        <div class="table-responsive">
          <table class="table table-hover table-sm mb-0">
            <thead class="table-light">
              <tr>
                <th>Time (UTC)</th>
                <th>IP / Forwarded</th>
                <th>User Agent</th>
                <th>Question / Answer</th>
                <th>Speed</th>
                <th>Err</th>
                <th>Accuracy</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${interactionRows || `<tr><td colspan="8" class="text-center text-muted py-5">No interactions yet</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      ${totalPages > 1 ? `
      <nav class="mt-3">
        <ul class="pagination pagination-sm justify-content-center">
          <li class="page-item ${page <= 1 ? "disabled" : ""}">
            <a class="page-link" href="?${qstr}&page=${page - 1}">‹ Prev</a>
          </li>
          ${pagLinks}
          <li class="page-item ${page >= totalPages ? "disabled" : ""}">
            <a class="page-link" href="?${qstr}&page=${page + 1}">Next ›</a>
          </li>
        </ul>
      </nav>` : ""}
    </div>

    <!-- IP Management Tab -->
    <div class="tab-pane fade" id="tab-ips">
      <div class="row g-3">

        <div class="col-md-4">
          <div class="card shadow-sm mb-3">
            <div class="card-header fw-semibold">Block an IP</div>
            <div class="card-body">
              <form method="POST" action="/admin/block">
                <input type="hidden" name="back" value="/admin#tab-ips">
                <div class="mb-2">
                  <input type="text" name="ip" class="form-control" placeholder="IP address" required>
                </div>
                <div class="mb-2">
                  <input type="text" name="reason" class="form-control" placeholder="Reason (optional)">
                </div>
                <button class="btn btn-danger w-100">Block IP</button>
              </form>
            </div>
          </div>

          <div class="card shadow-sm">
            <div class="card-header fw-semibold">Blocklist (${blocklist.length})</div>
            <div class="table-responsive">
              <table class="table table-sm mb-0">
                <thead class="table-light">
                  <tr><th>IP</th><th>Reason</th><th>Blocked</th><th></th></tr>
                </thead>
                <tbody>
                  ${blocklistRows || `<tr><td colspan="4" class="text-center text-muted py-3">Empty</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="col-md-8">
          <div class="card shadow-sm">
            <div class="card-header fw-semibold">Top IPs by Request Count</div>
            <div class="table-responsive">
              <table class="table table-sm mb-0">
                <thead class="table-light">
                  <tr><th>IP Address</th><th>Requests</th><th>Last Seen</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  ${ipStatsRows || `<tr><td colspan="5" class="text-center text-muted py-3">No data</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>

  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script>
  // Restore active tab from hash
  (function () {
    const hash = window.location.hash;
    if (hash) {
      const btn = document.querySelector('[data-bs-target="' + hash + '"]');
      if (btn) bootstrap.Tab.getOrCreateInstance(btn).show();
    }
    document.querySelectorAll('[data-bs-toggle="tab"]').forEach(function (btn) {
      btn.addEventListener('shown.bs.tab', function (e) {
        history.replaceState(null, '', window.location.pathname + window.location.search + e.target.dataset.bsTarget);
      });
    });
  })();
</script>
</body>
</html>`;

    res.send(html);
  } catch (err) {
    console.error("[admin] Dashboard error:", err);
    res.status(500).send(`<pre>Error: ${esc(String(err))}</pre>`);
  }
});

// ── Actions ──────────────────────────────────────────────────────────────────

router.post("/flag", async (req: Request, res: Response): Promise<void> => {
  const { id, flag, notes, back } = req.body as {
    id: string; flag: string; notes?: string; back?: string;
  };
  const valid = ["unreviewed", "accurate", "inaccurate"];
  if (!id || !flag || !valid.includes(flag)) {
    res.status(400).send("Invalid request");
    return;
  }
  try {
    await updateAccuracy(parseInt(id, 10), flag as "unreviewed" | "accurate" | "inaccurate", notes);
    res.redirect(back || "/admin");
  } catch (err) {
    console.error("[admin] flag error:", err);
    res.status(500).send("Failed");
  }
});

router.post("/block", async (req: Request, res: Response): Promise<void> => {
  const { ip, reason, back } = req.body as { ip: string; reason?: string; back?: string };
  if (!ip || typeof ip !== "string" || !ip.trim()) {
    res.status(400).send("Invalid IP");
    return;
  }
  try {
    await blockIp(ip.trim(), reason);
    console.log(`[admin] Blocked IP: ${ip.trim()}`);
    res.redirect(back || "/admin");
  } catch (err) {
    console.error("[admin] block error:", err);
    res.status(500).send("Failed");
  }
});

router.post("/unblock", async (req: Request, res: Response): Promise<void> => {
  const { ip, back } = req.body as { ip: string; back?: string };
  if (!ip || typeof ip !== "string") {
    res.status(400).send("Invalid IP");
    return;
  }
  try {
    await unblockIp(ip.trim());
    console.log(`[admin] Unblocked IP: ${ip.trim()}`);
    res.redirect(back || "/admin");
  } catch (err) {
    console.error("[admin] unblock error:", err);
    res.status(500).send("Failed");
  }
});

export default router;
