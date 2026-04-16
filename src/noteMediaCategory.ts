import type { NoteMediaItem } from "./types";

/** 与「所有附件」筛选一致：图片 / 视频 / 音频 / 文档 / 其他 */
export type AttachmentUiCategory =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "other";

/** 与顶栏筛选、列表过滤一致 */
export type AttachmentFilterKey = "all" | AttachmentUiCategory;

export const ATTACHMENT_FILTER_KEYS: AttachmentFilterKey[] = [
  "all",
  "image",
  "video",
  "audio",
  "document",
  "other",
];

const DOC_NAME_RE =
  /\.(pdf|docx?|xlsx?|pptx?|txt|md|csv|rtf|pages|numbers|key|epub|json|xml|yml|yaml)$/i;

function pathTailLower(url: string): string {
  try {
    const path = url.split("?")[0].split("#")[0];
    const seg = path.split("/").filter(Boolean).pop() ?? "";
    return seg.toLowerCase();
  } catch {
    return "";
  }
}

/** 文档类附件（扩展名判断，与 kind=file 组合使用） */
export function isDocumentLikeAttachment(item: NoteMediaItem): boolean {
  if (item.kind !== "file") return false;
  const name = (item.name ?? "").trim().toLowerCase();
  if (name && DOC_NAME_RE.test(name)) return true;
  return DOC_NAME_RE.test(pathTailLower(item.url));
}

export function getAttachmentUiCategory(item: NoteMediaItem): AttachmentUiCategory {
  if (item.kind === "image") return "image";
  if (item.kind === "video") return "video";
  if (item.kind === "audio") return "audio";
  if (item.kind === "file") {
    return isDocumentLikeAttachment(item) ? "document" : "other";
  }
  return "other";
}
