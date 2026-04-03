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
  const d = document.createElement("div");
  d.innerHTML = t;
  return (d.textContent ?? "").replace(/\s+/g, " ").trim();
}
