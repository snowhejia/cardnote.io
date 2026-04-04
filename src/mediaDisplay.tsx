import { useEffect, useState, type ReactNode } from "react";
import { resolveMediaUrl } from "./api/auth";
import {
  isLocalMediaRef,
  resolveLocalMediaDisplayUrl,
} from "./localMediaTauri";
export function useMediaDisplaySrc(url: string | undefined): string {
  const [src, setSrc] = useState(() => {
    if (!url) return "";
    if (!isLocalMediaRef(url)) return resolveMediaUrl(url);
    return "";
  });
  useEffect(() => {
    if (!url) {
      setSrc("");
      return;
    }
    if (!isLocalMediaRef(url)) {
      setSrc(resolveMediaUrl(url));
      return;
    }
    let c = false;
    void resolveLocalMediaDisplayUrl(url).then((s) => {
      if (!c) setSrc(s);
    });
    return () => {
      c = true;
    };
  }, [url]);
  return src;
}

export function MediaThumbImage({
  url,
  className,
  alt = "",
}: {
  url: string;
  className?: string;
  alt?: string;
}) {
  const src = useMediaDisplaySrc(url);
  if (!src) {
    return <span className={className} aria-hidden />;
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
    />
  );
}

export function MediaThumbVideo({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  const src = useMediaDisplaySrc(url);
  if (!src) {
    return <span className={className} aria-hidden />;
  }
  return (
    <video
      className={className}
      src={src}
      muted
      playsInline
      preload="metadata"
      tabIndex={-1}
      aria-hidden
    />
  );
}

export function MediaLightboxImage({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  const src = useMediaDisplaySrc(url);
  if (!src) return null;
  return <img src={src} alt="" className={className} />;
}

export function MediaLightboxVideo({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  const src = useMediaDisplaySrc(url);
  if (!src) return null;
  return (
    <video
      key={src}
      src={src}
      className={className}
      controls
      playsInline
      autoPlay
    />
  );
}

export function MediaLightboxAudio({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  const src = useMediaDisplaySrc(url);
  if (!src) return null;
  return (
    <audio key={src} src={src} controls autoPlay className={className} />
  );
}

export function MediaLightboxCover({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  const src = useMediaDisplaySrc(url);
  if (!src) return null;
  return <img src={src} alt="" className={className} />;
}

export function MediaOpenLink({
  url,
  className,
  children,
}: {
  url: string;
  className?: string;
  children: ReactNode;
}) {
  const href = useMediaDisplaySrc(url);
  if (!href) {
    return (
      <span className={className} aria-disabled>
        {children}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}
