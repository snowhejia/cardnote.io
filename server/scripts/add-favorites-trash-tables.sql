-- 已有库增量（幂等）。星标已并入 collections.is_favorite / favorite_sort，请用 npm run db:migrate。
-- 本文件仅保留垃圾桶表，供极老环境手工执行时参考。

CREATE TABLE IF NOT EXISTS trashed_notes (
  trash_id       TEXT PRIMARY KEY,
  owner_key      TEXT NOT NULL,
  col_id         TEXT NOT NULL,
  col_path_label TEXT NOT NULL DEFAULT '',
  card           JSONB NOT NULL,
  deleted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trashed_notes_owner ON trashed_notes(owner_key);
