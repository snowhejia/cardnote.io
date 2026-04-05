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

/** 卡片左上角：按 addedOn 显示「今天 / 昨天 / M月D日」+ 时刻 */
export function formatCardTimeLabel(card: NoteCard) {
  const clock = formatClock(card.minutesOfDay);
  const added = card.addedOn;
  if (!added) return `今天 ${clock}`;
  const today = localDateString();
  if (added === today) return `今天 ${clock}`;
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  if (added === localDateString(yest)) return `昨天 ${clock}`;
  const [, mm, dd] = added.split("-");
  return `${Number(mm)}月${Number(dd)}日 ${clock}`;
}
