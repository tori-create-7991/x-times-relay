import { postTweet, tweetPermalink } from "./post-x";
import { postTweetViaTypefully, postLinkedInViaTypefully } from "./post-typefully";
import { postBluesky } from "./post-bluesky";
import { postThreads } from "./post-threads";
import { relayWebhooks } from "./relay-webhooks";
import { appendHistory } from "./history";
import type { PostAllResult, PlatformResult } from "./types";

export async function postAll(
  text: string,
  { shareBody = false }: { shareBody?: boolean } = {}
): Promise<PostAllResult> {
  const username = process.env.X_USERNAME?.trim();

  const [xResult, bskyResult, threadsResult, linkedinResult] = await Promise.all([
    // X（TYPEFULLY_API_KEY 設定時はTypefully経由、それ以外は直接X API）
    (async (): Promise<PlatformResult> => {
      const useTypefully = !!process.env.TYPEFULLY_API_KEY;
      if (!useTypefully && !process.env.X_API_KEY) return null;
      try {
        const url = useTypefully
          ? await postTweetViaTypefully(text)
          : await (async () => {
              if (!username) throw new Error("X_USERNAME を .env に設定してください。");
              const id = await postTweet(text);
              return tweetPermalink(username, id);
            })();
        return { url, ok: true };
      } catch (e) {
        return { url: null, ok: false, error: (e as Error).message };
      }
    })(),
    // Bluesky
    (async (): Promise<PlatformResult> => {
      try {
        const result = await postBluesky(text);
        if (!result) return null;
        return { ...result, ok: true };
      } catch (e) {
        return { url: null, ok: false, error: (e as Error).message };
      }
    })(),
    // Threads
    (async (): Promise<PlatformResult> => {
      try {
        const result = await postThreads(text);
        if (!result) return null;
        return { ...result, ok: true };
      } catch (e) {
        return { url: null, ok: false, error: (e as Error).message };
      }
    })(),
    // LinkedIn（Typefully経由のみ。直接APIは審査が重いため未実装）
    (async (): Promise<PlatformResult> => {
      if (!process.env.TYPEFULLY_API_KEY || process.env.LINKEDIN_ENABLED !== "1") return null;
      try {
        const url = await postLinkedInViaTypefully(text);
        return { url, ok: true };
      } catch (e) {
        return { url: null, ok: false, error: (e as Error).message };
      }
    })(),
  ]);

  // Slack/Discord へは X の URL のみ中継
  if (xResult?.ok && xResult.url) {
    const relayText = shareBody ? `${text}\n${xResult.url}` : xResult.url;
    try {
      await relayWebhooks(relayText);
    } catch (e) {
      console.error("Webhook relay error:", (e as Error).message);
    }
  }

  // 履歴保存
  appendHistory({
    sent_at: new Date().toISOString(),
    text,
    x: xResult,
    bluesky: bskyResult,
    threads: threadsResult,
    linkedin: linkedinResult,
  });

  return { x: xResult, bluesky: bskyResult, threads: threadsResult, linkedin: linkedinResult };
}
