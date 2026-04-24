/**
 * useServerReminders — flag on 时拉取全量提醒（pending + completed），
 * flag off 或失败返回 null（调用方用本地 collectAllReminderEntries 兜底）。
 *
 * 为什么拉全部：现有 UI 依赖 allReminderEntries 既喂"全部提醒"视图又喂
 * 概览/侧边栏日历的数据源，没做按 pending/completed 切换，所以这里也
 * 一起拉。翻页最多 10 页（每页 200 条，合计 2000 条兜底上限）。
 */

import { useEffect, useState } from "react";
import { isLazyCollectionsEnabled } from "../lazyFeatureFlag";
import { fetchReminders, type ReminderRow } from "../api/aggregates";

const MAX_PAGES = 10;
const PAGE_LIMIT = 200;

export function useServerReminders(
  /** 依赖值发生变化时重新拉取（例如保存了一张新提醒后）。 */
  refreshKey: number | string = 0
): ReminderRow[] | null {
  const [rows, setRows] = useState<ReminderRow[] | null>(null);

  useEffect(() => {
    if (!isLazyCollectionsEnabled()) {
      setRows(null);
      return;
    }
    let cancelled = false;

    (async () => {
      const all: ReminderRow[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await fetchReminders({
          filter: "all",
          page,
          limit: PAGE_LIMIT,
        });
        if (cancelled) return;
        if (!res) return; // 失败 → 保持 null 让调用方 fallback
        all.push(...res.entries);
        if (!res.hasMore) break;
      }
      if (cancelled) return;
      setRows(all);
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return rows;
}
