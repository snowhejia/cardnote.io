/**
 * useServerSearch — flag on 时调用 /api/search；flag off 或暂未响应返回 null
 *
 * 调用方在 null 时应当用现有客户端 buildSearchResults 兜底。
 *
 * 行为：
 *   - 防抖 300ms
 *   - 空查询立即返回 null（不发请求）
 *   - flag off 永远返回 null（让调用方走本地）
 *   - 网络失败 / 5xx：静默返回 null（让调用方 fallback，不卡搜索）
 *   - 老请求的响应若在新查询期间才到达，丢弃
 */

import { useEffect, useState } from "react";
import { isLazyCollectionsEnabled } from "../lazyFeatureFlag";
import { searchContent, type SearchResult } from "../api/aggregates";

const DEBOUNCE_MS = 300;

export function useServerSearch(queryRaw: string): SearchResult | null {
  const query = queryRaw.trim();
  const [result, setResult] = useState<SearchResult | null>(null);

  useEffect(() => {
    if (!isLazyCollectionsEnabled()) {
      setResult(null);
      return;
    }
    if (!query) {
      setResult(null);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await searchContent(query, { limit: 50 });
      if (cancelled) return;
      setResult(r);
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  return result;
}
