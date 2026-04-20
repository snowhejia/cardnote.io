import { LOOSE_NOTES_COLLECTION_ID } from "./appkit/collectionModel";
import type { CardLinkRef, CardProperty } from "./types";

/**
 * 剪藏：父级 sf-clip-url 与子级 sf-xhs-url / sf-bili-url 曾写入相同 URL，合并展示后去掉重复项。
 */
function dedupeRedundantClipChildUrls(props: CardProperty[]): CardProperty[] {
  const clip = props.find((p) => p?.id === "sf-clip-url" && p.type === "url");
  const clipVal =
    clip && typeof clip.value === "string" ? clip.value.trim() : "";
  if (!clipVal) return props;
  return props.filter((p) => {
    if (!p) return true;
    if (
      (p.id === "sf-bili-url" || p.id === "sf-xhs-url") &&
      p.type === "url"
    ) {
      const v = typeof p.value === "string" ? p.value.trim() : "";
      return v !== clipVal;
    }
    return true;
  });
}

/** 将旧版 `select` / `multiSelect` 并入 `choice`（值均为 string[] | null） */
export function migrateCustomPropToChoice(p: CardProperty): CardProperty {
  const t = p.type as string;
  if (t === "select") {
    const v = p.value;
    const arr =
      typeof v === "string" && v.trim() ? [v.trim()] : [];
    return {
      ...p,
      type: "choice",
      value: arr.length ? arr : null,
    };
  }
  if (t === "multiSelect") {
    return { ...p, type: "choice" };
  }
  return p;
}

export function migrateCustomPropsList(props: CardProperty[]): CardProperty[] {
  const migrated = props.map((p) => {
    let x = migrateCustomPropToChoice(p);
    if (x.type === "collectionLink" && Array.isArray(x.value)) {
      const arr = x.value as string[];
      const v = arr.filter(
        (id) =>
          typeof id === "string" &&
          id.trim() &&
          id !== LOOSE_NOTES_COLLECTION_ID
      );
      if (v.length !== arr.length) {
        x = { ...x, value: v.length ? v : null };
      }
    }
    if (x.type === "cardLink" && x.value != null && typeof x.value === "object") {
      const o = x.value as Record<string, unknown>;
      const colId = typeof o.colId === "string" ? o.colId.trim() : "";
      const cardId = typeof o.cardId === "string" ? o.cardId.trim() : "";
      if (!colId || !cardId) {
        x = { ...x, value: null };
      }
    }
    if (x.type === "cardLinks" && Array.isArray(x.value)) {
      const seen = new Set<string>();
      const cleaned: CardLinkRef[] = [];
      for (const item of x.value) {
        if (!item || typeof item !== "object") continue;
        const o = item as Record<string, unknown>;
        const colId = typeof o.colId === "string" ? o.colId.trim() : "";
        const cardId = typeof o.cardId === "string" ? o.cardId.trim() : "";
        if (!colId || !cardId) continue;
        const key = `${colId}\t${cardId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        cleaned.push({ colId, cardId });
      }
      x = { ...x, value: cleaned.length ? cleaned : null };
    }
    return x;
  });
  return dedupeRedundantClipChildUrls(migrated);
}
