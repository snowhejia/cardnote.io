import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { DragEvent } from "react";
import type { AppDataMode } from "../appDataModeStorage";
import type { Collection } from "../types";
import {
  COLLECTION_DRAG_MIME,
  dropPositionFromEvent,
  moveCollectionInTree,
  persistCollectionTreeLayoutRemote,
  type CollectionDropPosition,
} from "./collectionDrag";
import {
  applyNoteCardDrop,
  noteCardDragTypesInclude,
  persistNoteCardDropToRemote,
  readNoteCardDragPayload,
} from "./noteCardDrag";

type DropIndicatorState = {
  targetId: string;
  position: CollectionDropPosition;
} | null;

/**
 * 侧栏合集行：合集树拖拽排序 + 接收小笔记拖入。
 */
export function useCollectionRowDnD(p: {
  canEdit: boolean;
  dataMode: AppDataMode;
  noteCardDragActiveRef: MutableRefObject<boolean>;
  draggingCollectionIdRef: MutableRefObject<string | null>;
  setCollections: Dispatch<SetStateAction<Collection[]>>;
  setCollapsedFolderIds: Dispatch<SetStateAction<Set<string>>>;
  setDraggingCollectionId: Dispatch<SetStateAction<string | null>>;
  setDropIndicator: Dispatch<SetStateAction<DropIndicatorState>>;
  setNoteCardDropCollectionId: Dispatch<SetStateAction<string | null>>;
  setCardDropMarker: Dispatch<
    SetStateAction<{
      colId: string;
      cardId: string;
      before: boolean;
    } | null>
  >;
  setDraggingNoteCardKey: Dispatch<SetStateAction<string | null>>;
}) {
  const {
    canEdit,
    dataMode,
    noteCardDragActiveRef,
    draggingCollectionIdRef,
    setCollections,
    setCollapsedFolderIds,
    setDraggingCollectionId,
    setDropIndicator,
    setNoteCardDropCollectionId,
    setCardDropMarker,
    setDraggingNoteCardKey,
  } = p;

  const onCollectionRowDragStart = useCallback(
    (id: string, e: DragEvent) => {
      if (!canEdit) {
        e.preventDefault();
        return;
      }
      const t = e.target as HTMLElement;
      if (t.closest("button, input, textarea")) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData(COLLECTION_DRAG_MIME, id);
      e.dataTransfer.setData("text/plain", id);
      e.dataTransfer.effectAllowed = "move";
      draggingCollectionIdRef.current = id;
      setDraggingCollectionId(id);
    },
    [canEdit, draggingCollectionIdRef, setDraggingCollectionId]
  );

  const onCollectionRowDragEnd = useCallback(() => {
    draggingCollectionIdRef.current = null;
    setDraggingCollectionId(null);
    setDropIndicator(null);
    setNoteCardDropCollectionId(null);
  }, [
    draggingCollectionIdRef,
    setDraggingCollectionId,
    setDropIndicator,
    setNoteCardDropCollectionId,
  ]);

  const onCollectionRowDragOver = useCallback(
    (id: string, e: DragEvent) => {
      if (!canEdit) return;
      if (
        noteCardDragActiveRef.current ||
        noteCardDragTypesInclude(e.dataTransfer)
      ) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setNoteCardDropCollectionId(id);
        return;
      }
      if (draggingCollectionIdRef.current === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const el = e.currentTarget as HTMLElement;
      setDropIndicator({
        targetId: id,
        position: dropPositionFromEvent(e, el),
      });
    },
    [
      canEdit,
      noteCardDragActiveRef,
      draggingCollectionIdRef,
      setNoteCardDropCollectionId,
      setDropIndicator,
    ]
  );

  const onCollectionRowDrop = useCallback(
    (targetId: string, e: DragEvent) => {
      if (!canEdit) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      const noteFrom = readNoteCardDragPayload(e);
      if (noteFrom) {
        if (noteFrom.colId !== targetId) {
          setCollections((prev) => {
            const next = applyNoteCardDrop(prev, noteFrom, {
              type: "collection",
              colId: targetId,
            });
            if (dataMode === "remote" && canEdit) {
              void persistNoteCardDropToRemote(noteFrom, next).then((ok) => {
                if (!ok) {
                  window.alert(
                    "笔记移动同步失败，请刷新后重试。"
                  );
                }
              });
            }
            return next;
          });
        }
        setNoteCardDropCollectionId(null);
        setCardDropMarker(null);
        setDraggingNoteCardKey(null);
        return;
      }
      const dragId = (
        e.dataTransfer.getData(COLLECTION_DRAG_MIME) ||
        e.dataTransfer.getData("text/plain")
      ).trim();
      if (!dragId) return;
      const el = e.currentTarget as HTMLElement;
      const position = dropPositionFromEvent(e, el);
      setCollections((prev) => {
        const next = moveCollectionInTree(
          prev,
          dragId,
          targetId,
          position
        );
        if (dataMode === "remote" && canEdit) {
          void persistCollectionTreeLayoutRemote(next, null).then((ok) => {
            if (!ok) {
              window.alert(
                "合集顺序同步失败，请刷新后重试。"
              );
            }
          });
        }
        return next;
      });
      if (position === "inside") {
        setCollapsedFolderIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
      }
      draggingCollectionIdRef.current = null;
      setDraggingCollectionId(null);
      setDropIndicator(null);
    },
    [
      canEdit,
      dataMode,
      setCollections,
      setCollapsedFolderIds,
      setNoteCardDropCollectionId,
      setCardDropMarker,
      setDraggingNoteCardKey,
      draggingCollectionIdRef,
      setDraggingCollectionId,
      setDropIndicator,
    ]
  );

  return {
    onCollectionRowDragStart,
    onCollectionRowDragEnd,
    onCollectionRowDragOver,
    onCollectionRowDrop,
  };
}
