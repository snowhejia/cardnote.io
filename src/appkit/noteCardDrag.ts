import {
  updateCardApi,
  type CardRemotePatch,
} from "../api/collections";
import type { Collection } from "../types";
import {
  appendCardToCollection,
  extractCardFromCollections,
  findCollectionById,
  insertCardRelativeTo,
} from "./collectionModel";

export type NoteCardDragPayload = {
  colId: string;
  cardId: string;
};

export type NoteCardDropTarget =
  | { type: "before"; colId: string; cardId: string }
  | { type: "after"; colId: string; cardId: string }
  | { type: "collection"; colId: string };

export const NOTE_CARD_DRAG_MIME = "application/x-mikujar-note-card";
export const NOTE_CARD_TEXT_PREFIX = "mikujar-note-card:";

export function noteCardDragTypesInclude(dt: DataTransfer): boolean {
  const want = NOTE_CARD_DRAG_MIME.toLowerCase();
  return [...dt.types].some((t) => t.toLowerCase() === want);
}

export function readNoteCardDragPayload(
  e: { dataTransfer: DataTransfer | null }
): NoteCardDragPayload | null {
  const dt = e.dataTransfer;
  if (!dt) return null;
  let raw =
    dt.getData(NOTE_CARD_DRAG_MIME) || dt.getData("text/plain");
  if (!raw) return null;
  if (raw.startsWith(NOTE_CARD_TEXT_PREFIX)) {
    raw = raw.slice(NOTE_CARD_TEXT_PREFIX.length);
  }
  try {
    const o = JSON.parse(raw) as NoteCardDragPayload & { blockId?: string };
    if (o?.colId && o?.cardId) {
      return { colId: o.colId, cardId: o.cardId };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function findCollectionIdForCard(
  cols: Collection[],
  cardId: string
): string | null {
  for (const c of cols) {
    if (c.cards.some((x) => x.id === cardId)) return c.id;
    if (c.children?.length) {
      const r = findCollectionIdForCard(c.children, cardId);
      if (r) return r;
    }
  }
  return null;
}

/** 远程模式：把拖拽后的合集内顺序与跨合集归属写入 PostgreSQL */
export async function persistNoteCardDropToRemote(
  from: NoteCardDragPayload,
  nextTree: Collection[]
): Promise<boolean> {
  const movedId = from.cardId;
  const fromColId = from.colId;
  const toColId = findCollectionIdForCard(nextTree, movedId);
  if (!toColId) return false;

  const toCol = findCollectionById(nextTree, toColId);
  if (!toCol) return false;

  const fromCol =
    fromColId !== toColId
      ? findCollectionById(nextTree, fromColId)
      : null;

  for (let idx = 0; idx < toCol.cards.length; idx++) {
    const c = toCol.cards[idx];
    const patch: CardRemotePatch = { sortOrder: idx };
    if (c.id === movedId && fromColId !== toColId) {
      patch.collectionId = toColId;
    }
    const ok = await updateCardApi(c.id, patch);
    if (!ok) return false;
  }

  if (fromColId !== toColId && fromCol) {
    for (let idx = 0; idx < fromCol.cards.length; idx++) {
      const ok = await updateCardApi(fromCol.cards[idx].id, {
        sortOrder: idx,
      });
      if (!ok) return false;
    }
  }

  return true;
}
export function applyNoteCardDrop(
  prev: Collection[],
  from: NoteCardDragPayload,
  to: NoteCardDropTarget
): Collection[] {
  if (
    to.type !== "collection" &&
    from.colId === to.colId &&
    (to.type === "before" || to.type === "after") &&
    from.cardId === to.cardId
  ) {
    return prev;
  }
  const fromCol = findCollectionById(prev, from.colId);
  const fromCard = fromCol?.cards.find((c) => c.id === from.cardId);
  if (!fromCard) return prev;

  const { next, card } = extractCardFromCollections(
    prev,
    from.colId,
    from.cardId
  );
  if (!card) return prev;

  if (to.type === "collection") {
    if (from.colId === to.colId) return prev;
    return appendCardToCollection(next, to.colId, card);
  }

  const place = to.type === "before" ? "before" : "after";
  const toCol = findCollectionById(next, to.colId);
  const anchor = toCol?.cards.find((c) => c.id === to.cardId);
  if (!anchor) return appendCardToCollection(next, to.colId, card);

  return insertCardRelativeTo(next, to.colId, card, to.cardId, place);
}
