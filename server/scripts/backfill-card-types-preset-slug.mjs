#!/usr/bin/env node
/**
 * 把已迁移库里 card_types.preset_slug 为空的非系统行，按 name 反推 legacy preset_type_id
 * 并写入 preset_slug，让前端侧栏能按它匹配 PRESET_OBJECT_TYPES_GROUPS。
 *
 * 仅处理 is_preset=false 且 preset_slug IS NULL 的行（系统预设不动）。
 *
 * 用法：
 *   node scripts/backfill-card-types-preset-slug.mjs --dry-run
 *   node scripts/backfill-card-types-preset-slug.mjs
 */

import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const DRY = process.argv.includes("--dry-run");

/** 与前端 notePresetTypesCatalog.ts 完全一致的 nameZh → preset id 映射 */
const NAME_TO_PRESET_ID = {
  // 顶层大类
  笔记: "note",
  文件: "file",
  网页: "web",
  主题: "topic",
  作品: "work",
  剪藏: "clip",
  任务: "task",
  项目: "project",
  开支: "expense",
  账户: "account",
  // note 子类
  学习: "note_standard",
  灵感: "idea",
  日记: "journal",
  摘抄: "quote",
  // file 子类
  图片: "file_image",
  视频: "file_video",
  音频: "file_audio",
  文档: "file_document",
  其他: "file_other",
  // topic 子类
  人物: "person",
  组织: "organization",
  事件: "event",
  地点: "place",
  概念: "topic_concept",
  // work 子类
  书籍: "work_book",
  影视: "work_movie",
  动漫: "work_anime",
  音乐: "work_music",
  游戏: "work_game",
  文章: "work_article",
  课程: "work_course",
  应用: "work_app",
  // clip 子类
  网页剪藏: "clip_bookmark",
  小红书: "post_xhs",
  "B 站": "post_bilibili",
  B站: "post_bilibili",
  // task 子类
  待办: "task_todo",
  习惯打卡: "habit_log",
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
  const rows = (
    await client.query(
      `SELECT id, user_id, name FROM card_types
        WHERE is_preset = false AND preset_slug IS NULL`
    )
  ).rows;

  let mapped = 0;
  let merged = 0;
  let skipped = 0;
  for (const r of rows) {
    const name = String(r.name || "").trim();
    const presetId = NAME_TO_PRESET_ID[name];
    if (!presetId) {
      skipped += 1;
      continue;
    }
    const dup = await client.query(
      `SELECT id FROM card_types WHERE user_id = $1 AND preset_slug = $2 LIMIT 1`,
      [r.user_id, presetId]
    );
    if (dup.rowCount > 0) {
      // 已存在同 slug 的系统预设：把所有指向自定义 r.id 的引用改指向系统预设 dup.id，
      // 然后删除自定义 card_type。
      const systemId = dup.rows[0].id;
      await client.query(
        `UPDATE collections SET bound_type_id = $2 WHERE bound_type_id = $1`,
        [r.id, systemId]
      );
      await client.query(
        `UPDATE cards SET card_type_id = $2 WHERE card_type_id = $1`,
        [r.id, systemId]
      );
      await client.query(
        `UPDATE card_links SET target_type_id = $2 WHERE target_type_id = $1`,
        [r.id, systemId]
      );
      await client.query(
        `UPDATE card_link_rules SET source_type_id = $2 WHERE source_type_id = $1`,
        [r.id, systemId]
      );
      await client.query(
        `UPDATE card_link_rules SET target_type_id = $2 WHERE target_type_id = $1`,
        [r.id, systemId]
      );
      // 子类型 parent_type_id 指向自定义的，也改为系统预设
      await client.query(
        `UPDATE card_types SET parent_type_id = $2 WHERE parent_type_id = $1`,
        [r.id, systemId]
      );
      await client.query(`DELETE FROM card_types WHERE id = $1`, [r.id]);
      merged += 1;
      continue;
    }
    await client.query(`UPDATE card_types SET preset_slug = $2 WHERE id = $1`, [r.id, presetId]);
    mapped += 1;
  }
  console.log(`processed: ${rows.length}; mapped: ${mapped}; merged-into-preset: ${merged}; skipped: ${skipped}`);

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
