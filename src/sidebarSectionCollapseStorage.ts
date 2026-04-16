import type { AppDataMode } from "./appDataModeStorage";

export type SidebarSectionCollapseState = {
  /** 侧栏「全部笔记 / 待办 / 笔记探索 / 所有附件」整块 */
  features: boolean;
  calendar: boolean;
  favorites: boolean;
  collections: boolean;
  tags: boolean;
};

export function defaultSidebarSectionCollapseState(): SidebarSectionCollapseState {
  return {
    features: false,
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
    const o = JSON.parse(raw) as Partial<SidebarSectionCollapseState>;
    return {
      features: Boolean(o.features),
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
