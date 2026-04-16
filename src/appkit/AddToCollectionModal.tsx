import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useAppChrome } from "../i18n/useAppChrome";
import type { Collection } from "../types";
import { walkCollectionsWithPath } from "./collectionModel";

export function AddToCollectionModal({
  open,
  collections,
  occupiedCollectionIds,
  onClose,
  onPick,
}: {
  open: boolean;
  collections: Collection[];
  /** 已包含该笔记的合集，不可再选 */
  occupiedCollectionIds: Set<string>;
  onClose: () => void;
  onPick: (targetCollectionId: string) => void;
}) {
  const c = useAppChrome();
  const rows = open
    ? walkCollectionsWithPath(collections, []).filter(
        ({ col }) => !occupiedCollectionIds.has(col.id)
      )
    : [];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="reminder-picker-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-to-col-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="reminder-picker-modal__panel add-to-col-modal__panel"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="add-to-col-modal-title" className="reminder-picker-modal__title">
          {c.cardAddToCollectionTitle}
        </h2>
        <p className="reminder-picker-modal__hint">
          {c.cardAddToCollectionHint}
        </p>
        {rows.length === 0 ? (
          <p className="add-to-col-modal__empty">{c.cardAddToCollectionEmpty}</p>
        ) : (
          <ul className="add-to-col-modal__list" role="listbox">
            {rows.map(({ col, path }) => (
              <li key={col.id} className="add-to-col-modal__item">
                <button
                  type="button"
                  className="add-to-col-modal__row"
                  role="option"
                  onClick={() => onPick(col.id)}
                >
                  <span
                    className="add-to-col-modal__dot"
                    style={{ backgroundColor: col.dotColor }}
                    aria-hidden
                  />
                  <span className="add-to-col-modal__path" title={path}>
                    {path}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="reminder-picker-modal__actions">
          <button
            type="button"
            className="reminder-picker-modal__btn reminder-picker-modal__btn--ghost"
            onClick={onClose}
          >
            {c.cardAddToCollectionCancel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
