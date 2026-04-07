import { getAppDataMode } from "../appDataModeStorage";
import { collections as initialCollections } from "../data";
import { loadLocalCollections } from "../localCollectionsStorage";
import type { Collection } from "../types";
import {
  pruneCollapsedFolderIds,
  resolveActiveCollectionId,
} from "./collectionModel";
import {
  activeCollectionStorageKey,
  collapsedFoldersStorageKey,
  readCollapsedFolderIdsFromStorage,
  readPersistedActiveCollectionId,
} from "./workspaceStorage";

export function cloneInitialCollections(): Collection[] {
  return structuredClone(initialCollections) as Collection[];
}

/** 首屏：本地模式读缓存/内置；云端模式不预填示例，避免未登录时闪一下样例 */
export function initialWorkspaceFromStorage(): {
  collections: Collection[];
  activeId: string;
  collapsedFolderIds: Set<string>;
} {
  if (getAppDataMode() === "local") {
    const cols = loadLocalCollections(cloneInitialCollections);
    const activeKey = activeCollectionStorageKey("local", null);
    const collapsedKey = collapsedFoldersStorageKey("local", null);
    return {
      collections: cols,
      activeId: resolveActiveCollectionId(
        cols,
        readPersistedActiveCollectionId(activeKey)
      ),
      collapsedFolderIds: pruneCollapsedFolderIds(
        cols,
        readCollapsedFolderIdsFromStorage(collapsedKey)
      ),
    };
  }
  return {
    collections: [],
    activeId: "",
    collapsedFolderIds: new Set(),
  };
}

export const INITIAL_WORKSPACE = initialWorkspaceFromStorage();
