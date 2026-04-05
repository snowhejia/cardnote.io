-- 已有库升级：合集说明（与前端 Collection.hint 对应）
ALTER TABLE collections ADD COLUMN IF NOT EXISTS hint TEXT NOT NULL DEFAULT '';
