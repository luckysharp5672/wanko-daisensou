# わんこ大戦争 バックエンド（Cloudflare Workers + D1）

セーブデータの自動同期（匿名UUID方式）と、ステージ×難易度ごとのクリアタイムランキングを提供するAPI。

## 構成

- **Cloudflare Workers**: `src/index.js` — APIエンドポイント
- **Cloudflare D1**: `saves` テーブル（セーブデータ）、`rankings` テーブル（ランキング）

## デプロイ手順

初回のみ、以下をこのディレクトリ（`backend/`）で実行する。

```bash
npm install
npx wrangler login          # ブラウザでCloudflareアカウント認証
npx wrangler d1 create wanko-daisensou
```

`wrangler d1 create` の出力に含まれる `database_id` を `wrangler.toml` の
`REPLACE_WITH_D1_DATABASE_ID` に貼り付ける。

```bash
npx wrangler d1 execute wanko-daisensou --remote --file=./schema.sql
npx wrangler deploy
```

デプロイが完了すると `https://wanko-daisensou-api.<あなたのサブドメイン>.workers.dev` が発行される。
このURLを `web/main.js` の `SYNC_API_BASE` 定数に設定するとクライアント側の同期が有効になる。

## 更新時

スキーマを変更しない限り、コード変更後は `npx wrangler deploy` のみでよい。
スキーマ変更時は `schema.sql` を編集し、`--remote` 付きで再実行する。

## API仕様

| メソッド | パス | 用途 |
|---|---|---|
| GET | `/api/save/:playerId` | セーブデータ取得 |
| PUT | `/api/save/:playerId` | セーブデータ保存（body: `{name, data, updatedAt}`） |
| POST | `/api/ranking` | クリアタイム送信（body: `{playerId, playerName, stageId, difficulty, clearTimeMs}`、自己ベストのみ更新） |
| GET | `/api/ranking/:stageId?difficulty=normal&limit=20` | ランキング取得 |

`playerId` はクライアント側で生成される匿名UUID（プロフィールIDをそのまま使用）。
ログイン機能はなく、同一ブラウザ・同一プロフィールでのみ同期される。

## 費用

Cloudflare Workers / D1 とも無料枠内で個人利用には十分（Workers: 10万リクエスト/日、D1: 5GBまで無料）。
自動スリープや一時停止がないため、久しぶりにアクセスしても即座に動作する。
