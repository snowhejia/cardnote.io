import type { LoginUiLang } from "./auth/loginUiI18n";
import type { NoteCard } from "./types";

function localDateString(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatClock(minutesOfDay: number) {
  const h = Math.floor(minutesOfDay / 60);
  const m = minutesOfDay % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 卡片时刻角标（与 {@link formatCardTimeLabel} 内时钟一致） */
export function formatCardClock(minutesOfDay: number): string {
  return formatClock(minutesOfDay);
}

function dateFromIsoParts(y: number, mo: number, d: number): Date {
  return new Date(y, mo - 1, d);
}

/**
 * 提醒日 YYYY-MM-DD → 展示用日期；非今年则带年份（与 {@link formatCardReminderBesideTime} 日期部分一致）。
 */
export function formatReminderDateLabel(
  iso: string,
  lang: LoginUiLang = "zh"
): string {
  const raw = iso?.trim() ?? "";
  const parts = raw.split("-");
  if (parts.length !== 3) return raw || "—";
  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !mo || !d) return raw;
  const yNow = new Date().getFullYear();
  const dt = dateFromIsoParts(y, mo, d);
  if (lang === "en") {
    return y === yNow
      ? dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : dt.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
  }
  return y === yNow ? `${mo}月${d}日` : `${y}年${mo}月${d}日`;
}

const WEEKDAYS_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/**
 * 我的待办「日程表」分组标题：周几 + 日期（与 {@link formatReminderDateLabel} 同年份省略规则）。
 */
export function formatReminderScheduleDayTitle(
  iso: string,
  lang: LoginUiLang = "zh"
): string {
  const raw = iso?.trim() ?? "";
  const parts = raw.split("-");
  if (parts.length !== 3) return raw || "—";
  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !mo || !d) return raw;
  const dt = dateFromIsoParts(y, mo, d);
  const yNow = new Date().getFullYear();
  if (lang === "en") {
    return dt.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      ...(y !== yNow ? { year: "numeric" as const } : {}),
    });
  }
  const wk = WEEKDAYS_ZH[dt.getDay()] ?? "";
  const datePart =
    y === yNow ? `${mo}月${d}日` : `${y}年${mo}月${d}日`;
  return `${wk} · ${datePart}`;
}

/** 日程表左侧时间列：有 reminderTime 时用之，否则用笔记时刻 HH:mm */
export function formatReminderScheduleTime(card: NoteCard): string {
  const t = card.reminderTime?.trim();
  if (t) return t;
  return formatCardClock(card.minutesOfDay);
}

/** 卡片左上角：按 addedOn 显示「今天 / 昨天 / M月D日」+ 时刻 */
export function formatCardTimeLabel(
  card: NoteCard,
  lang: LoginUiLang = "zh"
) {
  const clock = formatClock(card.minutesOfDay);
  const added = card.addedOn;
  if (lang === "en") {
    if (!added) return `Today ${clock}`;
    const today = localDateString();
    if (added === today) return `Today ${clock}`;
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    if (added === localDateString(yest)) return `Yesterday ${clock}`;
    const ap = added.split("-");
    if (ap.length !== 3) return clock;
    const y = Number(ap[0]);
    const mo = Number(ap[1]);
    const day = Number(ap[2]);
    if (!y || !mo || !day) return clock;
    const dt = dateFromIsoParts(y, mo, day);
    const yNow = new Date().getFullYear();
    const label =
      y === yNow
        ? dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : dt.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
    return `${label} ${clock}`;
  }
  if (!added) return `今天 ${clock}`;
  const today = localDateString();
  if (added === today) return `今天 ${clock}`;
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  if (added === localDateString(yest)) return `昨天 ${clock}`;
  const [, mm, dd] = added.split("-");
  return `${Number(mm)}月${Number(dd)}日 ${clock}`;
}

/**
 * 排在 {@link formatCardTimeLabel} 之后：有提醒日时返回「 · 提醒M月D日」（非今年则带年份）。
 * 无提醒返回空串。
 */
export function formatCardReminderBesideTime(
  card: NoteCard,
  lang: LoginUiLang = "zh"
): string {
  const raw = card.reminderOn?.trim();
  if (!raw) return "";
  const parts = raw.split("-");
  if (parts.length !== 3) {
    return lang === "en" ? ` · Reminder ${raw}` : ` · 提醒 ${raw}`;
  }
  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !mo || !d) {
    return lang === "en" ? ` · Reminder ${raw}` : ` · 提醒 ${raw}`;
  }
  const yNow = new Date().getFullYear();
  const timeSuffix = card.reminderTime ? ` ${card.reminderTime}` : "";
  if (lang === "en") {
    const dt = dateFromIsoParts(y, mo, d);
    const dateLabel =
      y === yNow
        ? dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : dt.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
    return ` · Reminder ${dateLabel}${timeSuffix}`;
  }
  const dateLabel = y === yNow ? `${mo}月${d}日` : `${y}年${mo}月${d}日`;
  return ` · 提醒${dateLabel}${timeSuffix}`;
}
