import type { AppDataMode } from "./appDataModeStorage";

export type SidebarSectionCollapseState = {
  /** 侧栏「全部笔记 / 待办 / 笔记探索」 */
  notes: boolean;
  /** 侧栏「文件」 */
  files: boolean;
  /** 侧栏「主题」（人物类目） */
  topic: boolean;
  /** 侧栏「剪藏」（网页剪藏 / 小红书 / B 站等） */
  clip: boolean;
  /** 侧栏「作品」预设分区 */
  work: boolean;
  /** 侧栏「任务」预设分区 */
  task: boolean;
  /** 侧栏「项目」预设分区 */
  project: boolean;
  /** 侧栏「开支」预设分区 */
  expense: boolean;
  /** 侧栏「账户」预设分区 */
  account: boolean;
  calendar: boolean;
  favorites: boolean;
  collections: boolean;
};

export function defaultSidebarSectionCollapseState(): SidebarSectionCollapseState {
  return {
    notes: false,
    files: false,
    topic: false,
    clip: false,
    work: false,
    task: false,
    project: false,
    expense: false,
    account: false,
    calendar: false,
    favorites: false,
    collections: false,
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
      SidebarSectionCollapseState & {
        features?: boolean;
        tags?: boolean;
        web?: boolean;
      }
    >;
    const legacy =
      typeof o.features === "boolean" &&
      o.notes === undefined &&
      o.files === undefined;
    return {
      notes: legacy ? Boolean(o.features) : Boolean(o.notes),
      files: legacy ? Boolean(o.features) : Boolean(o.files),
      topic: typeof o.topic === "boolean" ? o.topic : false,
      clip: typeof o.clip === "boolean" ? o.clip : false,
      work: typeof o.work === "boolean" ? o.work : false,
      task: typeof o.task === "boolean" ? o.task : false,
      project: typeof o.project === "boolean" ? o.project : false,
      expense: typeof o.expense === "boolean" ? o.expense : false,
      account: typeof o.account === "boolean" ? o.account : false,
      calendar: Boolean(o.calendar),
      favorites: Boolean(o.favorites),
      collections: Boolean(o.collections),
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
