import type { Collection, NoteCard, NoteMediaItem } from "../types";
import { findCardInTree } from "./collectionModel";

/** 该笔记的「相关」里是否已有同一 URL 的 file 对象卡（attachment 边会并入 relatedRefs） */
export function noteHasLinkedFileCardForMedia(
  noteCard: NoteCard,
  item: NoteMediaItem,
  collections: Collection[]
): boolean {
  const url = item.url?.trim();
  if (!url) return false;
  for (const ref of noteCard.relatedRefs ?? []) {
    const hit = findCardInTree(collections, ref.colId, ref.cardId);
    if (!hit) continue;
    if ((hit.card.objectKind ?? "note") !== "file") continue;
    const m0 = hit.card.media?.[0];
    if (m0?.url?.trim() === url) return true;
  }
  return false;
}
