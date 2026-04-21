#!/usr/bin/env node
/**
 * migrate-to-v2.js — 一次性把旧 schema 的数据映射到新 schema。
 *
 * 用法：
 *   # 干跑（事务内执行后回滚，不改库；仅用于排查）
 *   node server/scripts/migrate-to-v2.js --dry-run
 *   # 正式跑（单事务；失败回滚）
 *   node server/scripts/migrate-to-v2.js
 *   # 如存量数据中有 owner_key='__single__' 或 user_id IS NULL 的孤儿行，
 *   # 用 --single-user-id 指定把它们归并到哪个用户：
 *   node server/scripts/migrate-to-v2.js --single-user-id=<uuid>
 *
 * 行为：
 *   1. 把所有旧表重命名为 *_legacy
 *   2. 执行新的 schema.sql（建新表）
 *   3. 按表级映射规则搬数据：users / user_note_prefs → users.prefs_json / collections /
 *      cards + 预设子表 / card_attachments → card_files + 附件卡 + card_links(attachment) /
 *      card_links 旧 → 新 / email_verification_codes / 丢弃 mikujar_deploy_hooks
 *   4. 抽样核验行数与外键
 *   5. DROP 全部 *_legacy 表
 */

import crypto from "crypto";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import dotenv from "dotenv";
import pg from "pg";

import { PRESET_TREE, seedPresetCardTypesForUser } from "../src/cardTypePresets.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const DRY_RUN = process.argv.includes("--dry-run");
const SINGLE_USER_ID = (() => {
  const arg = process.argv.find((a) => a.startsWith("--single-user-id="));
  return arg ? arg.split("=")[1] : null;
})();

const LEGACY_TABLES = [
  "users",
  "collections",
  "cards",
  "card_placements",
  "card_links",
  "card_attachments",
  "email_verification_codes",
  "user_note_prefs",
  "mikujar_deploy_hooks",
];

// 旧 collections.preset_type_id 字符串 → 新 preset card_types.preset_slug
// catalog 已与前端 1:1，恒等映射；多余别名（如 web → clip_bookmark）也在这里处理。
const LEGACY_PRESET_TO_SLUG = {
  person: "person",
  organization: "organization",
  event: "event",
  place: "place",
  topic_concept: "topic_concept",
  post_xhs: "post_xhs",
  post_bilibili: "post_bilibili",
  web: "clip_bookmark",
  note: "note",
  file: "file",
  topic: "topic",
  work: "work",
  clip: "clip",
  task: "task",
  project: "project",
  expense: "expense",
  account: "account",
  bookmark: "clip_bookmark",
  // file 子类
  file_image: "file_image",
  file_video: "file_video",
  file_audio: "file_audio",
  file_document: "file_document",
  file_other: "file_other",
  // note 子类
  note_standard: "note_standard",
  idea: "idea",
  journal: "journal",
  quote: "quote",
  // 旧 v1 → catalog
  note_reading: "note_book",
  note_video: "note_video",
  note_study: "note_standard",
  note_idea: "idea",
  note_diary: "journal",
  note_quote: "quote",
  topic_person: "person",
  topic_org: "organization",
  topic_event: "event",
  topic_place: "place",
  work_film: "work_movie",
  clip_web: "clip_bookmark",
  clip_xhs: "post_xhs",
  clip_bilibili: "post_bilibili",
};

