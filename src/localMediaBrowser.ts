import { inferMediaKindFromFile } from "./localMediaTauri";
import type { NoteMediaKind } from "./types";

/** 浏览器本地模式写入 localStorage 时的单文件上限（base64 会膨胀，勿过大） */
const INLINE_MAX_BYTES = 3 * 1024 * 1024;

/**
 * 将附件以 data URL 写入笔记 JSON（仅存浏览器 localStorage）。
 * 大文件请用桌面版，走应用数据目录文件。
 */
export async function saveLocalMediaInlineInBrowser(file: File): Promise<{
  url: string;
  kind: NoteMediaKind;
  name?: string;
}> {
  if (file.size > INLINE_MAX_BYTES) {
    throw new Error(
      "浏览器本地模式下单个附件请小于 3MB；大文件请用桌面版写入应用数据目录～"
    );
  }
  const kind = inferMediaKindFromFile(file);
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
  if (!url.startsWith("data:")) {
    throw new Error("未能生成内联附件");
  }
  return {
    url,
    kind,
    name: file.name.trim() || undefined,
  };
}
