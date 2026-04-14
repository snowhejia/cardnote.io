import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { useAppChrome } from "../i18n/useAppChrome";
import type { Collection } from "../types";
import {
  findCollectionById,
  LOOSE_NOTES_COLLECTION_ID,
  walkCollectionsWithPath,
} from "./collectionModel";

/** 与 collectionDrag.isTargetUnderDragNode 一致：target 是否为 root 的（非自身）子孙 */
function isStrictDescendantCollection(
  root: Collection,
  targetId: string
): boolean {
  function walk(n: Collection): boolean {
    if (n.id === targetId) return true;
    return (n.children ?? []).some(walk);
  }
  return (root.children ?? []).some(walk);
}

export type CollectionMoveUnderDialogState = {
  sourceId: string;
  displayName: string;
};

type Props = {
  dialog: CollectionMoveUnderDialogState | null;
  collections: Collection[];
  onClose: () => void;
  onConfirm: (sourceId: string, parentId: string) => void;
};

export function CollectionMoveUnderDialog({
  dialog,
  collections,
  onClose,
  onConfirm,
}: Props) {
  const c = useAppChrome();
  const options = useMemo(() => {
    if (!dialog) return [];
    const sourceNode = findCollectionById(collections, dialog.sourceId);
    if (!sourceNode) return [];
    const flat = walkCollectionsWithPath(collections, []);
    return flat.filter(({ col }) => {
      if (col.id === dialog.sourceId) return false;
      if (col.id === LOOSE_NOTES_COLLECTION_ID) return false;
      return !isStrictDescendantCollection(sourceNode, col.id);
    });
  }, [collections, dialog]);

  const [parentId, setParentId] = useState("");

  useEffect(() => {
    if (!dialog) return;
    setParentId(options[0]?.col.id ?? "");
  }, [dialog, options]);

  if (!dialog) return null;

  const canSubmit =
    parentId.length > 0 && options.some((o) => o.col.id === parentId);

  return createPortal(
    <div
      className="auth-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="auth-modal collection-merge-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-move-under-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="collection-move-under-dialog-title"
          className="auth-modal__title"
        >
          {c.uiMoveCollectionUnderDialogTitle}
        </h2>
        <p className="collection-merge-dialog__body">
          {c.uiMoveCollectionUnderHint(dialog.displayName)}
        </p>
        {options.length === 0 ? (
          <p className="collection-merge-dialog__body collection-merge-dialog__body--muted">
            {c.uiMoveCollectionUnderNoTargets}
          </p>
        ) : (
          <div className="collection-merge-dialog__field">
            <label
              className="collection-merge-dialog__label"
              htmlFor="collection-move-under-target"
            >
              {c.uiMoveCollectionUnderPickLabel}
            </label>
            <select
              id="collection-move-under-target"
              className="auth-modal__input collection-merge-dialog__select"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              {options.map(({ col, path }) => (
                <option key={col.id} value={col.id}>
                  {path}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="auth-modal__actions">
          <button
            type="button"
            className="auth-modal__btn auth-modal__btn--ghost"
            onClick={onClose}
          >
            {c.profileCancel}
          </button>
          <button
            type="button"
            className="auth-modal__btn auth-modal__btn--primary"
            disabled={!canSubmit}
            onClick={() => {
              if (!canSubmit) return;
              const sid = dialog.sourceId;
              const pid = parentId;
              onClose();
              onConfirm(sid, pid);
            }}
          >
            {c.uiMoveCollectionUnderConfirm}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
