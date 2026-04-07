import { useEffect, type Dispatch, type SetStateAction } from "react";
import { fetchApiHealth } from "../api/health";
import {
  fetchCollectionsFromApi,
  saveCollectionsToApi,
} from "../api/collections";
import type { AppDataMode } from "../appDataModeStorage";
import { getAdminToken } from "../auth/token";
import { cloneInitialCollections } from "./initialWorkspace";
import { loadLocalCollections } from "../localCollectionsStorage";
import { migrateCollectionTree } from "../migrateCollections";
import {
  loadRemoteCollectionsSnapshot,
  remoteSnapshotUserKey,
  saveRemoteCollectionsSnapshot,
} from "../remoteCollectionsCache";
import type { Collection } from "../types";
import {
  activeCollectionStorageKey,
  collapsedFoldersStorageKey,
  readCollapsedFolderIdsFromStorage,
  readPersistedActiveCollectionId,
} from "./workspaceStorage";
import {
  pruneCollapsedFolderIds,
  resolveActiveCollectionId,
} from "./collectionModel";

type MediaMode = "cos" | "local" | null;

/**
 * 云端：健康检查 + 拉取/缓存合集树；本地：读 localStorage。
 */
export function useRemoteCollectionsSync(p: {
  authReady: boolean;
  dataMode: AppDataMode;
  writeRequiresLogin: boolean;
  currentUser: { id: string } | null | undefined;
  setCollections: Dispatch<SetStateAction<Collection[]>>;
  setActiveId: Dispatch<SetStateAction<string>>;
  setCollapsedFolderIds: Dispatch<SetStateAction<Set<string>>>;
  setRemoteLoaded: Dispatch<SetStateAction<boolean>>;
  setRemoteBootSyncing: Dispatch<SetStateAction<boolean>>;
  setRemoteSaveAllowed: Dispatch<SetStateAction<boolean>>;
  setApiOnline: Dispatch<SetStateAction<boolean>>;
  setLoadError: Dispatch<SetStateAction<string | null>>;
  setSaveError: Dispatch<SetStateAction<string | null>>;
  setMediaUploadMode: Dispatch<SetStateAction<MediaMode>>;
  setSidebarFlash: Dispatch<SetStateAction<string | null>>;
}): void {
  const {
    authReady,
    dataMode,
    writeRequiresLogin,
    currentUser,
    setCollections,
    setActiveId,
    setCollapsedFolderIds,
    setRemoteLoaded,
    setRemoteBootSyncing,
    setRemoteSaveAllowed,
    setApiOnline,
    setLoadError,
    setSaveError,
    setMediaUploadMode,
    setSidebarFlash,
  } = p;

  useEffect(() => {
    if (!authReady) return;

    if (dataMode === "local") {
      setMediaUploadMode(null);
      setApiOnline(true);
      setLoadError(null);
      setSaveError(null);
      setRemoteBootSyncing(false);
      const cols = loadLocalCollections(cloneInitialCollections);
      setCollections(cols);
      const localKey = activeCollectionStorageKey("local", null);
      const localCollapsedKey = collapsedFoldersStorageKey("local", null);
      setActiveId(
        resolveActiveCollectionId(cols, readPersistedActiveCollectionId(localKey))
      );
      setCollapsedFolderIds(
        pruneCollapsedFolderIds(
          cols,
          readCollapsedFolderIdsFromStorage(localCollapsedKey)
        )
      );
      setRemoteLoaded(true);
      return;
    }

    const snapshotKey = remoteSnapshotUserKey(
      writeRequiresLogin,
      currentUser?.id ?? null
    );
    const canTryRemoteCache =
      snapshotKey !== null &&
      (!writeRequiresLogin || Boolean(currentUser || getAdminToken()));

    let usedRemoteCache = false;
    if (canTryRemoteCache) {
      const cached = loadRemoteCollectionsSnapshot(snapshotKey);
      if (cached !== null) {
        const remoteUserId = writeRequiresLogin ? currentUser?.id ?? null : null;
        const remoteKey = activeCollectionStorageKey("remote", remoteUserId);
        const remoteCollapsedKey = collapsedFoldersStorageKey(
          "remote",
          remoteUserId
        );
        setCollections(cached);
        setActiveId(
          resolveActiveCollectionId(
            cached,
            readPersistedActiveCollectionId(remoteKey)
          )
        );
        setCollapsedFolderIds(
          pruneCollapsedFolderIds(
            cached,
            readCollapsedFolderIdsFromStorage(remoteCollapsedKey)
          )
        );
        setRemoteLoaded(true);
        setRemoteSaveAllowed(true);
        usedRemoteCache = true;
      }
    }

    if (!usedRemoteCache) {
      setRemoteSaveAllowed(false);
      setRemoteLoaded(false);
    }

    let cancelled = false;
    setRemoteBootSyncing(true);
    (async () => {
      try {
        const health = await fetchApiHealth();
        if (cancelled) return;
        const mu = health?.mediaUpload;
        if (mu === "cos" || mu === "local") {
          setMediaUploadMode(mu);
        } else {
          setMediaUploadMode(null);
        }
        const online = Boolean(health?.ok);
        if (writeRequiresLogin && !currentUser && !getAdminToken()) {
          setCollections([]);
          setLoadError(null);
          setSaveError(null);
          setApiOnline(online);
          setRemoteSaveAllowed(false);
          setRemoteLoaded(true);
          return;
        }
        const data = await fetchCollectionsFromApi();
        if (cancelled) return;
        if (data !== null) {
          let tree = migrateCollectionTree(data);
          const authed = Boolean(currentUser || getAdminToken());
          if (tree.length === 0 && authed && writeRequiresLogin) {
            tree = cloneInitialCollections();
            const seeded = await saveCollectionsToApi(tree);
            if (!seeded) {
              setSidebarFlash(
                "新账号内置笔记已就绪，但首次同步到服务器失败，可稍后再试或联系管理员"
              );
            }
          }
          setCollections(tree);
          const remoteKey = activeCollectionStorageKey(
            "remote",
            currentUser?.id ?? null
          );
          const remoteCollapsedKey = collapsedFoldersStorageKey(
            "remote",
            currentUser?.id ?? null
          );
          setActiveId(
            resolveActiveCollectionId(
              tree,
              readPersistedActiveCollectionId(remoteKey)
            )
          );
          setCollapsedFolderIds(
            pruneCollapsedFolderIds(
              tree,
              readCollapsedFolderIdsFromStorage(remoteCollapsedKey)
            )
          );
          if (snapshotKey) {
            saveRemoteCollectionsSnapshot(snapshotKey, tree);
          }
          setApiOnline(true);
          setLoadError(null);
          setRemoteSaveAllowed(true);
        } else {
          setRemoteSaveAllowed(false);
          if (writeRequiresLogin && (currentUser || getAdminToken())) {
            setLoadError(
              "笔记加载摔了一跤… 看看网络或重新登录试试？"
            );
            if (!usedRemoteCache) {
              setCollections([]);
              setApiOnline(false);
            } else {
              setApiOnline(false);
            }
          } else {
            setLoadError(
              "连不上服务器喵～请检查网络或稍后再刷新。"
            );
            if (!usedRemoteCache) {
              setCollections([]);
              setApiOnline(online);
            }
          }
        }
        setRemoteLoaded(true);
      } finally {
        if (!cancelled) setRemoteBootSyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    authReady,
    dataMode,
    writeRequiresLogin,
    currentUser?.id,
    setCollections,
    setActiveId,
    setCollapsedFolderIds,
    setRemoteLoaded,
    setRemoteBootSyncing,
    setRemoteSaveAllowed,
    setApiOnline,
    setLoadError,
    setSaveError,
    setMediaUploadMode,
    setSidebarFlash,
  ]);
}
