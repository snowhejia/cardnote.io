import { htmlToPlainText } from "./noteEditor/plainHtml";
import type { NoteCard } from "./types";

const REMINDER_NOTE_MAX = 120;
const BODY_PREVIEW_LEN = 48;

/** 待办主文案：提醒备注优先，否则正文前几字（与 AllRemindersView 一致） */
export function reminderTaskPrimaryLine(card: NoteCard, emptyLabel: string): string {
  const rem = card.reminderNote?.trim();
  if (rem) {
    return rem.length > REMINDER_NOTE_MAX
      ? `${rem.slice(0, REMINDER_NOTE_MAX)}…`
      : rem;
  }
  const plain = htmlToPlainText(card.text).trim();
  if (!plain) return emptyLabel;
  return plain.length > BODY_PREVIEW_LEN
    ? `${plain.slice(0, BODY_PREVIEW_LEN)}…`
    : plain;
}

/** 「完成记录」：优先显示完成时快照的提醒备注，否则正文摘要 */
export function reminderCompletionDisplayLine(
  card: NoteCard,
  emptyLabel: string
): string {
  const snap = card.reminderCompletedNote?.trim();
  if (snap) {
    return snap.length > REMINDER_NOTE_MAX
      ? `${snap.slice(0, REMINDER_NOTE_MAX)}…`
      : snap;
  }
  const plain = htmlToPlainText(card.text).trim();
  if (!plain) return emptyLabel;
  return plain.length > BODY_PREVIEW_LEN
    ? `${plain.slice(0, BODY_PREVIEW_LEN)}…`
    : plain;
}
