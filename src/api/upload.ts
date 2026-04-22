import { getAdminToken } from "../auth/token";
import { probeDimensionsFromFile } from "../noteMediaDimensions";
import type { NoteMediaKind } from "../types";
import { apiBase, apiFetchInit } from "./apiBase";
import { xhrPutBlob, xhrPutBlobEtag } from "./xhrUpload";

/** 文件夹拖入等场景下 File.type 常为空，避免被当成 octet-stream 导致 kind/COS Content-Type 错误 */
function inferContentTypeForUpload(file: File): string {
  const raw = file.type?.trim();
  if (raw && raw !== "application/octet-stream") return raw;
  const ext = file.name.toLowerCase().match(/\.([a-z0-9]+)$/i)?.[1];
  if (!ext) return raw || "application/octet-stream";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    bmp: "image/bmp",
    heic: "image/heic",
    heif: "image/heif",
    tif: "image/tiff",
    tiff: "image/tiff",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    wav: "audio/wav",
    pdf: "application/pdf",
  };
  return map[ext] ?? raw ?? "application/octet-stream";
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const admin = getAdminToken();
  if (admin) h.Authorization = `Bearer ${admin}`;
  else {
    const t = (import.meta.env.VITE_API_TOKEN as string | undefined)?.trim();
    if (t) h.Authorization = `Bearer ${t}`;
  }
  return h;
}

export type UploadMediaResult = {
  url: string;
  kind: NoteMediaKind;
  name?: string;
  /** 音频内嵌封面 */
  coverUrl?: string;
  /** 视频截帧 / 图片 WebP / PDF 首页（thumbnailUrl） */
  thumbnailUrl?: string;
  /** 主文件大小（写入笔记 JSON 供统计） */
  sizeBytes?: number;
  /** 音/视频时长（秒）；服务端 finalize 探测 */
  durationSec?: number;
  /** 图片或视频像素宽（与 heightPx 成对） */
  widthPx?: number;
  heightPx?: number;
};

export type UploadCardMediaOptions = {
  /** 0–100，上传阶段按已上传字节更新；收尾 finalize 期间保持 100 */
  onProgress?: (percent: number) => void;
};

/** 并行分片数（每片独立预签名 PUT） */
const MULTIPART_PARALLEL = 4;

type PresignJson = {
  direct?: unknown;
  multipart?: unknown;
  putUrl?: unknown;
  headers?: Record<string, string>;
  key?: unknown;
  uploadId?: unknown;
  partSize?: unknown;
  partCount?: unknown;
  url?: unknown;
  kind?: unknown;
  name?: unknown;
  contentType?: unknown;
  error?: unknown;
  code?: unknown;
};

async function abortMultipartUpload(
  base: string,
  key: string,
  uploadId: string,
  fileSize: number
) {
  try {
    await fetch(
      `${base}/api/upload/multipart/abort`,
      apiFetchInit({
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key, uploadId, fileSize }),
      })
    );
  } catch {
    /* 尽力中止 */
  }
}

function pickDurationSecFromFinalizeJson(fj: {
  durationSec?: unknown;
}): number | undefined {
  const d = fj.durationSec;
  if (typeof d !== "number" || !Number.isFinite(d) || d < 0) return undefined;
  return Math.round(d);
}

function pickDimensionsFromFinalizeJson(fj: {
  widthPx?: unknown;
  heightPx?: unknown;
}): { widthPx: number; heightPx: number } | undefined {
  const w = fj.widthPx;
  const h = fj.heightPx;
  if (typeof w !== "number" || typeof h !== "number") return undefined;
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return undefined;
  }
  if (w > 32767 || h > 32767) return undefined;
  return { widthPx: Math.round(w), heightPx: Math.round(h) };
}

