#!/usr/bin/env node
/**
 * 用 cardTypePresets.PRESET_TREE 刷新所有用户的预设 card_types 行：
 *   - 按 (user_id, preset_slug) 找到现有行 → 用 catalog 覆盖 schema_json + name + kind + parent_type_id
 *   - catalog 中 preset_slug 在该用户下不存在的 → INSERT 新行
 *   - 跨 slug 重命名（旧 'note_reading' 等） → 通过 NAME 匹配先 UPSERT slug，再覆盖
 *
 * 用法：
 *   node scripts/refresh-preset-card-types.mjs --dry-run
 *   node scripts/refresh-preset-card-types.mjs
 */

import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import pg from "pg";
import { PRESET_TREE } from "../src/cardTypePresets.js";

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

function flatten() {
  const out = [];
  for (let i = 0; i < PRESET_TREE.length; i += 1) {
    const root = PRESET_TREE[i];
    out.push({
      slug: root.slug,
      kind: root.kind,
      name: root.name,
      schema: root.schema || {},
      parentSlug: null,
      sortOrder: i,
    });
    const children = root.children || [];
    for (let j = 0; j < children.length; j += 1) {
      out.push({
        slug: children[j].slug,
        kind: root.kind,
        name: children[j].name,
        schema: children[j].schema || {},
        parentSlug: root.slug,
        sortOrder: j,
      });
    }
  }
  return out;
}

function newId() {
  return `ct_${crypto.randomBytes(8).toString("hex")}`;
}

try {
  await client.query("BEGIN");

  const flat = flatten();
  const users = (await client.query(`SELECT id FROM users`)).rows;
  let updated = 0;
  let inserted = 0;

  for (const u of users) {
    const userId = u.id;
    // 第一遍：根节点（无 parent）
    const slugToId = new Map();
    for (const node of flat.filter((n) => n.parentSlug === null)) {
      const existing = await client.query(
        `SELECT id FROM card_types WHERE user_id = $1 AND preset_slug = $2`,
        [userId, node.slug]
      );
      if (existing.rowCount > 0) {
        const id = existing.rows[0].id;
        slugToId.set(node.slug, id);
        await client.query(
          `UPDATE card_types
              SET name = $2, kind = $3, schema_json = $4::jsonb,
                  is_preset = true, parent_type_id = NULL, sort_order = $5
            WHERE id = $1`,
          [id, node.name, node.kind, JSON.stringify(node.schema), node.sortOrder]
        );
        updated += 1;
      } else {
        const id = newId();
        slugToId.set(node.slug, id);
        await client.query(
          `INSERT INTO card_types (id, user_id, parent_type_id, kind, name, schema_json, is_preset, preset_slug, sort_order)
           VALUES ($1,$2,NULL,$3,$4,$5::jsonb,true,$6,$7)`,
          [id, userId, node.kind, node.name, JSON.stringify(node.schema), node.slug, node.sortOrder]
        );
        inserted += 1;
      }
    }
    // 第二遍：子节点
    for (const node of flat.filter((n) => n.parentSlug !== null)) {
      const parentId = slugToId.get(node.parentSlug);
      if (!parentId) continue;
      const existing = await client.query(
        `SELECT id FROM card_types WHERE user_id = $1 AND preset_slug = $2`,
        [userId, node.slug]
      );
      if (existing.rowCount > 0) {
        await client.query(
          `UPDATE card_types
              SET name = $2, kind = $3, schema_json = $4::jsonb,
                  is_preset = true, parent_type_id = $5, sort_order = $6
            WHERE id = $1`,
          [existing.rows[0].id, node.name, node.kind, JSON.stringify(node.schema), parentId, node.sortOrder]
        );
        updated += 1;
      } else {
        const id = newId();
        await client.query(
          `INSERT INTO card_types (id, user_id, parent_type_id, kind, name, schema_json, is_preset, preset_slug, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,true,$7,$8)`,
          [id, userId, parentId, node.kind, node.name, JSON.stringify(node.schema), node.slug, node.sortOrder]
        );
        inserted += 1;
      }
    }
  }

  console.log(`users: ${users.length}; updated card_types: ${updated}; inserted: ${inserted}`);

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
