import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import {
  DESKTOP_TIMELINE_GALLERY_STACK_PAPER_EXIT_HEIGHT_PX,
  DESKTOP_TIMELINE_GALLERY_STACK_PAPER_MIN_HEIGHT_PX,
  MOBILE_CHROME_MEDIA,
  TABLET_WIDE_TOUCH_MEDIA,
} from "./appkit/appConstants";

/** 与 App `narrowUi`、卡片详情一致：窄屏或大屏触控平板时多为上下布局 */

type CardRowInnerProps = {
  hasGallery: boolean;
  className: string;
  children: ReactNode;
  /**
   * 时间线列数。多列瀑布时由桌面「长文」规则决定是否上下；1 列时多为左右分栏。
   * 桌面自动上下：用**模拟左右分栏下列宽**测 scrollHeight + 滞回，不用上下栏下的实际高度，避免闪屏。
   */
  timelineColumnCount?: number;
};

/**
 * 手机 / 部分平板：强制上下叠放（与列数、视口组合有关）。
 */
function computeGalleryStackForced(
  hasGallery: boolean,
  timelineColumnCount: number | undefined
): boolean {
  if (!hasGallery) return false;
  const mqMobile = window.matchMedia(MOBILE_CHROME_MEDIA);
  const mqTablet = window.matchMedia(TABLET_WIDE_TOUCH_MEDIA);
  const mqPhoneNarrow = window.matchMedia("(max-width: 900px)");
  const mobileChrome = mqMobile.matches;
  const tabletWide = mqTablet.matches;
  const tabletSingleCol = tabletWide && timelineColumnCount === 1;
  const phoneNarrowOneCol =
    mqPhoneNarrow.matches && timelineColumnCount === 1;

  if (mobileChrome && !tabletSingleCol && !phoneNarrowOneCol) {
    return true;
  }
  return false;
}

/**
 * 在**当前仍为左右分栏时的列宽**下，`.card__paper` 应有的外层宽度（与 flex：轨 30px + 正文 + 轮播 38% clamp 一致）。
 */
function projectedSplitPaperOuterWidthPx(innerEl: HTMLElement): number {
  const iw = innerEl.getBoundingClientRect().width;
  const railW = innerEl.querySelector(".card__move-rail") ? 30 : 0;
  const galleryW = Math.min(240, Math.max(132, Math.round(iw * 0.38)));
  return Math.max(80, Math.round(iw - railW - galleryW));
}

/**
 * 始终按「左右分栏」纸张列宽约束后读 scrollHeight；上下栏真实排版下纸会变宽变矮，不得用那个高度做判据。
 */
function measurePaperScrollHeightAsSplitColumn(
  innerEl: HTMLElement,
  paperEl: HTMLElement
): number {
  const w = projectedSplitPaperOuterWidthPx(innerEl);
  const prevW = paperEl.style.width;
  const prevMax = paperEl.style.maxWidth;
  const prevBox = paperEl.style.boxSizing;
  paperEl.style.boxSizing = "border-box";
  paperEl.style.width = `${w}px`;
  paperEl.style.maxWidth = `${w}px`;
  const h = paperEl.scrollHeight;
  paperEl.style.width = prevW;
  paperEl.style.maxWidth = prevMax;
  paperEl.style.boxSizing = prevBox;
  return h;
}

/**
 * 时间线/垃圾桶/笔记探索卡片内层：手机等强制上下；
 * 桌面有附件时若「按左右分栏列宽模拟」正文纸过高则上下叠放，滞回避免阈值抖动。
 */
export function CardRowInner({
  hasGallery,
  className,
  children,
  timelineColumnCount,
}: CardRowInnerProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [stackGallery, setStackGallery] = useState(false);
  /** 桌面长文上下态的滞回（与模拟 split 列高联动，不用上下栏实际高度） */
  const desktopTallStackRef = useRef(false);

  useLayoutEffect(() => {
    if (!hasGallery) {
      desktopTallStackRef.current = false;
      setStackGallery(false);
      return;
    }

    const mqMobile = window.matchMedia(MOBILE_CHROME_MEDIA);
    const mqTablet = window.matchMedia(TABLET_WIDE_TOUCH_MEDIA);
    const mqPhoneNarrow = window.matchMedia("(max-width: 900px)");

    let raf = 0;
    const apply = () => {
      const forced = computeGalleryStackForced(
        hasGallery,
        timelineColumnCount
      );
      if (forced) {
        desktopTallStackRef.current = false;
        setStackGallery(true);
        return;
      }

      const inner = innerRef.current;
      const paper = inner?.querySelector(
        ".card__paper"
      ) as HTMLElement | null;
      if (!inner || !paper) {
        setStackGallery(desktopTallStackRef.current);
        return;
      }

      const simH = measurePaperScrollHeightAsSplitColumn(inner, paper);
      let tall = desktopTallStackRef.current;
      if (!tall && simH >= DESKTOP_TIMELINE_GALLERY_STACK_PAPER_MIN_HEIGHT_PX) {
        tall = true;
      } else if (
        tall &&
        simH <= DESKTOP_TIMELINE_GALLERY_STACK_PAPER_EXIT_HEIGHT_PX
      ) {
        tall = false;
      }
      desktopTallStackRef.current = tall;
      setStackGallery(tall);
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        apply();
      });
    };

    apply();

    mqMobile.addEventListener("change", apply);
    mqTablet.addEventListener("change", apply);
    mqPhoneNarrow.addEventListener("change", apply);

    const inner = innerRef.current;
    const paper = inner?.querySelector(".card__paper") as HTMLElement | null;
    let ro: ResizeObserver | undefined;
    if (inner && paper && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(schedule);
      ro.observe(inner);
      ro.observe(paper);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      mqMobile.removeEventListener("change", apply);
      mqTablet.removeEventListener("change", apply);
      mqPhoneNarrow.removeEventListener("change", apply);
      ro?.disconnect();
    };
  }, [hasGallery, timelineColumnCount]);

  const cls =
    className +
    (hasGallery && stackGallery
      ? " card__inner--mobile-gallery-stack"
      : "");

  return (
    <div ref={innerRef} className={cls}>
      {children}
    </div>
  );
}
