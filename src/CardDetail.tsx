import { useCallback, useEffect, useMemo, useState } from "react";
import type { DragEvent, ClipboardEvent } from "react";
import { createPortal } from "react-dom";
import { CardGallery } from "./CardGallery";
import { CardTagsRow } from "./CardTagsRow";
import {
  formatCardReminderBesideTime,
  formatCardTimeLabel,
} from "./cardTimeLabel";
import {
  dataTransferHasFiles,
  filesFromDataTransfer,
} from "./filesFromDataTransfer";
import { NoteCardTiptap } from "./noteEditor/NoteCardTiptap";
import type { NoteCard, NoteMediaItem } from "./types";

const detailMenuId = (cardId: string) => `__detail__${cardId}`;

const CARD_DETAIL_LAYOUT_KEY = "mikujar-card-detail-layout";

/** 左右分栏：方框 + 正中竖线 */
function IconDetailLayoutSplit() {
  return (
    <svg
      className="card__detail-layout-toggle-icon"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={true}
    >
      <rect
        x="2.5"
        y="2.5"
        width="11"
        height="11"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <line
        x1="8"
        y1="3.75"
        x2="8"
        y2="12.25"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 上下分栏：方框 + 正中横线 */
function IconDetailLayoutStack() {
  return (
    <svg
      className="card__detail-layout-toggle-icon"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={true}
    >
      <rect
        x="2.5"
        y="2.5"
        width="11"
        height="11"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <line
        x1="3.75"
        y1="8"
        x2="12.25"
        y2="8"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function readInitialDetailLayoutStack(): boolean {
  try {
    return localStorage.getItem(CARD_DETAIL_LAYOUT_KEY) === "stack";
  } catch {
    return false;
  }
}

export interface CardDetailProps {
  card: NoteCard;
  colId: string;
  onClose: () => void;
  canEdit: boolean;
  canAttachMedia: boolean;
  relatedPanelOpen: boolean;
  uploadBusy: boolean;
  cardMenuId: string | null;
  setCardMenuId: (id: string | null) => void;
  onToggleRelatedPanel: () => void;
  onBeginMediaUpload: () => void;
  onClearMedia: () => void;
  onTogglePin: () => void;
  /** 打开提醒日期选择（与列表卡片「⋯」一致） */
  onOpenReminderPicker?: () => void;
  onDelete: () => void;
  onChangeText: (html: string) => void;
  onTagsCommit: (colId: string, cardId: string, tags: string[]) => void;
  onPasteFiles?: (files: File[]) => void;
  onRemoveGalleryItem?: (item: NoteMediaItem) => void;
  /** 将附件设为轮播首项（封面） */
  onSetGalleryCoverItem?: (item: NoteMediaItem) => void;
}

/** 详情覆层：与主时间线相同的 card / card__paper / 轮播结构；音视频在侧栏内直接播放 */
export function CardDetail({
  card,
  colId,
  onClose,
  canEdit,
  canAttachMedia,
  relatedPanelOpen,
  uploadBusy,
  cardMenuId,
  setCardMenuId,
  onToggleRelatedPanel,
  onBeginMediaUpload,
  onClearMedia,
  onTogglePin,
  onOpenReminderPicker,
  onDelete,
  onChangeText,
  onTagsCommit,
  onPasteFiles,
  onRemoveGalleryItem,
  onSetGalleryCoverItem,
}: CardDetailProps) {
  const menuId = useMemo(() => detailMenuId(card.id), [card.id]);
  const menuOpen = cardMenuId === menuId;
  const reminderBesideTime = formatCardReminderBesideTime(card);
  const [fileDragOver, setFileDragOver] = useState(false);
  /** true = 上下分栏（附件在上、正文在下）；false = 左右分栏 */
  const [layoutStack, setLayoutStack] = useState(readInitialDetailLayoutStack);

  const attachEnabled =
    Boolean(canEdit && canAttachMedia && onPasteFiles);

  const onDetailDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!attachEnabled) return;
      if (!dataTransferHasFiles(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
    },
    [attachEnabled]
  );

  const onDetailDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!attachEnabled) return;
      if (!dataTransferHasFiles(e.dataTransfer)) return;
      e.preventDefault();
      setFileDragOver(true);
    },
    [attachEnabled]
  );

  const onDetailDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!attachEnabled) return;
      const rel = e.relatedTarget as Node | null;
      if (rel && e.currentTarget.contains(rel)) return;
      setFileDragOver(false);
    },
    [attachEnabled]
  );

  const onDetailDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!attachEnabled || !onPasteFiles) return;
      if (!dataTransferHasFiles(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      setFileDragOver(false);
      const files = filesFromDataTransfer(e.dataTransfer);
      if (files.length === 0) return;
      onPasteFiles(files);
    },
    [attachEnabled, onPasteFiles]
  );

  const onDetailPasteCapture = useCallback(
    (e: ClipboardEvent<HTMLDivElement>) => {
      if (!attachEnabled || !onPasteFiles) return;
      const files = filesFromDataTransfer(e.clipboardData);
      if (files.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      onPasteFiles(files);
    },
    [attachEnabled, onPasteFiles]
  );

  useEffect(() => {
    setFileDragOver(false);
  }, [card.id]);

  const toggleDetailLayout = useCallback(() => {
    setLayoutStack((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(
          CARD_DETAIL_LAYOUT_KEY,
          next ? "stack" : "split"
        );
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const media = (card.media ?? []).filter((m) => m.url?.trim());
  const hasGallery = media.length > 0 || uploadBusy;

  const panel = (
    <div className="card-detail-overlay" onMouseDown={onClose}>
      <div
        className={
          "card-detail-wrap card-detail-wrap--square" +
          (hasGallery && layoutStack ? " card-detail-wrap--layout-stack" : "")
        }
        onMouseDown={(e) => e.stopPropagation()}
        onDragOver={onDetailDragOver}
        onDragEnter={onDetailDragEnter}
        onDragLeave={onDetailDragLeave}
        onDrop={onDetailDrop}
        onPasteCapture={onDetailPasteCapture}
      >
        <div
          className={
            "card card--detail-modal" +
            (hasGallery ? " card--detail-modal--has-gallery" : "") +
            (hasGallery && layoutStack
              ? " card--detail-modal--layout-stack"
              : "") +
            (menuOpen ? " is-menu-open" : "") +
            (fileDragOver && attachEnabled ? " card--file-drag-over" : "")
          }
        >
          <div
            className={
              "card__inner" + (hasGallery ? " card__inner--split" : "")
            }
          >
            <div
              className={
                "card__paper" +
                (hasGallery ? " card__paper--with-gallery" : "")
              }
            >
              <div className="card__toolbar">
                <span className="card__time">
                  {formatCardTimeLabel(card)}
                  {reminderBesideTime ? (
                    <span className="card__time-reminder">
                      {reminderBesideTime}
                    </span>
                  ) : null}
                </span>
                <div className="card__toolbar-actions">
                  {hasGallery ? (
                    <button
                      type="button"
                      className="card__detail-layout-toggle"
                      aria-pressed={layoutStack}
                      aria-label={
                        layoutStack
                          ? "切换为左右分栏"
                          : "切换为上下分栏（附件在上，正文在下可滚动）"
                      }
                      title={
                        layoutStack
                          ? "切换为左右分栏"
                          : "切换为上下分栏（附件在上，正文在下可滚动）"
                      }
                      onClick={toggleDetailLayout}
                    >
                      {layoutStack ? (
                        <IconDetailLayoutSplit />
                      ) : (
                        <IconDetailLayoutStack />
                      )}
                    </button>
                  ) : null}
                  <div
                    className="card__menu-root"
                    data-card-menu-root={menuId}
                  >
                    <button
                      type="button"
                      className="card__more"
                      aria-label="更多操作"
                      aria-expanded={menuOpen}
                      onClick={() =>
                        setCardMenuId(
                          cardMenuId === menuId ? null : menuId
                        )
                      }
                    >
                      …
                    </button>
                    {menuOpen ? (
                      <div
                        className="card__menu"
                        role="menu"
                        aria-orientation="vertical"
                      >
                        <button
                          type="button"
                          className={
                            "card__menu-item" +
                            (relatedPanelOpen ? " is-active" : "")
                          }
                          role="menuitem"
                          onClick={() => {
                            onToggleRelatedPanel();
                            setCardMenuId(null);
                          }}
                        >
                          相关笔记
                        </button>
                        {canEdit && canAttachMedia ? (
                          <button
                            type="button"
                            className="card__menu-item"
                            role="menuitem"
                            disabled={uploadBusy}
                            onClick={() => onBeginMediaUpload()}
                          >
                            {uploadBusy ? "上传中…" : "添加附件"}
                          </button>
                        ) : null}
                        {canEdit && hasGallery ? (
                          <button
                            type="button"
                            className="card__menu-item"
                            role="menuitem"
                            onClick={() => onClearMedia()}
                          >
                            清空附件
                          </button>
                        ) : null}
                        {canEdit && onOpenReminderPicker ? (
                          <button
                            type="button"
                            className="card__menu-item"
                            role="menuitem"
                            onClick={() => {
                              onOpenReminderPicker();
                              setCardMenuId(null);
                            }}
                          >
                            提醒…
                          </button>
                        ) : null}
                        {canEdit ? (
                          <button
                            type="button"
                            className="card__menu-item"
                            role="menuitem"
                            onClick={() => {
                              onTogglePin();
                              setCardMenuId(null);
                            }}
                          >
                            {card.pinned ? "取消置顶" : "置顶"}
                          </button>
                        ) : null}
                        {canEdit ? (
                          <button
                            type="button"
                            className="card__menu-item card__menu-item--danger"
                            role="menuitem"
                            onClick={() => onDelete()}
                          >
                            删除
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <NoteCardTiptap
                id={`card-detail-${card.id}`}
                value={card.text}
                canEdit={canEdit}
                onChange={onChangeText}
                ariaLabel="笔记正文"
                onPasteFiles={onPasteFiles}
                highlightBubble
              />
              <CardTagsRow
                colId={colId}
                card={card}
                canEdit={canEdit}
                onCommit={onTagsCommit}
              />
            </div>
            {hasGallery ? (
              <CardGallery
                items={media}
                playback="inlineAv"
                onRemoveItem={onRemoveGalleryItem}
                onSetCoverItem={onSetGalleryCoverItem}
                uploadPending={uploadBusy}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
