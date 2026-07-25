# text-sns-relay（旧 x-times-relay）

自分の短文投稿を **X / Bluesky / Threads / LinkedIn** に同時投稿し、Slack と Discord の **Webhook** に通知するためのツールです。
**ブラウザ UI**（ローカル、履歴閲覧つき）と **CLI** があります。

## リポジトリの取得

```bash
git clone https://github.com/tori-create-7991/text-sns-relay.git
cd text-sns-relay
```

## 対応プラットフォーム

| プラットフォーム | 投稿 | 認証 |
|---|---|---|
| X | ✓ | OAuth1.0a（直接） or Typefully API |
| Bluesky | ✓ | App Password |
| Threads（Meta） | ✓ | Threads API アクセストークン |
| LinkedIn | ✓ | Typefully API のみ（直接APIは審査が重いため未実装） |

未設定のプラットフォームは自動でスキップされます（`postAll` は各プラットフォームを並行実行し、設定済みの分だけ投稿）。

## 無料で「簡易」にやる場合の現実（X）

- **X の投稿をプログラムで読む API** は、現状 **無料枠だけでは読み取りができない** ことが多いです。
- **投稿だけ**は無料枠で使える場合があります（X Developer のプラン次第）。
- 読み取りが使えないときの代替は、**手動で URL を渡す** `send-url.ts`、または **ポーリング** `poll-x.ts`（読み取り API が必要）。
- Bluesky・Threads は投稿APIのみ実装（読み取りは未対応）。

## 準備（Slack / Discord）

### Slack（日本リージョンでも同じ）

1. ワークスペースで **Incoming Webhooks** を有効にする（または「着信 Webhooks」アプリをチャンネルに追加）。
2. 通知したいチャンネル（例: `#times`）用の **Webhook URL** をコピーする。

### Discord

1. サーバー → チャンネル（例: `#times`）→ **チャンネルを編集** → **連携サービス** → **ウェブフック** → 新しいウェブフック。
2. **Webhook URL** をコピーする。

## セットアップ

```bash
npm install
cp env.example .env
# .env を編集（Webhook は必須。各SNSに投稿するなら認証情報も）
```

Node.js 18 以上（`fetch` 利用）。

### X の `.env`

X Developer Portal でアプリ作成・ユーザー認証（OAuth1.0a）。

- `X_API_KEY` / `X_API_SECRET` / `X_ACCESS_TOKEN` / `X_ACCESS_TOKEN_SECRET`
- `X_USERNAME` … 投稿 URL 用（`@` なし）

#### 課金せずにX投稿したい場合（Typefully経由、無料プラン）

