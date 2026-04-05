import { getAppDataMode } from "../appDataModeStorage";

/** Tauri 未配置 `VITE_API_BASE` 时的默认云端 API */
export const DEFAULT_TAURI_REMOTE_API = "https://api.notes.hejiac.com";

/**
 * 云端 API 根（不受「本地/云端数据模式」影响），供登录、/me 等鉴权请求使用。
 */
function remoteApiBaseResolved(): string {
  const b = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  if (b) return b.replace(/\/$/, "");
  if (typeof __TAURI_BUILD__ !== "undefined" && __TAURI_BUILD__) {
    const override = (
      import.meta.env.VITE_TAURI_API_PORT as string | undefined
    )?.trim();
    if (override && /^\d+$/.test(override)) {
      return `http://127.0.0.1:${override}`;
    }
    return DEFAULT_TAURI_REMOTE_API.replace(/\/$/, "");
  }
  return "";
}

/** 与 {@link apiBase} 相同，但本地数据模式下仍返回云端根地址，用于校验会话、避免误清 token */
export function remoteApiBase(): string {
  return remoteApiBaseResolved();
}

/**
 * API 根地址（无尾部斜杠）。
 * - **本地数据模式**：不连远程（返回 `""`；笔记读写走本地存储）。
 * - **云端数据模式** + `VITE_API_BASE`：优先使用该地址（Vercel 等）。
 * - **云端数据模式** + Tauri 构建且未配 `VITE_API_BASE`：`DEFAULT_TAURI_REMOTE_API`。
 * - **云端数据模式** + 浏览器开发：`""`，走 Vite 对 `/api`、`/uploads` 的代理。
 */
export function apiBase(): string {
  if (getAppDataMode() === "local") return "";
  return remoteApiBaseResolved();
}

/**
 * 跨域访问绝对地址的 API 时须 `include` 才会带上 httpOnly 登录 Cookie。
 * 走 Vite 同源代理时保持 same-origin 即可。
 */
export function apiFetchCredentials(): RequestCredentials {
  const raw = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  if (raw && /^https?:\/\//i.test(raw)) return "include";
  if (typeof __TAURI_BUILD__ !== "undefined" && __TAURI_BUILD__) {
    return "include";
  }
  return "same-origin";
}

/** 合并 fetch 第二参数，默认带上 {@link apiFetchCredentials} */
export function apiFetchInit(extra?: RequestInit): RequestInit {
  return {
    ...extra,
    credentials: extra?.credentials ?? apiFetchCredentials(),
  };
}
