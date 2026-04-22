import type { ReactNode } from "react";
import { useAppChrome } from "../i18n/useAppChrome";
import { RailIcon } from "./RailIcon";
import type { RailIconKey } from "./RailIcon";

/** Rail 顶层导航项的 key（与 App.tsx 的 railKey 派生一一对应）。 */
export type RailKey =
  | "overview"
  | "notes"
  | "files"
  | "topic"
  | "clip"
  | "work"
  | "task"
  | "project"
  | "expense"
  | "account"
  | "calendar"
  | "reminders"
  | "connections"
  | "archived"
  | "trash";

export type RailAvailability = {
  /** 笔记常驻，保留位以便未来做权限隐藏 */
  notes: boolean;
  files: boolean;
  topic: boolean;
  clip: boolean;
  work: boolean;
  task: boolean;
  project: boolean;
  expense: boolean;
  account: boolean;
  /** 是否存在名为「已归档」的合集 */
  archived: boolean;
};

type RailGroup = "content" | "system";

type RailItemDef = {
  key: RailKey;
  icon: RailIconKey;
  /** useAppChrome 里的 label 键 */
  labelKey:
    | "railOverview"
    | "railNotes"
    | "railFiles"
    | "railTopic"
    | "railClip"
    | "railWork"
    | "railTask"
    | "railProject"
    | "railExpense"
    | "railAccount"
    | "railCalendar"
    | "railReminders"
    | "railConnections"
    | "railArchived"
    | "railTrash";
  /** 未命中 availability 时本项整个不渲染 */
  availabilityKey?: keyof RailAvailability;
  group: RailGroup;
};

/** 导航顺序。预设大类型全部平行放在 content 组，无分小组。 */
export const RAIL_ITEMS: RailItemDef[] = [
  { key: "overview", icon: "twinkle", labelKey: "railOverview", group: "content" },
  { key: "notes", icon: "arch", labelKey: "railNotes", group: "content" },
  {
    key: "files",
    icon: "stair",
    labelKey: "railFiles",
    availabilityKey: "files",
    group: "content",
  },
  {
    key: "topic",
    icon: "petal",
    labelKey: "railTopic",
    availabilityKey: "topic",
    group: "content",
  },
  {
    key: "clip",
    icon: "arc",
    labelKey: "railClip",
    availabilityKey: "clip",
    group: "content",
  },
  {
    key: "work",
    icon: "hourglass",
    labelKey: "railWork",
    availabilityKey: "work",
    group: "content",
  },
  {
    key: "task",
    icon: "dots",
    labelKey: "railTask",
    availabilityKey: "task",
    group: "content",
  },
  {
    key: "project",
    icon: "butterfly",
    labelKey: "railProject",
    availabilityKey: "project",
    group: "content",
  },
  {
    key: "expense",
    icon: "capsule",
    labelKey: "railExpense",
    availabilityKey: "expense",
    group: "content",
  },
  {
    key: "account",
    icon: "heart",
    labelKey: "railAccount",
    availabilityKey: "account",
    group: "content",
  },
  { key: "calendar", icon: "ring", labelKey: "railCalendar", group: "system" },
  { key: "reminders", icon: "sparkle", labelKey: "railReminders", group: "system" },
  { key: "connections", icon: "peanut", labelKey: "railConnections", group: "system" },
  {
    key: "archived",
    icon: "scallop",
    labelKey: "railArchived",
    availabilityKey: "archived",
    group: "system",
  },
  { key: "trash", icon: "sStep", labelKey: "railTrash", group: "system" },
];

function filterItems(
  items: RailItemDef[],
  availability: RailAvailability
): RailItemDef[] {
  return items.filter((it) => {
    if (!it.availabilityKey) return true;
    return availability[it.availabilityKey];
  });
}

export type SidebarRailProps = {
  activeKey: RailKey;
  onPick: (key: RailKey) => void;
  availability: RailAvailability;
};

/**
 * 窄导航条：所有顶层入口（大类型 + 工具/系统视图）集中在这里。
 * 纯图标 56px 宽，hover/focus 弹 tooltip；点击通过 onPick 委托给 App.tsx。
 */
export function SidebarRail(props: SidebarRailProps): ReactNode {
  const { activeKey, onPick, availability } = props;
  const ui = useAppChrome();
  const contentItems = filterItems(
    RAIL_ITEMS.filter((it) => it.group === "content"),
    availability
  );
  const systemItems = filterItems(
    RAIL_ITEMS.filter((it) => it.group === "system"),
    availability
  );

  const renderItem = (it: RailItemDef) => {
    const label = ui[it.labelKey];
    const isActive = it.key === activeKey;
    return (
      <button
        key={it.key}
        type="button"
        className={"rail__item" + (isActive ? " is-active" : "")}
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
        title={label}
        onClick={() => onPick(it.key)}
      >
        <RailIcon shape={it.icon} size={22} className="rail__icon" />
        <span className="rail__tip">{label}</span>
      </button>
    );
  };

  return (
    <nav className="rail" aria-label={ui.railAriaNav}>
      <div className="rail__group">{contentItems.map(renderItem)}</div>
      <hr className="rail__rule" />
      <div className="rail__group">{systemItems.map(renderItem)}</div>
    </nav>
  );
}
