import { htmlToPlainText } from "../noteEditor/plainHtml";
import type { Collection, NoteCard } from "../types";
import { localDateString } from "./dateUtils";
import { walkCollectionsWithPath } from "./collectionModel";

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

export function formatChineseDayTitle(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const wk = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][
    dt.getDay()
  ];
  return `${y}年${m}月${d}日 ${wk}`;
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

/** 新建合集侧栏圆点：随机色相，饱和度与亮度控制在易辨认、不过分刺眼 */
export function randomDotColor(): string {
  const h = Math.floor(Math.random() * 360);
  const s = 48 + Math.floor(Math.random() * 28);
  const l = 48 + Math.floor(Math.random() * 14);
  return `hsl(${h} ${s}% ${l}%)`;
}
