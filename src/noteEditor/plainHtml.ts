/** 将存储的正文转为 Tiptap 可用的 HTML；旧数据为纯文本时按段落转义后包成 <p> */
export function noteBodyToHtml(stored: string | undefined): string {
  const raw = stored ?? "";
  const t = raw.trim();
  if (!t) return "<p></p>";
  if (/^\s*<[/a-z!]/i.test(raw)) {
    return raw;
  }
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paras = raw.split(/\n\n+/).map((p) => esc(p).replace(/\n/g, "<br>"));
  return paras.map((p) => `<p>${p}</p>`).join("") || "<p></p>";
}

/** 搜索、摘要、关联推荐等：从 HTML 或纯文本得到可匹配的纯文本 */
export function htmlToPlainText(html: string | undefined): string {
  const t = html ?? "";
  if (!t.includes("<")) return t;
  if (typeof document === "undefined") {
    return t.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  try {
    const doc = new DOMParser().parseFromString(t, "text/html");
    return (doc.body?.textContent ?? "").replace(/\s+/g, " ").trim();
  } catch {
    return t.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
}

function decodeHtmlEntitiesLite(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * 备忘录 / 网页导出的 HTML → 导入为卡片前的纯文本：保留换行与段落边界。
 * 与 {@link htmlToPlainText} 不同，后者为搜索会压成单行空格。
 */
export function htmlToPlainTextForImportCard(html: string | undefined): string {
  const raw = html ?? "";
  if (!raw.trim()) return "";
  if (!raw.includes("<")) return raw.trim();

  let s = raw.replace(/\r\n/g, "\n");
  s = s.replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "");
  s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  s = s.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|h[1-6]|blockquote|pre|tr)\s*>/gi, "\n\n");
  s = s.replace(/<\/(li)\s*>/gi, "\n");
  s = s.replace(/<\/(div|section|article|header|footer)\s*>/gi, "\n\n");
  s = s.replace(/<[^>]+>/g, "");
  s = decodeHtmlEntitiesLite(s);
  s = s.replace(/[ \t\f\v]+\n/g, "\n");
  s = s.replace(/\n[ \t]+/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}
