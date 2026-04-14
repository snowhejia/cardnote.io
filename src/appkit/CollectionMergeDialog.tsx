import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { useAppChrome } from "../i18n/useAppChrome";
import type { Collection } from "../types";
import { findCollectionById, walkCollectionsWithPath } from "./collectionModel";

/** 与 collectionDrag.isTargetUnderDragNode 一致：target 是否为 root 的（非自身）子孙 */
function isStrictDescendantCollection(root: Collection, targetId: string): boolean {
  function walk(n: Collection): boolean {
    if (n.id === targetId) return true;
    return (n.children ?? []).some(walk);
  }
  return (root.children ?? []).some(walk);
}

export type CollectionMergeDialogState = {
  sourceId: string;
  displayName: string;
};

type Props = {
  dialog: CollectionMergeDialogState | null;
  collections: Collection[];
  onClose: () => void;
  onConfirmMerge: (sourceId: string, targetId: string) => void;
};

export function CollectionMergeDialog({
  dialog,
  collections,
  onClose,
  onConfirmMerge,
}: Props) {
  const c = useAppChrome();
  const options = useMemo(() => {
    if (!dialog) return [];
    const sourceNode = findCollectionById(collections, dialog.sourceId);
    if (!sourceNode) return [];
    const flat = walkCollectionsWithPath(collections, []);
    return flat.filter(({ col }) => {
      if (col.id === dialog.sourceId) return false;
      return !isStrictDescendantCollection(sourceNode, col.id);
    });
  }, [collections, dialog]);

  const [targetId, setTargetId] = useState("");

  useEffect(() => {
    if (!dialog) return;
    setTargetId(options[0]?.col.id ?? "");
  }, [dialog, options]);

  if (!dialog) return null;

  const canSubmit = targetId.length > 0 && options.some((o) => o.col.id === targetId);

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
        aria-labelledby="collection-merge-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="collection-merge-dialog-title" className="auth-modal__title">
          {c.uiMergeCollectionDialogTitle}
        </h2>
        <p className="collection-merge-dialog__body">
          {c.uiMergeCollectionHint(dialog.displayName)}
        </p>
        {options.length === 0 ? (
          <p className="collection-merge-dialog__body collection-merge-dialog__body--muted">
            {c.uiMergeCollectionNoTargets}
          </p>
        ) : (
          <div className="collection-merge-dialog__field">
            <label
              className="collection-merge-dialog__label"
              htmlFor="collection-merge-target"
            >
              {c.uiMergeCollectionPickLabel}
            </label>
            <select
              id="collection-merge-target"
              className="auth-modal__input collection-merge-dialog__select"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
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
              const tid = targetId;
              onClose();
              onConfirmMerge(sid, tid);
            }}
          >
            {c.uiMergeCollectionConfirm}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
