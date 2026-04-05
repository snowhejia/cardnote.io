import type { TrashedNoteEntry } from "../types";
import { apiBase, apiFetchInit } from "./apiBase";
import { buildHeadersGet, buildHeadersPut } from "./collections";

/** 拉取星标合集 id；null 表示失败 */
export async function fetchMeFavorites(): Promise<string[] | null> {
  const base = apiBase();
  try {
    const r = await fetch(
      `${base}/api/me/favorites`,
      apiFetchInit({ headers: buildHeadersGet() })
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { collectionIds?: unknown };
    if (!Array.isArray(j.collectionIds)) return null;
    return j.collectionIds.filter((x): x is string => typeof x === "string");
  } catch {
    return null;
  }
}

/** 整表替换星标 id 列表 */
export async function putMeFavorites(collectionIds: string[]): Promise<boolean> {
  const base = apiBase();
  try {
    const r = await fetch(
      `${base}/api/me/favorites`,
      apiFetchInit({
        method: "PUT",
        headers: buildHeadersPut({ "Content-Type": "application/json" }),
        body: JSON.stringify({ collectionIds }),
      })
    );
    return r.ok;
  } catch {
    return false;
  }
}

/** 拉取云端回收站；null 表示失败 */
export async function fetchMeTrash(): Promise<TrashedNoteEntry[] | null> {
  const base = apiBase();
  try {
    const r = await fetch(
      `${base}/api/me/trash`,
      apiFetchInit({ headers: buildHeadersGet() })
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { entries?: unknown };
    if (!Array.isArray(j.entries)) return null;
    const out: TrashedNoteEntry[] = [];
    for (const e of j.entries) {
      if (!e || typeof e !== "object") continue;
      const o = e as Record<string, unknown>;
      if (
        typeof o.trashId !== "string" ||
        typeof o.colId !== "string" ||
        typeof o.card !== "object" ||
        o.card === null
      ) {
        continue;
      }
      out.push({
        trashId: o.trashId,
        colId: o.colId,
        colPathLabel: typeof o.colPathLabel === "string" ? o.colPathLabel : "",
        card: o.card as TrashedNoteEntry["card"],
        deletedAt: typeof o.deletedAt === "string" ? o.deletedAt : "",
      });
    }
    return out;
  } catch {
    return null;
  }
}

/** 写入一条回收站快照（删除笔记前调用） */
export async function postMeTrashEntry(entry: TrashedNoteEntry): Promise<boolean> {
  const base = apiBase();
  try {
    const r = await fetch(
      `${base}/api/me/trash`,
      apiFetchInit({
        method: "POST",
        headers: buildHeadersPut({ "Content-Type": "application/json" }),
        body: JSON.stringify(entry),
      })
    );
    return r.ok;
  } catch {
    return false;
  }
}

export async function deleteMeTrashEntry(trashId: string): Promise<boolean> {
  const base = apiBase();
  try {
    const r = await fetch(
      `${base}/api/me/trash/${encodeURIComponent(trashId)}`,
      apiFetchInit({ method: "DELETE", headers: buildHeadersPut() })
    );
    return r.ok;
  } catch {
    return false;
  }
}

export async function clearMeTrash(): Promise<boolean> {
  const base = apiBase();
  try {
    const r = await fetch(
      `${base}/api/me/trash`,
      apiFetchInit({ method: "DELETE", headers: buildHeadersPut() })
    );
    return r.ok;
  } catch {
    return false;
  }
}
