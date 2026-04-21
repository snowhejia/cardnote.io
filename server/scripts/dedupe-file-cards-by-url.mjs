#!/usr/bin/env node
/**
 * 修复迁移产生的"同 url 重复文件卡"。
 *
 * 起因：migrate-to-v2 在两个地方各建了一遍文件卡：
 *   (1) 旧 cards.object_kind='file_*' → 新 file 卡（用 cards.media[0]）
 *   (2) 遍历 note.cards.media[] → 新 file 卡 + attachment link
 * 旧业务里已经被 createFileCardForNoteMedia 独立过的 url 在 (1)(2) 各出现一次。
 *
 * 处理：每个用户内按 (user_id, card_files.url) 分组；
 *   - 保留 created_at 最早那张为 keeper
 *   - 把所有指向"被删 file 卡"的 card_links 重定向到 keeper（去重）
 *   - 把 keeper 的 card_placements/card_links/cards.cover_thumb_url 等保持原样
 *   - DROP 掉其他重复 file 卡（card_files 行随 cascade）
 *
 * 用法：
 *   node scripts/dedupe-file-cards-by-url.mjs --dry-run
 *   node scripts/dedupe-file-cards-by-url.mjs
 */

import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const DRY = process.argv.includes("--dry-run");

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

  // 1) 找重复组
  const groups = (
    await client.query(`
      SELECT fc.user_id, cf.url,
             ARRAY_AGG(fc.id ORDER BY fc.created_at ASC, fc.id ASC) AS card_ids
        FROM cards fc
        JOIN card_types ct ON ct.id = fc.card_type_id
        JOIN card_files cf ON cf.card_id = fc.id
       WHERE ct.kind = 'file' AND fc.trashed_at IS NULL
       GROUP BY fc.user_id, cf.url
      HAVING COUNT(*) > 1
    `)
  ).rows;

  let groupCount = groups.length;
  let dupCount = 0;
  let mergedLinks = 0;

  for (const g of groups) {
    const ids = g.card_ids;
    const keeper = ids[0];
    const losers = ids.slice(1);
    dupCount += losers.length;

    // 2) 把所有指向 loser 的 card_links 重定向到 keeper（注意 PK 冲突要 ON CONFLICT 跳）
    for (const loser of losers) {
      // 入站：to_card_id = loser → keeper（避免 self-link）
      const inLinks = await client.query(
        `SELECT from_card_id, property_key, target_type_id, user_id, sort_order, meta, created_at
           FROM card_links WHERE to_card_id = $1`,
        [loser]
      );
      for (const l of inLinks.rows) {
        if (l.from_card_id === keeper) continue; // 自环
        await client.query(
          `INSERT INTO card_links
              (from_card_id, property_key, to_card_id, target_type_id, user_id, sort_order, meta, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (from_card_id, property_key, to_card_id) DO NOTHING`,
          [l.from_card_id, l.property_key, keeper, l.target_type_id, l.user_id, l.sort_order, l.meta, l.created_at]
        );
        mergedLinks += 1;
      }
      // 出站：from_card_id = loser → keeper
      const outLinks = await client.query(
        `SELECT property_key, to_card_id, target_type_id, user_id, sort_order, meta, created_at
           FROM card_links WHERE from_card_id = $1`,
        [loser]
      );
      for (const l of outLinks.rows) {
        if (l.to_card_id === keeper) continue;
        await client.query(
          `INSERT INTO card_links
              (from_card_id, property_key, to_card_id, target_type_id, user_id, sort_order, meta, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (from_card_id, property_key, to_card_id) DO NOTHING`,
          [keeper, l.property_key, l.to_card_id, l.target_type_id, l.user_id, l.sort_order, l.meta, l.created_at]
        );
        mergedLinks += 1;
      }

      // 3) placements：把 loser 的 placements 合并到 keeper
      const plRows = await client.query(
        `SELECT collection_id, pinned, sort_order FROM card_placements WHERE card_id = $1`,
        [loser]
      );
      for (const p of plRows.rows) {
        await client.query(
          `INSERT INTO card_placements (card_id, collection_id, pinned, sort_order)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (card_id, collection_id) DO NOTHING`,
          [keeper, p.collection_id, p.pinned, p.sort_order]
        );
      }

      // 4) 删 loser 卡（card_files / card_links 由 cascade 清理）
      await client.query(`DELETE FROM cards WHERE id = $1`, [loser]);
    }
  }

  console.log(
    `groups with duplicates: ${groupCount}; deleted file cards: ${dupCount}; merged links: ${mergedLinks}`
  );

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
  console.error(e.stack);
  process.exit(1);
} finally {
  await client.end();
}
