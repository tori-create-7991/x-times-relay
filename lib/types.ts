export type PlatformResult =
  | { url: string; ok: true }
  | { url: null; ok: false; error: string }
  | null;

export interface HistoryEntry {
  sent_at: string;
  text: string;
  x: PlatformResult;
  bluesky: PlatformResult;
  threads: PlatformResult;
  linkedin: PlatformResult;
}

export interface PostAllResult {
  x: PlatformResult;
  bluesky: PlatformResult;
  threads: PlatformResult;
  linkedin: PlatformResult;
}

export interface OAuth1aParams {
  method: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
}
