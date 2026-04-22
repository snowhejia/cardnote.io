import type { ReactNode } from "react";
import { useAppChrome } from "../i18n/useAppChrome";
import type { Collection } from "../types";
import { CollectionIconGlyph } from "./CollectionIconGlyph";
import { RailIcon } from "./RailIcon";
import type { RailIconKey } from "./RailIcon";
import { toContrastyGlyphColor } from "../sidebarDotColor";
import type { RailKey } from "./SidebarRail";

type QuickLink = {
  key: RailKey;
  label: string;
  icon: RailIconKey;
  show: boolean;
};

export type SidebarOverviewPanelProps = {
  onPick: (key: RailKey, opts?: { collectionId?: string }) => void;
  /** 扁平化的顶层合集列表（只取前 N 个展示，作为「最近合集」占位） */
  recentCollections: Collection[];
  availability: {
    files: boolean;
    archived: boolean;
  };
};

/**
 * 「概览」主侧栏：快速入口 + 最近合集。
 * 当前无 LRU，recentCollections 由 App.tsx 传入顶层合集的 slice 占位。
 */
export function SidebarOverviewPanel(
  props: SidebarOverviewPanelProps
): ReactNode {
  const { onPick, recentCollections, availability } = props;
  const ui = useAppChrome();

  const quickLinks: QuickLink[] = [
    { key: "notes", icon: "arch", label: ui.railNotes, show: true },
    {
      key: "files",
      icon: "stair",
      label: ui.railFiles,
      show: availability.files,
    },
    { key: "calendar", icon: "ring", label: ui.railCalendar, show: true },
    { key: "reminders", icon: "sparkle", label: ui.railReminders, show: true },
    { key: "connections", icon: "peanut", label: ui.railConnections, show: true },
    {
      key: "archived",
      icon: "scallop",
      label: ui.railArchived,
      show: availability.archived,
    },
    { key: "trash", icon: "sStep", label: ui.railTrash, show: true },
  ];

  return (
    <div className="sidebar__overview" role="listbox" aria-label={ui.railOverview}>
      <div className="sidebar__overview-section">
        <div className="sidebar__overview-heading">
          {ui.overviewQuickLinksHeading}
        </div>
        <div className="sidebar__overview-list">
          {quickLinks
            .filter((q) => q.show)
            .map((q) => (
              <button
                key={q.key}
                type="button"
                className="sidebar__overview-row"
                onClick={() => onPick(q.key)}
              >
                <RailIcon
                  shape={q.icon}
                  size={16}
                  className="sidebar__overview-icon"
                />
                <span className="sidebar__overview-label">{q.label}</span>
              </button>
            ))}
        </div>
      </div>

      {recentCollections.length > 0 ? (
        <div className="sidebar__overview-section">
          <div className="sidebar__overview-heading">
            {ui.overviewRecentCollectionsHeading}
          </div>
          <div className="sidebar__overview-list">
            {recentCollections.map((c) => (
              <button
                key={c.id}
                type="button"
                className="sidebar__overview-row"
                onClick={() => onPick("notes", { collectionId: c.id })}
                title={c.name}
              >
                <CollectionIconGlyph
                  shape={c.iconShape}
                  color={toContrastyGlyphColor(c.dotColor)}
                  size={13}
                  className="sidebar__overview-icon"
                />
                <span className="sidebar__overview-label">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
