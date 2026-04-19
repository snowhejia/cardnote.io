/**
 * 小红书页面结构会改版，以下选择器多路兜底；失败时仍尽量带回 og 元数据。
 */
function textOf(el) {
  return el?.innerText?.trim() || "";
}

/** 当前笔记在 URL 中的 id，用于从内嵌 JSON 里截取「本条笔记」片段，避免拿到登录者信息 */
function extractNoteIdFromUrl() {
  const p = location.pathname;
  let m = p.match(/\/explore\/([^/?#]+)/);
  if (m) return decodeURIComponent(m[1]);
  m = p.match(/\/discovery\/item\/([^/?#]+)/);
  if (m) return decodeURIComponent(m[1]);
  m = p.match(/\/user\/profile\/[^/]+\/([^/?#]+)/);
  if (m) return decodeURIComponent(m[1]);
  return "";
}

function isInTopNavOrSidebar(el) {
  return !!el.closest(
    "header, nav, [class*='navbar'], [class*='nav-bar'], [class*='NavBar'], [id*='header'], .reds-menu, [class*='side-bar'], [class*='sidebar'], [class*='user-menu']"
  );
}

/**
 * 仅取「帖子作者」昵称：只在笔记主体容器内找，排除顶栏/侧栏登录用户；JSON 只解析当前 noteId 附近片段。
 */
function scrapeAuthorNickname() {
  const bad = /^(关注|粉丝|主页|私信|更多|查看|Follow|登录|注册)/;

  const roots = [];
  const pushRoot = (n) => {
    if (n && roots.indexOf(n) === -1) roots.push(n);
  };
  pushRoot(document.querySelector("#noteContainer"));
  pushRoot(document.querySelector(".note-detail"));
  pushRoot(document.querySelector('[class*="note-detail"]'));
  pushRoot(document.querySelector(".note-scroller"));
  pushRoot(document.querySelector("article.note-item"));
  pushRoot(document.querySelector("main article"));
  pushRoot(document.querySelector("main"));

  const tryDomInRoot = (root) => {
    if (!root) return "";
    const selectors = [
      ".author-wrapper .username",
      ".author-wrapper .name",
      ".author .username",
      ".author .name",
      ".author-name",
      ".user-name",
      '[class*="author"] [class*="name"]',
      '[class*="Author"] [class*="name"]',
      '[class*="nickname"]',
    ];
    for (const sel of selectors) {
      for (const el of root.querySelectorAll(sel)) {
        if (isInTopNavOrSidebar(el)) continue;
        const t = textOf(el);
        if (t && t.length <= 48 && t.length >= 1 && !bad.test(t)) return t;
      }
    }
    for (const a of root.querySelectorAll('a[href*="/user/profile/"]')) {
      if (isInTopNavOrSidebar(a)) continue;
      const t = textOf(a);
      if (
        t &&
        t.length > 0 &&
        t.length <= 48 &&
        !bad.test(t) &&
        !/^\d+$/.test(t)
      ) {
        return t;
      }
    }
    return "";
  };

  for (const r of roots) {
    const got = tryDomInRoot(r);
    if (got) return got;
  }

  const noteId = extractNoteIdFromUrl();
  if (noteId) {
    for (const script of document.querySelectorAll("script:not([src])")) {
      const t = script.textContent || "";
      if (t.length < 80 || t.length > 500_000) continue;
      const idx = t.indexOf(noteId);
      if (idx === -1) continue;
      const chunk = t.slice(Math.max(0, idx - 2000), Math.min(t.length, idx + 12000));
      let anchor = chunk.indexOf(`"noteId":"${noteId}"`);
      if (anchor === -1) anchor = chunk.indexOf(`"id":"${noteId}"`);
      if (anchor === -1) anchor = chunk.indexOf(noteId);
      const tail = anchor === -1 ? chunk : chunk.slice(anchor, Math.min(chunk.length, anchor + 28000));
      /** 锚在本条笔记之后，优先取 user 块内昵称，避免 chunk 里更早出现的他人 nickName */
      const anchoredNick = tail.match(
        /"user"\s*:\s*\{[\s\S]{0,12000}?"nickName"\s*:\s*"((?:[^"\\]|\\.)*)"/i
      );
      const anchoredNickname = tail.match(
        /"user"\s*:\s*\{[\s\S]{0,12000}?"nickname"\s*:\s*"((?:[^"\\]|\\.)*)"/i
      );
      for (const m0 of [anchoredNick, anchoredNickname]) {
        if (m0?.[1]) {
          const raw = m0[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
          if (raw.length > 0 && raw.length <= 64 && !bad.test(raw)) return raw;
        }
      }
      const m = chunk.match(/"nickName"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (m && m[1]) {
        const raw = m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        if (raw.length > 0 && raw.length <= 64 && !bad.test(raw)) return raw;
      }
      const m2 = chunk.match(/"nickname"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
      if (m2 && m2[1]) {
        const raw = m2[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        if (raw.length > 0 && raw.length <= 64 && !bad.test(raw)) return raw;
      }
    }
  }

  return "";
}

/** 内嵌时间戳多为毫秒（13 位）或秒（10 位） */
function xhsTimestampToYmd(raw) {
  let n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 1e12) n *= 1000;
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function scrapeXhsPublishDateYmd() {
  const noteId = extractNoteIdFromUrl();
  if (!noteId) return null;
  for (const script of document.querySelectorAll("script:not([src])")) {
    const t = script.textContent || "";
    if (t.length < 80 || t.length > 500_000) continue;
    const idx = t.indexOf(noteId);
    if (idx === -1) continue;
    const chunk = t.slice(
      Math.max(0, idx - 2500),
      Math.min(t.length, idx + 35000)
    );
    const reNum =
      /"(?:time|timestamp|lastUpdateTime|pubTime|publish_time)"\s*:\s*(\d{10,13})\b/g;
    let m;
    while ((m = reNum.exec(chunk)) !== null) {
      const ymd = xhsTimestampToYmd(m[1]);
      if (ymd && ymd >= "2010-01-01") return ymd;
    }
    const iso = chunk.match(
      /"(?:time|date|publishTime)"\s*:\s*"(\d{4}-\d{2}-\d{2})/
    );
    if (iso?.[1]) return iso[1];
  }
  return null;
}

/**
 * 与主站 sf-xhs-type 选项 id 一致：o-xhs-note（图文）/ o-xhs-video（视频）
 * @param {string} noteId
 * @param {string[]} videoUrls
 */
function inferXhsPostType(noteId, videoUrls) {
  if (videoUrls && videoUrls.length > 0) return "o-xhs-video";
  const roots = [
    document.querySelector("#noteContainer"),
    document.querySelector(".note-detail"),
    document.querySelector('[class*="note-detail"]'),
  ].filter(Boolean);
  for (const root of roots) {
    if (root.querySelector("video")) return "o-xhs-video";
  }
  if (noteId) {
    for (const script of document.querySelectorAll("script:not([src])")) {
      const t = script.textContent || "";
      if (t.length < 80 || t.length > 500_000) continue;
      const idx = t.indexOf(noteId);
      if (idx === -1) continue;
      const chunk = t.slice(idx, Math.min(t.length, idx + 22000));
      if (
        /"type"\s*:\s*"video"/i.test(chunk) ||
        /"noteType"\s*:\s*"video"/i.test(chunk) ||
        /"noteType"\s*:\s*2\b/.test(chunk)
      ) {
        return "o-xhs-video";
      }
    }
  }
  return "o-xhs-note";
}

function scrapeNotePage() {
  const ogTitle = document
    .querySelector('meta[property="og:title"]')
    ?.getAttribute("content")
    ?.trim();
  const ogDesc = document
    .querySelector('meta[property="og:description"]')
    ?.getAttribute("content")
    ?.trim();

  const titleCandidates = [
    ogTitle,
    textOf(document.querySelector("#detail-title")),
    textOf(document.querySelector('[class*="title"][class*="note"]')),
    document.title?.replace(/\s*-\s*小红书\s*$/i, "").trim(),
  ].filter(Boolean);

  const title = titleCandidates[0] || "小红书笔记";

  const bodyCandidates = [
    textOf(document.querySelector("#detail-desc .note-text")),
    textOf(document.querySelector("#detail-desc")),
    textOf(document.querySelector(".note-text")),
    textOf(document.querySelector('[class*="note-text"]')),
    textOf(document.querySelector('[class*="desc"]')),
    ogDesc,
  ].filter(Boolean);

  const body = bodyCandidates[0] || "";

  /** 小红书正文里的表情包 / 小贴纸，不当作笔记配图 */
  function isEmojiOrStickerImg(img, src) {
    const low = String(src).toLowerCase();
    const urlHints = [
      "emoji",
      "sticker",
      "emoticon",
      "expression",
      "emotion",
      "/face/",
      "face_",
      "meme",
      "decorate",
      "decoration",
      "stickpack",
      "gifimage",
      "static-expression",
    ];
    if (urlHints.some((h) => low.includes(h))) return true;

    const cls = String(img.className || "").toLowerCase();
    if (
      /\bemoji\b|sticker|emoticon|expression|表情|decorate/.test(cls)
    ) {
      return true;
    }

    let p = img.parentElement;
    for (let d = 0; d < 4 && p; d++, p = p.parentElement) {
      const pc = String(p.className || "").toLowerCase();
      if (
        /\bemoji\b|sticker|emoticon|expression|表情|decorate|note-content-emoji/.test(
          pc
        )
      ) {
        return true;
      }
    }

    const alt = String(img.getAttribute("alt") || "").toLowerCase();
    if (alt.includes("表情") || alt.includes("emoji")) return true;

    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (nw > 0 && nh > 0 && nw <= 72 && nh <= 72) return true;

    try {
      const r = img.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.width <= 56 && r.height <= 56) {
        return true;
      }
    } catch {
      /* ignore */
    }

    return false;
  }

  function imgDisplaySrc(img) {
    return (
      img.currentSrc ||
      img.src ||
      img.dataset?.src ||
      img.getAttribute("data-original") ||
      ""
    );
  }

  function isUsableNoteImage(img, src) {
    if (!src || !/^https?:\/\//i.test(src)) return false;
    if (isEmojiOrStickerImg(img, src)) return false;
    const low = src.toLowerCase();
    if (
      low.includes("avatar") ||
      low.includes("icon") ||
      low.includes("1x1") ||
      low.includes("blank")
    ) {
      return false;
    }
    try {
      const u = new URL(src);
      if (u.pathname.length < 8) return false;
    } catch {
      return false;
    }
    return true;
  }

  const seen = new Set();
  const imageUrls = [];

  function tryPushImage(img) {
    const src = imgDisplaySrc(img);
    if (!isUsableNoteImage(img, src)) return false;
    if (seen.has(src)) return false;
    seen.add(src);
    imageUrls.push(src);
    return true;
  }

  /**
   * 多图笔记顺序问题：原先按 #noteContainer 等选择器拼 DOM 深度顺序，常与轮播视觉顺序不一致；
   * Swiper loop 还会在首尾插入 swiper-slide-duplicate。这里先按「主轮播」slide 顺序收图，再兜底其它区域。
   */
  const noteRoots = [];
  const pushRoot = (n) => {
    if (n && noteRoots.indexOf(n) === -1) noteRoots.push(n);
  };
  pushRoot(document.querySelector("#noteContainer"));
  pushRoot(document.querySelector(".note-detail"));
  pushRoot(document.querySelector('[class*="note-detail"]'));

  function pickMainSwiperWrapper(root) {
    let best = null;
    let bestN = 0;
    for (const wrap of root.querySelectorAll(".swiper-wrapper")) {
      const n = wrap.querySelectorAll(
        ".swiper-slide:not(.swiper-slide-duplicate)"
      ).length;
      if (n > bestN) {
        bestN = n;
        best = wrap;
      }
    }
    return best;
  }

  for (const root of noteRoots) {
    const wrap = pickMainSwiperWrapper(root);
    if (!wrap) continue;
    let slides = wrap.querySelectorAll(
      ":scope > .swiper-slide:not(.swiper-slide-duplicate)"
    );
    if (slides.length === 0) {
      slides = wrap.querySelectorAll(
        ".swiper-slide:not(.swiper-slide-duplicate)"
      );
    }
    for (const slide of slides) {
      const imgs = slide.querySelectorAll("img");
      for (const img of imgs) {
        if (tryPushImage(img)) break;
      }
    }
  }

  const imgSelectors = [
    "#noteContainer img",
    ".swiper-slide img",
    ".note-content img",
    "#detail-desc img",
    "article img",
  ];
  for (const sel of imgSelectors) {
    for (const img of document.querySelectorAll(sel)) {
      tryPushImage(img);
    }
  }

  /** 与「F12 搜 mp4」同类：依赖用户先播放过视频，资源才会出现在 Performance 里 */
  const videoUrls = collectLikelyMp4Urls();

  const pageUrl = location.href;
  const authorNickname = scrapeAuthorNickname();
  const noteIdForType = extractNoteIdFromUrl();
  const publishDateYmd = scrapeXhsPublishDateYmd();
  const xhsPostType = inferXhsPostType(noteIdForType, videoUrls);
  return {
    title,
    body,
    imageUrls,
    videoUrls,
    pageUrl,
    authorNickname,
    publishDateYmd,
    xhsPostType,
  };
}

/** 同一支视频常出现多条 URL（仅 query 不同，或 performance 与 video 元素各一条），按路径去重 */
function mp4CanonicalKey(url) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`.toLowerCase();
  } catch {
    return url;
  }
}

/** 从 Performance 资源列表里找 .mp4（网页版播放后常见） */
function collectPerformanceMp4Urls() {
  const out = [];
  const seen = new Set();
  try {
    const entries = performance.getEntriesByType("resource");
    for (const e of entries) {
      const name = e.name || "";
      if (!/\.mp4(\?|#|$)/i.test(name)) continue;
      if (!/^https?:\/\//i.test(name)) continue;
      const key = mp4CanonicalKey(name);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** video 标签上的直链（少数页面有） */
function collectVideoElementMp4Urls() {
  const out = [];
  const seen = new Set();
  for (const v of document.querySelectorAll("video")) {
    const src =
      v.currentSrc ||
      v.getAttribute("src") ||
      v.querySelector("source[src]")?.getAttribute("src");
    if (!src || !/^https?:\/\//i.test(src)) continue;
    if (!/\.mp4(\?|#|$)/i.test(src)) continue;
    const key = mp4CanonicalKey(src);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(src);
  }
  return out;
}

function collectLikelyMp4Urls() {
  const byKey = new Map();
  // 先收 video 元素：一般是当前可播地址，fetch 时更稳；再补 performance 里同路径尚未收录的
  for (const u of collectVideoElementMp4Urls()) {
    const key = mp4CanonicalKey(u);
    if (!byKey.has(key)) byKey.set(key, u);
  }
  for (const u of collectPerformanceMp4Urls()) {
    const key = mp4CanonicalKey(u);
    if (!byKey.has(key)) byKey.set(key, u);
  }
  return Array.from(byKey.values());
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "SCRAPE") {
    try {
      sendResponse({ ok: true, data: scrapeNotePage() });
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
    return true;
  }
  return false;
});