// 旧 cards.object_kind → 新 preset card_types.preset_slug
const OBJECT_KIND_TO_SLUG = {
  note: "note",
  file_image: "file_image",
  file_video: "file_video",
  file_audio: "file_audio",
  file_document: "file_document",
  file_other: "file_other",
  person: "person",
  post_xhs: "post_xhs",
  post_bilibili: "post_bilibili",
  web: "clip_bookmark",
};

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function parseMonthText(text) {
  if (!text || typeof text !== "string") return null;
  const m = text.trim().match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-01`;
}

function boolToDeletionState(pending) {
  return pending ? "pending" : "active";
}

/** 按 (kind) 找 preset 根 slug（如 'note'/'file'/'topic'/'clip'）。 */
function rootSlugForKind(kind) {
  return kind; // 根节点的 slug 恰好就是 kind
}

async function tableExists(client, name) {
  const res = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
    [name]
  );
  return res.rowCount > 0;
}

async function assertLegacyShape(client) {
  for (const t of ["users", "collections", "cards", "card_placements", "card_links"]) {
    if (!(await tableExists(client, t))) {
      throw new Error(`legacy table '${t}' not found — nothing to migrate (or already migrated)`);
    }
  }
  // 如已是新 schema（有 card_types 表），则拒绝重跑
  if (await tableExists(client, "card_types")) {
    throw new Error("new schema already applied (card_types exists) — refusing to re-run");
  }
}

async function renameLegacyTables(client) {
  for (const t of LEGACY_TABLES) {
    if (await tableExists(client, t)) {
      await client.query(`ALTER TABLE ${t} RENAME TO ${t}_legacy`);
    }
  }
  // PG 不会随表名改索引/约束名。为避免与新 schema 冲突，把所有 *_legacy 表上的
  // 索引重命名加前缀。约束（PK/UNIQUE 等）由其索引承担，CHECK 约束名独立。
  const idxRes = await client.query(`
    SELECT i.relname AS idx_name, t.relname AS tbl_name
      FROM pg_class i
      JOIN pg_index x ON x.indexrelid = i.oid
      JOIN pg_class t ON t.oid = x.indrelid
      JOIN pg_namespace n ON n.oid = i.relnamespace
     WHERE n.nspname = 'public' AND t.relname LIKE '%_legacy'
  `);
  for (const r of idxRes.rows) {
    if (!r.idx_name.startsWith("legacy_")) {
      await client.query(
        `ALTER INDEX ${JSON.stringify(r.idx_name)} RENAME TO ${JSON.stringify(
          "legacy_" + r.idx_name
        )}`
      );
    }
  }
  // CHECK 约束也加前缀（避免将来再加名字冲突）
  const conRes = await client.query(`
    SELECT c.conname AS con_name, t.relname AS tbl_name
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public' AND t.relname LIKE '%_legacy'
       AND c.contype IN ('c','f','u','p')
  `);
  for (const r of conRes.rows) {
    if (!r.con_name.startsWith("legacy_")) {
      await client.query(
        `ALTER TABLE ${r.tbl_name} RENAME CONSTRAINT ${JSON.stringify(
          r.con_name
        )} TO ${JSON.stringify("legacy_" + r.con_name)}`
      );
    }
  }

  // 触发器：DROP，避免它们引用被改名的列
  await client.query(`DROP TRIGGER IF EXISTS trg_cards_sync_attachments ON cards_legacy`);
  await client.query(`DROP TRIGGER IF EXISTS trg_col_upd  ON collections_legacy`);
  await client.query(`DROP TRIGGER IF EXISTS trg_card_upd ON cards_legacy`);
  await client.query(`DROP FUNCTION IF EXISTS sync_card_attachments_from_cards_media()`);
  await client.query(`DROP FUNCTION IF EXISTS touch_updated_at()`);
}

async function applyNewSchema(client) {
  const sqlPath = join(__dirname, "schema.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  await client.query(sql);
}

/** 如果旧表有 user_id 可为 NULL 的孤儿行，要求 --single-user-id；返回决议后的 fallback userId。 */
async function resolveSingleUserId(client) {
  const r1 = await client.query(
    `SELECT COUNT(*)::int AS n FROM cards_legacy WHERE user_id IS NULL`
  );
  const r2 = await client.query(
    `SELECT COUNT(*)::int AS n FROM collections_legacy WHERE user_id IS NULL`
  );
  const orphans = (r1.rows[0]?.n || 0) + (r2.rows[0]?.n || 0);
  if (orphans === 0) return null;
  if (!SINGLE_USER_ID) {
    throw new Error(
      `${orphans} legacy rows have user_id IS NULL (single-user mode relic). ` +
        `Re-run with --single-user-id=<uuid> to merge them into a user.`
    );
  }
  const ok = await client.query(`SELECT 1 FROM users_legacy WHERE id=$1`, [SINGLE_USER_ID]);
  if (ok.rowCount === 0) {
    throw new Error(`--single-user-id=${SINGLE_USER_ID} does not exist in users_legacy`);
  }
  return SINGLE_USER_ID;
}

async function migrateUsers(client) {
  const rows = (
    await client.query(`
      SELECT id, username, password_hash, display_name, role, avatar_url, avatar_thumb_url,
             email, media_usage_month, media_uploaded_bytes_month,
             ai_usage_month, ai_note_assist_calls_month,
             deletion_pending, deletion_requested_at, created_at
      FROM users_legacy
    `)
  ).rows;
  for (const u of rows) {
    // 合并两个月份列：取较新的月份作为 usage_month；若两者月份不同，则保守归零计数。
    const mediaMonth = parseMonthText(u.media_usage_month);
    const aiMonth = parseMonthText(u.ai_usage_month);
    let usageMonth = mediaMonth || aiMonth;
    let mediaBytes = Number(u.media_uploaded_bytes_month || 0);
    let aiCalls = Number(u.ai_note_assist_calls_month || 0);
    if (mediaMonth && aiMonth && mediaMonth !== aiMonth) {
      // 月份不一致——以较新的为准，清零另一方
      if (mediaMonth > aiMonth) {
        usageMonth = mediaMonth;
        aiCalls = 0;
      } else {
        usageMonth = aiMonth;
        mediaBytes = 0;
      }
    }

    await client.query(
      `INSERT INTO users (id, username, password_hash, display_name, role,
                          avatar_url, avatar_thumb_url, email,
                          usage_month, media_uploaded_bytes_month, ai_assist_calls_month,
                          prefs_json, deletion_state, deletion_attempts,
                          deletion_requested_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'{}'::jsonb,$12,0,$13,$14)`,
      [
        u.id,
        u.username,
        u.password_hash,
        u.display_name ?? "",
        u.role ?? "user",
        u.avatar_url ?? "",
        u.avatar_thumb_url ?? "",
        u.email,
        usageMonth,
        mediaBytes,
        aiCalls,
        boolToDeletionState(u.deletion_pending),
        u.deletion_requested_at,
        u.created_at,
      ]
    );
  }
  console.log(`  migrated ${rows.length} users`);
}

async function mergeUserNotePrefs(client, fallbackUserId) {
  if (!(await tableExists(client, "user_note_prefs_legacy"))) {
    console.log(`  no user_note_prefs_legacy — skipping`);
    return;
  }
  const rows = (await client.query(`SELECT owner_key, prefs FROM user_note_prefs_legacy`)).rows;
  let n = 0;
  for (const r of rows) {
    const userId = r.owner_key === "__single__" ? fallbackUserId : r.owner_key;
    if (!userId) continue;
    const exists = await client.query(`SELECT 1 FROM users WHERE id=$1`, [userId]);
    if (exists.rowCount === 0) continue;
    await client.query(`UPDATE users SET prefs_json = $2::jsonb WHERE id=$1`, [
      userId,
      JSON.stringify(r.prefs || {}),
    ]);
    n += 1;
  }
  console.log(`  merged ${n} user_note_prefs rows into users.prefs_json`);
}

async function seedPresetsForAllUsers(client) {
  const users = (await client.query(`SELECT id FROM users`)).rows;
  // slugToId[userId][slug] = card_type_id
  const slugToIdByUser = new Map();
  for (const u of users) {
    const { slugToId } = await seedPresetCardTypesForUser(u.id, client);
    slugToIdByUser.set(u.id, slugToId);
  }
  console.log(`  seeded presets for ${users.length} users`);
  return slugToIdByUser;
}

/**
 * 为旧 collections 中 card_schema 非空的行创建自定义 card_type。
 * 返回 Map: collectionId → newCardTypeId（用于 collections.bound_type_id）。
 */
async function createCustomCardTypesFromCollections(client, slugToIdByUser, fallbackUserId) {
  const rows = (
    await client.query(`
      SELECT id, user_id, name, card_schema, preset_type_id
        FROM collections_legacy
       WHERE card_schema IS NOT NULL
         AND card_schema::text <> '{}'
    `)
  ).rows;
  const out = new Map();
  for (const c of rows) {
    const userId = c.user_id || fallbackUserId;
    if (!userId) continue;
    const slugToId = slugToIdByUser.get(userId);
    if (!slugToId) continue;

    const presetSlug = LEGACY_PRESET_TO_SLUG[c.preset_type_id?.trim() || ""] || null;
    const kind = presetSlug
      ? (slugToId.get(presetSlug) ? kindFromSlug(presetSlug) : "custom")
      : "custom";
    const parentTypeId = presetSlug ? slugToId.get(presetSlug) || null : null;

    const id = newId("ct");
    await client.query(
      `INSERT INTO card_types (id, user_id, parent_type_id, kind, name, schema_json, is_preset, preset_slug, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,false,NULL,0)`,
      [id, userId, parentTypeId, kind, c.name || "自定义类型", JSON.stringify(c.card_schema)]
    );
    out.set(c.id, id);
  }
  console.log(`  created ${out.size} custom card_types from collections.card_schema`);
  return out;
}

function kindFromSlug(slug) {
  // slug 以 kind 开头或就等于 kind
  if (!slug) return "custom";
  const head = slug.split("_")[0];
  const valid = [
    "note",
    "file",
    "bookmark",
    "topic",
    "work",
    "clip",
    "task",
    "project",
    "expense",
    "account",
  ];
  return valid.includes(head) ? head : "custom";
}

async function migrateCollections(client, customTypeByColId, fallbackUserId) {
  const rows = (
    await client.query(`
      SELECT id, user_id, parent_id, name, dot_color, hint, sort_order,
             is_favorite, favorite_sort, is_category, card_schema, preset_type_id,
             created_at, updated_at
        FROM collections_legacy
       ORDER BY parent_id NULLS FIRST
    `)
  ).rows;

  for (const c of rows) {
    const userId = c.user_id || fallbackUserId;
    if (!userId) continue;

    let boundTypeId = customTypeByColId.get(c.id) || null;
    if (!boundTypeId && c.preset_type_id) {
      const slug = LEGACY_PRESET_TO_SLUG[c.preset_type_id.trim()];
      if (slug) {
        const res = await client.query(
          `SELECT id FROM card_types WHERE user_id=$1 AND preset_slug=$2`,
          [userId, slug]
        );
        if (res.rows[0]) boundTypeId = res.rows[0].id;
      }
    }

    await client.query(
      `INSERT INTO collections (id, user_id, parent_id, bound_type_id, name, description,
                                dot_color, sort_order, is_favorite, favorite_sort,
                                created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        c.id,
        userId,
        c.parent_id,
        boundTypeId,
        c.name ?? "",
        c.hint ?? "",
        c.dot_color ?? "",
        c.sort_order ?? 0,
        !!c.is_favorite,
        c.favorite_sort,
        c.created_at,
        c.updated_at,
      ]
    );
  }
  console.log(`  migrated ${rows.length} collections`);
}

