import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import type { NoteMediaKind } from "./types";

/** 写入 JSON 的标记；真实文件在 AppLocalData 下相对路径 */
export const LOCAL_MEDIA_PREFIX = "local-media:";

const MEDIA_DIR = "mikujar/media";

export function isLocalMediaRef(url: string): boolean {
  return url.startsWith(LOCAL_MEDIA_PREFIX);
}

/** Tauri 桌面 + 本地模式可用「存到应用数据目录文件夹」 */
export function canSaveMediaToAppFolder(): boolean {
  return isTauri();
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

function safeFileSegment(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 96);
  return base || "file";
}

export async function saveLocalMediaToAppFolder(file: File): Promise<{
  url: string;
  kind: NoteMediaKind;
  name?: string;
}> {
  if (!isTauri()) {
    throw new Error("仅 Tauri 桌面版可在本地模式写入附件文件夹");
  }
  const { BaseDirectory, mkdir, writeFile } = await import(
    "@tauri-apps/plugin-fs"
  );
  const kind = inferMediaKindFromFile(file);
  const id = crypto.randomUUID();
  const safe = safeFileSegment(file.name);
  const rel = `${MEDIA_DIR}/${id}_${safe}`;
  await mkdir(MEDIA_DIR, {
    recursive: true,
    baseDir: BaseDirectory.AppLocalData,
  });
  const buf = new Uint8Array(await file.arrayBuffer());
  await writeFile(rel, buf, { baseDir: BaseDirectory.AppLocalData });
  return {
    url: `${LOCAL_MEDIA_PREFIX}${rel}`,
    kind,
    name: file.name.trim() || undefined,
  };
}

export async function deleteLocalMediaFile(storedUrl: string): Promise<void> {
  if (!isTauri() || !isLocalMediaRef(storedUrl)) return;
  const rel = storedUrl.slice(LOCAL_MEDIA_PREFIX.length);
  try {
    const { BaseDirectory, remove } = await import("@tauri-apps/plugin-fs");
    await remove(rel, { baseDir: BaseDirectory.AppLocalData });
  } catch {
    /* 已删 */
  }
}

export async function resolveLocalMediaDisplayUrl(
  storedUrl: string
): Promise<string> {
  if (!isLocalMediaRef(storedUrl)) return storedUrl;
  if (!isTauri()) return "";
  const rel = storedUrl.slice(LOCAL_MEDIA_PREFIX.length);
  const { appLocalDataDir, join } = await import("@tauri-apps/api/path");
  const root = await appLocalDataDir();
  const abs = await join(root, rel);
  return convertFileSrc(abs);
}
