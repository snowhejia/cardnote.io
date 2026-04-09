import { createPortal } from "react-dom";

export type CollectionContextMenuState = {
  x: number;
  y: number;
  id: string;
  name: string;
  hasChildren: boolean;
};

type Props = {
  menu: CollectionContextMenuState | null;
  onRemove: (id: string, name: string, hasChildren: boolean) => void;
};

export function CollectionContextMenu({ menu, onRemove }: Props) {
  if (!menu) return null;
  return createPortal(
    <div
      data-collection-ctx-menu
      className="attachment-ctx-menu"
      style={{
        position: "fixed",
        left: Math.min(
          menu.x,
          typeof window !== "undefined" ? window.innerWidth - 160 : menu.x
        ),
        top: menu.y,
        zIndex: 10002,
      }}
      role="menu"
    >
      <button
        type="button"
        className="attachment-ctx-menu__item attachment-ctx-menu__item--danger"
        role="menuitem"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(menu.id, menu.name, menu.hasChildren);
        }}
      >
        删除合集
      </button>
    </div>,
    document.body
  );
}