/** 对单张旧卡决议 (card_type_id, kind, presetSlug)。 */
function resolveCardType(row, slugToId) {
  const ok = (row.object_kind || "note").trim() || "note";
  const slug = OBJECT_KIND_TO_SLUG[ok] || "note";
  const id = slugToId.get(slug);
  return { cardTypeId: id, kind: kindFromSlug(slug), presetSlug: slug };
}

/** 把 media JSONB 元素规范化为 card_files 字段 + 富元数据。 */
function normalizeMedia(elem) {
  if (!elem || typeof elem !== "object") return null;
  const url = String(elem.url || "").trim();
  if (!url) return null;
  const kindRaw = String(elem.kind || "").toLowerCase();
  const kind = ["image", "video", "audio", "file"].includes(kindRaw) ? kindRaw : "file";
  const numOrNull = (v) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v.trim());
    return null;
  };
  const bytesRaw = elem.sizeBytes;
  const bytes =
    typeof bytesRaw === "number" && Number.isFinite(bytesRaw)
      ? Math.trunc(bytesRaw)
      : typeof bytesRaw === "string" && /^[0-9]+$/.test(bytesRaw)
      ? Number(bytesRaw)
      : null;
  return {
    url,
    original_name: String(elem.name || ""),
    thumb_url: String(elem.thumbnailUrl || ""),
    cover_url: String(elem.coverUrl || ""),
    cover_thumb_url: String(elem.coverThumbnailUrl || elem.coverThumbUrl || ""),
    bytes,
    kind,
    durationSec: numOrNull(elem.durationSec),
    widthPx: numOrNull(elem.widthPx),
    heightPx: numOrNull(elem.heightPx),
  };
}

