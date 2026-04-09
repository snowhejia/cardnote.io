import { htmlToPlainText } from "../noteEditor/plainHtml";
import type { NoteCard } from "../types";

export const MASONRY_LAYOUT_STORAGE_KEY = "mikujar-masonry-layout";

/** 瀑布流模式下：超过则默认折叠，需点「展开全文」 */
export const MASONRY_COLLAPSE_PLAIN_CHARS = 520;
export const MASONRY_COLLAPSE_MEDIA_COUNT = 4;

/**
 * 是否启用瀑布流（双列）时间线。
 * localStorage 仅当值为 `"1"` 时为 true；缺省、`"0"`、其它值或无法读取时均为 false（**单列时间线列表，新用户默认**）。
 */
export function readMasonryLayoutFromStorage(): boolean {
  try {
    return (
      typeof localStorage !== "undefined" &&
      localStorage.getItem(MASONRY_LAYOUT_STORAGE_KEY) === "1"
    );
  } catch {
    return false;
  }
}

/** 首次访问尚无 key 时写入 `"0"`，与默认列表行为一致并固定偏好键。 */
export function initMasonryLayoutPreferenceIfNeeded(): void {
  try {
    if (typeof localStorage === "undefined") return;
    const k = MASONRY_LAYOUT_STORAGE_KEY;
    if (localStorage.getItem(k) === null) {
      localStorage.setItem(k, "0");
    }
  } catch {
    /* ignore */
  }
}

export function cardNeedsMasonryCollapse(card: NoteCard): boolean {
  const plainLen = htmlToPlainText(card.text ?? "").length;
  const mediaN = (card.media ?? []).filter((m) => m.url?.trim()).length;
  if (plainLen >= MASONRY_COLLAPSE_PLAIN_CHARS) return true;
  if (mediaN >= MASONRY_COLLAPSE_MEDIA_COUNT) return true;
  if (plainLen >= 300 && mediaN >= 2) return true;
  return false;
}
