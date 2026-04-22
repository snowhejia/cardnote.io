import type { ReactNode } from "react";
import { useAppChrome } from "../i18n/useAppChrome";
import type { Collection } from "../types";
import { CollectionIconGlyph } from "./CollectionIconGlyph";
import { toContrastyGlyphColor } from "../sidebarDotColor";
import type { RailKey } from "./SidebarRail";

export type SidebarOverviewPanelProps = {
  onPick: (key: RailKey, opts?: { collectionId?: string }) => void;
  /** 被标星的合集，按树顺序 */
  favoriteCollections: Collection[];
  /** 最近打开的合集，按 MRU 顺序（队首最新） */
  recentCollections: Collection[];
};

function renderCollectionRow(
  col: Collection,
  onPick: SidebarOverviewPanelProps["onPick"]
): ReactNode {
  return (
    <button
      key={col.id}
      type="button"
      className="sidebar__overview-row"
      onClick={() => onPick("notes", { collectionId: col.id })}
      title={col.name}
    >
      <CollectionIconGlyph
        shape={col.iconShape}
        color={toContrastyGlyphColor(col.dotColor)}
        size={13}
        className="sidebar__overview-icon"
      />
      <span className="sidebar__overview-label">{col.name}</span>
    </button>
  );
}

/**
 * 「概览」主侧栏：收藏合集 + 最近打开的合集。
 * 收藏列表来自用户点过星的合集（favoriteCollectionIds）。
 * 最近列表来自 MRU 队列（recentCollectionIds），每次 activeId 命中合集时更新。
 */
export function SidebarOverviewPanel(
  props: SidebarOverviewPanelProps
): ReactNode {
  const { onPick, favoriteCollections, recentCollections } = props;
  const ui = useAppChrome();

  return (
    <div className="sidebar__overview" role="listbox" aria-label={ui.railOverview}>
      {favoriteCollections.length > 0 ? (
        <div className="sidebar__overview-section">
          <div className="sidebar__overview-heading">{ui.sidebarFavorites}</div>
          <div className="sidebar__overview-list">
            {favoriteCollections.map((c) => renderCollectionRow(c, onPick))}
          </div>
        </div>
      ) : null}

      {recentCollections.length > 0 ? (
        <div className="sidebar__overview-section">
          <div className="sidebar__overview-heading">
            {ui.overviewRecentCollectionsHeading}
          </div>
          <div className="sidebar__overview-list">
            {recentCollections.map((c) => renderCollectionRow(c, onPick))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
