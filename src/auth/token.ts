const KEY = "mikujar_admin_jwt";

/**
 * JWT 存 localStorage，减少 Safari 关标签 / 进程回收时 sessionStorage 被清空导致的「突然掉登录」。
 * 启动时若仅在 sessionStorage 有旧数据则迁移过来并清掉 session。
 */
export function getAdminToken(): string | null {
  try {
    const fromLs = localStorage.getItem(KEY);
    if (fromLs) return fromLs;
    const fromSs = sessionStorage.getItem(KEY);
    if (fromSs) {
      try {
        localStorage.setItem(KEY, fromSs);
      } catch {
        /* quota / 隐私模式：退回仅 session */
        return fromSs;
      }
      sessionStorage.removeItem(KEY);
      return fromSs;
    }
  } catch {
    return null;
  }
  return null;
}

export function setAdminToken(token: string): void {
  try {
    localStorage.setItem(KEY, token);
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  } catch {
    try {
      sessionStorage.setItem(KEY, token);
    } catch {
      /* ignore */
    }
  }
}

export function clearAdminToken(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
