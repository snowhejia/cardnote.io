import { useEffect, useMemo, useRef, useState } from "react";
import {
  mightHaveApiSession,
  needsCosReadUrl,
  resolveCosMediaUrlIfNeeded,
  resolveMediaUrl,
} from "../api/auth";
import { useAppChrome } from "../i18n/useAppChrome";
import { useMediaDisplaySrc } from "../mediaDisplay";
import {
  type AttachmentFilterKey,
  getAttachmentUiCategory,
} from "../noteMediaCategory";
import { formatByteSize } from "../noteStats";
import type { NoteMediaItem } from "../types";
import type { MediaAttachmentListEntry } from "./collectionModel";

/** 每页条数（与主时间线批次 40 对齐） */
const ATTACHMENTS_PAGE_SIZE = 40;

function attachmentDisplayName(item: NoteMediaItem): string {
  const n = item.name?.trim();
  if (n) return n;
  try {
    const u = new URL(item.url, "https://local.invalid");
    const seg = u.pathname.split("/").filter(Boolean).pop();
    if (seg) return decodeURIComponent(seg);
  } catch {
    /* ignore */
  }
  const tail = item.url.replace(/\s/g, "");
  return tail.length > 40 ? `…${tail.slice(-36)}` : tail || item.kind;
}

function formatDurationSec(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "";
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** 仅音/视频且成功读到 metadata 时展示；无时长则不占行 */
function AttachmentDurationIfAny({ item }: { item: NoteMediaItem }) {
  type Phase = "loading" | "hidden" | "ok";
  const [phase, setPhase] = useState<Phase>("loading");
  const [text, setText] = useState("");

  useEffect(() => {
    if (item.kind !== "video" && item.kind !== "audio") {
      setPhase("hidden");
      return;
    }
    let cancelled = false;
    const run = async () => {
      const raw = resolveMediaUrl(item.url);
      let src = raw;
      try {
        if (needsCosReadUrl(raw) && mightHaveApiSession()) {
          src = await resolveCosMediaUrlIfNeeded(raw);
        } else if (needsCosReadUrl(raw)) {
          if (!cancelled) setPhase("hidden");
          return;
        }
      } catch {
        if (!cancelled) setPhase("hidden");
        return;
      }
      if (cancelled || !src) {
        if (!cancelled) setPhase("hidden");
        return;
      }
      const el = document.createElement(
        item.kind === "video" ? "video" : "audio"
      );
      el.preload = "metadata";
      el.muted = true;
      el.src = src;
      const cleanup = () => {
        el.removeAttribute("src");
        el.load();
      };
      const onMeta = () => {
        if (cancelled) return;
        const d = el.duration;
        cleanup();
        const formatted = Number.isFinite(d) ? formatDurationSec(d) : "";
        if (!formatted) {
          setPhase("hidden");
        } else {
          setText(formatted);
          setPhase("ok");
        }
      };
      const onErr = () => {
        if (cancelled) return;
        cleanup();
        setPhase("hidden");
      };
      el.addEventListener("loadedmetadata", onMeta, { once: true });
      el.addEventListener("error", onErr, { once: true });
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [item.kind, item.url]);

  if (item.kind !== "video" && item.kind !== "audio") return null;
  if (phase !== "ok" || !text) return null;
  return (
    <span className="all-attachments-page__meta-line all-attachments-page__meta-line--duration">
      {text}
    </span>
  );
}

function ContainedMediaImg({ url }: { url: string }) {
  const src = useMediaDisplaySrc(url);
  if (!src) {
    return (
      <span className="all-attachments-page__preview-ph" aria-hidden>
        …
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="all-attachments-page__preview-img"
      loading="lazy"
      decoding="async"
    />
  );
}

function ContainedVideoPeek({ url }: { url: string }) {
  const src = useMediaDisplaySrc(url);
  if (!src) {
    return (
      <span className="all-attachments-page__preview-ph" aria-hidden>
        …
      </span>
    );
  }
  return (
    <video
      className="all-attachments-page__preview-video"
      src={src}
      muted
      playsInline
      preload="metadata"
      aria-hidden
    />
  );
}

function AttachmentPreview({ item }: { item: NoteMediaItem }) {
  const thumb = item.thumbnailUrl?.trim();
  const cover = item.coverUrl?.trim();

  if (item.kind === "image") {
    const u = thumb || item.url;
    return <ContainedMediaImg url={u} />;
  }
  if (item.kind === "video") {
    if (thumb) return <ContainedMediaImg url={thumb} />;
    return <ContainedVideoPeek url={item.url} />;
  }
  if (item.kind === "audio") {
    if (cover) return <ContainedMediaImg url={cover} />;
    return (
      <span
        className="all-attachments-page__preview-ph all-attachments-page__preview-ph--audio"
        aria-hidden
      >
        ♪
      </span>
    );
  }
  if (thumb) return <ContainedMediaImg url={thumb} />;
  return (
    <span
      className="all-attachments-page__preview-ph all-attachments-page__preview-ph--file"
      aria-hidden
    >
      FILE
    </span>
  );
}

export function AllAttachmentsView({
  entries,
  filterKey,
  onOpenCard,
}: {
  entries: MediaAttachmentListEntry[];
  filterKey: AttachmentFilterKey;
  onOpenCard: (colId: string, cardId: string) => void;
}) {
  const c = useAppChrome();
  const pageRootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (filterKey === "all") return entries;
    return entries.filter(
      (e) => getAttachmentUiCategory(e.item) === filterKey
    );
  }, [entries, filterKey]);

  const filteredTotal = filtered.length;
  const totalPages = Math.max(
    1,
    Math.ceil(filteredTotal / ATTACHMENTS_PAGE_SIZE)
  );

  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setPageIndex(0);
  }, [filterKey]);

  useEffect(() => {
    if (filteredTotal === 0) {
      setPageIndex(0);
      return;
    }
    const last = Math.ceil(filteredTotal / ATTACHMENTS_PAGE_SIZE) - 1;
    setPageIndex((p) => Math.min(p, last));
  }, [filteredTotal]);

  useEffect(() => {
    const tl = pageRootRef.current?.closest(".timeline");
    if (tl instanceof HTMLElement) {
      tl.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [pageIndex, filterKey]);

  const start = pageIndex * ATTACHMENTS_PAGE_SIZE;
  const pageSlice = useMemo(
    () => filtered.slice(start, start + ATTACHMENTS_PAGE_SIZE),
    [filtered, start]
  );

  const pageDisplay = pageIndex + 1;
  const canPrev = pageIndex > 0;
  const canNext = pageIndex < totalPages - 1;

  if (entries.length === 0) {
    return (
      <div className="timeline__empty all-attachments-page__empty">
        {c.allAttachmentsEmpty}
      </div>
    );
  }

  return (
    <div className="all-attachments-page" ref={pageRootRef}>
      {filtered.length === 0 ? (
        <div className="timeline__empty all-attachments-page__empty">
          {c.allAttachmentsEmptyFiltered}
        </div>
      ) : (
        <>
          <ul className="all-attachments-page__grid" role="list">
            {pageSlice.map((ent) => {
              const name = attachmentDisplayName(ent.item);
              const sizeLine =
                typeof ent.item.sizeBytes === "number" &&
                ent.item.sizeBytes >= 0
                  ? formatByteSize(ent.item.sizeBytes)
                  : c.allAttachmentsMetaDash;
              return (
                <li key={`${ent.col.id}-${ent.card.id}-${ent.mediaIndex}`}>
                  <button
                    type="button"
                    className="all-attachments-page__cell"
                    onClick={() => onOpenCard(ent.col.id, ent.card.id)}
                  >
                    <div className="all-attachments-page__preview-box">
                      <AttachmentPreview item={ent.item} />
                    </div>
                    <div className="all-attachments-page__info">
                      <span className="all-attachments-page__name" title={name}>
                        {name}
                      </span>
                      <span className="all-attachments-page__meta-line">
                        {sizeLine}
                      </span>
                      <AttachmentDurationIfAny item={ent.item} />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          {totalPages > 1 ? (
            <nav
              className="all-attachments-page__pagination"
              aria-label={c.allAttachmentsPaginationNavAria}
            >
              <button
                type="button"
                className="all-attachments-page__pagination-btn"
                disabled={!canPrev}
                aria-disabled={!canPrev}
                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              >
                {c.allAttachmentsPaginationPrev}
              </button>
              <span className="all-attachments-page__pagination-label">
                {c.allAttachmentsPaginationPageOf(pageDisplay, totalPages)}
              </span>
              <button
                type="button"
                className="all-attachments-page__pagination-btn"
                disabled={!canNext}
                aria-disabled={!canNext}
                onClick={() =>
                  setPageIndex((p) => Math.min(totalPages - 1, p + 1))
                }
              >
                {c.allAttachmentsPaginationNext}
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