X APIのPay Per Use（$5〜の従量課金）を避けたい場合、[Typefully](https://typefully.com)
無料プランのAPI経由でX投稿できる。TypefullyがX公式パートナーとしてAPI費用を負担する
構造のため、自分でX Developer Portalのアプリ・Project設定は不要。

- 制限: **無料プランは月15投稿まで**（1ソーシャルセット）
- `.env`に`TYPEFULLY_API_KEY`と`TYPEFULLY_SOCIAL_SET_ID`を設定すると、X投稿はこちらが
  優先され、直接API方式（`X_API_KEY`等）は使われなくなる
- APIキー: Typefully → Settings → API で発行
- `TYPEFULLY_SOCIAL_SET_ID`: 同じSettings → APIページの「Development mode」を
  オンにすると画面上にIDが表示される

月15投稿を超える運用にしたくなったら、素直にPay Per Use（$5チャージ、以降投稿
$0.01〜0.015/件）に切り替えるのが実用的。

### Bluesky の `.env`

アカウント設定 → Privacy and Security → App Passwords で発行（本パスワードは使わない）。

- `BSKY_HANDLE`（例: `yourname.bsky.social`）
- `BSKY_APP_PASSWORD`

### Threads の `.env`

Meta for Developers でアプリ作成 → Threads API プロダクト追加 → アクセストークン取得。

- `THREADS_USER_ID`
- `THREADS_ACCESS_TOKEN`

### LinkedIn の `.env`

LinkedIn公式APIは個人開発者の投稿権限申請が重い（手動審査・平均数ヶ月・却下も多い）ため、
直接APIは未実装。**Typefully経由のみ**対応（上記「課金せずにX投稿したい場合」参照）。

- `TYPEFULLY_API_KEY` / `TYPEFULLY_SOCIAL_SET_ID`（Xと共通）
- `LINKEDIN_ENABLED=1`（未設定だとTypefully設定済みでもLinkedInには投稿しない）
- Typefully側で対象アカウントのLinkedInを連携済みであること

## Web UI（ローカル）

```bash
npm run ui
# ブラウザで http://127.0.0.1:3847/ を開く
```

- 設定済みの全プラットフォームへ同時投稿。結果は各プラットフォームごとに表示。
- `/history` で送信履歴（直近50件）を一覧表示。
- **既定で `127.0.0.1` のみ**（LAN からは開けません）。変えたい場合は `RELAY_UI_HOST` / `RELAY_UI_PORT`。
- ブラウザから他人に使われたくない場合は **`RELAY_UI_USER` と `RELAY_UI_PASSWORD`** を設定すると Basic 認証がかかります。

## CLI: 投稿して Slack / Discord へ

```bash
npm run post -- "いまの気持ち"
# 本文も Slack/Discord に送りたいとき
npm run post -- --body "いまの気持ち"
```

設定済みの全プラットフォームに同時投稿されます。Slack/Discordへは X の URL のみ中継されます。

## 送信履歴の確認（CLI）

```bash
npm run list
npm run list -- --limit 50
```

## 使い方（手動で URL だけ飛ばす）

投稿した X の URL をコピーして:

```bash
npm run send -- "https://x.com/yourname/status/1234567890"
```

標準入力でも可:

```bash
echo "https://x.com/yourname/status/1234567890" | npm run send
```

同じ URL が **Slack と Discord の両方**に送られます（どちらかの URL だけ設定すれば、その一方だけにも送れます）。

## 自動ポーリング（Xの読み取り API が使える場合のみ）

X Developer Portal で **読み取り可能な** Bearer トークンと、数値の **ユーザー ID** が取れる場合:

`.env` に追加:

```env
X_BEARER_TOKEN=...
X_USER_ID=1234567890123456789
X_USERNAME=yourname
```

初回は「最新 ID だけ記録」し、**それ以降の新規投稿**から通知します。

```bash
npm run poll
```

定期実行はローカルの cron や GitHub Actions などに任せてください（シークレットはリポジトリに置かないこと）。

## tori-dev-blog との連携（Notion経由、任意）

投稿履歴を [tori-dev-blog](https://github.com/tori-create-7991/tori-dev-blog)
の `/tweets` ページに反映したい場合、Notion DB「つぶやきログ」に同期できる
（tori-dev-blog `docs/adr/0003-notion-as-shared-datastore-for-tweets.md` 参照）。
コードレベルの依存はなく、両リポジトリが同じ Notion DB を参照するのみ（疎結合）。

`.env` に追加:

```env
NOTION_TOKEN=ntn_...
NOTION_TWEETS_DB_ID=641e0e88-38b8-466a-98e4-d53aa4bd9432
```

未設定なら同期はスキップされ、ローカルの `data/history.json` のみに記録される。

## ディレクトリ構成

```
lib/
  load-env.ts
  relay-webhooks.ts     # Slack/Discord通知
  oauth1a.ts             # X OAuth1.0a署名
  post-x.ts              # X投稿（直接API）
  post-typefully.ts      # X/LinkedIn投稿（Typefully経由、無料プラン月15投稿まで）
  post-bluesky.ts        # Bluesky投稿（セッション90分キャッシュ）
  post-threads.ts        # Threads投稿（2ステップ: container作成→publish）
  post-all.ts            # 全プラットフォーム並行投稿 + 履歴保存
  history.ts             # 送信履歴の読み書き（書き込みキューで競合防止）
  notion-sync.ts         # Notion DB「つぶやきログ」への同期（tori-dev-blog連携）
  types.ts                # 共有型定義
post-x.ts                # CLI: 統合投稿
send-url.ts / poll-x.ts / server.ts / list.ts
```

## ソース管理について

- このディレクトリのスクリプトは **コミットして問題ありません**。
- **`.env` と `data/` は `.gitignore` 済み**です。Webhook URL やトークンは絶対に push しないでください。

## トラブルシュート

| 症状 | 確認 |
|------|------|
| Slack に来ない | Webhook URL がそのチャンネル用か、アプリがチャンネルに入っているか |
| Discord に来ない | Webhook がそのチャンネル用か、URL が有効か |
| `poll-x` が 403/401 | 無料枠では読み取り不可の可能性。手動 `send-url` 運用へ |
| Bluesky ログイン失敗 | `BSKY_APP_PASSWORD` が本パスワードでなくApp Passwordか確認 |
| Threads 投稿失敗 | アクセストークンの有効期限、Threads API プロダクトの追加状況を確認 |

## アイディア / 拡張案（メモ）

> 今後の拡張アイデア。実装は未定の構想メモ。

- **ブログに「つぶやき」カテゴリを持たせる** — 各SNSへ流すだけでなく、ブログ側にも短文の「つぶやき」カテゴリを設けて連携する（tori-dev-blog の `/tweets` ページ、Phase 2 予定）。
- **1日1回の発言（モーニングルーティン）** — 毎朝の習慣として、次の3つの切り口で1日1回投稿する:
  - **発見** … 気づいたこと・知ったこと
  - **達成** … できたこと・進んだこと
  - **改善** … 直したこと・次に良くしたいこと
- **週1回のブログ** — 1週間に1回、その週の調べごとや発見をまとめた記事を出す。
