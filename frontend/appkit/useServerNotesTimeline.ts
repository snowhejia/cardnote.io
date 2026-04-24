/**
 * useServerNotesTimeline — flag on 时拉 /api/notes 全部页（cap 2000），
 * flag off 或失败返回 null（调用方走本地遍历）。
 *
 * 注意：服务端口径是"非 file_* 的所有卡"，本地原口径还多一层"必须在
 * preset-note 子树内"的过滤。两者在大多数账户下结果一致；migrated /
 * 老账户可能略有差异（lazy-mode 会多包含 task/person 子树里被打成 note
 * 形态的边角卡）。属于可接受偏移。
 */

import { useEffect, useState } from "react";
import { isLazyCollectionsEnabled } from "../lazyFeatureFlag";
import { fetchNotesPage, type LightCardRow } from "../api/aggregates";

const MAX_PAGES = 10;
const PAGE_LIMIT = 200;

export function useServerNotesTimeline(
  refreshKey: number | string = 0
): LightCardRow[] | null {
  const [rows, setRows] = useState<LightCardRow[] | null>(null);

  useEffect(() => {
    if (!isLazyCollectionsEnabled()) {
      setRows(null);
      return;
    }
    let cancelled = false;

    (async () => {
      const all: LightCardRow[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await fetchNotesPage({ page, limit: PAGE_LIMIT });
        if (cancelled) return;
        if (!res) return; // 失败 → 保持 null 让调用方 fallback
        all.push(...res.cards);
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
