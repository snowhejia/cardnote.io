const KEY = "mikujar.attachmentsPreviewLayout";

export type AttachmentsPreviewLayout = "contain" | "square";

export function readAttachmentsPreviewLayout(): AttachmentsPreviewLayout {
  try {
    if (typeof localStorage === "undefined") return "contain";
    if (localStorage.getItem(KEY)?.trim() === "square") return "square";
  } catch {
    /* ignore */
  }
  return "contain";
}

export function writeAttachmentsPreviewLayout(
  v: AttachmentsPreviewLayout
): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(KEY, v);
  } catch {
    /* ignore */
  }
}
