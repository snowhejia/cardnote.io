/**
 * 加载 server/.env 后测试 PostgreSQL 是否可达（SELECT 1 + server_version）。
 * 使用：cd server && npm run db:test
 */
import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("❌ 未设置 DATABASE_URL。请复制 .env.example 为 .env 并填写。");
  process.exit(1);
}

const redacted = url.replace(/:([^:@]+)@/, ":***@");
const ssl =
  process.env.PG_SSL === "false"
    ? false
    : { rejectUnauthorized: false };

const pool = new pg.Pool({
  connectionString: url,
  ssl,
  max: 1,
  connectionTimeoutMillis: 10_000,
});

try {
  const r = await pool.query("SELECT 1 AS ok, current_database() AS db, current_user AS usr");
  const v = await pool.query("SELECT version() AS v");
  console.log("✅ PostgreSQL 连接成功");
  console.log(`   URL: ${redacted}`);
  console.log(`   数据库: ${r.rows[0]?.db}  用户: ${r.rows[0]?.usr}`);
  console.log(`   ${String(v.rows[0]?.v ?? "").split("\n")[0]}`);
} catch (e) {
  console.error("❌ 连接失败:", e.message ?? e);
  console.error("\n排查：");
  console.error("  · 本地 Docker：在 server 目录执行  docker compose up -d");
  console.error("  · 本机库：检查 DATABASE_URL 端口、用户名密码");
  console.error("  · Docker 实例未开 SSL 时请在 .env 设置 PG_SSL=false");
  process.exit(1);
} finally {
  await pool.end();
}
