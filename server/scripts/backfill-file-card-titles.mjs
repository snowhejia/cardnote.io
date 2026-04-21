#!/usr/bin/env node
/**
 * 给所有 file 卡的 cards.custom_props 补齐 sf-file-title 字段
 *（旧 createFileCardForNoteMedia 的行为，迁移时未保留）。
 */

import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const DRY = process.argv.includes("--dry-run");

const url = process.env.DATABASE_URL?.trim();
const ssl = process.env.PG_SSL === "false" ? false : { rejectUnauthorized: false };
const client = new pg.Client({ connectionString: url, ssl });
await client.connect();

function stripExt(s) {
  const t = String(s || "").trim();
  if (!t) return "";
  const i = t.lastIndexOf(".");
  if (i <= 0 || i >= t.length - 1) return t;
  return t.slice(0, i);
}

try {
  await client.query("BEGIN");
  // 取所有 kind=file 的卡及其 card_files.original_name
  const rows = (
    await client.query(`
      SELECT c.id, c.body, c.custom_props, cf.original_name
        FROM cards c
        JOIN card_types ct ON ct.id = c.card_type_id AND ct.kind = 'file'
        JOIN card_files cf ON cf.card_id = c.id
       WHERE c.trashed_at IS NULL
    `)
  ).rows;

  let updated = 0;
  for (const r of rows) {
    const cp = Array.isArray(r.custom_props) ? r.custom_props.slice() : [];
    const has = cp.some((p) => p?.id === "sf-file-title");
    if (has) continue;
    const title = stripExt(r.original_name) || stripExt(r.body) || "";
    if (!title) continue;
    cp.push({ id: "sf-file-title", name: "标题", type: "text", value: title });
    await client.query(`UPDATE cards SET custom_props = $2::jsonb WHERE id = $1`, [
      r.id,
      JSON.stringify(cp),
    ]);
    updated += 1;
  }

  console.log(`processed: ${rows.length}; backfilled sf-file-title: ${updated}`);
  if (DRY) {
    console.log("\n🧪 DRY RUN — rolling back");
    await client.query("ROLLBACK");
  } else {
    await client.query("COMMIT");
    console.log("\n✅ committed");
  }
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("\n❌ failed:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
