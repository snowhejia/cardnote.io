/**
 * useServerCalendarDots — flag on 时按月拉 /api/calendar/days，
 * 累积所有访问过的月份到一个 Set；flag off 返回 null 让调用方走本地。
 *
 * 行为：
 *   - 每次 currentMonth 变化，若未缓存该月则触发一次请求
 *   - 多月累积在同一个 Map<monthYm, { notes, reminders }> 里
 *   - 返回 { notes, reminders } 两个合并 Set（供侧栏日历高亮逻辑消费）
 *   - 失败/flag off → 返回 null（调用方会用本地 walk 结果）
 *
 * 对比本地实现的差异：
 *   - 本地：一次 walk 算出所有年月的日期集；flag off 时沿用
 *   - 服务端：只预加载当前月 + 用户访问过的月；第一次看某月有几百 ms 延迟
 *   - 实际影响小：用户通常只看近几个月；有延迟时点数暂缺，后续请求返回即补齐
 */

import { useEffect, useMemo, useState } from "react";
import { isLazyCollectionsEnabled } from "../lazyFeatureFlag";
import { fetchCalendarMonth } from "../api/aggregates";

type MonthSlice = {
  notes: Set<string>;
  reminders: Set<string>;
};

function toYm(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function useServerCalendarDots(currentMonth: Date): {
  notes: Set<string>;
  reminders: Set<string>;
} | null {
  const monthYm = toYm(currentMonth);
  const [cache, setCache] = useState<Map<string, MonthSlice>>(new Map());
  const [disabled, setDisabled] = useState(!isLazyCollectionsEnabled());

  useEffect(() => {
    if (!isLazyCollectionsEnabled()) {
      setDisabled(true);
      return;
    }
    if (cache.has(monthYm)) return;
    let cancelled = false;
    (async () => {
      const res = await fetchCalendarMonth(monthYm);
      if (cancelled) return;
      if (!res) {
        /* 一旦失败一次就降级为 null（不再刷屏尝试），让调用方走本地 */
        setDisabled(true);
        return;
      }
      const notes = new Set<string>();
      const reminders = new Set<string>();
      for (const d of res.days) {
        if (d.noteCount > 0) notes.add(d.ymd);
        if (d.reminderCount > 0) reminders.add(d.ymd);
      }
      setCache((prev) => {
        if (prev.has(monthYm)) return prev;
        const next = new Map(prev);
        next.set(monthYm, { notes, reminders });
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [monthYm, cache]);

  return useMemo(() => {
    if (disabled) return null;
    const notes = new Set<string>();
    const reminders = new Set<string>();
    for (const slice of cache.values()) {
      for (const d of slice.notes) notes.add(d);
      for (const d of slice.reminders) reminders.add(d);
    }
    return { notes, reminders };
  }, [cache, disabled]);
}