/**
 * 根据文件子类构造与 catalog 一致的 custom_props，把 durationSec/widthPx/heightPx
 * 写到 schema field id 上，前端可直接读出展示。
 */
function buildFileCustomPropsFromMedia(slug, m) {
  const props = [];
  if (m.widthPx != null && m.heightPx != null) {
    props.push({ id: "sf-file-resolution", value: `${Math.round(m.widthPx)}x${Math.round(m.heightPx)}` });
  }
  if (slug === "file_video") {
    if (m.durationSec != null) {
      props.push({ id: "sf-vid-duration-sec", value: Math.round(m.durationSec) });
    }
    if (m.widthPx != null && m.heightPx != null) {
      props.push({ id: "sf-vid-resolution", value: `${Math.round(m.widthPx)}x${Math.round(m.heightPx)}` });
    }
  } else if (slug === "file_audio") {
    if (m.durationSec != null) {
      props.push({ id: "sf-aud-duration-sec", value: Math.round(m.durationSec) });
    }
  }
  return props;
}

/** 把一个 kind→preset_slug 字符串返回：图片/视频/音频/文档/其他 */
function fileKindToSlug(kind) {
  return (
    {
      image: "file_image",
      video: "file_video",
      audio: "file_audio",
      file: "file_document",
    }[kind] || "file_document"
  );
}

