-- COS 迁移：1) 换桶/域名  2) 路径 mikujar/media、→ media/ 等
-- 旧数据可能混用：地域域名、全球加速域名（cos.accelerate.myqcloud.com），须分别替成新桶地域域名。
-- 使用前：备份库；改下面常量；psql：BEGIN → 执行 → 抽查 → COMMIT 或 ROLLBACK

BEGIN;

DO $$
DECLARE
  -- 旧桶地域域名（示例：上海）
  old_regional CONSTANT text := 'https://portfolio-media-1310791405.cos.ap-shanghai.myqcloud.com';
  -- 旧桶全球加速域名（与地域不同，需单独一行替换）
  old_accelerate CONSTANT text := 'https://portfolio-media-1310791405.cos.accelerate.myqcloud.com';
  -- 新桶地域访问域名（新加坡等，无加速）
  new_root CONSTANT text := 'https://mikujar-1310791405.cos.ap-singapore.myqcloud.com';
BEGIN
  -- ── 1a) 全球加速 → 新域名 ──
  UPDATE users
  SET avatar_url = replace(avatar_url, old_accelerate, new_root)
  WHERE avatar_url LIKE '%' || old_accelerate || '%';

  UPDATE cards
  SET media = replace(media::text, old_accelerate, new_root)::jsonb
  WHERE media::text LIKE '%' || old_accelerate || '%';

  -- ── 1b) 旧地域域名 → 新域名 ──
  UPDATE users
  SET avatar_url = replace(avatar_url, old_regional, new_root)
  WHERE avatar_url LIKE '%' || old_regional || '%';

  UPDATE cards
  SET media = replace(media::text, old_regional, new_root)::jsonb
  WHERE media::text LIKE '%' || old_regional || '%';

  -- ── 2) 路径：/mikujar/media/ → /media/，/mikujar/avatars/ → /avatars/ ──
  UPDATE users
  SET avatar_url = replace(avatar_url, '/mikujar/avatars/', '/avatars/')
  WHERE avatar_url LIKE '%/mikujar/avatars/%';

  UPDATE cards
  SET media =
    replace(
      replace(media::text, '/mikujar/media/', '/media/'),
      '/mikujar/avatars/',
      '/avatars/'
    )::jsonb
  WHERE media::text LIKE '%/mikujar/%';

  -- 正文里若贴过完整链：
  -- UPDATE cards SET text = replace(replace(replace(replace(text, old_accelerate, new_root), old_regional, new_root), '/mikujar/media/', '/media/'), '/mikujar/avatars/', '/avatars/') WHERE text LIKE '%myqcloud.com%' OR text LIKE '%mikujar%';
END $$;

-- 抽查（应不再出现 accelerate、ap-shanghai、mikujar/media）：
-- SELECT id, left(media::text, 500) FROM cards WHERE media::text LIKE '%accelerate%' OR media::text LIKE '%mikujar%' LIMIT 10;

-- 确认无误后 COMMIT，否则 ROLLBACK
