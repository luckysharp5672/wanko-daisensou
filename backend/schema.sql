-- わんこ大戦争 セーブデータ同期・ランキング用のD1スキーマ
-- 適用: wrangler d1 execute wanko-daisensou --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS saves (
  player_id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rankings (
  player_id TEXT NOT NULL,
  stage_id TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  player_name TEXT NOT NULL DEFAULT '名無し',
  clear_time_ms INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, stage_id, difficulty)
);

CREATE INDEX IF NOT EXISTS idx_rankings_lookup
  ON rankings (stage_id, difficulty, clear_time_ms ASC);