async function finalizeAfterUpload(
  base: string,
  key: string,
  kind: NoteMediaKind
): Promise<{
  coverUrl?: string;
  thumbnailUrl?: string;
  durationSec?: number;
  widthPx?: number;
  heightPx?: number;
}> {
  let coverUrl: string | undefined;
  let durationSec: number | undefined;
  let widthPx: number | undefined;
  let heightPx: number | undefined;
  if (kind === "audio") {
    const fin = await fetch(
      `${base}/api/upload/finalize-audio`,
      apiFetchInit({
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key }),
      })
    );
    const fj = (await fin.json().catch(() => ({}))) as {
      coverUrl?: unknown;
      durationSec?: unknown;
      error?: unknown;
    };
    if (!fin.ok) {
      throw new Error(
        typeof fj.error === "string" ? fj.error : "音频封面没抠出来…先听听歌也行～"
      );
    }
    if (typeof fj.coverUrl === "string" && fj.coverUrl.trim()) {
      coverUrl = fj.coverUrl.trim();
    }
    durationSec = pickDurationSecFromFinalizeJson(fj);
  }

  let thumbnailUrl: string | undefined;
  if (kind === "video") {
    try {
      const fin = await fetch(
        `${base}/api/upload/finalize-video`,
        apiFetchInit({
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ key }),
        })
      );
      const fj = (await fin.json().catch(() => ({}))) as {
        thumbnailUrl?: unknown;
        durationSec?: unknown;
        widthPx?: unknown;
        heightPx?: unknown;
        error?: unknown;
      };
      if (!fin.ok) {
        const msg =
          typeof fj.error === "string" ? fj.error : `HTTP ${fin.status}`;
        console.warn("[upload] finalize-video failed:", msg, { key });
      } else if (
        typeof fj.thumbnailUrl !== "string" ||
        !fj.thumbnailUrl.trim()
      ) {
        console.warn(
          "[upload] finalize-video: no thumbnailUrl (服务端需 ffmpeg 截帧，见服务器日志)",
          { key }
        );
      } else {
        thumbnailUrl = fj.thumbnailUrl.trim();
      }
      const d = pickDurationSecFromFinalizeJson(fj);
      if (d !== undefined) durationSec = d;
      const dim = pickDimensionsFromFinalizeJson(fj);
      if (dim) {
        widthPx = dim.widthPx;
        heightPx = dim.heightPx;
      }
    } catch (e) {
      console.warn("[upload] finalize-video request error", e);
    }
  }

  if (kind === "image") {
    try {
      const fin = await fetch(
        `${base}/api/upload/finalize-image`,
        apiFetchInit({
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ key }),
        })
      );
      const fj = (await fin.json().catch(() => ({}))) as {
        thumbnailUrl?: unknown;
        widthPx?: unknown;
        heightPx?: unknown;
      };
      if (fin.ok && typeof fj.thumbnailUrl === "string" && fj.thumbnailUrl.trim()) {
        thumbnailUrl = fj.thumbnailUrl.trim();
      }
      if (fin.ok) {
        const dim = pickDimensionsFromFinalizeJson(fj);
        if (dim) {
          widthPx = dim.widthPx;
          heightPx = dim.heightPx;
        }
      }
    } catch {
      /* 忽略 */
    }
  }

  if (kind === "file" && /\.pdf$/i.test(key)) {
    try {
      const fin = await fetch(
        `${base}/api/upload/finalize-pdf`,
        apiFetchInit({
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ key }),
        })
      );
      const fj = (await fin.json().catch(() => ({}))) as {
        thumbnailUrl?: unknown;
      };
      if (fin.ok && typeof fj.thumbnailUrl === "string" && fj.thumbnailUrl.trim()) {
        thumbnailUrl = fj.thumbnailUrl.trim();
      }
    } catch {
      /* 忽略 */
    }
  }

  return { coverUrl, thumbnailUrl, durationSec, widthPx, heightPx };
}

/**
 * 通过 COS 预签名直传上传媒体文件（大于 8MB 时自动分片并行上传）。
 * 若服务端未配置 COS 则抛出错误（不再 fallback 到 multipart form）。
 */
