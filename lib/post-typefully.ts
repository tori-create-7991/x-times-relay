const API_BASE = "https://api.typefully.com/v2";

export type TypefullyPlatform = "x" | "linkedin";

interface DraftResponse {
  id: number | string;
  social_set_id: number | string;
  status: string; // "draft" | "scheduled" | "published" | "error" | "planned"
  x_published_url?: string;
  linkedin_published_url?: string;
  error?: string;
}

function authHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

async function createDraft(
  apiKey: string,
  socialSetId: string,
  text: string,
  platform: TypefullyPlatform
): Promise<DraftResponse> {
  const res = await fetch(`${API_BASE}/social-sets/${socialSetId}/drafts`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      publish_at: "now",
      platforms: { [platform]: {} },
      posts: [{ text }],
    }),
  });
  const data = (await res.json()) as DraftResponse & { detail?: string; message?: string };
  if (!res.ok) {
    throw new Error(data.detail || data.message || JSON.stringify(data));
  }
  return data;
}

async function getDraft(apiKey: string, socialSetId: string, draftId: string | number): Promise<DraftResponse> {
  const res = await fetch(`${API_BASE}/social-sets/${socialSetId}/drafts/${draftId}`, {
    headers: authHeaders(apiKey),
  });
  const data = (await res.json()) as DraftResponse & { detail?: string; message?: string };
  if (!res.ok) {
    throw new Error(data.detail || data.message || JSON.stringify(data));
  }
  return data;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Typefully 経由で指定プラットフォームへ投稿する（無料プラン: 月15投稿まで、全プラットフォーム合算）。
// publish_at: "now" は非同期処理なので、公開URLが確定するまでポーリングする。
export async function postViaTypefully(text: string, platform: TypefullyPlatform): Promise<string> {
  const apiKey = process.env.TYPEFULLY_API_KEY;
  const socialSetId = process.env.TYPEFULLY_SOCIAL_SET_ID;
  if (!apiKey || !socialSetId) {
    throw new Error("TYPEFULLY_API_KEY, TYPEFULLY_SOCIAL_SET_ID を .env に設定してください。");
  }

  const created = await createDraft(apiKey, socialSetId, text, platform);

  // 公開完了（status: published）になるまで最大15秒、1秒間隔でポーリング
  let draft = created;
  for (let i = 0; i < 15 && draft.status !== "published" && draft.status !== "error"; i++) {
    await sleep(1000);
    draft = await getDraft(apiKey, socialSetId, created.id);
  }

  if (draft.status === "error") {
    throw new Error(draft.error || "Typefully側で投稿に失敗しました。");
  }
  const url = platform === "x" ? draft.x_published_url : draft.linkedin_published_url;
  if (!url) {
    throw new Error(
      `投稿は受け付けられましたが公開確認がタイムアウトしました（status: ${draft.status}）。Typefully側で確認してください。`
    );
  }
  return url;
}

export function postTweetViaTypefully(text: string): Promise<string> {
  return postViaTypefully(text, "x");
}

export function postLinkedInViaTypefully(text: string): Promise<string> {
  return postViaTypefully(text, "linkedin");
}
