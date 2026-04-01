import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { basename, join } from "path";
import { parseBuffer } from "music-metadata";
import {
  buildObjectPublicUrl,
  isCosConfigured,
  putCosPublicObject,
} from "./storage.js";

/** 内嵌封面过大则跳过，避免内存与存储压力 */
const MAX_EMBEDDED_COVER_BYTES = 512 * 1024;

/** 已知 MIME → 稳定扩展名；其余类型从原始文件名或 MIME 子类型推断 */
const MIME_TO_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/ogg": "ogv",
  "application/pdf": "pdf",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "audio/aac": "aac",
  "audio/x-aac": "aac",
  "audio/opus": "opus",
};

const MAX_MB = Math.min(
  500,
  Math.max(1, Number(process.env.UPLOAD_MAX_MB || 100))
);
export const UPLOAD_MAX_BYTES = MAX_MB * 1024 * 1024;

export function getMediaUploadMode(hasPublicStaticDir) {
  if (isCosConfigured()) return "cos";
  if (hasPublicStaticDir) return "local";
  return null;
}

function normalizeMime(m) {
  const s = String(m ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  return s || "application/octet-stream";
}

function mediaPrefix() {
  const p = process.env.COS_MEDIA_PREFIX?.trim() || "mikujar/media";
  return p.replace(/\/$/, "");
}

function kindFromMime(mimetype) {
  const m = normalizeMime(mimetype);
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  return "file";
}

/** 仅取文件名中最后一个「安全」扩展名 */
function safeExtFromOriginalName(originalname) {
  const base =
    typeof originalname === "string" && originalname.trim()
      ? basename(originalname.trim())
      : "";
  const m = /^.+\.([a-zA-Z0-9]{1,16})$/.exec(base);
  return m ? m[1].toLowerCase() : null;
}

function extForStoredFile(mimetype, originalname) {
  const m = normalizeMime(mimetype);
  if (MIME_TO_EXT[m]) return MIME_TO_EXT[m];
  const fromName = safeExtFromOriginalName(originalname);
  if (fromName) return fromName;
  if (m === "application/octet-stream") return "bin";
  const sub = m.split("/")[1]?.replace(/[^a-z0-9+.-]/gi, "") ?? "";
  if (sub.length >= 1 && sub.length <= 16) return sub.slice(0, 16);
  return "bin";
}

function attachmentDisplayName(originalname) {
  const raw =
    typeof originalname === "string" && originalname.trim()
      ? basename(originalname)
      : "";
  return raw.slice(0, 160) || "附件";
}

/**
 * 从 MP3/FLAC/M4A 等标签中取出第一张内嵌图，供封面展示。
 * @returns {{ buffer: Buffer; mimeType: string; ext: string } | null}
 */
async function tryExtractEmbeddedAudioCover(buffer, mimeType) {
  try {
    const md = await parseBuffer(
      new Uint8Array(buffer),
      { mimeType },
      { duration: false }
    );
    const pic = md.common.picture?.[0];
    if (!pic?.data?.length) return null;
    if (pic.data.length > MAX_EMBEDDED_COVER_BYTES) return null;
    const buf = Buffer.from(pic.data);
    const fmt = String(pic.format || "").toLowerCase();
    if (fmt.includes("png")) {
      return { buffer: buf, mimeType: "image/png", ext: "png" };
    }
    if (fmt.includes("webp")) {
      return { buffer: buf, mimeType: "image/webp", ext: "webp" };
    }
    return { buffer: buf, mimeType: "image/jpeg", ext: "jpg" };
  } catch {
    return null;
  }
}

/** @param {{ buffer: Buffer; mimetype: string; originalname?: string }} file */
export async function saveUploadedMedia(file, opts) {
  const mimetype = normalizeMime(file.mimetype);
  const ext = extForStoredFile(mimetype, file.originalname);
  const token = `${Date.now()}-${randomBytes(12).toString("hex")}`;
  const filename = `${token}.${ext}`;
  const kind = kindFromMime(mimetype);
  /** 对象键仍用随机名；前端用 name 展示原始文件名 */
  const name = attachmentDisplayName(file.originalname);

  let coverUrl;
  if (kind === "audio") {
    const cover = await tryExtractEmbeddedAudioCover(file.buffer, mimetype);
    if (cover) {
      const coverFilename = `${token}-cover.${cover.ext}`;
      if (isCosConfigured()) {
        const coverKey = `${mediaPrefix()}/${coverFilename}`;
        await putCosPublicObject(coverKey, cover.buffer, cover.mimeType);
        coverUrl = buildObjectPublicUrl(coverKey);
      } else {
        await mkdir(opts.publicUploadsDir, { recursive: true });
        const coverPath = join(opts.publicUploadsDir, coverFilename);
        await writeFile(coverPath, cover.buffer);
        coverUrl = `/uploads/${coverFilename}`;
      }
    }
  }

  if (isCosConfigured()) {
    const key = `${mediaPrefix()}/${filename}`;
    await putCosPublicObject(key, file.buffer, mimetype);
    const url = buildObjectPublicUrl(key);
    return coverUrl ? { url, kind, name, coverUrl } : { url, kind, name };
  }

  await mkdir(opts.publicUploadsDir, { recursive: true });
  const diskPath = join(opts.publicUploadsDir, filename);
  await writeFile(diskPath, file.buffer);
  const url = `/uploads/${filename}`;
  return coverUrl ? { url, kind, name, coverUrl } : { url, kind, name };
}
