import { htmlToPlainText } from "../noteEditor/plainHtml";
import type { NoteCard } from "../types";

export const MASONRY_LAYOUT_STORAGE_KEY = "mikujar-masonry-layout";

/** 瀑布流模式下：超过则默认折叠，需点「展开全文」 */
export const MASONRY_COLLAPSE_PLAIN_CHARS = 520;
export const MASONRY_COLLAPSE_MEDIA_COUNT = 4;

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

export function cardNeedsMasonryCollapse(card: NoteCard): boolean {
  const plainLen = htmlToPlainText(card.text ?? "").length;
  const mediaN = (card.media ?? []).filter((m) => m.url?.trim()).length;
  if (plainLen >= MASONRY_COLLAPSE_PLAIN_CHARS) return true;
  if (mediaN >= MASONRY_COLLAPSE_MEDIA_COUNT) return true;
  if (plainLen >= 300 && mediaN >= 2) return true;
  return false;
}
