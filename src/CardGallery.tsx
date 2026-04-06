import {
  useEffect,
  useState,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import type { NoteMediaItem, NoteMediaKind } from "./types";
import { LOCAL_MEDIA_PREFIX } from "./localMediaTauri";
import {
  MediaLightboxAudio,
  MediaLightboxCover,
  MediaLightboxImage,
  MediaLightboxVideo,
  MediaOpenLink,
  MediaThumbImage,
  MediaThumbLoadingOverlay,
  MediaThumbVideo,
  useMediaDisplaySrc,
} from "./mediaDisplay";

function fileLabelFromUrl(url: string): string {
  if (url.startsWith(LOCAL_MEDIA_PREFIX)) {
    const seg =
      url.slice(LOCAL_MEDIA_PREFIX.length).split("/").pop() ?? "";
    const i = seg.indexOf("_");
    if (i >= 0 && i < seg.length - 1) {
      return decodeURIComponent(seg.slice(i + 1).replace(/\+/g, " "));
    }
    return seg || "文件";
  }
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (!last) return "文件";
    return decodeURIComponent(last.replace(/\+/g, " "));
  } catch {
    return "文件";
  }
}

function FileDocIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="14" y2="17" />
    </svg>
  );
}

function AudioGlyphIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function GalleryInlineVideo({ url }: { url: string }) {
  const src = useMediaDisplaySrc(url);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
  }, [src]);

  const showLoading = !src || !ready;

  return (
    <div
      className="card__gallery-thumb-wrap"
      aria-busy={showLoading || undefined}
    >
      {showLoading ? <MediaThumbLoadingOverlay /> : null}
      {src ? (
        <video
          className={[
            "card__gallery-thumb",
            "card__gallery-thumb--video",
            ready ? "card__gallery-thumb--ready" : "card__gallery-thumb--pending",
          ].join(" ")}
          src={src}
          controls
          playsInline
          preload="auto"
          onLoadedData={() => setReady(true)}
          onCanPlay={() => setReady(true)}
          onError={() => setReady(true)}
        />
      ) : null}
    </div>
  );
}

function GalleryInlineAudioBar({ url }: { url: string }) {
  const src = useMediaDisplaySrc(url);
  if (!src) return null;
  return <audio src={src} controls className="card__gallery-inline-audio" />;
}

type LightboxState = {
  url: string;
  kind: NoteMediaKind;
  name?: string;
  coverUrl?: string;
};

export type CardGalleryPlayback = "default" | "inlineAv";

