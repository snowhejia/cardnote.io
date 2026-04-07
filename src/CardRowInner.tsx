import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const MOBILE_MQ = "(max-width: 900px)";

/** 与 .card 横格 --note-line-height 一致 */
const NOTE_LINE_PX = 30;
/** 正文 ProseMirror min-height 为 3 行；超过约第 4 行起视为长笔记 */
const SHORT_BODY_MAX_SCROLL_PX =
  3 * NOTE_LINE_PX + NOTE_LINE_PX * 0.92;
/**
 * 是否上下叠放图库依赖 ProseMirror scrollHeight，而 scrollHeight 会随左右/上下布局变化（窄栏更高、宽栏更矮），
 * 单阈值会在边界附近来回切换造成闪屏。用双阈值滞回避免振荡。
 */
const STACK_GALLERY_UPPER_PX = SHORT_BODY_MAX_SCROLL_PX + 10;
const STACK_GALLERY_LOWER_PX = 2.5 * NOTE_LINE_PX;

type CardRowInnerProps = {
  hasGallery: boolean;
  /** 正文变化时重新测量（Tiptap 高度变化由 ResizeObserver 覆盖） */
  textRev: string;
  className: string;
  children: ReactNode;
};

/**
 * 时间线/垃圾桶卡片内层：有附件时小屏默认仍左右分栏；正文变长后改为上下布局。
 */
export function CardRowInner({
  hasGallery,
  textRev,
  className,
  children,
}: CardRowInnerProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [stackGallery, setStackGallery] = useState(false);

  useEffect(() => {
    if (!hasGallery) {
      setStackGallery(false);
      return;
    }
    const root = innerRef.current;
    if (!root) return;

    const mq = window.matchMedia(MOBILE_MQ);

    const measure = () => {
      if (!mq.matches) {
        setStackGallery(false);
        return;
      }
      const pm = root.querySelector(
        ".ProseMirror"
      ) as HTMLElement | null;
      if (!pm) {
        setStackGallery(false);
        return;
      }
      const h = pm.scrollHeight;
      setStackGallery((prev) => {
        if (!prev && h > STACK_GALLERY_UPPER_PX) return true;
        if (prev && h < STACK_GALLERY_LOWER_PX) return false;
        return prev;
      });
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(root);
    const pm0 = root.querySelector(
      ".ProseMirror"
    ) as HTMLElement | null;
    if (pm0) ro.observe(pm0);

    mq.addEventListener("change", measure);
    window.addEventListener("resize", measure);

    return () => {
      ro.disconnect();
      mq.removeEventListener("change", measure);
      window.removeEventListener("resize", measure);
    };
  }, [hasGallery, textRev]);

  const cls =
    className +
    (hasGallery && stackGallery
      ? " card__inner--mobile-gallery-stack"
      : "");

  return (
    <div ref={innerRef} className={cls}>
      {children}
    </div>
  );
}
