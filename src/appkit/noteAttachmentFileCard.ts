import type { Collection, NoteCard, NoteMediaItem } from "../types";
import { findCardInTree, isFileCard } from "./collectionModel";

/** 该笔记的「相关」里是否已有同一 URL 的 file 对象卡（attachment 边会并入 relatedRefs） */
export function noteHasLinkedFileCardForMedia(
  noteCard: NoteCard,
  item: NoteMediaItem,
  collections: Collection[]
): boolean {
  return findLinkedFileCardForNoteMedia(noteCard, item, collections) !== null;
}

/** 解析笔记上某附件已关联的 file 对象卡（按首条 media.url 匹配） */
export function findLinkedFileCardForNoteMedia(
  noteCard: NoteCard,
  item: NoteMediaItem,
  collections: Collection[]
): { colId: string; card: NoteCard } | null {
  const url = item.url?.trim();
  if (!url) return null;
  for (const ref of noteCard.relatedRefs ?? []) {
    const hit = findCardInTree(collections, ref.colId, ref.cardId);
    if (!hit) continue;
    if (!isFileCard(hit.card)) continue;
    const m0 = hit.card.media?.[0];
    if (m0?.url?.trim() === url) return { colId: hit.col.id, card: hit.card };
  }

  // 兜底：某些数据中 attachment 关系未并入 relatedRefs；
  // 改为按 URL 命中 file 卡，并优先匹配 sf-file-source 指回当前 noteCard。
  const candidates: { colId: string; card: NoteCard }[] = [];
  const walk = (cols: Collection[]) => {
    for (const col of cols) {
      for (const card of col.cards ?? []) {
        if (!isFileCard(card)) continue;
        const m0 = card.media?.[0];
        if (m0?.url?.trim() !== url) continue;
        candidates.push({ colId: col.id, card });
      }
      if (col.children?.length) walk(col.children);
    }
  };
  walk(collections);
  if (candidates.length === 0) return null;

  const sourceMatched = candidates.find(({ card }) => {
    const p = (card.customProps ?? []).find((x) => x?.id === "sf-file-source");
    if (!p || !p.value || typeof p.value !== "object") return false;
    const v = p.value as { cardId?: unknown };
    return typeof v.cardId === "string" && v.cardId.trim() === noteCard.id;
  });
  if (sourceMatched) return sourceMatched;

  return candidates[0] ?? null;
}
