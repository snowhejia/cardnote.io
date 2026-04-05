-- 已有库增量：星标合集 + 垃圾桶表（幂等）
CREATE TABLE IF NOT EXISTS user_favorite_collections (
  owner_key      TEXT NOT NULL,
  collection_id  TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_key, collection_id)
);

CREATE INDEX IF NOT EXISTS idx_user_fav_col_owner ON user_favorite_collections(owner_key);

CREATE TABLE IF NOT EXISTS trashed_notes (
  trash_id       TEXT PRIMARY KEY,
  owner_key      TEXT NOT NULL,
  col_id         TEXT NOT NULL,
  col_path_label TEXT NOT NULL DEFAULT '',
  card           JSONB NOT NULL,
  deleted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trashed_notes_owner ON trashed_notes(owner_key);
