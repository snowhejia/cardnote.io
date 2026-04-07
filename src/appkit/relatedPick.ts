import { htmlToPlainText } from "../noteEditor/plainHtml";
import type { Collection, NoteCard } from "../types";

/** 候选行大致高度（含 gap），供 ResizeObserver 估算可显示条数 */
export const RELATED_PICK_ROW_EST_PX = 50;
export const RELATED_PICK_POOL_MAX = 800;

/**
 * 源笔记与候选笔记的内容相似度（越大越靠前）。含标签、词片段、汉字重合与搜索词加权。
 */
export function relatedPickSimilarity(
  sourceColId: string,
  sourceCard: NoteCard,
  col: Collection,
  card: NoteCard,
  path: string,
  query: string
): number {
  const srcText = htmlToPlainText(sourceCard.text ?? "").trim();
  const srcLower = srcText.toLowerCase();
  const srcTags = sourceCard.tags ?? [];
  const hay = `${htmlToPlainText(card.text ?? "").trim()}\n${(card.tags ?? []).join(" ")}\n${col.name}\n${path}`.toLowerCase();
  let score = 0;

  if (query) {
    const ql = query.toLowerCase();
    if (htmlToPlainText(card.text ?? "").toLowerCase().includes(ql)) score += 120;
    if (col.name.toLowerCase().includes(ql)) score += 60;
    if ((card.tags ?? []).some((t) => t.toLowerCase().includes(ql))) {
      score += 90;
    }
    if (path.toLowerCase().includes(ql)) score += 40;
  }

  for (const t of srcTags) {
    const tl = t.trim().toLowerCase();
    if (tl.length < 1) continue;
    if ((card.tags ?? []).some((x) => x.toLowerCase() === tl)) score += 85;
    else if (hay.includes(tl)) score += 28;
  }

  const tokens = srcLower.split(/[\s,.;，。；、\n\r]+/).filter((w) => w.length >= 2);
  const seen = new Set<string>();
  for (const w of tokens) {
    if (seen.has(w)) continue;
    seen.add(w);
    if (hay.includes(w)) score += Math.min(36, w.length * 4);
  }

  for (const ch of srcLower.replace(/\s/g, "")) {
    if (/[\u4e00-\u9fff]/.test(ch) && hay.includes(ch)) score += 1.15;
  }

  if (col.id === sourceColId) score += 18;

  return score;
}
