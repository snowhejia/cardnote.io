import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { updateCardApi } from "../api/collections";
import type { AppDataMode } from "../appDataModeStorage";
import type { Collection } from "../types";
import { patchNoteCardByIdInTree } from "./collectionModel";

const TEXT_SAVE_DEBOUNCE_MS = 400;

/**
 * snippet 形态识别:服务端 extractSnippet 把 body 去标签 + 压成单行 +
 * slice(0,180) + 加 U+2026("…")。前端经 noteBodyToHtml 包成 <p>...</p>。
 * 任何看起来"像 snippet 被回写"的 PATCH 都拦下来,既挡住未标记的 stub,
 * 也挡住任何把 snippet 当 body 的写入路径。
 */
function looksLikeSnippetBody(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // U+2026 末尾(允许后面跟 </p> 等收尾标签)
  return /…\s*(<\/[a-z]+>\s*)*$/.test(t);
}

function shortLog(s: string, n = 80): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

/**
 * 远程模式下卡片正文防抖 PATCH；切页/隐藏时 flush。
 */
export function useCardTextRemoteAutosave(
  dataMode: AppDataMode,
  setCollections: Dispatch<SetStateAction<Collection[]>>
) {
  const textSaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const pendingCardTextById = useRef<Map<string, string>>(new Map());

  const flushPendingCardTextToRemote = useCallback(async () => {
    if (dataMode === "local") return;
    const timers = textSaveTimers.current;
    for (const h of timers.values()) clearTimeout(h);
    timers.clear();
    const pending = pendingCardTextById.current;
    const entries = [...pending.entries()];
    pending.clear();
    if (entries.length === 0) return;
    await Promise.all(
      entries.map(([cid, t]) => updateCardApi(cid, { text: t }))
    );
  }, [dataMode]);

  useEffect(() => {
    if (dataMode === "local") return;
    const onHidden = () => {
      if (document.visibilityState === "hidden") {
        void flushPendingCardTextToRemote();
      }
    };
    const onPageHide = () => {
      void flushPendingCardTextToRemote();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [dataMode, flushPendingCardTextToRemote]);

  const setCardText = useCallback(
    (_colId: string, cardId: string, text: string) => {
      /* 防御层:在写入前先看本地 card 状态,挡住两类危险 PATCH。
         - card.isStub:某个未标完整加载的占位卡(text 是 snippet 截断版),
           被 TipTap 回写就会把真实 body 覆盖成 snippet。
         - 长度收缩+末尾 U+2026:无视来源,只要新文本看起来像 extractSnippet
           的产物(以"…"结尾)且比旧文本短一半以上,直接拒。
         拦下时 console.warn 留诊断,方便下次复现锁定调用路径。 */
      let isStub = false;
      let prevText = "";
      setCollections((prev) =>
        patchNoteCardByIdInTree(prev, cardId, (card) => {
          if (card.isStub) {
            isStub = true;
            return card;
          }
          prevText = card.text ?? "";
          return { ...card, text };
        })
      );

      if (isStub) {
        // eslint-disable-next-line no-console
        console.warn(
          `[cardText] refused PATCH to stub card ${cardId} (incoming text: "${shortLog(text)}")`
        );
        return;
      }

      const isSnippetShape = looksLikeSnippetBody(text);
      const shrankByHalf =
        prevText.length > 0 && text.length < prevText.length * 0.5;
      if (isSnippetShape && shrankByHalf) {
        // eslint-disable-next-line no-console
        console.warn(
          `[cardText] refused suspicious snippet-shaped shrink for ${cardId}: ` +
            `prev ${prevText.length}c → new ${text.length}c — ` +
            `prev: "${shortLog(prevText)}" — new: "${shortLog(text)}"`
        );
        return;
      }

      if (dataMode !== "local") {
        pendingCardTextById.current.set(cardId, text);
        const existing = textSaveTimers.current.get(cardId);
        if (existing) clearTimeout(existing);
        textSaveTimers.current.set(
          cardId,
          setTimeout(() => {
            const latest = pendingCardTextById.current.get(cardId);
            if (latest !== undefined) {
              void updateCardApi(cardId, { text: latest });
              pendingCardTextById.current.delete(cardId);
            }
            textSaveTimers.current.delete(cardId);
          }, TEXT_SAVE_DEBOUNCE_MS)
        );
      }
    },
    [dataMode, setCollections]
  );

  return { setCardText, flushPendingCardTextToRemote };
}
