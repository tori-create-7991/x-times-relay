#!/usr/bin/env tsx
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadEnv } from "./lib/load-env";
import { postAll } from "./lib/post-all";
import { loadHistory } from "./lib/history";
import type { HistoryEntry } from "./lib/types";

loadEnv();

const HOST = process.env.RELAY_UI_HOST ?? "127.0.0.1";
const PORT = Number(process.env.RELAY_UI_PORT ?? "3847");
const MAX_BODY = 65536;

function checkBasicAuth(req: IncomingMessage): boolean {
  const user = process.env.RELAY_UI_USER;
  const pass = process.env.RELAY_UI_PASSWORD;
  if (!user || !pass) return true;
  const h = req.headers.authorization;
  if (!h?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = Buffer.from(h.slice(6), "base64").toString("utf8");
  } catch {
    return false;
  }
  const i = decoded.indexOf(":");
  const u = i === -1 ? decoded : decoded.slice(0, i);
  const p = i === -1 ? "" : decoded.slice(i + 1);
  return u === user && p === pass;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("リクエストが大きすぎます。"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>X / Bluesky / Threads → Slack / Discord</title>
  <style>
    :root {
      --bg: #0f1419;
      --card: #1a2332;
      --border: #2d3a4d;
      --text: #e7ecf3;
      --muted: #8b9cb3;
      --accent: #1d9bf0;
      --accent-hover: #1a8cd8;
      --err: #f4212e;
      --ok: #00ba7c;
      font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; background: var(--bg); color: var(--text);
      display: flex; align-items: flex-start; justify-content: center;
      padding: 2rem 1rem;
    }
    .card {
      width: 100%; max-width: 32rem;
      background: var(--card); border: 1px solid var(--border);
      border-radius: 12px; padding: 1.5rem 1.25rem;
      box-shadow: 0 8px 32px rgba(0,0,0,.35);
    }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem; }
    h1 { font-size: 1.125rem; font-weight: 600; margin: 0; }
    a.history-link { font-size: 0.75rem; color: var(--muted); text-decoration: none; }
    a.history-link:hover { color: var(--accent); }
    p.sub { margin: 0 0 1.25rem; font-size: 0.8125rem; color: var(--muted); line-height: 1.5; }
    label { display: block; font-size: 0.75rem; color: var(--muted); margin-bottom: 0.35rem; }
    textarea {
      width: 100%; min-height: 7rem; resize: vertical;
      padding: 0.65rem 0.75rem; border-radius: 8px;
      border: 1px solid var(--border); background: var(--bg); color: var(--text);
      font-size: 0.9375rem; line-height: 1.45;
    }
    textarea:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: transparent; }
    .row { margin-top: 1rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    input[type="checkbox"] { accent-color: var(--accent); width: 1rem; height: 1rem; }
    .chk label { display: inline; font-size: 0.8125rem; color: var(--text); margin: 0; cursor: pointer; }
    button {
      margin-top: 1rem; width: 100%;
      padding: 0.65rem 1rem; border: none; border-radius: 999px;
      background: var(--accent); color: #fff; font-size: 0.9375rem; font-weight: 600;
      cursor: pointer;
    }
    button:hover:not(:disabled) { background: var(--accent-hover); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    #msg { margin-top: 1rem; font-size: 0.8125rem; line-height: 1.6; min-height: 1.25rem; }
    #msg.err { color: var(--err); }
    #msg.ok { color: var(--ok); word-break: break-all; }
    #msg .platform { display: block; }
    #msg a { color: var(--ok); }
    footer { margin-top: 1.25rem; font-size: 0.6875rem; color: var(--muted); line-height: 1.4; }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-header">
      <h1>X / Bluesky / Threads に投稿</h1>
      <a class="history-link" href="/history">履歴</a>
    </div>
    <p class="sub">設定済みのプラットフォームへ同時投稿し、Slack / Discord へ X の URL を共有します。</p>
    <label for="text">投稿本文</label>
    <textarea id="text" maxlength="5000" placeholder="いま書きたいこと…"></textarea>
    <div class="row chk">
      <input type="checkbox" id="shareBody" />
      <label for="shareBody">Slack / Discord には本文も送る（URL に加えて）</label>
    </div>
    <button type="button" id="btn">投稿して共有</button>
    <div id="msg" role="status"></div>
    <footer>秘密情報はブラウザに出しません。Basic 認証は RELAY_UI_USER / RELAY_UI_PASSWORD で有効化できます。</footer>
  </div>
  <script>
    const textEl = document.getElementById("text");
    const shareBody = document.getElementById("shareBody");
    const btn = document.getElementById("btn");
    const msg = document.getElementById("msg");

    function setMsg(html, cls) {
      msg.innerHTML = html || "";
      msg.className = cls || "";
    }

    btn.addEventListener("click", async () => {
      const body = textEl.value.trim();
      if (!body) { setMsg("本文を入力してください。", "err"); return; }
      btn.disabled = true;
      setMsg("送信中…", "");
      try {
        const res = await fetch("/api/post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: body, shareBody: shareBody.checked }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || res.statusText);

        const lines = [];
        if (data.x?.ok) lines.push(\`<span class="platform">X: <a href="\${data.x.url}" target="_blank" rel="noopener">\${data.x.url}</a></span>\`);
        if (data.x && !data.x.ok) lines.push(\`<span class="platform" style="color:var(--err)">X: エラー — \${data.x.error || '失敗'}</span>\`);
        if (data.bluesky?.ok) lines.push(\`<span class="platform">Bluesky: <a href="\${data.bluesky.url}" target="_blank" rel="noopener">\${data.bluesky.url}</a></span>\`);
        if (data.bluesky && !data.bluesky.ok) lines.push(\`<span class="platform" style="color:var(--err)">Bluesky: エラー — \${data.bluesky.error || '失敗'}</span>\`);
        if (data.threads?.ok) lines.push(\`<span class="platform">Threads: <a href="\${data.threads.url}" target="_blank" rel="noopener">\${data.threads.url}</a></span>\`);
        if (data.threads && !data.threads.ok) lines.push(\`<span class="platform" style="color:var(--err)">Threads: エラー — \${data.threads.error || '失敗'}</span>\`);
        if (data.linkedin?.ok) lines.push(\`<span class="platform">LinkedIn: <a href="\${data.linkedin.url}" target="_blank" rel="noopener">\${data.linkedin.url}</a></span>\`);
        if (data.linkedin && !data.linkedin.ok) lines.push(\`<span class="platform" style="color:var(--err)">LinkedIn: エラー — \${data.linkedin.error || '失敗'}</span>\`);

        setMsg("完了:\\n" + lines.join(""), "ok");
        textEl.value = "";
      } catch (e) {
        setMsg(e.message || String(e), "err");
      } finally {
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>`;

function renderHistory(history: HistoryEntry[]): string {
  const rows = history.slice(0, 50).map((e) => {
    const date = new Date(e.sent_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
    const text = e.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const link = (p: HistoryEntry["x"]): string => {
      if (!p?.ok || !p.url) return p ? "エラー" : "未設定";
      if (!/^https?:\/\//.test(p.url)) return "（不正なURL）";
      const escaped = p.url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
      return `<a href="${escaped}" target="_blank" rel="noopener">${escaped}</a>`;
    };
    return `<tr>
      <td>${date}</td>
      <td class="text-cell">${text}</td>
      <td>${link(e.x)}</td>
      <td>${link(e.bluesky)}</td>
      <td>${link(e.threads)}</td>
      <td>${link(e.linkedin)}</td>
    </tr>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>送信履歴</title>
  <style>
    :root {
      --bg: #0f1419; --card: #1a2332; --border: #2d3a4d;
      --text: #e7ecf3; --muted: #8b9cb3; --accent: #1d9bf0;
      font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); padding: 2rem 1rem; }
    h1 { font-size: 1.125rem; font-weight: 600; margin: 0 0 0.5rem; }
    a.back { font-size: 0.8125rem; color: var(--muted); text-decoration: none; display: inline-block; margin-bottom: 1.5rem; }
    a.back:hover { color: var(--accent); }
    .wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
    th { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); color: var(--muted); white-space: nowrap; }
    td { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); vertical-align: top; }
    td.text-cell { max-width: 18rem; word-break: break-word; }
    a { color: var(--accent); }
    .empty { color: var(--muted); margin-top: 2rem; }
  </style>
</head>
<body>
  <a class="back" href="/">← 投稿画面に戻る</a>
  <h1>送信履歴（最新 50 件）</h1>
  <div class="wrap">
    ${history.length === 0 ? '<p class="empty">まだ履歴がありません。</p>' : `
    <table>
      <thead><tr><th>日時</th><th>本文</th><th>X</th><th>Bluesky</th><th>Threads</th><th>LinkedIn</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`}
  </div>
</body>
</html>`;
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (!checkBasicAuth(req)) {
    res.writeHead(401, {
      "WWW-Authenticate": 'Basic realm="x-times-relay"',
      "Content-Type": "text/plain; charset=utf-8",
    });
    res.end("認証が必要です。");
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(HTML);
    return;
  }

  if (req.method === "GET" && url.pathname === "/history") {
    const history = loadHistory();
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderHistory(history));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/post") {
    let raw: string;
    try {
      raw = await readBody(req);
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: (e as Error).message }));
      return;
    }
    let payload: { text?: unknown; shareBody?: unknown };
    try {
      payload = JSON.parse(raw) as { text?: unknown; shareBody?: unknown };
    } catch {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "JSON が不正です。" }));
      return;
    }
    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    const shareBody = Boolean(payload.shareBody);
    if (!text) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "text が空です。" }));
      return;
    }

    try {
      const result = await postAll(text, { shareBody });
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: (e as Error).message || String(e) }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found");
});

server.listen(PORT, HOST, () => {
  console.error(
    `x-times-relay UI: http://${HOST}:${PORT}/\n` +
      "止めるには Ctrl+C です。"
  );
});
