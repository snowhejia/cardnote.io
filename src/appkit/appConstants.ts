/**
 * 与 App.css 中抽屉/手机顶栏一致：
 * - 视口 ≤900px，或
 * - 大屏触控设备（粗指针 + 无悬停，典型为平板），侧拉与手机同一套。
 */
/** 大屏触控平板（不含窄屏手机），与 MOBILE_CHROME 第二子句一致 */
export const TABLET_WIDE_TOUCH_MEDIA =
  "(min-width: 901px) and (hover: none) and (pointer: coarse)";

export const MOBILE_CHROME_MEDIA = `(max-width: 900px), (${TABLET_WIDE_TOUCH_MEDIA})`;

export function matchesMobileChromeMedia(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_CHROME_MEDIA).matches;
}

/**
 * 时间线卡片（非手机强制上下时）：按「左右分栏」下列宽**模拟**测量 `.card__paper` 的 scrollHeight，
 * 达到或超过此值则切为上下布局；不用上下栏下的实际高度，避免纸变宽→变矮→又切回左右的振荡闪屏。
 * 见 {@link CardRowInner}。
 */
export const DESKTOP_TIMELINE_GALLERY_STACK_PAPER_MIN_HEIGHT_PX = 360;

/**
 * 滞回下沿：已为上下布局时，**仍按左右分栏列宽模拟**的 scrollHeight 低于此值才恢复左右分栏。
 * 必须小于 {@link DESKTOP_TIMELINE_GALLERY_STACK_PAPER_MIN_HEIGHT_PX}。
 */
export const DESKTOP_TIMELINE_GALLERY_STACK_PAPER_EXIT_HEIGHT_PX = 280;

/** @deprecated 宽度判断已改为 {@link matchesMobileChromeMedia}；保留供旧逻辑对照 */
export const MOBILE_NAV_SWIPE_LAYOUT_MAX_PX = 900;
export const MOBILE_NAV_SWIPE_OPEN_MIN_DX = 56;
export const MOBILE_NAV_SWIPE_CLOSE_MIN_DX = 56;
export const MOBILE_NAV_SWIPE_AXIS_RATIO = 1.25;
/** 仅从屏幕左缘划入时打开，减少与正文/编辑器手势冲突 */
export const MOBILE_NAV_SWIPE_FROM_LEFT_PX = 40;
