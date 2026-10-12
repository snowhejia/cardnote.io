import TurndownService from "turndown";
import { zipSync, strToU8 } from "fflate";

/**
 * Markdown export: one .md file per card, one folder per collection (nested
 * like the sidebar). Plain Markdown so it imports into Craft / Obsidian /
 * Bear / Notion. A card placed in several collections is written once, in the
 * first collection reached; the other memberships are listed in its header.
 *
 * With `localMedia`, attachments are listed separately (deduplicated by URL,
 * stored once under attachments/) and notes link to them by relative path;
 * the browser then downloads each file into the chosen folder. Without it,
 * notes link to the remote URLs (zip fallback, text only).
 */

export const ATTACHMENTS_DIR = "attachments";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
});
turndown.remove(["style", "script", "head", "title", "meta"]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** Card bodies are HTML (editor output, Evernote/Yuque imports) or plain text. */
export function bodyToMarkdown(body) {
  const raw = typeof body === "string" ? body : "";
  if (!raw.trim()) return "";
  if (!/<[a-z!/][^>]*>/i.test(raw)) return raw.trim();
  const cleaned = raw
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<\?xml[^>]*\?>/gi, "")
    .replace(/<\/?en-note[^>]*>/gi, "");
  try {
    return turndown.turndown(cleaned).replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return cleaned.replace(/<[^>]+>/g, "").trim();
  }
}

/**
 * Safe on macOS / Windows / zip readers; keeps CJK. Also satisfies Chrome's
 * File System Access check (net::IsSafePortablePathComponent), which rejects
 * `~`, format chars such as the emoji ZWJ, leading/trailing space, trailing
 * dots, Windows reserved names and .lnk/.local — any of these makes
 * getFileHandle throw "Name is not allowed".
 */
function safeName(name, fallback, max = 80) {
  let s = String(name || "")
    .replace(/~/g, "～")
    .replace(/[\p{Cf}﷐-﷯￾￿]/gu, "")
    .replace(/[\\/:*?"<>|#%\p{Cc}]/gu, " ")
    .replace(/\s+/gu, " ")
    .slice(0, max)
    .replace(/^[.\s]+|[.\s]+$/gu, "");
  if (/^(con|prn|aux|nul|com\d|lpt\d|clock\$)(\..*)?$/i.test(s)) s = `_${s}`;
  return s || fallback;
}

/** Pick a name not yet in `used` (case-insensitive), adding " 2", " 3"… before the extension. */
function uniqueName(base, ext, used) {
  let name = `${base}${ext}`;
  for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base} ${i}${ext}`;
  used.add(name.toLowerCase());
  return name;
}

function firstLine(markdown) {
  for (const line of markdown.split("\n")) {
    const t = line.replace(/^[#>\-*\s]+/, "").replace(/[*_`[\]]/g, "").trim();
    if (t) return t;
  }
  return "";
}

function cardDateTime(card) {
  const date = text(card.addedOn).slice(0, 10);
  if (!date) return "";
  const m = Number(card.minutesOfDay);
  if (!Number.isFinite(m) || m <= 0) return date;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${date} ${hh}:${mm}`;
}

function propValueText(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (typeof value === "boolean") return value ? "✓" : "";
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "object" && v ? text(v.title) || text(v.name) || text(v.label) : propValueText(v)))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object") return text(value.title) || text(value.name) || text(value.url);
  return "";
}

function mediaFileName(media) {
  const url = text(media?.url);
  return text(media?.name) || decodeURIComponent(url.split("?")[0].split("/").pop() || "") || "file";
}

/** Markdown link target: percent-encode each segment so spaces / CJK survive every parser. */
function linkTarget(path) {
  return path.split("/").map((s) => (s === ".." ? s : encodeURIComponent(s))).join("/");
}

function cardMarkdown(card, title, collectionPaths, mediaLinks) {
  const body = bodyToMarkdown(card.text);
  const meta = [];
  const when = cardDateTime(card);
  if (when) meta.push(`📅 ${when}`);
  const tags = (Array.isArray(card.tags) ? card.tags : []).map(text).filter(Boolean);
  if (tags.length) meta.push(tags.map((t) => `#${t.replace(/\s+/g, "_")}`).join(" "));
  if (collectionPaths.length > 1) meta.push(`📁 ${collectionPaths.join(" · ")}`);

  const props = (Array.isArray(card.customProps) ? card.customProps : [])
    .map((p) => [text(p?.name), propValueText(p?.value)])
    .filter(([name, value]) => name && value);

  const media = mediaLinks.map(({ kind, label, target }) =>
    kind === "image" ? `![${label}](${target})` : `[${label}](${target})`,
  );

  // Untitled cards: the body's own first line already reads as the title.
  const parts = text(card.title) || !body ? [`# ${title}`] : [];
  if (meta.length) parts.push(meta.join("  ·  "));
  if (props.length) parts.push(props.map(([n, v]) => `- **${n}**: ${v}`).join("\n"));
  if (body) parts.push(body);
  if (media.length) parts.push(media.join("\n\n"));
  return parts.join("\n\n") + "\n";
}

