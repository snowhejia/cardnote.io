import { htmlToPlainText } from "../noteEditor/plainHtml";
import type { Collection, NoteCard } from "../types";
import { localDateString } from "./dateUtils";
import { walkCollectionsWithPath, isFileCard } from "./collectionModel";

export function cardTextMatchesQuery(card: NoteCard, q: string): boolean {
  if (htmlToPlainText(card.text).toLowerCase().includes(q)) return true;
  for (const t of card.tags ?? []) {
    if (t.toLowerCase().includes(q)) return true;
  }
  for (const m of card.media ?? []) {
    if ((m.name ?? "").toLowerCase().includes(q)) return true;
  }
  return false;
}

export function buildSearchResults(
  cols: Collection[],
  qRaw: string
): {
  collectionMatches: { col: Collection; path: string }[];
  groupedCards: { col: Collection; path: string; cards: NoteCard[] }[];
} {
  const q = qRaw.trim().toLowerCase();
  if (!q) {
    return { collectionMatches: [], groupedCards: [] };
  }
  const flat = walkCollectionsWithPath(cols, []);
  const collectionMatches: { col: Collection; path: string }[] = [];
  const seenNameHit = new Set<string>();
  const cardHits: { col: Collection; path: string; card: NoteCard }[] = [];

  for (const { col, path } of flat) {
    if (col.name.toLowerCase().includes(q) && !seenNameHit.has(col.id)) {
      seenNameHit.add(col.id);
      collectionMatches.push({ col, path });
    }
    for (const card of col.cards) {
      if (isFileCard(card)) continue;
      if (cardTextMatchesQuery(card, q)) {
        cardHits.push({ col, path, card });
      }
    }
  }

  const groupMap = new Map<
    string,
    { col: Collection; path: string; cards: NoteCard[] }
  >();
  for (const h of cardHits) {
    let g = groupMap.get(h.col.id);
    if (!g) {
      g = { col: h.col, path: h.path, cards: [] };
      groupMap.set(h.col.id, g);
    }
    g.cards.push(h.card);
  }
  return {
    collectionMatches,
    groupedCards: [...groupMap.values()],
  };
}

export function formatCalendarDayTitle(
  iso: string,
  lang: "zh" | "en" = "zh"
): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay();
  if (lang === "en") {
    const wk = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow];
    return `${wk}, ${m}/${d}/${y}`;
  }
  const wk = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][dow];
  return `${y}年${m}月${d}日 ${wk}`;
}

/** @deprecated 使用 {@link formatCalendarDayTitle}(iso, "zh") */
export function formatChineseDayTitle(iso: string): string {
  return formatCalendarDayTitle(iso, "zh");
}

/** 侧栏月历格：周一为列首 */
export function buildCalendarCells(
  viewMonth: Date
): (null | { day: number; dateStr: string })[] {
  const y = viewMonth.getFullYear();
  const mo = viewMonth.getMonth();
  const firstDow = new Date(y, mo, 1).getDay();
  const pad = (firstDow + 6) % 7;
  const dim = new Date(y, mo + 1, 0).getDate();
  const cells: (null | { day: number; dateStr: string })[] = [];
  for (let i = 0; i < pad; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) {
    cells.push({
      day: d,
      dateStr: localDateString(new Date(y, mo, d)),
    });
  }
  return cells;
}

/**
 * 合集侧栏默认调色板：与左侧 rail 共用的大地/暖粉色系 15 色。
 * 把新建合集 / 合集设置 / 文件子类型默认色统一到这套。
 */
export const EARTHY_DOT_PALETTE: readonly string[] = [
  "#DE4A2C", // coral
  "#E88368", // salmon
  "#E68045", // orange
  "#D98A3A", // amber
  "#E6A82A", // mustard
  "#E5C263", // gold
  "#7F8F4F", // olive
  "#9FAD72", // sage
  "#1F5F57", // teal
  "#5C9D8F", // seafoam
  "#8CB1D9", // periwinkle
  "#4C6C9A", // navy
  "#A696C4", // lavender
  "#B57A9A", // mauve
  "#E3A0AB", // rose
];

/** 新建合集侧栏圆点：从大地色系里随机挑一个 */
export function randomDotColor(): string {
  const i = Math.floor(Math.random() * EARTHY_DOT_PALETTE.length);
  return EARTHY_DOT_PALETTE[i];
}
