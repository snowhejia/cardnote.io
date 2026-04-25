import type { NoteMediaKind } from "./types";

/**
 * 历史命名(本来用于 Tauri 桌面壳本地文件存储);Tauri 已移除,
 * 文件保留是因为 LOCAL_MEDIA_PREFIX / isLocalMediaRef / inferMediaKindFromFile
 * 仍被多处引用。Tauri 专属函数现在退化为 no-op / 默认返回。
 */

/** 写入 JSON 的标记;真实文件曾在 Tauri AppLocalData 下,Tauri 移除后旧链接读到会显示空 */
export const LOCAL_MEDIA_PREFIX = "local-media:";

export function isLocalMediaRef(url: string): boolean {
  return url.startsWith(LOCAL_MEDIA_PREFIX);
}

/** 已不再支持本地文件夹保存(Tauri 移除) */
export function canSaveMediaToAppFolder(): boolean {
  return false;
}

export function inferMediaKindFromFile(file: File): NoteMediaKind {
  const t = file.type || "";
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (/^(png|jpe?g|gif|webp|svg|bmp|ico)$/.test(ext)) return "image";
  if (/^(mp4|webm|mov|m4v|mkv)$/.test(ext)) return "video";
  if (/^(mp3|m4a|wav|aac|flac|ogg)$/.test(ext)) return "audio";
  return "file";
}

export async function saveLocalMediaToAppFolder(_file: File): Promise<{
  url: string;
  kind: NoteMediaKind;
  name?: string;
  sizeBytes: number;
}> {
  throw new Error("本地小文件夹存储已移除(Tauri 桌面端不再支持)");
}

export async function deleteLocalMediaFile(_storedUrl: string): Promise<void> {
  /* no-op: Tauri 移除后无法访问本地文件;旧 local-media:* 链接对应的文件已无法清理 */
}

export async function resolveLocalMediaDisplayUrl(
  storedUrl: string
): Promise<string> {
  if (!isLocalMediaRef(storedUrl)) return storedUrl;
  // Tauri 移除后无法解析本地文件路径,旧链接显示为空
  return "";
}
