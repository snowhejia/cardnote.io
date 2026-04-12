/** 存储键，值为 "1"…"6" */
export const TIMELINE_COLUMNS_STORAGE_KEY = "mikujar-timeline-columns";

/** 新安装 / 无记录时的默认列数 */
export const DEFAULT_TIMELINE_COLUMNS = 2 as const;

/** 旧键，仅迁移时读取 */
const LEGACY_MASONRY_LAYOUT_KEY = "mikujar-masonry-layout";
const LEGACY_MASONRY_COLUMNS_KEY = "mikujar-masonry-columns";

/**
 * 时间线列数：`1` 单列列表，`2`–`6` 瀑布流。
 */
export type TimelineColumnPreference = 1 | 2 | 3 | 4 | 5 | 6;

/** 顶栏步进器（宽屏） */
export const TIMELINE_COLUMN_STEPS_WIDE: readonly TimelineColumnPreference[] =
  [1, 2, 3, 4, 5, 6];

/** 窄屏 / 手机：最多 2 列 */
export const TIMELINE_COLUMN_STEPS_NARROW: readonly TimelineColumnPreference[] =
  [1, 2];

export function timelineColumnSteps(
  narrow: boolean
): readonly TimelineColumnPreference[] {
  return narrow ? TIMELINE_COLUMN_STEPS_NARROW : TIMELINE_COLUMN_STEPS_WIDE;
}

function parseTimelinePref(
  v: string | null
): TimelineColumnPreference | null {
  if (v === "1") return 1;
  if (v === "2" || v === "3" || v === "4" || v === "5" || v === "6") {
    return Number(v) as TimelineColumnPreference;
  }
  /** 旧版「自动」改为默认列数 */
  if (v === "auto") return DEFAULT_TIMELINE_COLUMNS;
  return null;
}

function migrateLegacyTimelinePreference(): TimelineColumnPreference {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_TIMELINE_COLUMNS;
    const layout = localStorage.getItem(LEGACY_MASONRY_LAYOUT_KEY);
    const wasMasonry = layout === "1";
    if (wasMasonry) {
      const c = localStorage.getItem(LEGACY_MASONRY_COLUMNS_KEY);
      const p = parseTimelinePref(c);
      if (p !== null) return p;
      return DEFAULT_TIMELINE_COLUMNS;
    }
    if (layout === "0") return 1;
    return DEFAULT_TIMELINE_COLUMNS;
  } catch {
    return DEFAULT_TIMELINE_COLUMNS;
  }
}

export function readTimelineColumnPreferenceFromStorage(): TimelineColumnPreference {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_TIMELINE_COLUMNS;
    const raw = localStorage.getItem(TIMELINE_COLUMNS_STORAGE_KEY);
    const p = parseTimelinePref(raw);
    if (p !== null) return p;
    return migrateLegacyTimelinePreference();
  } catch {
    return DEFAULT_TIMELINE_COLUMNS;
  }
}

export function writeTimelineColumnPreferenceToStorage(
  p: TimelineColumnPreference
): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(TIMELINE_COLUMNS_STORAGE_KEY, String(p));
  } catch {
    /* ignore */
  }
}

/**
 * 尚无新键时：从旧键迁移并写入。
 */
export function initTimelineColumnPreferenceIfNeeded(): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (localStorage.getItem(TIMELINE_COLUMNS_STORAGE_KEY) !== null) return;
    writeTimelineColumnPreferenceToStorage(migrateLegacyTimelinePreference());
  } catch {
    /* ignore */
  }
}
