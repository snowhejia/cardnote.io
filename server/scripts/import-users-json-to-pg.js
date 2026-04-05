#!/usr/bin/env node
/**
 * 将 users.json 导入 PostgreSQL users 表（与 migrate-json-to-pg 中用户段一致）。
 *
 * 用法：
 *   cd server
 *   node scripts/import-users-json-to-pg.js
 * 未传路径时默认读取 data/users.json；也可显式指定文件：
 *   node scripts/import-users-json-to-pg.js /其它路径/users.json
 *
 * 可选：
 *   --upsert        若 id 已存在则更新用户名、密码哈希、显示名、角色、头像（默认：已存在则跳过）
 *   --schema        先建 users 表（执行 schema-users.sql，无需超级权限、兼容旧版 PG）
 *   --full-schema   执行完整 schema.sql（需库支持 pgcrypto；云库若禁止建扩展会失败）
 *
 * 依赖 .env 中的 DATABASE_URL 时可省略命令行里的 DATABASE_URL。
 */

import dotenv from "dotenv";
import { readFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));

const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) {
  console.error("❌ 请设置环境变量 DATABASE_URL（或在命令前临时写上）");
  process.exit(1);
}

const DEFAULT_USERS_JSON = join(__dirname, "../data/users.json");
const jsonPath = args[0] ?? DEFAULT_USERS_JSON;

const upsert = flags.has("--upsert");
const runSchema = flags.has("--schema");
const runFullSchema = flags.has("--full-schema");
const SCHEMA_USERS_PATH = join(__dirname, "schema-users.sql");
const SCHEMA_FULL_PATH = join(__dirname, "schema.sql");

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.PG_SSL === "false" ? false : { rejectUnauthorized: false },
  max: 3,
});

function rowFromJson(u) {
  return [
    u.id,
    u.username,
    u.passwordHash ?? u.password_hash ?? "",
    (u.displayName ?? u.display_name ?? "").trim() || u.username,
    u.role === "admin" ? "admin" : "user",
    u.avatarUrl ?? u.avatar_url ?? "",
  ];
}

async function main() {
  if (runFullSchema) {
    console.log("📐 执行完整 schema.sql（含扩展、合集/卡片、触发器）…");
    const sql = await readFile(SCHEMA_FULL_PATH, "utf8");
    await pool.query(sql);
    console.log("   完成\n");
  } else if (runSchema) {
    console.log("📐 执行 schema-users.sql（仅 users 表）…");
    const sql = await readFile(SCHEMA_USERS_PATH, "utf8");
    await pool.query(sql);
    console.log("   完成\n");
  }

  console.log(`📄 读取：${jsonPath}`);
  let raw;
  try {
    raw = await readFile(jsonPath, "utf8");
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "ENOENT") {
      throw new Error(`找不到文件：${jsonPath}`);
    }
    throw e;
  }
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  const users = JSON.parse(raw);
  if (!Array.isArray(users)) {
    throw new Error("JSON 根节点必须是数组");
  }

  const insertSql = upsert
    ? `INSERT INTO users (id, username, password_hash, display_name, role, avatar_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         username = EXCLUDED.username,
         password_hash = EXCLUDED.password_hash,
         display_name = EXCLUDED.display_name,
         role = EXCLUDED.role,
         avatar_url = EXCLUDED.avatar_url`
    : `INSERT INTO users (id, username, password_hash, display_name, role, avatar_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`;

  let inserted = 0;
  let skipped = 0;
  let upsertOk = 0;
  let errors = 0;

  for (const u of users) {
    if (!u || typeof u.id !== "string" || !u.id.trim()) {
      console.warn("   跳过：缺少 id", u);
      errors++;
      continue;
    }
    if (typeof u.username !== "string" || !u.username.trim()) {
      console.warn("   跳过：缺少 username", u.id);
      errors++;
      continue;
    }
    try {
      const res = await pool.query(insertSql, rowFromJson(u));
      if (upsert) {
        if (res.rowCount > 0) upsertOk++;
      } else {
        if (res.rowCount > 0) inserted++;
        else skipped++;
      }
    } catch (e) {
      if (e.code === "23505") {
        console.warn(
          `   唯一约束冲突（多为 username 已存在）: ${u.username} / ${u.id} — ${e.message}`
        );
        errors++;
      } else {
        throw e;
      }
    }
  }

  if (upsert) {
    console.log(`✅ 完成：按 id 写入或更新 ${upsertOk} 条`);
  } else {
    console.log(`✅ 完成：新插入 ${inserted} 条，id 已存在跳过 ${skipped} 条`);
  }
  if (errors) console.log(`   校验失败或唯一约束冲突：${errors} 条`);
  await pool.end();
}

main().catch((e) => {
  console.error("❌ 导入失败：", e.message || e);
  if (e && typeof e === "object") {
    if ("code" in e && e.code) console.error("   PostgreSQL code:", e.code);
    if ("detail" in e && e.detail) console.error("   detail:", e.detail);
    if ("hint" in e && e.hint) console.error("   hint:", e.hint);
    if ("position" in e && e.position != null) {
      console.error("   position:", e.position);
    }
  }
  process.exit(1);
});
