import { createPortal } from "react-dom";

export type CollectionDeleteDialogState = {
  id: string;
  displayName: string;
  hasSubtree: boolean;
};

type Props = {
  dialog: CollectionDeleteDialogState | null;
  onClose: () => void;
  onConfirmRemove: (id: string) => void;
};

export function CollectionDeleteDialog({
  dialog,
  onClose,
  onConfirmRemove,
}: Props) {
  if (!dialog) return null;
  return createPortal(
    <div
      className="auth-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="auth-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="collection-delete-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="collection-delete-dialog-title" className="auth-modal__title">
          删除合集
        </h2>
        <p className="auth-modal__hint">
          {dialog.hasSubtree
            ? `要连「${dialog.displayName}」带子文件夹一锅端吗？里面的笔记也会一起蒸发，救不回喔。`
            : `确定拆掉「${dialog.displayName}」这个合集？里面的笔记也会一起消失喔。`}
        </p>
        <div className="auth-modal__actions">
          <button
            type="button"
            className="auth-modal__btn auth-modal__btn--ghost"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="auth-modal__btn auth-modal__btn--primary"
            onClick={() => {
              const id = dialog.id;
              onClose();
              onConfirmRemove(id);
            }}
          >
            确定删除
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
