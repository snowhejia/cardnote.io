import type { Collection } from "../types";
import { getAdminToken } from "../auth/token";
import { apiBase } from "./apiBase";

/** GET：多用户模式下需携带登录 JWT（或脚本用的 API_TOKEN + 服务端要求的 userId） */
function buildHeadersGet(): Record<string, string> {
  const h: Record<string, string> = {};
  const token = getAdminToken();
  if (token) h.Authorization = `Bearer ${token}`;
  else {
    const t = (import.meta.env.VITE_API_TOKEN as string | undefined)?.trim();
    if (t) h.Authorization = `Bearer ${t}`;
  }
  return h;
}

/** PUT：优先会话中的管理员 JWT，其次兼容 VITE_API_TOKEN */
function buildHeadersPut(
  extra?: Record<string, string>
): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  const admin = getAdminToken();
  if (admin) {
    h.Authorization = `Bearer ${admin}`;
    return h;
  }
  const t = (import.meta.env.VITE_API_TOKEN as string | undefined)?.trim();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

/** 拉取合集树；null 表示请求失败（网络或非 2xx） */
export async function fetchCollectionsFromApi(): Promise<
  Collection[] | null
> {
  const base = apiBase();
  try {
    const r = await fetch(`${base}/api/collections`, {
      headers: buildHeadersGet(),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as unknown;
    if (!Array.isArray(data)) return null;
    return data as Collection[];
  } catch {
    return null;
  }
}

export async function saveCollectionsToApi(
  data: Collection[]
): Promise<boolean> {
  const base = apiBase();
  try {
    const r = await fetch(`${base}/api/collections`, {
      method: "PUT",
      headers: buildHeadersPut({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    return r.ok;
  } catch {
    return false;
  }
}
