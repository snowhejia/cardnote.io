import type { Collection, SchemaField } from "../types";
import { findCollectionPathFromRoot } from "./collectionModel";

export function templateSchemaFieldsFromCollection(col: Collection): SchemaField[] {
  const map = new Map<string, SchemaField>();
  for (const f of col.cardSchema?.fields ?? []) {
    if (!f?.id?.trim()) continue;
    map.set(f.id, f);
  }
  return [...map.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function mergeSchemaFieldLayers(layers: Iterable<SchemaField[]>): SchemaField[] {
  const map = new Map<string, SchemaField>();
  for (const fields of layers) {
    for (const f of fields) {
      if (!f?.id?.trim()) continue;
      map.set(f.id, f);
    }
  }
  return [...map.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function mergedTemplateSchemaFieldsForCollection(
  roots: Collection[],
  collectionId: string
): SchemaField[] {
  const chain = findCollectionPathFromRoot(roots, collectionId) ?? [];
  return mergeSchemaFieldLayers(chain.map(templateSchemaFieldsFromCollection));
}

export function mergedTemplateSchemaFieldsForPlacements(
  roots: Collection[],
  placementIds: string[]
): SchemaField[] {
  const byId = new Map<string, Collection>();
  const parentById = new Map<string, string | null>();
  const walk = (nodes: Collection[], parentId: string | null) => {
    for (const c of nodes) {
      byId.set(c.id, c);
      parentById.set(c.id, parentId);
      if (c.children?.length) walk(c.children, c.id);
    }
  };
  walk(roots, null);

  const orderedCollectionIds: string[] = [];
  const orderedSeen = new Set<string>();
  for (const pid of placementIds) {
    const leafId = pid.trim();
    if (!leafId || !byId.has(leafId)) continue;
    const chain: string[] = [];
    const chainSeen = new Set<string>();
    let cur: string | null = leafId;
    while (cur && !chainSeen.has(cur)) {
      chainSeen.add(cur);
      chain.push(cur);
      cur = parentById.get(cur) ?? null;
    }
    chain.reverse();
    for (const cid of chain) {
      if (orderedSeen.has(cid)) continue;
      orderedSeen.add(cid);
      orderedCollectionIds.push(cid);
    }
  }

  return mergeSchemaFieldLayers(
    orderedCollectionIds
      .map((cid) => byId.get(cid))
      .filter((col): col is Collection => Boolean(col))
      .map(templateSchemaFieldsFromCollection)
  );
}

