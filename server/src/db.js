import pg from "pg";

// PG DATE (OID 1082) 默认被 node-pg 解析成 JS Date，会因时区漂移；
// 业务里我们只关心日期字符串（YYYY-MM-DD），让驱动直接透传文本。
pg.types.setTypeParser(1082, (val) => val);

let pool = null;

/**
 * 在连接串上合并 libpq `options`，为会话设置 statement_timeout（毫秒）。
 * 避免使用 pool.on("connect") 里再 client.query(SET…)：会与 pool.query 抢同一连接并发 query，触发 pg 弃用警告。
 */
function appendStatementTimeoutOption(connectionString, ms = 30_000) {
  const s = String(connectionString || "").trim();
  if (!s) return s;
  try {
    const u = new URL(s);
    const existingOpts = (u.searchParams.get("options") || "").trim();
    if (/statement_timeout/i.test(existingOpts) || /statement_timeout=/i.test(u.href)) {
      return s;
    }
    const flag = `-c statement_timeout=${ms}`;
    u.searchParams.set("options", existingOpts ? `${existingOpts} ${flag}` : flag);
    return u.toString();
  } catch {
    if (/statement_timeout/i.test(s)) return s;
    const sep = s.includes("?") ? "&" : "?";
    return `${s}${sep}options=${encodeURIComponent(`-c statement_timeout=${ms}`)}`;
  }
}

/**
 * 获取（或惰性创建）全局连接池。
 * 须先设置环境变量 DATABASE_URL。
 */
export function getPool() {
  if (pool) return pool;
  const urlRaw = process.env.DATABASE_URL?.trim();
  if (!urlRaw) throw new Error("DATABASE_URL 未配置，请在环境变量中设置 PostgreSQL 连接串（见 server/.env.example）");
  const url = appendStatementTimeoutOption(urlRaw);

  pool = new pg.Pool({
    connectionString: url,
    // 腾讯云 PG 使用 SSL；若需完整证书验证可改为 { ca: fs.readFileSync('...') }
    ssl: process.env.PG_SSL === "false" ? false : { rejectUnauthorized: false },

    max: 10,                          // 最大连接数（腾讯云基础版通常 ≥100）
    min: 2,                           // 保持最小常驻连接，减少冷启动延迟
    idleTimeoutMillis: 30_000,        // 空闲 30s 回收（短于腾讯云 NAT 900s 超时）
    connectionTimeoutMillis: 8_000,   // 建连超时

    // TCP keep-alive：防止 NAT 网关静默断开长闲置连接
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });

  pool.on("error", (err) => {
    // pg 库会自动从池中移除出错的 client，这里只记录日志
    console.error("[pg] idle client error:", err.message);
  });

  return pool;
}

/**
 * 执行单条 SQL，自动从池中借/还连接。
 * 遇到可重试的瞬时错误（连接断开）最多重试一次。
 */
export async function query(sql, params, { retry = 1 } = {}) {
  try {
    return await getPool().query(sql, params);
  } catch (err) {
    const code = err.code ?? err.errno;
    const transient = [
      "ECONNRESET", "ECONNREFUSED", "EPIPE",
      "57P01",  // 管理员终止连接
      "08006",  // 连接失败
      "08001",  // 无法连接
    ].includes(code);
    if (retry > 0 && transient) {
      console.warn("[pg] transient error, retrying:", code);
      await new Promise((r) => setTimeout(r, 200));
      return query(sql, params, { retry: retry - 1 });
    }
    throw err;
  }
}

/** 借出客户端，用于事务。调用方必须 finally { client.release() } */
export async function getClient() {
  return getPool().connect();
}

/** 优雅关闭连接池（SIGTERM 时调用） */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/** 健康检查：SELECT 1；失败则抛出异常 */
export async function pingDb() {
  await query("SELECT 1");
}
