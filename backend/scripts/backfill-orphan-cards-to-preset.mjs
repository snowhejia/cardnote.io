#!/usr/bin/env node
/**
 * 把所有孤儿卡(无 card_placements 行)回填到该用户该 type 对应的默认 preset 合集。
 * 取代 LOOSE_NOTES 概念 — 每张卡必须有真实归属。
 *
 * 匹配策略(与 storage-pg.js findDefaultCollectionForCardType 一致):
 *   1) 精确匹配 collections.bound_type_id == cards.card_type_id
 *   2) fallback 到同 kind 的合集(如 file_image → kind=file 的合集)
 *   3) 多个匹配优先 id LIKE 'preset-%' (系统种子合集),其次 created_at ASC
 *
 * 用法(在 backend 目录,已配置 DATABASE_URL):
 *   node scripts/backfill-orphan-cards-to-preset.mjs --dry-run
 *   node scripts/backfill-orphan-cards-to-preset.mjs            # 实跑
 *
 * 失败的孤儿(找不到任何匹配合集)会列出,需要手动处理。
 */
import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const DRY = process.argv.includes("--dry-run");

const { query, getClient, closePool } = await import("../src/db.js");

const stats = {
  orphans: 0,
  placed: 0,
  failed: 0,
};
const failures = [];

try {
  const orphans = (
    await query(`
      SELECT c.id AS card_id, c.user_id, c.card_type_id, ct.preset_slug, ct.kind
        FROM cards c
        JOIN card_types ct ON ct.id = c.card_type_id
       WHERE c.trashed_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM card_placements p WHERE p.card_id = c.id)
       ORDER BY c.user_id, ct.preset_slug, c.created_at ASC
    `)
  ).rows;

  stats.orphans = orphans.length;
  console.log(`待处理孤儿卡: ${orphans.length}${DRY ? " (dry-run)" : ""}`);

  // 缓存 (user_id, card_type_id) → 默认合集 id
  const cache = new Map();
  async function findDefault(userId, cardTypeId) {
    const key = `${userId}::${cardTypeId}`;
    if (cache.has(key)) return cache.get(key);
    // 1) 精确
    let r = await query(
      `SELECT id FROM collections
        WHERE user_id = $1 AND bound_type_id = $2
        ORDER BY (id LIKE 'preset-%') DESC, created_at ASC, id ASC
        LIMIT 1`,
      [userId, cardTypeId]
    );
    if (r.rows[0]) {
      cache.set(key, r.rows[0].id);
      return r.rows[0].id;
    }
    // 2) 同 kind fallback
    r = await query(
      `SELECT col.id
         FROM collections col
         JOIN card_types target ON target.id = col.bound_type_id
        WHERE col.user_id = $1
          AND target.kind = (SELECT kind FROM card_types WHERE id = $2)
        ORDER BY (col.id LIKE 'preset-%') DESC, col.created_at ASC, col.id ASC
        LIMIT 1`,
      [userId, cardTypeId]
    );
    if (r.rows[0]) {
      cache.set(key, r.rows[0].id);
      return r.rows[0].id;
    }
    cache.set(key, null);
    return null;
  }

  const client = await getClient();
  try {
    if (!DRY) await client.query("BEGIN");
    for (const o of orphans) {
      const targetCol = await findDefault(o.user_id, o.card_type_id);
      if (!targetCol) {
        stats.failed += 1;
        failures.push({
          card_id: o.card_id,
          user_id: o.user_id,
          slug: o.preset_slug,
          kind: o.kind,
        });
        continue;
      }
      if (DRY) {
        console.log(
          `  [dry] card=${o.card_id} (${o.preset_slug}) → ${targetCol}`
        );
      } else {
        // 末尾 sort_order: MAX+1
        const orderRes = await client.query(
          `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM card_placements WHERE collection_id = $1`,
          [targetCol]
        );
        const sortOrder = orderRes.rows[0].next;
        await client.query(
          `INSERT INTO card_placements (card_id, collection_id, pinned, sort_order)
           VALUES ($1,$2,false,$3)`,
          [o.card_id, targetCol, sortOrder]
        );
      }
      stats.placed += 1;
    }
    if (!DRY) {
      await client.query("COMMIT");
      console.log("✅ committed");
    } else {
      console.log("🧪 DRY RUN — 未写库");
    }
  } catch (e) {
    if (!DRY) await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  console.log("\n=== 汇总 ===");
  console.log(`  孤儿总数: ${stats.orphans}`);
  console.log(`  已回填到默认合集: ${stats.placed}`);
  console.log(`  失败(无可用合集): ${stats.failed}`);
  if (failures.length) {
    console.log("\n失败明细(需要手动处理):");
    console.table(failures);
  }
} catch (e) {
  console.error("\n❌ 失败:", e?.message ?? e);
  process.exit(1);
} finally {
  await closePool();
}
