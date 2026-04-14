import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { localDateString } from "./appkit/dateUtils";
import { useAppChrome } from "./i18n/useAppChrome";
import type { Collection, NoteCard } from "./types";

function findCard(
  cols: Collection[],
  colId: string,
  cardId: string
): NoteCard | null {
  const walk = (nodes: Collection[]): NoteCard | null => {
    for (const c of nodes) {
      if (c.id === colId) {
        const card = c.cards.find((x) => x.id === cardId);
        if (card) return card;
      }
      if (c.children?.length) {
        const f = walk(c.children);
        if (f) return f;
      }
    }
    return null;
  };
  return walk(cols);
}

export type ReminderPickerTarget =
  | { kind: "card"; colId: string; cardId: string }
  | { kind: "new-task" };

export function ReminderPickerModal({
  open,
  collections,
  colId,
  cardId,
  mode = "card",
  onClose,
  onSave,
  onClear,
}: {
  open: boolean;
  collections: Collection[];
  colId: string;
  cardId: string;
  /** `new-task`：无已有卡片，用于「新建待办」 */
  mode?: "card" | "new-task";
  onClose: () => void;
  onSave: (isoDate: string, time: string, note: string) => void;
  onClear: () => void;
}) {
  const c = useAppChrome();
  const card =
    open && mode === "card" ? findCard(collections, colId, cardId) : null;
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    if (mode === "new-task") {
      const now = new Date();
      setDate(localDateString(now));
      const pad = (n: number) => String(n).padStart(2, "0");
      setTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
      setNote("");
      return;
    }
    if (!card) return;
    setDate(card.reminderOn ?? "");
    setTime(card.reminderTime ?? "");
    setNote(card.reminderNote ?? "");
  }, [open, mode, card, cardId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  if (mode === "card" && !card) return null;

  const hint =
    mode === "new-task" ? c.remPickerNewTaskHint : c.remPickerHint;
  const showClear = mode === "card" && Boolean(card?.reminderOn);

  return createPortal(
    <div
      className="reminder-picker-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminder-picker-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="reminder-picker-modal__panel"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="reminder-picker-title" className="reminder-picker-modal__title">
          {c.remPickerTitle}
        </h2>
        <p className="reminder-picker-modal__hint">{hint}</p>

        <div className="reminder-picker-modal__row">
          <label className="reminder-picker-modal__label">
            {c.remPickerDateLabel}
            <input
              type="date"
              className="reminder-picker-modal__input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="reminder-picker-modal__label">
            {c.remPickerTimeLabel}
            <input
              type="time"
              className="reminder-picker-modal__input"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
        </div>

        <label className="reminder-picker-modal__label reminder-picker-modal__label--full">
          {c.remPickerNoteLabel}
          <textarea
            className="reminder-picker-modal__textarea"
            rows={2}
            placeholder={c.remPickerNotePlaceholder}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <div className="reminder-picker-modal__actions">
          <button
            type="button"
            className="reminder-picker-modal__btn reminder-picker-modal__btn--ghost"
            onClick={onClose}
          >
            {c.remPickerCancel}
          </button>
          {showClear ? (
            <button
              type="button"
              className="reminder-picker-modal__btn reminder-picker-modal__btn--ghost"
              onClick={() => {
                onClear();
                onClose();
              }}
            >
              {c.remPickerClear}
            </button>
          ) : null}
          <button
            type="button"
            className="reminder-picker-modal__btn reminder-picker-modal__btn--primary"
            disabled={!date}
            onClick={() => {
              if (!date) return;
              onSave(date, time, note);
              onClose();
            }}
          >
            {c.remPickerSave}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