export async function uploadCardMedia(
  file: File,
  options?: UploadCardMediaOptions
): Promise<UploadMediaResult> {
  const onProgress = options?.onProgress;
  const base = apiBase();
  const pres = await fetch(
    `${base}/api/upload/presign`,
    apiFetchInit({
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename: file.name,
        contentType: inferContentTypeForUpload(file),
        fileSize: file.size,
      }),
    })
  );

  const pj = (await pres.json().catch(() => ({}))) as PresignJson;

  if (!pres.ok) {
    throw new Error(
      typeof pj.error === "string" ? pj.error : "上传预约失败惹，等等再试～"
    );
  }

  if (pj.direct !== true) {
    throw new Error(
      typeof pj.error === "string"
        ? pj.error
        : "附件小仓库今天有点挤，稍候再来贴贴纸～"
    );
  }

  const isMultipart = pj.multipart === true;
  if (!isMultipart && typeof pj.putUrl !== "string") {
    throw new Error(
      typeof pj.error === "string"
        ? pj.error
        : "附件小仓库今天有点挤，稍候再来贴贴纸～"
    );
  }

  if (
    typeof pj.key !== "string" ||
    typeof pj.url !== "string" ||
    !pj.url ||
    typeof pj.kind !== "string"
  ) {
    throw new Error("上传结果怪怪的…刷新下再试？");
  }

  const kind = pj.kind as NoteMediaKind;
  if (kind !== "image" && kind !== "video" && kind !== "audio" && kind !== "file") {
    throw new Error("上传结果怪怪的…刷新下再试？");
  }

  const key = pj.key;

  if (isMultipart) {
    const uploadId = typeof pj.uploadId === "string" ? pj.uploadId : "";
    const partSize = Number(pj.partSize);
    const partCount = Number(pj.partCount);
    if (
      !uploadId ||
      !Number.isFinite(partSize) ||
      partSize < 1 ||
      !Number.isFinite(partCount) ||
      partCount < 1
    ) {
      throw new Error("分片参数无效，请重试");
    }

    const partProgress = new Float64Array(partCount);
    const emit = () => {
      let sum = 0;
      for (let i = 0; i < partCount; i++) sum += partProgress[i];
      onProgress?.(
        Math.min(100, Math.round((100 * sum) / Math.max(1, file.size)))
      );
    };

    const parts: { PartNumber: number; ETag: string }[] = [];

    async function uploadPart(partIdx: number) {
      const start = partIdx * partSize;
      const end = Math.min(file.size, start + partSize);
      const blob = file.slice(start, end);
      const prs = await fetch(
        `${base}/api/upload/multipart/part-url`,
        apiFetchInit({
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            key,
            uploadId,
            partNumber: partIdx + 1,
          }),
        })
      );
      const prj = (await prs.json().catch(() => ({}))) as {
        putUrl?: unknown;
        error?: unknown;
      };
      if (!prs.ok || typeof prj.putUrl !== "string") {
        throw new Error(
          typeof prj.error === "string" ? prj.error : "分片预签名失败"
        );
      }
      const etag = await xhrPutBlobEtag(prj.putUrl, {}, blob, {
        expectedBytes: blob.size,
        onUploadedBytes: (loaded) => {
          partProgress[partIdx] = loaded;
          emit();
        },
      });
      partProgress[partIdx] = blob.size;
      emit();
      parts[partIdx] = { PartNumber: partIdx + 1, ETag: etag };
    }

    let nextPart = 0;
    async function worker() {
      for (;;) {
        const i = nextPart++;
        if (i >= partCount) return;
        await uploadPart(i);
      }
    }

    try {
      await Promise.all(
        Array.from({ length: Math.min(MULTIPART_PARALLEL, partCount) }, () =>
          worker()
        )
      );

      const sorted = [...parts].sort(
        (a, b) => a.PartNumber - b.PartNumber
      );

      const comp = await fetch(
        `${base}/api/upload/multipart/complete`,
        apiFetchInit({
          method: "POST",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            key,
            uploadId,
            parts: sorted,
          }),
        })
      );
      const cj = (await comp.json().catch(() => ({}))) as { error?: unknown };
      if (!comp.ok) {
        throw new Error(
          typeof cj.error === "string" ? cj.error : "分片合并失败"
        );
      }
      onProgress?.(100);
    } catch (err) {
      void abortMultipartUpload(base, key, uploadId, file.size);
      throw err instanceof Error
        ? err
        : new Error("分片上传失败，再试一次好不好？");
    }
  } else {
    const headers: Record<string, string> = { ...(pj.headers ?? {}) };
    try {
      await xhrPutBlob(pj.putUrl as string, headers, file, {
        expectedBytes: file.size,
        onProgress,
      });
    } catch {
      throw new Error("文件上传路上绊了一下，再试一次好不好？");
    }
    onProgress?.(100);
  }

  const { coverUrl, thumbnailUrl, durationSec, widthPx, heightPx } =
    await finalizeAfterUpload(base, key, kind);

  /** 若服务端 finalize-video 没返回 thumbnailUrl（多半是没装 ffmpeg / 报错），
   *  在浏览器里自己截第一帧并 PUT 上去，至少保证新视频有个能缓存的缩略图。 */
  let effectiveThumbnailUrl: string | undefined = thumbnailUrl;
  if (!effectiveThumbnailUrl && kind === "video") {
    try {
      const fallback = await captureAndUploadVideoThumbnailInBrowser(
        base,
        file
      );
      if (fallback) effectiveThumbnailUrl = fallback;
    } catch {
      /* 忽略：上传失败不阻塞主流程 */
    }
  }

  const out: UploadMediaResult = {
    url: pj.url,
    kind,
    sizeBytes: file.size,
  };
  if (typeof pj.name === "string" && pj.name.trim()) {
    out.name = pj.name.trim();
  }
  if (coverUrl) out.coverUrl = coverUrl;
  if (effectiveThumbnailUrl) out.thumbnailUrl = effectiveThumbnailUrl;
  if (durationSec !== undefined) out.durationSec = durationSec;
  let wPx = widthPx;
  let hPx = heightPx;
  if (
    (kind === "image" || kind === "video") &&
    (wPx === undefined || hPx === undefined)
  ) {
    const d = await probeDimensionsFromFile(file, kind).catch(() => null);
    if (d) {
      wPx = d.widthPx;
      hPx = d.heightPx;
    }
  }
  if (wPx !== undefined && hPx !== undefined) {
    out.widthPx = wPx;
    out.heightPx = hPx;
  }
  return out;
}

