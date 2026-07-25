#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { loadEnv } from "./lib/load-env";
import { postAll } from "./lib/post-all";

loadEnv();

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let shareBody = false;
  const rest: string[] = [];
  for (const a of args) {
    if (a === "--body" || a === "-b") shareBody = true;
    else rest.push(a);
  }
  let text = rest.join(" ").trim();
  if (!text) {
    text = readFileSync(0, "utf8").trim();
  }
  if (!text) {
    console.error(
      "使い方: tsx post-x.ts [--body] \"投稿本文\"\n" +
        "  --body … Slack/Discord に本文と URL の両方を送る"
    );
    process.exit(1);
  }

  const result = await postAll(text, { shareBody });

  if (result.x?.ok) console.log("X:       ", result.x.url);
  if (result.x && !result.x.ok) console.error("X エラー:", result.x.error);
  if (result.bluesky?.ok) console.log("Bluesky: ", result.bluesky.url);
  if (result.bluesky && !result.bluesky.ok) console.error("Bluesky エラー:", result.bluesky.error);
  if (result.threads?.ok) console.log("Threads: ", result.threads.url);
  if (result.threads && !result.threads.ok) console.error("Threads エラー:", result.threads.error);
  if (result.linkedin?.ok) console.log("LinkedIn:", result.linkedin.url);
  if (result.linkedin && !result.linkedin.ok) console.error("LinkedIn エラー:", result.linkedin.error);

  const anyOk = result.x?.ok || result.bluesky?.ok || result.threads?.ok || result.linkedin?.ok;
  if (!anyOk) {
    console.error("いずれのプラットフォームにも投稿できませんでした。");
    process.exit(1);
  }
}

main().catch((e: Error) => {
  console.error(e.message || e);
  process.exit(1);
});
