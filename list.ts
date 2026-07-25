#!/usr/bin/env tsx
import { loadEnv } from "./lib/load-env";
import { loadHistory } from "./lib/history";

loadEnv();

const args = process.argv.slice(2);
let limit = 20;
for (let i = 0; i < args.length; i++) {
  if ((args[i] === "--limit" || args[i] === "-n") && args[i + 1]) {
    limit = parseInt(args[i + 1], 10) || 20;
  }
}

const history = loadHistory();
if (history.length === 0) {
  console.log("履歴がありません。");
  process.exit(0);
}

const entries = history.slice(0, limit);
console.log(`送信履歴（${entries.length}/${history.length} 件）\n`);

for (const e of entries) {
  const date = new Date(e.sent_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const preview = e.text.length > 60 ? e.text.slice(0, 60) + "…" : e.text;
  console.log(`[${date}] "${preview}"`);
  if (e.x?.ok)            console.log(`  X       ${e.x.url}`);
  if (e.x && !e.x.ok)    console.log(`  X       エラー: ${e.x.error}`);
  if (e.bluesky?.ok)      console.log(`  Bluesky ${e.bluesky.url}`);
  if (e.bluesky && !e.bluesky.ok) console.log(`  Bluesky エラー: ${e.bluesky.error}`);
  if (e.threads?.ok)      console.log(`  Threads ${e.threads.url}`);
  if (e.threads && !e.threads.ok) console.log(`  Threads エラー: ${e.threads.error}`);
  if (e.linkedin?.ok)      console.log(`  LinkedIn ${e.linkedin.url}`);
  if (e.linkedin && !e.linkedin.ok) console.log(`  LinkedIn エラー: ${e.linkedin.error}`);
  console.log();
}
