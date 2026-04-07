import type { Collection } from "./types";
import { migrateCollectionTree } from "./migrateCollections";

const KEY = "mikujar.remote.v1.collectionsSnapshot";

export type RemoteCollectionsSnapshotV1 = {
  v: 1;
  userKey: string;
  collections: Collection[];
  savedAt: string;
};

/**
 * 与 activeCollectionStorageKey(remote, userId) 的 guest 语义一致：未登录云端用 guest。
 * 要求登录时必须有 userId，否则返回 null（不做按用户快照，避免串数据）。
 */
export function remoteSnapshotUserKey(
  writeRequiresLogin: boolean,
  userId: string | null | undefined
): string | null {
  if (writeRequiresLogin) {
    const id = userId?.trim();
    return id ? id : null;
  }
  return userId?.trim() || "guest";
}

export function loadRemoteCollectionsSnapshot(
  userKey: string
): Collection[] | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<RemoteCollectionsSnapshotV1>;
    if (o.v !== 1 || o.userKey !== userKey || !Array.isArray(o.collections)) {
      return null;
    }
    return migrateCollectionTree(o.collections);
  } catch {
    return null;
  }
}

export function saveRemoteCollectionsSnapshot(
  userKey: string,
  collections: Collection[]
): void {
  try {
    if (typeof localStorage === "undefined") return;
    const payload: RemoteCollectionsSnapshotV1 = {
      v: 1,
      userKey,
      collections,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // quota / 隐私模式
  }
}
