#!/usr/bin/env node
/**
 * 清理 v1 cardTypePresets 留下的重复 slug：把所有指向旧 slug 的引用
 * 重定向到 catalog 版本的 slug，再删除旧 card_types 行。
 */

import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const DRY = process.argv.includes("--dry-run");

/** v1 旧 slug → catalog 新 slug */
const SLUG_MERGE = {
  clip_web: "clip_bookmark",
  clip_xhs: "post_xhs",
  clip_bilibili: "post_bilibili",
  note_reading: "note_book",
  note_study: "note_standard",
  note_idea: "idea",
  note_diary: "journal",
  note_quote: "quote",
  topic_person: "person",
  topic_org: "organization",
  topic_event: "event",
  topic_place: "place",
  work_film: "work_movie",
};

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}
const ssl = process.env.PG_SSL === "false" ? false : { rejectUnauthorized: false };
const client = new pg.Client({ connectionString: url, ssl });
await client.connect();

try {
  await client.query("BEGIN");
  let merged = 0;
  let removedTypes = 0;

  for (const [oldSlug, newSlug] of Object.entries(SLUG_MERGE)) {
    const pairs = (
      await client.query(
        `SELECT old.id AS old_id, new.id AS new_id, old.user_id
           FROM card_types old
           JOIN card_types new
             ON new.user_id = old.user_id AND new.preset_slug = $2
          WHERE old.preset_slug = $1`,
        [oldSlug, newSlug]
      )
    ).rows;
    for (const p of pairs) {
      await client.query(`UPDATE collections SET bound_type_id = $2 WHERE bound_type_id = $1`, [p.old_id, p.new_id]);
      await client.query(`UPDATE cards SET card_type_id = $2 WHERE card_type_id = $1`, [p.old_id, p.new_id]);
      await client.query(`UPDATE card_links SET target_type_id = $2 WHERE target_type_id = $1`, [p.old_id, p.new_id]);
      await client.query(`UPDATE card_link_rules SET source_type_id = $2 WHERE source_type_id = $1`, [p.old_id, p.new_id]);
      await client.query(`UPDATE card_link_rules SET target_type_id = $2 WHERE target_type_id = $1`, [p.old_id, p.new_id]);
      await client.query(`UPDATE card_types SET parent_type_id = $2 WHERE parent_type_id = $1`, [p.old_id, p.new_id]);
      await client.query(`DELETE FROM card_types WHERE id = $1`, [p.old_id]);
      removedTypes += 1;
      merged += 1;
    }

    // 没有"new" 同名行的（用户没收到 catalog 的种子）— 直接 rename slug
    const orphans = (
      await client.query(
        `SELECT id FROM card_types
          WHERE preset_slug = $1
            AND NOT EXISTS (SELECT 1 FROM card_types n WHERE n.user_id = card_types.user_id AND n.preset_slug = $2)`,
        [oldSlug, newSlug]
      )
    ).rows;
    for (const o of orphans) {
      await client.query(`UPDATE card_types SET preset_slug = $2 WHERE id = $1`, [o.id, newSlug]);
    }
  }

  console.log(`merged: ${merged} duplicates; removed: ${removedTypes} card_types`);

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
