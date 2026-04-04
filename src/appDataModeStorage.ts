const STORAGE_KEY = "mikujar.appDataMode";

export type AppDataMode = "local" | "remote";

export function getStoredAppDataMode(): AppDataMode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "local" || v === "remote") return v;
  } catch {
    /* ignore */
  }
  return null;
}

/** 当前模式：未写过存储时默认云端（与服务器同步）。 */
export function getAppDataMode(): AppDataMode {
  return getStoredAppDataMode() ?? "remote";
}

export function setAppDataMode(mode: AppDataMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* quota */
  }
}
