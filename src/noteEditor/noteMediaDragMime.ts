/** 从笔记详情附件栏拖到正文时使用的 DataTransfer MIME（JSON） */
export const NOTE_MEDIA_ITEM_DRAG_MIME =
  "application/x-mikujar-note-media-item+json";

export type NoteMediaDragPayload = {
  url: string;
  kind: "image" | "video" | "audio" | "file";
  name?: string;
};

export function parseNoteMediaDragPayload(
  dt: DataTransfer | null
): NoteMediaDragPayload | null {
  if (!dt) return null;
  try {
    const raw = dt.getData(NOTE_MEDIA_ITEM_DRAG_MIME);
    if (!raw?.trim()) return null;
    const o = JSON.parse(raw) as Partial<NoteMediaDragPayload>;
    if (typeof o.url !== "string" || !o.url.trim()) return null;
    const k = o.kind;
    if (k !== "image" && k !== "video" && k !== "audio" && k !== "file") {
      return null;
    }
    return {
      url: o.url.trim(),
      kind: k,
      name: typeof o.name === "string" ? o.name : undefined,
    };
  } catch {
    return null;
  }
}

export function hasNoteMediaDragPayload(dt: DataTransfer | null): boolean {
  if (!dt?.types?.length) return false;
  return Array.from(dt.types).includes(NOTE_MEDIA_ITEM_DRAG_MIME);
}
