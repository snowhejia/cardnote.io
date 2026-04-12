import { useCallback, useRef } from "react";
import type { TouchEvent } from "react";
import {
  matchesMobileChromeMedia,
  MOBILE_NAV_SWIPE_CLOSE_MIN_DX,
} from "./appConstants";
import {
  mobileNavSwipeMostlyHorizontal,
  mobileNavSwipeTargetIsTextual,
} from "./mobileNavSwipe";

/**
 * 小屏相关笔记全屏页：右滑关闭（与左侧合集侧栏「左滑关」镜像）。
 */
export function useRelatedPanelSwipe(p: { onClose: () => void }) {
  const { onClose } = p;
  const swipeRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      if (typeof window === "undefined" || !matchesMobileChromeMedia()) {
        return;
      }
      if (mobileNavSwipeTargetIsTextual(e.target)) return;
      const t = e.touches[0];
      if (!t) return;
      swipeRef.current = { x: t.clientX, y: t.clientY };
    },
    []
  );

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      const start = swipeRef.current;
      swipeRef.current = null;
      if (!start) return;
      if (typeof window !== "undefined" && !matchesMobileChromeMedia()) {
        return;
      }
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (dx < MOBILE_NAV_SWIPE_CLOSE_MIN_DX) return;
      if (!mobileNavSwipeMostlyHorizontal(dx, dy)) return;
      onClose();
    },
    [onClose]
  );

  const onTouchCancel = useCallback(() => {
    swipeRef.current = null;
  }, []);

  return { onTouchStart, onTouchEnd, onTouchCancel };
}
