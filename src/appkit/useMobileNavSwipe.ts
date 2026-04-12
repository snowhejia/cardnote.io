import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import type { TouchEvent } from "react";
import {
  matchesMobileChromeMedia,
  MOBILE_NAV_SWIPE_CLOSE_MIN_DX,
  MOBILE_NAV_SWIPE_FROM_LEFT_PX,
  MOBILE_NAV_SWIPE_OPEN_MIN_DX,
} from "./appConstants";
import {
  mobileNavSwipeMostlyHorizontal,
  mobileNavSwipeTargetIsTextual,
} from "./mobileNavSwipe";

/**
 * 主区从左缘滑开侧栏、侧栏内左滑关闭。
 */
export function useMobileNavSwipe(p: {
  mobileNavOpen: boolean;
  setMobileNavOpen: Dispatch<SetStateAction<boolean>>;
  showRemoteLoading: boolean;
  /** 为 true 时不记录主区边缘滑动手势 */
  blockMainEdgeSwipe: boolean;
}) {
  const {
    mobileNavOpen,
    setMobileNavOpen,
    showRemoteLoading,
    blockMainEdgeSwipe,
  } = p;

  const mobileMainSwipeRef = useRef<{
    x: number;
    y: number;
    tracking: boolean;
  } | null>(null);
  const mobileSidebarSwipeRef = useRef<{ x: number; y: number } | null>(
    null
  );

  const onMobileMainTouchStart = useCallback(
    (e: TouchEvent) => {
      if (typeof window === "undefined" || !matchesMobileChromeMedia()) {
        return;
      }
      if (blockMainEdgeSwipe) return;
      if (mobileNavSwipeTargetIsTextual(e.target)) return;
      const t = e.touches[0];
      if (!t) return;
      if (t.clientX > MOBILE_NAV_SWIPE_FROM_LEFT_PX) {
        mobileMainSwipeRef.current = null;
        return;
      }
      mobileMainSwipeRef.current = {
        x: t.clientX,
        y: t.clientY,
        tracking: true,
      };
    },
    [blockMainEdgeSwipe]
  );

  const onMobileMainTouchEnd = useCallback(
    (e: TouchEvent) => {
      const start = mobileMainSwipeRef.current;
      mobileMainSwipeRef.current = null;
      if (!start?.tracking) return;
      if (typeof window !== "undefined" && !matchesMobileChromeMedia()) {
        return;
      }
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (dx < MOBILE_NAV_SWIPE_OPEN_MIN_DX) return;
      if (!mobileNavSwipeMostlyHorizontal(dx, dy)) return;
      setMobileNavOpen(true);
    },
    [setMobileNavOpen]
  );

  const onMobileMainTouchCancel = useCallback(() => {
    mobileMainSwipeRef.current = null;
  }, []);

  const onMobileSidebarTouchStart = useCallback(
    (e: TouchEvent) => {
      if (typeof window === "undefined" || !matchesMobileChromeMedia()) {
        return;
      }
      if (!mobileNavOpen || showRemoteLoading) return;
      if (mobileNavSwipeTargetIsTextual(e.target)) return;
      const t = e.touches[0];
      if (!t) return;
      mobileSidebarSwipeRef.current = { x: t.clientX, y: t.clientY };
    },
    [mobileNavOpen, showRemoteLoading]
  );

  const onMobileSidebarTouchEnd = useCallback(
    (e: TouchEvent) => {
      const start = mobileSidebarSwipeRef.current;
      mobileSidebarSwipeRef.current = null;
      if (!start) return;
      if (typeof window !== "undefined" && !matchesMobileChromeMedia()) {
        return;
      }
      if (!mobileNavOpen) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (dx > -MOBILE_NAV_SWIPE_CLOSE_MIN_DX) return;
      if (!mobileNavSwipeMostlyHorizontal(dx, dy)) return;
      setMobileNavOpen(false);
    },
    [mobileNavOpen, setMobileNavOpen]
  );

  const onMobileSidebarTouchCancel = useCallback(() => {
    mobileSidebarSwipeRef.current = null;
  }, []);

  return {
    onMobileMainTouchStart,
    onMobileMainTouchEnd,
    onMobileMainTouchCancel,
    onMobileSidebarTouchStart,
    onMobileSidebarTouchEnd,
    onMobileSidebarTouchCancel,
  };
}