/**
 * @param {Array} collections tree from getCollectionsTree
 * @param {{ localMedia?: boolean }} [opts]
 * @returns {{
 *   notes: Array<{ path: string, content: string }>,
 *   attachments: Array<{ url: string, path: string, bytes: number | null }>,
 * }}
 */
export function buildMarkdownExport(collections, { localMedia = false } = {}) {
  const firstPlacement = new Map(); // cardId -> { card, dir }
  const pathsByCard = new Map(); // cardId -> [collection path]

  const visit = (nodes, parentDir) => {
    if (!Array.isArray(nodes)) return;
    const usedDirs = new Set();
    for (const col of nodes) {
      if (!col || typeof col !== "object") continue;
      const dirName = uniqueName(safeName(col.name, "Untitled"), "", usedDirs);
      const dir = parentDir ? `${parentDir}/${dirName}` : dirName;
      for (const card of Array.isArray(col.cards) ? col.cards : []) {
        const id = text(card?.id);
        if (!id) continue;
        if (!firstPlacement.has(id)) firstPlacement.set(id, { card, dir });
        const paths = pathsByCard.get(id) ?? [];
        if (!paths.includes(dir)) paths.push(dir);
        pathsByCard.set(id, paths);
      }
      visit(col.children, dir);
    }
  };
  visit(collections, "");

  const attachmentsByUrl = new Map(); // url -> { url, path, bytes }
  const usedAttachmentNames = new Set();
  const attachmentFor = (media) => {
    const url = text(media.url);
    let a = attachmentsByUrl.get(url);
    if (!a) {
      const name = mediaFileName(media);
      const dot = name.lastIndexOf(".");
      let ext = dot > 0 && name.length - dot <= 8 ? name.slice(dot).replace(/[^.\w]/g, "") : "";
      if (ext === ".") ext = "";
      if (/^\.(lnk|local)$/i.test(ext)) ext += "_";
      const base = safeName(ext ? name.slice(0, dot) : name, "file", 100);
      a = {
        url,
        path: `${ATTACHMENTS_DIR}/${uniqueName(base, ext, usedAttachmentNames)}`,
        bytes: Number.isFinite(Number(media.sizeBytes)) ? Number(media.sizeBytes) : null,
      };
      attachmentsByUrl.set(url, a);
    }
    return a;
  };

  const usedNamesByDir = new Map(); // dir -> Set of lowercased file names
  const notes = [];
  for (const [id, { card, dir }] of firstPlacement) {
    const title =
      text(card.title) ||
      firstLine(bodyToMarkdown(card.text)).slice(0, 60) ||
      text(card.media?.[0]?.name) ||
      cardDateTime(card) ||
      "Untitled";
    if (!usedNamesByDir.has(dir)) usedNamesByDir.set(dir, new Set());
    const path = `${dir}/${uniqueName(safeName(title, "Untitled"), ".md", usedNamesByDir.get(dir))}`;
    const up = "../".repeat(dir.split("/").length);
    const mediaLinks = (Array.isArray(card.media) ? card.media : [])
      .filter((m) => text(m?.url))
      .map((m) => ({
        kind: m.kind,
        label: mediaFileName(m).replace(/[[\]]/g, ""),
        target: localMedia ? linkTarget(up + attachmentFor(m).path) : text(m.url),
      }));
    notes.push({ path, content: cardMarkdown(card, title, pathsByCard.get(id) ?? [], mediaLinks) });
  }
  return { notes, attachments: [...attachmentsByUrl.values()] };
}

/** Text-only zip (attachments as remote links) under a single top-level folder. */
export function markdownExportZip(collections, rootName = "cardnote") {
  const { notes } = buildMarkdownExport(collections);
  const entries = {};
  for (const n of notes) entries[`${rootName}/${n.path}`] = [strToU8(n.content), { level: 6 }];
  return { zip: zipSync(entries), cardCount: notes.length };
}
