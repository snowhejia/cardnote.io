import { getAdminToken } from "../auth/token";
import { apiBase, remoteApiBase } from "./apiBase";

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
  avatarUrl: string;
};

/**
 * 媒体地址：绝对 URL 原样返回。
 * - `/uploads/…` 由后端（或 COS 回写为绝对地址）提供，分域部署时补全为 API 根。
 * - 其它以 `/` 开头的路径视为**前端静态资源**（Vite `public/` 等），与当前页面同源，
 *   不可拼到 API 上，否则云端未登录示例图会 404，与本地模式不一致。
 */
export function resolveMediaUrl(pathOrUrl: string): string {
  const p = pathOrUrl.trim();
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  if (/^data:/i.test(p)) return p;
  if (/^blob:/i.test(p)) return p;
  const base = apiBase();
  const normalized = p.startsWith("/") ? p : `/${p}`;
  if (base && normalized.startsWith("/uploads/")) {
    return `${base}${normalized}`;
  }
  return normalized;
}

export async function fetchAuthStatus(): Promise<{
  writeRequiresLogin: boolean;
}> {
  const base = apiBase();
  const remoteBase = base.length > 0;
  try {
    const r = await fetch(`${base}/api/auth/status`);
    if (!r.ok) {
      // 已指向绝对地址的云端却拿不到状态：按「需要登录」处理，避免既不显示登录又无法同步
      return { writeRequiresLogin: remoteBase ? true : false };
    }
    const j = (await r.json()) as { writeRequiresLogin?: unknown };
    return { writeRequiresLogin: Boolean(j.writeRequiresLogin) };
  } catch {
    return { writeRequiresLogin: remoteBase ? true : false };
  }
}

export async function loginWithCredentials(
  username: string,
  password: string
): Promise<
  | { ok: true; token: string; user: AuthUser }
  | { ok: false; error: string }
> {
  const base = remoteApiBase();
  try {
    const r = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim(), password }),
    });
    const j = (await r.json().catch(() => ({}))) as {
      token?: unknown;
      user?: unknown;
      error?: unknown;
    };
    if (!r.ok) {
      return {
        ok: false,
        error: typeof j.error === "string" ? j.error : "登录失败",
      };
    }
    if (typeof j.token !== "string" || !j.user || typeof j.user !== "object") {
      return { ok: false, error: "响应无效" };
    }
    const u = j.user as AuthUser;
    if (!u.id || !u.username) {
      return { ok: false, error: "响应无效" };
    }
    return { ok: true, token: j.token, user: u };
  } catch {
    return { ok: false, error: "网络错误" };
  }
}

export async function fetchAuthMe(): Promise<{
  ok: boolean;
  admin: boolean;
  user: AuthUser | null;
  /** 仅 true 时应清除本地 JWT（401/403）；网络抖动、5xx 勿清，避免误像「掉登录」 */
  sessionInvalid?: boolean;
}> {
  const token = getAdminToken();
  if (!token) {
    return { ok: false, admin: false, user: null };
  }
  const base = remoteApiBase();
  try {
    const r = await fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.status === 401 || r.status === 403) {
      return {
        ok: false,
        admin: false,
        user: null,
        sessionInvalid: true,
      };
    }
    if (!r.ok) {
      return { ok: false, admin: false, user: null };
    }
    const j = (await r.json()) as {
      ok?: unknown;
      admin?: unknown;
      user?: AuthUser | null;
    };
    return {
      ok: Boolean(j.ok),
      admin: Boolean(j.admin),
      user: j.user ?? null,
    };
  } catch {
    return { ok: false, admin: false, user: null };
  }
}

const ME_RETRY_COUNT = 3;
const ME_RETRY_DELAY_MS = 400;

/** 校验会话时带重试，减轻弱网下 /me 偶发失败 → 误当成未登录 */
export async function fetchAuthMeWithRetry(): Promise<{
  ok: boolean;
  admin: boolean;
  user: AuthUser | null;
  sessionInvalid?: boolean;
}> {
  let last = await fetchAuthMe();
  if (last.ok && last.user) return last;
  if (last.sessionInvalid) return last;
  const token = getAdminToken();
  if (!token) return last;
  for (let i = 1; i < ME_RETRY_COUNT; i++) {
    await new Promise((r) => setTimeout(r, ME_RETRY_DELAY_MS));
    last = await fetchAuthMe();
    if (last.ok && last.user) return last;
    if (last.sessionInvalid) return last;
  }
  return last;
}
