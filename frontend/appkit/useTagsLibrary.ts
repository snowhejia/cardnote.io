/**
 * useTagsLibrary — 标签建议列表（服务端优先，本地兜底）
 *
 * 行为：
 *   - 默认：走现有本地实现（遍历 collections 树 dedup）
 *   - VITE_LAZY_COLLECTIONS=1 或 localStorage.cardnote.lazyCollections=1：
 *       尝试 GET /api/tags，成功则用服务端返回
 *       失败（网络错/401/500/还没返回）时自动 fallback 到本地实现
 *
 * 设计要点：
 *   - 不抛错（失败静默 fallback）—— 标签面板不是关键路径
 *   - 只拉一次 / 依赖 collections 变化时不自动重拉（标签变化率低；
 *     用户新建/修改合集后重开页面就会刷新，够用）
 *   - 真要实时同步可在 PR 5 后续和 SSE 细粒度事件一起接入
 */

import { useEffect, useMemo, useState } from "react";
import type { Collection } from "../types";
import { collectAllTagsFromCollections } from "./collectionModel";
import { isLazyCollectionsEnabled } from "../lazyFeatureFlag";
import { fetchTags } from "../api/aggregates";

/**
 * 返回标签字符串数组（按频率/字母序，内部细节由提供方决定）。
 * 传入 collections 作为本地 fallback 源。
 */
export function useTagsLibrary(collections: Collection[]): string[] {
  const localTags = useMemo(
    () => collectAllTagsFromCollections(collections),
    [collections]
  );

  const [serverTags, setServerTags] = useState<string[] | null>(null);

  useEffect(() => {
    if (!isLazyCollectionsEnabled()) return;
    let cancelled = false;
    (async () => {
      const res = await fetchTags();
      if (cancelled) return;
      if (!res || !Array.isArray(res.tags)) return;
      /* 按服务端已有排序保留（count DESC + 字母） */
      const arr = res.tags.map((t) => t.tag).filter(Boolean);
      setServerTags(arr);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return serverTags ?? localTags;
}