/**
 * 浏览器内抓取视频第一帧为 JPEG，走 /api/upload/presign 直传 COS，返回公开 URL。
 * 只在服务器 finalize-video 没给出 thumbnailUrl 时作为兜底调用。
 */
async function captureAndUploadVideoThumbnailInBrowser(
  base: string,
  videoFile: File
): Promise<string | null> {
  const blob = await captureVideoFirstFrameBlob(videoFile).catch(() => null);
  if (!blob) {
    console.warn(
      "[upload] 视频缩略图浏览器兜底：抓帧失败（CORS / 不支持的编码等）",
      { name: videoFile.name }
    );
    return null;
  }
  const stem = (videoFile.name || "video").replace(/\.[^.]+$/, "");
  const thumbFile = new File([blob], `${stem}-thumb.jpg`, {
    type: "image/jpeg",
  });
  try {
    const pres = await fetch(
      `${base}/api/upload/presign`,
      apiFetchInit({
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: thumbFile.name,
          contentType: "image/jpeg",
          fileSize: thumbFile.size,
        }),
      })
    );
    const pj = (await pres.json().catch(() => ({}))) as PresignJson;
    if (!pres.ok || pj.direct !== true) return null;
    if (typeof pj.putUrl !== "string" || typeof pj.url !== "string") return null;
    if (pj.multipart === true) {
      /** 缩略图恒小，不走分片路径；若服务器强行返回 multipart 直接放弃兜底 */
      return null;
    }
    const headers: Record<string, string> = { ...(pj.headers ?? {}) };
    try {
      await xhrPutBlob(pj.putUrl, headers, thumbFile, {
        expectedBytes: thumbFile.size,
      });
    } catch {
      return null;
    }
    return pj.url;
  } catch {
    return null;
  }
}

/** 在 <video> + <canvas> 中抓取首帧（默认 0.2s 或 5% 处）为 JPEG Blob；失败返回 null */
function captureVideoFirstFrameBlob(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    let settled = false;
    const finish = (b: Blob | null) => {
      if (settled) return;
      settled = true;
      try {
        video.removeAttribute("src");
        video.load();
      } catch {
        /* ignore */
      }
      URL.revokeObjectURL(url);
      resolve(b);
    };
    const safety = window.setTimeout(() => finish(null), 8000);
    video.addEventListener("loadedmetadata", () => {
      const d = Number.isFinite(video.duration) ? video.duration : 0;
      const target = d > 0 ? Math.min(0.2, d * 0.05) : 0;
      try {
        video.currentTime = target;
      } catch {
        finish(null);
      }
    });
    video.addEventListener("seeked", () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) {
        window.clearTimeout(safety);
        finish(null);
        return;
      }
      const MAX_EDGE = 720;
      const ratio = Math.min(1, MAX_EDGE / Math.max(w, h));
      const cw = Math.max(1, Math.round(w * ratio));
      const ch = Math.max(1, Math.round(h * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        window.clearTimeout(safety);
        finish(null);
        return;
      }
      try {
        ctx.drawImage(video, 0, 0, cw, ch);
      } catch {
        window.clearTimeout(safety);
        finish(null);
        return;
      }
      canvas.toBlob(
        (b) => {
          window.clearTimeout(safety);
          finish(b);
        },
        "image/jpeg",
        0.82
      );
    });
    video.addEventListener("error", () => {
      window.clearTimeout(safety);
      finish(null);
    });
  });
}
