import { plainTextFromNoteHtml } from "./notePlainText";
import type { Collection, NoteCard } from "./types";
import { walkCollections } from "./appkit/collectionModel";

function hasMeaningfulCustomProps(card: NoteCard): boolean {
  for (const p of card.customProps ?? []) {
    const v = p.value;
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && !v.trim()) continue;
    if (typeof v === "number" && !Number.isFinite(v)) continue;
    if (typeof v === "boolean" && v === false) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "object" && v !== null && "cardId" in v) {
      const l = v as { cardId?: string };
      if ((l.cardId ?? "").trim()) return true;
      continue;
    }
    return true;
  }
  return false;
}

/**
 * 无任何正文、附件、标签、提醒/置顶，且自定义属性无有效值。
 * 仅有指向其它卡的 relatedRefs（相关 / creator / source / attachment 等）而无上述实质内容时，仍视为空白（设置里「清除空白卡片」会收录）。
 */
export function isBlankNoteCard(card: NoteCard): boolean {
  if (plainTextFromNoteHtml(card.text ?? "").length > 0) return false;
  const media = (card.media ?? []).filter((m) => (m.url ?? "").trim());
  if (media.length > 0) return false;
  if (hasMeaningfulCustomProps(card)) return false;
  const tags = (card.tags ?? []).map((t) => String(t).trim()).filter(Boolean);
  if (tags.length > 0) return false;
  if (card.reminderOn?.trim()) return false;
  if (card.reminderTime?.trim()) return false;
  if (card.reminderNote?.trim()) return false;
  if (card.reminderCompletedAt?.trim()) return false;
  if (card.pinned) return false;
  return true;
}

/** 每张卡仅一条代表 placement（用于删除入回收站时的路径文案） */
export function collectBlankCardsInTree(
  roots: Collection[]
): { cardId: string; colId: string }[] {
  const byId = new Map<string, string>();
  walkCollections(roots, (col) => {
    for (const card of col.cards) {
      if (!isBlankNoteCard(card)) continue;
      if (!byId.has(card.id)) byId.set(card.id, col.id);
    }
  });
  return [...byId.entries()].map(([cardId, colId]) => ({ cardId, colId }));
}
