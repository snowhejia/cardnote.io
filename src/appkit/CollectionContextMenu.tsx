import { createPortal } from "react-dom";
import { useAppChrome } from "../i18n/useAppChrome";

export type CollectionContextMenuState = {
  x: number;
  y: number;
  id: string;
  name: string;
  hasChildren: boolean;
};

type Props = {
  menu: CollectionContextMenuState | null;
  onMergeInto: (id: string, name: string) => void;
  onRemove: (id: string, name: string, hasChildren: boolean) => void;
};

export function CollectionContextMenu({
  menu,
  onMergeInto,
  onRemove,
}: Props) {
  const c = useAppChrome();
  if (!menu) return null;
  return createPortal(
    <div
      data-collection-ctx-menu
      className="attachment-ctx-menu"
      style={{
        position: "fixed",
        left: Math.min(
          menu.x,
          typeof window !== "undefined" ? window.innerWidth - 180 : menu.x
        ),
        top: menu.y,
        zIndex: 10002,
      }}
      role="menu"
    >
      <button
        type="button"
        className="attachment-ctx-menu__item"
        role="menuitem"
        onClick={(e) => {
          e.stopPropagation();
          onMergeInto(menu.id, menu.name);
        }}
      >
        {c.uiMergeCollectionMenu}
      </button>
      <button
        type="button"
        className="attachment-ctx-menu__item attachment-ctx-menu__item--danger"
        role="menuitem"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(menu.id, menu.name, menu.hasChildren);
        }}
      >
        {c.uiDeleteCollectionMenu}
      </button>
    </div>,
    document.body
  );
}
