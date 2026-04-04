import type { Collection } from "./types";
import { migrateCollectionTree } from "./migrateCollections";

const KEY = "mikujar.local.v1.collections";

export function loadLocalCollections(
  fallback: () => Collection[]
): Collection[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback();
    const parsed = JSON.parse(raw) as unknown;
    return migrateCollectionTree(parsed);
  } catch {
    return fallback();
  }
}

export function saveLocalCollections(data: Collection[]): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}
