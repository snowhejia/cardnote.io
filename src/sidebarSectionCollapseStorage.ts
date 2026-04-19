import type { AppDataMode } from "./appDataModeStorage";

export type SidebarSectionCollapseState = {
  /** 侧栏「全部笔记 / 待办 / 笔记探索」 */
  notes: boolean;
  /** 侧栏「所有附件」 */
  files: boolean;
  calendar: boolean;
  favorites: boolean;
  collections: boolean;
  tags: boolean;
};

export function defaultSidebarSectionCollapseState(): SidebarSectionCollapseState {
  return {
    notes: false,
    files: false,
    calendar: false,
    favorites: false,
    collections: false,
    tags: false,
  };
}

function defaultState(): SidebarSectionCollapseState {
  return defaultSidebarSectionCollapseState();
}

/** `true` = 该区域内容已折叠隐藏 */
export function sidebarSectionsCollapseStorageKey(
  dataMode: AppDataMode,
  userId: string | null | undefined
): string {
  const u =
    dataMode === "remote"
      ? userId?.trim() || "signed-out"
      : "local";
  return `mikujar.sidebarSectionCollapsed.${dataMode}.${u}`;
}

export function readSidebarSectionsCollapsed(
  key: string
): SidebarSectionCollapseState {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultState();
    const o = JSON.parse(raw) as Partial<
      SidebarSectionCollapseState & { features?: boolean }
    >;
    const legacy =
      typeof o.features === "boolean" &&
      o.notes === undefined &&
      o.files === undefined;
    return {
      notes: legacy ? Boolean(o.features) : Boolean(o.notes),
      files: legacy ? Boolean(o.features) : Boolean(o.files),
      calendar: Boolean(o.calendar),
      favorites: Boolean(o.favorites),
      collections: Boolean(o.collections),
      tags: Boolean(o.tags),
    };
  } catch {
    return defaultState();
  }
}

export function writeSidebarSectionsCollapsed(
  key: string,
  state: SidebarSectionCollapseState
): void {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
