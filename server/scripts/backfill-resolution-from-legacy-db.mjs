#!/usr/bin/env node
/**
 * 从“旧库 cards.media”按 URL 回填文件卡分辨率到当前 v2 库 cards.custom_props。
 *
 * 用法：
 *   node scripts/backfill-resolution-from-legacy-db.mjs \
 *     --source-url='postgresql://.../old_db' \
 *     [--target-url='postgresql://.../new_db'] \
 *     [--dry-run]
 *
 * 说明：
 * - 旧库应包含 cards.media(JSONB)；
 * - 新库应为 v2（cards + card_types + card_files）；
 * - 回填字段：sf-file-resolution；file_video 额外补 sf-vid-resolution（兼容旧读取逻辑）。
 */
import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const args = new Map(
  process.argv
    .slice(2)
    .map((a) => {
      const i = a.indexOf("=");
      return i > 0 ? [a.slice(0, i), a.slice(i + 1)] : [a, "1"];
    })
);
const dryRun = args.has("--dry-run");
const sourceUrl = String(args.get("--source-url") || "").trim();
const targetUrl = String(args.get("--target-url") || process.env.DATABASE_URL || "").trim();

if (!sourceUrl) {
  console.error("❌ 缺少 --source-url（旧库连接串）");
  process.exit(1);
}
if (!targetUrl) {
  console.error("❌ 缺少目标库连接串（--target-url 或 DATABASE_URL）");
  process.exit(1);
}

const ssl =
  process.env.PG_SSL === "false" ? false : { rejectUnauthorized: false };
const source = new pg.Client({ connectionString: sourceUrl, ssl });
const target = new pg.Client({ connectionString: targetUrl, ssl });

function parseResText(v) {
  if (typeof v !== "string") return null;
  const m = v.match(/^(\d+)\s*[x×]\s*(\d+)$/i);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { w: Math.round(w), h: Math.round(h) };
}

function upsertProp(arr, prop) {
  const i = arr.findIndex((p) => p && typeof p === "object" && p.id === prop.id);
  if (i < 0) {
    arr.push(prop);
    return true;
  }
  const existing = arr[i];
  const old = parseResText(String(existing?.value ?? ""));
  if (old && old.w > 0 && old.h > 0) return false;
  arr[i] = { ...existing, ...prop };
  return true;
}

try {
  await source.connect();
  await target.connect();

  const src = await source.query(
    `WITH rows AS (
       SELECT
         trim(m->>'url') AS url,
         (m->>'widthPx')::int AS w,
         (m->>'heightPx')::int AS h
       FROM cards c
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.media, '[]'::jsonb)) m
       WHERE
         coalesce(m->>'url','') <> ''
         AND (m->>'widthPx') ~ '^[0-9]+$'
         AND (m->>'heightPx') ~ '^[0-9]+$'
         AND (m->>'widthPx')::int > 0
         AND (m->>'heightPx')::int > 0
     )
     SELECT DISTINCT ON (url) url, w, h
     FROM rows
     ORDER BY url, (w * h) DESC`
  );

  const byUrl = new Map();
  for (const r of src.rows) byUrl.set(r.url, { w: r.w, h: r.h });

  const tgt = await target.query(
    `SELECT c.id, ct.preset_slug, c.custom_props, f.url
     FROM cards c
     JOIN card_types ct ON ct.id = c.card_type_id
     JOIN card_files f ON f.card_id = c.id
     WHERE ct.kind = 'file' AND c.trashed_at IS NULL`
  );

  let matched = 0;
  let changed = 0;
  const updates = [];

  for (const row of tgt.rows) {
    const url = String(row.url || "").trim();
    if (!url) continue;
    const d = byUrl.get(url);
    if (!d) continue;
    matched += 1;
    const next = Array.isArray(row.custom_props) ? row.custom_props.slice() : [];
    const resText = `${d.w}x${d.h}`;
    let dirty = false;
    dirty = upsertProp(next, {
      id: "sf-file-resolution",
      name: "分辨率",
      type: "text",
      value: resText,
    }) || dirty;
    if (row.preset_slug === "file_video") {
      dirty = upsertProp(next, {
        id: "sf-vid-resolution",
        name: "分辨率",
        type: "text",
        value: resText,
      }) || dirty;
    }
    if (dirty) {
      changed += 1;
      updates.push({ id: row.id, customProps: JSON.stringify(next) });
    }
  }

  if (!dryRun && updates.length > 0) {
    await target.query("BEGIN");
    try {
      for (const u of updates) {
        await target.query(`UPDATE cards SET custom_props = $2::jsonb WHERE id = $1`, [
          u.id,
          u.customProps,
        ]);
      }
      await target.query("COMMIT");
    } catch (e) {
      await target.query("ROLLBACK");
      throw e;
    }
  }

  console.log(
    JSON.stringify(
      {
        sourceResolutionUrls: byUrl.size,
        targetFileCards: tgt.rows.length,
        matchedByUrl: matched,
        willUpdateCards: changed,
        dryRun,
      },
      null,
      2
    )
  );
} finally {
  await source.end().catch(() => {});
  await target.end().catch(() => {});
}