async function migrateCards(client, slugToIdByUser, fallbackUserId) {
  // 先取所有卡。order: file_* 先，其他后 —— note→fileCard 的 attachment link
  // 才能在目标 file 卡已经 INSERT 后再写入（满足 FK）。
  const rows = (
    await client.query(`
      SELECT id, user_id, text, minutes_of_day, added_on,
             reminder_on, reminder_time, reminder_note,
             reminder_completed_at, reminder_completed_note,
             tags, related_refs, media, custom_props, object_kind,
             trashed_at, trash_col_id, trash_col_path_label,
             created_at, updated_at
        FROM cards_legacy
       ORDER BY (CASE WHEN object_kind LIKE 'file_%' THEN 0 ELSE 1 END), id
    `)
  ).rows;

  // (user_id, url) → 已存在的文件卡 id：避免遍历 note.media 时把"已经独立成 file 卡的 url"
  // 又重复展开一次。先扫描旧 file 卡（object_kind LIKE 'file_%') 的 media[0].url 建索引。
  const urlToFileCard = new Map(); // key: `${user_id}\u0001${url}` → file_card_id
  for (const c of rows) {
    const ok = (c.object_kind || "").trim();
    if (!ok.startsWith("file_")) continue;
    const userId = c.user_id || fallbackUserId;
    if (!userId) continue;
    const mediaArr = Array.isArray(c.media) ? c.media : [];
    const main = mediaArr[0] ? normalizeMedia(mediaArr[0]) : null;
    if (!main || !main.url) continue;
    urlToFileCard.set(`${userId}\u0001${main.url}`, c.id);
  }

  let noteN = 0;
  let fileN = 0;
  let subN = 0;
  let attachmentN = 0;
  let reminderN = 0;

  for (const c of rows) {
    const userId = c.user_id || fallbackUserId;
    if (!userId) continue;
    const slugToId = slugToIdByUser.get(userId);
    if (!slugToId) continue;

    const { cardTypeId, kind, presetSlug } = resolveCardType(c, slugToId);
    if (!cardTypeId) {
      console.warn(`  ! cannot resolve card_type for card ${c.id}; skipped`);
      continue;
    }

    const addedOn = typeof c.added_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.added_on)
      ? c.added_on
      : null;

    // trash snapshot
    const trashSnapshot =
      c.trashed_at && (c.trash_col_id || c.trash_col_path_label)
        ? { colId: c.trash_col_id || null, pathLabel: c.trash_col_path_label || "" }
        : null;

    // 插入 cards 基表
    await client.query(
      `INSERT INTO cards (id, user_id, card_type_id, title, body, added_on,
                          minutes_of_day, tags, custom_props, cover_thumb_url,
                          trashed_at, trash_snapshot_json, created_at, updated_at)
       VALUES ($1,$2,$3,'',$4,$5,$6,$7,$8::jsonb,'',$9,$10,$11,$12)`,
      [
        c.id,
        userId,
        cardTypeId,
        c.text ?? "",
        addedOn,
        c.minutes_of_day ?? 0,
        c.tags || [],
        JSON.stringify(c.custom_props ?? []),
        c.trashed_at,
        trashSnapshot ? JSON.stringify(trashSnapshot) : null,
        c.created_at,
        c.updated_at,
      ]
    );

    // 把 cards.media[] 当作附件展开成 file 卡 + attachment 链。
    // 适用于 note / clip / topic / work / task / project / expense / account / bookmark
    // 等所有"非 file"大类（file 卡自身的 media[0] 在下面 file 分支处理）。
    async function migrateMediaAsAttachments() {
      const mediaArr = Array.isArray(c.media) ? c.media : [];
      for (let i = 0; i < mediaArr.length; i += 1) {
        const m = normalizeMedia(mediaArr[i]);
        if (!m) continue;
        const fileSlug = fileKindToSlug(m.kind);
        const fileTypeId = slugToId.get(fileSlug);
        if (!fileTypeId) continue;

        const cacheKey = `${userId}\u0001${m.url}`;
        let fileCardId = urlToFileCard.get(cacheKey);
        if (!fileCardId) {
          fileCardId = newId("card");
          const cp = buildFileCustomPropsFromMedia(fileSlug, m);
          await client.query(
            `INSERT INTO cards (id, user_id, card_type_id, title, body, custom_props, created_at, updated_at)
             VALUES ($1,$2,$3,$4,'',$5::jsonb,$6,$6)`,
            [fileCardId, userId, fileTypeId, m.original_name || "", JSON.stringify(cp), c.created_at]
          );
          await client.query(
            `INSERT INTO card_files (card_id, url, original_name, thumb_url, cover_url, cover_thumb_url, bytes)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [fileCardId, m.url, m.original_name, m.thumb_url, m.cover_url, m.cover_thumb_url, m.bytes]
          );
          urlToFileCard.set(cacheKey, fileCardId);
        }
        await client.query(
          `INSERT INTO card_links (from_card_id, property_key, to_card_id, target_type_id, user_id, sort_order)
           VALUES ($1,'attachment',$2,$3,$4,$5)
           ON CONFLICT (from_card_id, property_key, to_card_id) DO NOTHING`,
          [c.id, fileCardId, fileTypeId, userId, i]
        );
        attachmentN += 1;
      }
    }

    // 写子表
    if (kind === "note") {
      await client.query(
        `INSERT INTO card_notes (card_id, format, rich_body_json) VALUES ($1,'plain',NULL)`,
        [c.id]
      );
      noteN += 1;
      await migrateMediaAsAttachments();
    } else if (kind === "file") {
      // file 卡自身：取 media[0] 作为主文件，把 duration/resolution 合并进 custom_props
      const mediaArr = Array.isArray(c.media) ? c.media : [];
      const main = mediaArr[0] ? normalizeMedia(mediaArr[0]) : null;
      if (main) {
        const fromMedia = buildFileCustomPropsFromMedia(presetSlug, main);
        if (fromMedia.length > 0) {
          const existing = Array.isArray(c.custom_props) ? c.custom_props : [];
          const merged = [...existing];
          for (const p of fromMedia) {
            if (!merged.some((x) => x?.id === p.id)) merged.push(p);
          }
          await client.query(
            `UPDATE cards SET custom_props = $2::jsonb WHERE id = $1`,
            [c.id, JSON.stringify(merged)]
          );
        }
      }
      await client.query(
        `INSERT INTO card_files (card_id, url, original_name, thumb_url, cover_url, cover_thumb_url, bytes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          c.id,
          main?.url || "",
          main?.original_name || "",
          main?.thumb_url || "",
          main?.cover_url || "",
          main?.cover_thumb_url || "",
          main?.bytes ?? null,
        ]
      );
      fileN += 1;
    } else if (kind === "topic") {
      await client.query(
        `INSERT INTO card_topics (card_id, color, summary) VALUES ($1,'','')`,
        [c.id]
      );
      subN += 1;
      await migrateMediaAsAttachments();
    } else if (kind === "clip") {
      // 从 custom_props 抽取 source_url/source_id
      const cp = Array.isArray(c.custom_props) ? c.custom_props : [];
      const props = Object.fromEntries(
        cp
          .map((p) => [p?.key, p?.value])
          .filter(([k]) => typeof k === "string" && k)
      );
      const srcUrl = String(props.source_url || props.sourceUrl || props.url || "").trim();
      const srcId = String(props.source_id || props.bvid || props.note_id || "").trim();
      await client.query(
        `INSERT INTO card_clips (card_id, source_url, source_id, author_card_id)
         VALUES ($1,$2,$3,NULL)`,
        [c.id, srcUrl, srcId]
      );
      subN += 1;
      await migrateMediaAsAttachments();
    } else {
      // 其他 kind（work/task/bookmark/project/expense/account 等）：
      // 不写专属子表（其表结构未在存量数据出现），但保留附件链
      await migrateMediaAsAttachments();
    }

    // reminder 拆表
    if (c.reminder_on && typeof c.reminder_on === "string") {
      const datePart = c.reminder_on.trim();
      const timePart = (c.reminder_time || "").trim() || "00:00";
      const mdate = datePart.match(/^(\d{4}-\d{2}-\d{2})/);
      const mtime = timePart.match(/^(\d{2}:\d{2})/);
      if (mdate) {
        const iso = `${mdate[1]}T${mtime ? mtime[1] : "00:00"}:00`;
        const completedAtTxt = (c.reminder_completed_at || "").trim() || null;
        await client.query(
          `INSERT INTO card_reminders (card_id, user_id, due_at, note, completed_at, completed_note)
           VALUES ($1,$2,$3::timestamptz,$4,$5::timestamptz,$6)
           ON CONFLICT (card_id) DO NOTHING`,
          [
            c.id,
            userId,
            iso,
            c.reminder_note || "",
            completedAtTxt,
            c.reminder_completed_note || "",
          ]
        );
        reminderN += 1;
      }
    }
  }
  console.log(
    `  migrated ${rows.length} cards (note=${noteN}, file=${fileN}, sub=${subN}) + ${attachmentN} attachment-cards + ${reminderN} reminders`
  );
}

async function migratePlacements(client, fallbackUserId) {
  const rows = (
    await client.query(`
      SELECT p.card_id, p.collection_id, p.pinned, p.sort_order
        FROM card_placements_legacy p
        JOIN cards_legacy c ON c.id = p.card_id
        JOIN collections_legacy col ON col.id = p.collection_id
    `)
  ).rows;
  for (const p of rows) {
    await client.query(
      `INSERT INTO card_placements (card_id, collection_id, pinned, sort_order)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (card_id, collection_id) DO NOTHING`,
      [p.card_id, p.collection_id, !!p.pinned, p.sort_order ?? 0]
    );
  }
  console.log(`  migrated ${rows.length} placements`);
}

async function migrateCardLinks(client, fallbackUserId) {
  const rows = (
    await client.query(`
      SELECT user_id, from_card_id, to_card_id, link_type, meta, created_at
        FROM card_links_legacy
    `)
  ).rows;
  let n = 0;
  for (const l of rows) {
    const userId = l.user_id || fallbackUserId;
    if (!userId) continue;
    // 目标 card_type 缓存：查新 cards 表
    const tt = await client.query(`SELECT card_type_id FROM cards WHERE id=$1`, [l.to_card_id]);
    const targetTypeId = tt.rows[0]?.card_type_id || null;
    await client.query(
      `INSERT INTO card_links (from_card_id, property_key, to_card_id, target_type_id, user_id, sort_order, meta, created_at)
       VALUES ($1,$2,$3,$4,$5,0,$6::jsonb,$7)
       ON CONFLICT (from_card_id, property_key, to_card_id) DO NOTHING`,
      [l.from_card_id, l.link_type || "related", l.to_card_id, targetTypeId, userId, l.meta || {}, l.created_at]
    );
    n += 1;
  }
  console.log(`  migrated ${n}/${rows.length} card_links`);
}

async function migrateEmailVerCodes(client) {
  const rows = (
    await client.query(`
      SELECT kind, subject_key, email, code_hash, expires_at, created_at, user_id
        FROM email_verification_codes_legacy
    `)
  ).rows;
  for (const r of rows) {
    await client.query(
      `INSERT INTO email_verification_codes (kind, subject_key, email, code_hash, expires_at, created_at, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (kind, subject_key) DO NOTHING`,
      [r.kind, r.subject_key, r.email, r.code_hash, r.expires_at, r.created_at, r.user_id]
    );
  }
  console.log(`  migrated ${rows.length} email_verification_codes`);
}

async function verifyMigration(client) {
  const checks = [
    [`orphan cards without type`, `SELECT COUNT(*)::int AS n FROM cards WHERE card_type_id NOT IN (SELECT id FROM card_types)`],
    [`orphan placements (card)`, `SELECT COUNT(*)::int AS n FROM card_placements WHERE card_id NOT IN (SELECT id FROM cards)`],
    [`orphan placements (col)`, `SELECT COUNT(*)::int AS n FROM card_placements WHERE collection_id NOT IN (SELECT id FROM collections)`],
    [`orphan card_links (from)`, `SELECT COUNT(*)::int AS n FROM card_links WHERE from_card_id NOT IN (SELECT id FROM cards)`],
    [`orphan card_links (to)`, `SELECT COUNT(*)::int AS n FROM card_links WHERE to_card_id NOT IN (SELECT id FROM cards)`],
    [`orphan card_files`, `SELECT COUNT(*)::int AS n FROM card_files WHERE card_id NOT IN (SELECT id FROM cards)`],
  ];
  for (const [label, sql] of checks) {
    const r = await client.query(sql);
    const n = r.rows[0]?.n || 0;
    if (n > 0) throw new Error(`verify failed: ${label} = ${n}`);
  }
  console.log(`  verify: all FK-integrity checks passed`);
}

async function dropLegacyTables(client) {
  for (const t of LEGACY_TABLES) {
    const name = `${t}_legacy`;
    if (await tableExists(client, name)) {
      await client.query(`DROP TABLE ${name} CASCADE`);
    }
  }
  console.log(`  dropped all *_legacy tables`);
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("❌ DATABASE_URL not set");
    process.exit(1);
  }

  const ssl = process.env.PG_SSL === "false" ? false : { rejectUnauthorized: false };
  const client = new pg.Client({ connectionString: url, ssl });
  await client.connect();

  try {
    await client.query("BEGIN");

    console.log("[1/11] Assert legacy shape…");
    await assertLegacyShape(client);

    console.log("[2/11] Rename legacy tables…");
    await renameLegacyTables(client);

    console.log("[3/11] Apply new schema.sql…");
    await applyNewSchema(client);

    console.log("[4/11] Resolve single-user fallback…");
    const fallback = await resolveSingleUserId(client);

    console.log("[5/11] Migrate users…");
    await migrateUsers(client);

    console.log("[6/11] Merge user_note_prefs → users.prefs_json…");
    await mergeUserNotePrefs(client, fallback);

    console.log("[7/11] Seed preset card_types per user…");
    const slugToIdByUser = await seedPresetsForAllUsers(client);

    console.log("[8/11] Create custom card_types from collections.card_schema…");
    const customTypeByColId = await createCustomCardTypesFromCollections(
      client,
      slugToIdByUser,
      fallback
    );

    console.log("[9/11] Migrate collections…");
    await migrateCollections(client, customTypeByColId, fallback);

    console.log("[10/11] Migrate cards + subtables + attachments + reminders…");
    await migrateCards(client, slugToIdByUser, fallback);

    console.log("        Migrate card_placements…");
    await migratePlacements(client, fallback);

    console.log("        Migrate card_links…");
    await migrateCardLinks(client, fallback);

    console.log("        Migrate email_verification_codes…");
    await migrateEmailVerCodes(client);

    console.log("[11/11] Verify FK integrity…");
    await verifyMigration(client);

    if (!DRY_RUN) {
      console.log("        Drop legacy tables…");
      await dropLegacyTables(client);
    }

    if (DRY_RUN) {
      console.log("\n🧪 DRY RUN — rolling back all changes");
      await client.query("ROLLBACK");
    } else {
      await client.query("COMMIT");
      console.log("\n✅ Migration committed");
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("\n❌ Migration failed:", err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