/** 卡片右侧媒体轮播；inlineAv 时音视频在区内直接 controls，点图/文件仍开 lightbox */
export function CardGallery({
  items,
  onRemoveItem,
  playback = "default",
}: {
  items: NoteMediaItem[];
  onRemoveItem?: (item: NoteMediaItem) => void;
  playback?: CardGalleryPlayback;
}) {
  const [i, setI] = useState(0);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [attachMenu, setAttachMenu] = useState<{
    x: number;
    y: number;
    item: NoteMediaItem;
  } | null>(null);
  const n = items.length;
  const inlineAv = playback === "inlineAv";

  const itemsKey = items
    .map(
      (x) =>
        `${x.kind}:${x.url}:${x.name ?? ""}:${x.coverUrl ?? ""}`
    )
    .join("|");
  useEffect(() => {
    setI((prev) => {
      if (n === 0) return 0;
      return Math.min(prev, n - 1);
    });
  }, [n, itemsKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (attachMenu) {
        e.preventDefault();
        setAttachMenu(null);
        return;
      }
      if (lightbox) setLightbox(null);
    };
    if (!attachMenu && !lightbox) return;
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [attachMenu, lightbox]);

  useEffect(() => {
    if (!attachMenu) return;
    const onDown = (e: PointerEvent) => {
      const el = document.querySelector("[data-attachment-ctx-menu]");
      if (el?.contains(e.target as Node)) return;
      setAttachMenu(null);
    };
    const t = window.setTimeout(() => {
      document.addEventListener("pointerdown", onDown, true);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [attachMenu]);

  useEffect(() => {
    if (!lightbox) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lightbox]);

  if (n === 0) return null;

  const safeI = ((i % n) + n) % n;
  const current = items[safeI];
  const go = (delta: number) => {
    setI((x) => (x + delta + n * 100) % n);
  };

  const openCurrentLightbox = () => {
    setLightbox({
      url: current.url,
      kind: current.kind,
      name: current.name ?? fileLabelFromUrl(current.url),
      ...(current.kind === "audio" && current.coverUrl
        ? { coverUrl: current.coverUrl }
        : {}),
    });
  };

  const openAttachmentMenu = (
    e: MouseEvent<HTMLElement>,
    item: NoteMediaItem
  ) => {
    if (!onRemoveItem) return;
    e.preventDefault();
    e.stopPropagation();
    setAttachMenu({ x: e.clientX, y: e.clientY, item });
  };

  const lightboxAsItem = (): NoteMediaItem | null => {
    if (!lightbox) return null;
    if (lightbox.kind === "file") {
      return {
        kind: "file",
        url: lightbox.url,
        name: lightbox.name ?? fileLabelFromUrl(lightbox.url),
      };
    }
    if (lightbox.kind === "audio") {
      const name = lightbox.name ?? fileLabelFromUrl(lightbox.url);
      return {
        kind: "audio",
        url: lightbox.url,
        name,
        ...(lightbox.coverUrl ? { coverUrl: lightbox.coverUrl } : {}),
      };
    }
    if (lightbox.kind === "image" || lightbox.kind === "video") {
      const name = lightbox.name ?? fileLabelFromUrl(lightbox.url);
      return { kind: lightbox.kind, url: lightbox.url, name };
    }
    return { kind: lightbox.kind, url: lightbox.url };
  };

  const lightboxPortal =
    lightbox &&
    createPortal(
      <div
        className="image-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label="预览"
        onClick={() => setLightbox(null)}
      >
        <button
          type="button"
          className="image-lightbox__close"
          aria-label="关闭"
          onClick={(e) => {
            e.stopPropagation();
            setLightbox(null);
          }}
        >
          ×
        </button>
        {lightbox.kind === "image" ? (
          <div
            className="image-lightbox__media-stack"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              const it = lightboxAsItem();
              if (it) openAttachmentMenu(e, it);
            }}
          >
            <MediaLightboxImage
              url={lightbox.url}
              className="image-lightbox__img"
            />
            <p className="image-lightbox__media-caption">
              {lightbox.name ?? fileLabelFromUrl(lightbox.url)}
            </p>
          </div>
        ) : lightbox.kind === "video" ? (
          <div
            className="image-lightbox__media-stack"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              const it = lightboxAsItem();
              if (it) openAttachmentMenu(e, it);
            }}
          >
            <MediaLightboxVideo
              url={lightbox.url}
              className="image-lightbox__img image-lightbox__video"
            />
            <p className="image-lightbox__media-caption">
              {lightbox.name ?? fileLabelFromUrl(lightbox.url)}
            </p>
          </div>
        ) : lightbox.kind === "audio" ? (
          <div
            className="image-lightbox__audio-wrap"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              const it = lightboxAsItem();
              if (it) openAttachmentMenu(e, it);
            }}
          >
            {lightbox.coverUrl ? (
              <MediaLightboxCover
                url={lightbox.coverUrl}
                className="image-lightbox__audio-cover"
              />
            ) : null}
            <p className="image-lightbox__audio-title">
              {lightbox.name ?? fileLabelFromUrl(lightbox.url)}
            </p>
            <MediaLightboxAudio
              url={lightbox.url}
              className="image-lightbox__audio"
            />
          </div>
        ) : (
          <div
            className="image-lightbox__file"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              const it = lightboxAsItem();
              if (it) openAttachmentMenu(e, it);
            }}
          >
            <FileDocIcon className="image-lightbox__file-icon" />
            <p className="image-lightbox__file-name">
              {lightbox.name ?? fileLabelFromUrl(lightbox.url)}
            </p>
            <MediaOpenLink
              url={lightbox.url}
              className="image-lightbox__file-link"
            >
              在新窗口打开
            </MediaOpenLink>
          </div>
        )}
      </div>,
      document.body
    );

  const attachMenuPortal =
    attachMenu &&
    onRemoveItem &&
    createPortal(
      <div
        data-attachment-ctx-menu
        className="attachment-ctx-menu"
        style={{
          position: "fixed",
          left: Math.min(
            attachMenu.x,
            typeof window !== "undefined"
              ? window.innerWidth - 148
              : attachMenu.x
          ),
          top: attachMenu.y,
          zIndex: 10001,
        }}
        role="menu"
      >
        <button
          type="button"
          className="attachment-ctx-menu__item"
          role="menuitem"
          onClick={() => {
            onRemoveItem(attachMenu.item);
            setAttachMenu(null);
            setLightbox(null);
          }}
        >
          删除附件
        </button>
      </div>,
      document.body
    );

  const showPlayBadge =
    !inlineAv &&
    (current.kind === "audio" || current.kind === "video");

  const thumbInteractive = (() => {
    if (inlineAv && (current.kind === "video" || current.kind === "audio")) {
      return (
        <div
          className={
            "card__gallery-thumb-hit card__gallery-thumb-hit--inline-av" +
            (current.kind === "audio"
              ? " card__gallery-thumb-hit--audio-inline"
              : "")
          }
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {current.kind === "video" ? (
            <GalleryInlineVideo url={current.url} />
          ) : (
            <>
              <div className="card__gallery-audio-thumb card__gallery-audio-thumb--inline">
                {current.coverUrl ? (
                  <>
                    <MediaThumbImage
                      url={current.coverUrl}
                      className="card__gallery-audio-cover"
                      alt=""
                    />
                    <div className="card__gallery-audio-cover-caption">
                      <span className="card__gallery-audio-name card__gallery-audio-name--on-cover">
                        {current.name ?? fileLabelFromUrl(current.url)}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <AudioGlyphIcon className="card__gallery-audio-icon" />
                    <span className="card__gallery-audio-name">
                      {current.name ?? fileLabelFromUrl(current.url)}
                    </span>
                  </>
                )}
              </div>
              <GalleryInlineAudioBar url={current.url} />
            </>
          )}
        </div>
      );
    }

    return (
      <div
        role="button"
        tabIndex={0}
        className={
          "card__gallery-thumb-hit" +
          (current.kind === "file"
            ? " card__gallery-thumb-hit--file"
            : current.kind === "audio"
              ? " card__gallery-thumb-hit--audio"
              : "")
        }
        title={
          onRemoveItem
            ? current.kind === "file"
              ? "点击查看，右键可删除"
              : current.kind === "audio"
                ? "点击放大播放音频，右键可删除"
                : "点击放大，右键可删除"
            : current.kind === "file"
              ? "点击查看"
              : current.kind === "audio"
                ? "点击放大播放音频"
                : "点击放大"
        }
        aria-label={
          current.kind === "video"
            ? "点击放大播放视频"
            : current.kind === "image"
              ? "点击放大查看图片"
              : current.kind === "audio"
                ? "点击放大播放音频"
                : "查看文件"
        }
        onClick={(e) => {
          e.stopPropagation();
          openCurrentLightbox();
        }}
        onContextMenu={(e) => {
          if (onRemoveItem) openAttachmentMenu(e, current);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            openCurrentLightbox();
          }
        }}
      >
        {current.kind === "image" ? (
          <MediaThumbImage
            url={current.url}
            className="card__gallery-thumb"
            alt=""
          />
        ) : current.kind === "audio" ? (
          <>
            <div className="card__gallery-audio-thumb">
              {current.coverUrl ? (
                <>
                  <MediaThumbImage
                    url={current.coverUrl}
                    className="card__gallery-audio-cover"
                    alt=""
                  />
                  <div className="card__gallery-audio-cover-caption">
                    <span className="card__gallery-audio-name card__gallery-audio-name--on-cover">
                      {current.name ?? fileLabelFromUrl(current.url)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <AudioGlyphIcon className="card__gallery-audio-icon" />
                  <span className="card__gallery-audio-name">
                    {current.name ?? fileLabelFromUrl(current.url)}
                  </span>
                </>
              )}
            </div>
            {showPlayBadge ? (
              <span className="card__gallery-play-badge" aria-hidden>
                ▶
              </span>
            ) : null}
          </>
        ) : current.kind === "video" ? (
          <MediaThumbVideo
            url={current.url}
            className="card__gallery-thumb card__gallery-thumb--video"
            playBadge={showPlayBadge}
          />
        ) : (
          <div className="card__gallery-file">
            <FileDocIcon className="card__gallery-file-icon" />
            <span className="card__gallery-file-name">
              {current.name ?? fileLabelFromUrl(current.url)}
            </span>
          </div>
        )}
      </div>
    );
  })();

  return (
    <div className="card__gallery">
      {lightboxPortal}
      {attachMenuPortal}
      <div className="card__gallery-viewport">
        {thumbInteractive}
        {n > 1 ? (
          <span className="card__gallery-count">
            {safeI + 1}/{n}
          </span>
        ) : null}
        {n > 1 ? (
          <>
            <button
              type="button"
              className="card__gallery-arrow card__gallery-arrow--prev"
              aria-label="上一项"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
            />
            <button
              type="button"
              className="card__gallery-arrow card__gallery-arrow--next"
              aria-label="下一项"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
            />
          </>
        ) : null}
        {n > 1 ? (
          <div
            className="card__gallery-dots"
            role="tablist"
            aria-label="分页"
          >
            {items.map((_, idx) => (
              <button
                key={idx}
                type="button"
                role="tab"
                aria-selected={idx === safeI}
                className={
                  "card__gallery-dot" +
                  (idx === safeI ? " is-active" : "")
                }
                onClick={(e) => {
                  e.stopPropagation();
                  setI(idx);
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
