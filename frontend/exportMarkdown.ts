/**
 * 导出全部笔记到本地：Markdown（一卡一 .md，合集即文件夹）+ 附件原文件。
 *
 * - 支持 File System Access API（Chrome / Edge）：用户选一个文件夹，正文与附件
 *   逐个写入磁盘；附件经 cos-read 预签名直连 COS 流式下载，不进内存、不经后端。
 *   中断后重新导出到同一文件夹会跳过已下载完整的附件。
 * - 其它浏览器：下载仅含正文的 zip（附件为在线链接）。
 */
import { apiBase, apiFetchInit } from "./api/apiBase";
import { buildHeadersGet } from "./api/collections";
import { resolveCosMediaUrlIfNeeded, resolveMediaUrl } from "./api/auth";

type ExportManifest = {
  notes: { path: string; content: string }[];
  attachments: { url: string; path: string; bytes: number | null }[];
};

export type MarkdownExportProgress = {
  phase: "manifest" | "notes" | "attachments" | "done";
  notesDone: number;
  notesTotal: number;
  filesDone: number;
  filesTotal: number;
  bytesDone: number;
  bytesTotal: number;
  filesFailed: number;
  /** 失败的笔记与附件（制表符分隔：路径、URL、原因） */
  failed: string[];
};

type DirHandle = FileSystemDirectoryHandle;

const ATTACHMENT_CONCURRENCY = 3;

export function canExportToFolder(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/** 必须在用户点击的同步调用链里先调用（浏览器要求用户手势） */
export async function pickExportFolder(): Promise<DirHandle | null> {
  try {
    const picker = (
      window as unknown as {
        showDirectoryPicker: (o: { mode: "readwrite"; id?: string }) => Promise<DirHandle>;
      }
    ).showDirectoryPicker;
    return await picker({ mode: "readwrite", id: "cardnote-export" });
  } catch (e) {
    if ((e as DOMException)?.name === "AbortError") return null;
    throw e;
  }
}

async function fetchManifest(): Promise<ExportManifest> {
  const r = await fetch(
    `${apiBase()}/api/exports/markdown/manifest`,
    apiFetchInit({ headers: buildHeadersGet() }),
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as ExportManifest;
}

const dirCache = new WeakMap<DirHandle, Map<string, Promise<DirHandle>>>();

/** 逐级创建子目录；同一路径并发调用只建一次 */
function getDir(root: DirHandle, dirPath: string): Promise<DirHandle> {
  if (!dirPath) return Promise.resolve(root);
  let cache = dirCache.get(root);
  if (!cache) dirCache.set(root, (cache = new Map()));
  const hit = cache.get(dirPath);
  if (hit) return hit;
  const slash = dirPath.lastIndexOf("/");
  const parentPath = slash >= 0 ? dirPath.slice(0, slash) : "";
  const name = dirPath.slice(slash + 1);
  const p = getDir(root, parentPath).then((parent) =>
    parent.getDirectoryHandle(name, { create: true }),
  );
  cache.set(dirPath, p);
  return p;
}

function splitPath(path: string): [string, string] {
  const slash = path.lastIndexOf("/");
  return slash >= 0 ? [path.slice(0, slash), path.slice(slash + 1)] : ["", path];
}

async function existingSize(root: DirHandle, path: string): Promise<number | null> {
  const [dir, name] = splitPath(path);
  try {
    const d = await getDir(root, dir);
    const f = await (await d.getFileHandle(name)).getFile();
    return f.size;
  } catch {
    return null;
  }
}

async function writeText(root: DirHandle, path: string, content: string) {
  const [dir, name] = splitPath(path);
  const fh = await (await getDir(root, dir)).getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(content);
  await w.close();
}

async function downloadAttachment(
  root: DirHandle,
  a: ExportManifest["attachments"][number],
  onBytes: (n: number) => void,
  signal: AbortSignal,
) {
  const src = await resolveCosMediaUrlIfNeeded(resolveMediaUrl(a.url));
  const res = await fetch(src, { mode: "cors", signal });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const [dir, name] = splitPath(a.path);
  const fh = await (await getDir(root, dir)).getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  try {
    const counter = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctl) {
        onBytes(chunk.byteLength);
        ctl.enqueue(chunk);
      },
    });
    await res.body.pipeThrough(counter).pipeTo(w, { signal });
  } catch (e) {
    await w.abort().catch(() => {});
    throw e;
  }
}

export async function exportMarkdownToFolder(
  root: DirHandle,
  onProgress: (p: MarkdownExportProgress) => void,
  signal: AbortSignal,
): Promise<MarkdownExportProgress> {
  const p: MarkdownExportProgress = {
    phase: "manifest",
    notesDone: 0,
    notesTotal: 0,
    filesDone: 0,
    filesTotal: 0,
    bytesDone: 0,
    bytesTotal: 0,
    filesFailed: 0,
    failed: [],
  };
  const emit = () => onProgress({ ...p, failed: [...p.failed] });
  emit();

  const manifest = await fetchManifest();
  p.phase = "notes";
  p.notesTotal = manifest.notes.length;
  p.filesTotal = manifest.attachments.length;
  p.bytesTotal = manifest.attachments.reduce((s, a) => s + (a.bytes ?? 0), 0);
  emit();

  let lastEmit = 0;
  const throttledEmit = () => {
    const now = Date.now();
    if (now - lastEmit > 250) {
      lastEmit = now;
      emit();
    }
  };

  for (const n of manifest.notes) {
    signal.throwIfAborted();
    try {
      await writeText(root, n.path, n.content);
    } catch (e) {
      p.failed.push(`${n.path}\t\t${(e as Error)?.message ?? e}`);
    }
    p.notesDone++;
    throttledEmit();
  }

  p.phase = "attachments";
  emit();
  let next = 0;
  const worker = async () => {
    while (next < manifest.attachments.length) {
      signal.throwIfAborted();
      const a = manifest.attachments[next++];
      try {
        const size = await existingSize(root, a.path);
        if (size != null && a.bytes != null && size === a.bytes) {
          p.bytesDone += a.bytes;
        } else {
          let got = 0;
          try {
            await downloadAttachment(root, a, (b) => {
              got += b;
              p.bytesDone += b;
              throttledEmit();
            }, signal);
          } catch (e) {
            p.bytesDone -= got;
            throw e;
          }
          // 记录体积与实际不符时按实际计入，避免进度条超过 100%
          if (a.bytes != null && got !== a.bytes) p.bytesDone += a.bytes - got;
        }
      } catch (e) {
        if (signal.aborted) throw e;
        p.failed.push(`${a.path}\t${a.url}\t${(e as Error)?.message ?? e}`);
        p.filesFailed++;
        if (a.bytes != null) p.bytesDone += a.bytes;
      }
      p.filesDone++;
      throttledEmit();
    }
  };
  await Promise.all(Array.from({ length: ATTACHMENT_CONCURRENCY }, worker));

  if (p.failed.length) {
    await writeText(root, "export-failed.txt", p.failed.join("\n") + "\n");
  }
  p.phase = "done";
  emit();
  return p;
}

/** 不支持选文件夹的浏览器：下载仅正文的 zip */
export async function downloadMarkdownZip(): Promise<void> {
  const r = await fetch(
    `${apiBase()}/api/exports/markdown`,
    apiFetchInit({ headers: buildHeadersGet() }),
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const blob = await r.blob();
  const name =
    /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") ?? "")?.[1] ??
    "cardnote-markdown.zip";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
