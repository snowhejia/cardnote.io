-- mikujar PostgreSQL schema
-- 幂等：全部使用 IF NOT EXISTS / OR REPLACE，可重复执行

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── 用户表（替代 data/users.json）─────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'subscriber')),
  avatar_url    TEXT NOT NULL DEFAULT '',
  avatar_thumb_url TEXT NOT NULL DEFAULT '',
  email         TEXT,
  media_usage_month           TEXT NOT NULL DEFAULT '',
  media_uploaded_bytes_month  BIGINT NOT NULL DEFAULT 0,
  ai_usage_month                TEXT NOT NULL DEFAULT '',
  ai_note_assist_calls_month    INTEGER NOT NULL DEFAULT 0,
  deletion_pending     BOOLEAN NOT NULL DEFAULT false,
  deletion_requested_at TIMESTAMPTZ NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email) WHERE email IS NOT NULL;

-- ─── 合集表（替代 JSON 内 Collection 对象）──────────────────────────────
-- user_id = NULL 表示单用户模式（adminGateEnabled = false）
-- parent_id 自引用 DEFERRABLE INITIALLY DEFERRED：批量插入时无需关心顺序
CREATE TABLE IF NOT EXISTS collections (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
  parent_id   TEXT REFERENCES collections(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  name        TEXT NOT NULL DEFAULT '',
  dot_color   TEXT NOT NULL DEFAULT '',
  hint        TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  favorite_sort INTEGER NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collections_user_id   ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_parent_id ON collections(parent_id);
CREATE INDEX IF NOT EXISTS idx_collections_user_favorites
  ON collections (user_id, favorite_sort)
  WHERE is_favorite = true;

-- ─── 卡片表：正文与附件等全局字段；归属合集见 card_placements ───────────
-- user_id 与 collections 一致：多用户为 JWT sub；单用户模式可为 NULL
CREATE TABLE IF NOT EXISTS cards (
  id              TEXT PRIMARY KEY,
  user_id         TEXT REFERENCES users(id) ON DELETE CASCADE,
  text            TEXT NOT NULL DEFAULT '',
  minutes_of_day  INTEGER NOT NULL DEFAULT 0,
  added_on        TEXT,
  reminder_on     TEXT,
  reminder_time   TEXT,
  reminder_note   TEXT,
  reminder_completed_at TEXT,
  reminder_completed_note TEXT,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  related_refs    JSONB NOT NULL DEFAULT '[]',
  media           JSONB NOT NULL DEFAULT '[]',
  trashed_at      TIMESTAMPTZ NULL,
  trash_col_id    TEXT NULL,
  trash_col_path_label TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cards_user_id       ON cards(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_added_on      ON cards(added_on);
CREATE INDEX IF NOT EXISTS idx_cards_reminder_on   ON cards(reminder_on);

CREATE INDEX IF NOT EXISTS idx_cards_user_trashed
  ON cards (user_id, trashed_at DESC)
  WHERE trashed_at IS NOT NULL;

-- 笔记在多个合集中的出现位置；置顶与排序按合集独立。删合集只删归属行，不删 cards 行。
CREATE TABLE IF NOT EXISTS card_placements (
  card_id         TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  collection_id   TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  pinned          BOOLEAN NOT NULL DEFAULT false,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (card_id, collection_id)
);

CREATE INDEX IF NOT EXISTS idx_card_placements_col ON card_placements(collection_id);
CREATE INDEX IF NOT EXISTS idx_card_placements_card ON card_placements(card_id);

-- ─── 自动更新 updated_at ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_col_upd  ON collections;
DROP TRIGGER IF EXISTS trg_card_upd ON cards;

CREATE TRIGGER trg_col_upd
  BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE PROCEDURE touch_updated_at();

CREATE TRIGGER trg_card_upd
  BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE PROCEDURE touch_updated_at();

-- ─── 邮箱验证码（注册 / 换绑同一表，kind 区分）──────────────────────────
CREATE TABLE IF NOT EXISTS email_verification_codes (
  kind         TEXT NOT NULL CHECK (kind IN ('registration', 'email_change')),
  subject_key  TEXT NOT NULL,
  email        TEXT NOT NULL,
  code_hash    TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id      TEXT REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (kind, subject_key),
  CONSTRAINT chk_email_ver_codes_user CHECK (
    (kind = 'registration' AND user_id IS NULL)
    OR (kind = 'email_change' AND user_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_email_ver_codes_expires ON email_verification_codes (expires_at);
