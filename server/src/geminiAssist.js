/**
 * Google Gemini（服务端代理，密钥仅环境变量 GEMINI_API_KEY）。
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();

/**
 * REST 路径已是 …/v1beta/models/{MODEL_ID}:generateContent，这里只填模型 ID。
 * 常见误填：带 `models/` 前缀（会变成 …/models/models/…）、Vertex 全路径、中文或空格。
 */
function normalizeGeminiModelId(raw) {
  let s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return "gemini-2.0-flash";
  // publishers/google/models/gemini-xxx 或 …/models/gemini-xxx
  const tail = s.match(/\/models\/([^/]+)\s*$/);
  if (tail) s = tail[1];
  s = s.replace(/^models\//i, "").replace(/\s+/g, "");
  if (!/^gemini-[a-z0-9._-]+$/i.test(s)) {
    console.warn(
      `[geminiAssist] GEMINI_MODEL 无法解析为合法模型 ID，已退回 gemini-2.0-flash。收到：${JSON.stringify(
        raw
      )}`
    );
    return "gemini-2.0-flash";
  }
  return s;
}

const GEMINI_MODEL = normalizeGeminiModelId(process.env.GEMINI_MODEL);

const MAX_CARD_TEXT = 32000;
const MAX_TITLE = 500;
const MAX_CHAT = 8000;
const MAX_TAGS = 800;
const MAX_ATTACHMENTS_LINE = 4000;
const MAX_CARD_EXTRAS = 2000;
const MAX_RELATED_EACH = 12000;
const MAX_RELATED_TOTAL = 24000;
const MAX_IMAGE_B64_CHARS = 5 * 1024 * 1024;

/** 问 AI 侧栏：控制篇幅；用户要的是信息增量，不是代写长文 */
const MAX_CHAT_REPLY_CHARS = 1400;

/** 侧栏回答：信息为主，非作文 */
const ASSIST_PURPOSE_ZH =
  "用户目的是多获取信息：补充要点、小知识、背景、对比、可再查的方向或关键词，像便签与提要，不是请你代笔写文章。以信息密度为主，少用铺陈、少用抒情和冗长开头；优先短句、条目、分段，不要写成完整作文或演讲稿。";

/** 中文语气：自然、不官僚 */
const ASSIST_REPLY_TONE_ZH =
  "语气像随口说明：自然顺口即可。少用公文腔、少用「综上所述」「值得注意的是」；不必八股「首先其次最后」，除非分点真的更清晰。";

export function isGeminiConfigured() {
  return Boolean(GEMINI_API_KEY);
}

function truncate(s, n) {
  if (typeof s !== "string") return "";
  if (s.length <= n) return s;
  return s.slice(0, n) + "\n…";
}

/**
 * 侧栏展示为纯文本：去掉 Markdown 星号等，避免出现 ****、**加粗** 残字。
 */
function sanitizeAnswerPlainText(s) {
  if (typeof s !== "string") return "";
  return s.trim().replace(/\*{2,}/g, "");
}

/**
 * @param {{ maxOutputTokens?: number; temperature?: number }} [genOptions]
 */
async function generateWithContent(
  systemInstruction,
  userTextBlock,
  images,
  genOptions = {}
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    GEMINI_MODEL
  )}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const parts = [{ text: userTextBlock }];
  const list = Array.isArray(images) ? images : [];
  for (const img of list) {
    if (!img || typeof img !== "object") continue;
    const mimeType =
      typeof img.mimeType === "string" && img.mimeType.startsWith("image/")
      ? img.mimeType
      : "image/jpeg";
    const data =
      typeof img.dataBase64 === "string" ? img.dataBase64.trim() : "";
    if (!data || data.length > MAX_IMAGE_B64_CHARS) continue;
    const label = typeof img.label === "string" ? img.label.trim() : "";
    if (label) parts.push({ text: `\n${label}\n` });
    parts.push({
      inlineData: { mimeType, data },
    });
  }

  const maxOut =
    typeof genOptions.maxOutputTokens === "number"
      ? genOptions.maxOutputTokens
      : 4096;
  const temp =
    typeof genOptions.temperature === "number" ? genOptions.temperature : 0.65;

  const body = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: temp,
      maxOutputTokens: maxOut,
    },
  };

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const rawErr = await r.text();
  if (!r.ok) {
    const err = new Error(
      `Gemini 请求失败（${r.status}）：${rawErr.slice(0, 280)}`
    );
    err.code = "GEMINI_HTTP";
    throw err;
  }

  let data;
  try {
    data = JSON.parse(rawErr);
  } catch {
    const err = new Error("Gemini 返回非 JSON");
    err.code = "GEMINI_BAD_RESPONSE";
    throw err;
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";

  const block = data?.candidates?.[0]?.finishReason;
  if (!text?.trim() && block === "SAFETY") {
    const err = new Error("内容被安全策略拦截，请换一段笔记再试");
    err.code = "GEMINI_SAFETY";
    throw err;
  }

  return text;
}

function normalizeImagesPayload(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (out.length >= 16) break;
    if (!item || typeof item !== "object") continue;
    const mimeType =
      typeof item.mimeType === "string" ? item.mimeType : "image/jpeg";
    const dataBase64 =
      typeof item.dataBase64 === "string" ? item.dataBase64 : "";
    if (!dataBase64.trim()) continue;
    const label = typeof item.label === "string" ? item.label.slice(0, 240) : "";
    out.push({
      label,
      mimeType: mimeType.startsWith("image/") ? mimeType : "image/jpeg",
      dataBase64: dataBase64.trim(),
    });
  }
  return out;
}

/**
 * 延伸线索会作为用户发给下游 AI 的短主题（多查信息），不是 AI 反问用户；剔除面向读者的套话。
 */
function sanitizeExtensionSeedLine(s) {
  let t = typeof s === "string" ? s.trim() : "";
  if (!t) return t;
  const banned = [
    "你觉得",
    "你认为",
    "你怎么看",
    "你是否觉得",
    "你是否认为",
    "对你来说",
    "对你而言",
    "请问你",
    "你还能",
    "你有没有觉得",
    "有没有觉得",
  ];
  for (const ph of banned) {
    t = t.split(ph).join("");
  }
  t = t
    .replace(/^[，,、；;：:\s]+/, "")
    .replace(/[，,]{2,}/g, "，")
    .replace(/\s{2,}/g, " ")
    .trim();
  return t;
}

function parseQuestionsJson(raw) {
  let s = (raw || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  const j = JSON.parse(s);
  const arr = j?.questions;
  if (!Array.isArray(arr)) throw new Error("no questions array");
  const questions = arr
    .filter((x) => typeof x === "string")
    .map((x) => sanitizeExtensionSeedLine(x.trim()))
    .filter((x) => x.length > 0)
    .slice(0, 5);
  if (questions.length < 5) {
    while (questions.length < 5) questions.push("…");
  }
  return { questions };
}

function normalizeRelatedCards(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (out.length >= 32) break;
    if (!item || typeof item !== "object") continue;
    const collectionName =
      typeof item.collectionName === "string"
        ? item.collectionName.slice(0, 160)
        : "";
    const text =
      typeof item.text === "string"
        ? truncate(item.text, MAX_RELATED_EACH)
        : "";
    if (!collectionName.trim() && !text.trim()) continue;
    out.push({ collectionName, text });
  }
  return out;
}

/**
 * 主笔记 + 相关笔记（权重说明在文案中）；相关总长度封顶。
 */
function buildContextBlock({
  cardTitle,
  cardText,
  cardTags,
  cardAttachments,
  cardExtras,
  relatedCards,
}) {
  let main = `【当前笔记·优先依据】\n首行摘要：${
    cardTitle || "（无）"
  }\n\n【正文全文】\n${cardText || "（空）"}`;
  if (cardTags?.trim()) {
    main += `\n\n【标签】\n${cardTags}`;
  }
  if (cardAttachments?.trim()) {
    main += `\n\n【附件与媒体】\n${cardAttachments}`;
  }
  if (cardExtras?.trim()) {
    main += `\n\n【日历 / 提醒 / 其它元信息】\n${cardExtras}`;
  }

  if (!relatedCards?.length) return main;

  let rel =
    `\n\n════════\n【相关笔记·仅供参考、权重明显低于当前笔记】\n` +
    `下列卡片与当前笔记在应用中建立过「相关笔记」链接，仅作补充背景；与当前笔记冲突时以当前笔记为准；弱相关时勿强行混写。\n`;
  let used = 0;
  for (let i = 0; i < relatedCards.length; i++) {
    const r = relatedCards[i];
    const name = (r.collectionName || "未命名").trim() || "未命名";
    const body = (r.text || "").trim() || "（空）";
    const block = `\n--- 相关 ${i + 1} · 合集「${name}」---\n${body}\n`;
    if (used + block.length > MAX_RELATED_TOTAL) break;
    rel += block;
    used += block.length;
  }
  return main + rel;
}

function fallbackQuestionsFromLines(raw) {
  const lines = (raw || "")
    .split(/\n+/)
    .map((l) => l.replace(/^\d+[\.\)、]\s*/, "").replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
  const questions = [];
  for (const line of lines) {
    if (questions.length >= 5) break;
    if (line.length > 8) {
      const cleaned = sanitizeExtensionSeedLine(line);
      if (cleaned.length > 0) questions.push(cleaned);
    }
  }
  while (questions.length < 5) questions.push("…");
  return { questions: questions.slice(0, 5) };
}

/**
 * @param {object} payload
 * @param {'suggest_questions'|'quick_action'|'chat'} payload.task
 * @param {string} [payload.cardTitle]
 * @param {string} [payload.cardText]
 * @param {'dive'|'explain'|'simplify'|'example'} [payload.quickAction]
 * @param {string} [payload.message]
 */
export async function runNoteAssist(payload) {
  if (!GEMINI_API_KEY) {
    const err = new Error("GEMINI_NOT_CONFIGURED");
    err.code = "GEMINI_NOT_CONFIGURED";
    throw err;
  }

  const cardTitle = truncate(payload.cardTitle ?? "", MAX_TITLE);
  const cardText = truncate(payload.cardText ?? "", MAX_CARD_TEXT);
  const cardTags = truncate(payload.cardTags ?? "", MAX_TAGS);
  const cardAttachments = truncate(payload.cardAttachments ?? "", MAX_ATTACHMENTS_LINE);
  const cardExtras = truncate(payload.cardExtras ?? "", MAX_CARD_EXTRAS);
  const relatedCards = normalizeRelatedCards(payload.relatedCards);
  const images = normalizeImagesPayload(payload.images);
  const task = payload.task;
  const ctxBlock = buildContextBlock({
    cardTitle,
    cardText,
    cardTags,
    cardAttachments,
    cardExtras,
    relatedCards,
  });

  const weightHint =
    "上下文含「当前笔记」全文（优先）与若干「相关笔记」摘录（次要）。请主要围绕当前笔记作答；相关笔记仅作辅助联想。";
  const visionHint =
    images.length > 0
      ? " 若随附图片，请结合图片与文字理解；相关卡片所附图片权重低于当前笔记配图。"
      : "";

  if (task === "suggest_questions") {
    const sys =
      `${weightHint}${visionHint} 你是学习助手。用户在整理个人知识库：请根据「当前笔记」全文与上下文中的「相关笔记」摘录，生成 5 条「还可补充进来的知识或信息方向」——用来日后检索、整理成新卡片，把这一块记全；不是在向用户发问，也不是布置作文。

每一条都是用户即将发给下游 AI 的短主题（陈述式信息方向），便于 AI 输出可剪贴进笔记的要点。回复必须且仅为一个 JSON 对象，不要 Markdown 代码围栏，不要其它说明文字。键 questions 为长度恰好 5 的字符串数组（字段名仍为 questions 以兼容客户端）。

意图：从已有笔记与相似/相关笔记里，推断还有哪些维度、哪些事实或背景值得补进知识库（缺口感、相邻概念、上下游信息）；相关笔记只辅助联想与交叉，仍以当前笔记主题为锚。

人称与语气：无主句或短标题，像随手记的检索主题、清单名；读起来要像「人话」，不要像需求文档或论文目录。严禁出现：你觉得、你认为、你怎么看、你是否、对你来说、对你而言、请问你、你最喜欢 等面向读者的第二人称。条目标题不要用疑问句：避免以「吗」「呢」收尾，避免「如何理解 X？」「怎样看待 X？」这类发问句式——改成陈述式短句。

死板腔（必须避免）：少用或不用「核心…模块」「…优化策略」「…机制探讨」「…生态与扩展性」「用户体验…」等并列套话；不要把五条都写成同一种「XX软件 + 抽象名词」的公式。若笔记是想法/产品/工具类，不要默认输出「模块设计、策略、机制、安全、插件」这种流水线标题。

具体性：若笔记出现具体作品、人物、产品、软件名，优先直呼其名；若笔记只有宽泛主题（如想做某类软件），也要具体落到可补的信息类型，而不是空泛大类。

信息栏目（极重要）：影视类仍可用「作品名 + 演员/幕后/同类型推荐」式短句。产品/工具/效率/阅读/笔记类：优先实操与素材向——怎么做或从哪步入手、有哪些口碑好的产品或清单、真实案例或小团队故事、常见取舍与踩坑、参考学习资源；角度要岔开，像「做这类软件从哪几步开始」「国内外好用的效率与笔记软件举例」「小团队做笔记类产品的真实案例」这种，而不是五条全是抽象管理词汇。

主题优先，不写「作者心理」：只围绕笔记里的客观主题补知识，禁止分析写笔记的人的心理或付费动机。

开放 vs 考据：不要封闭式 trivia；工具类不要追问个人使用感受。

禁止：把笔记作者称作「用户」「笔者」；禁止问卷式排比。

每条约 8～40 字为宜，五条之间角度岔开。`;
    const user = `${ctxBlock}\n\n请写 5 条（中文），彼此角度不同。每条陈述「还能往知识库里补哪一类信息」，不要写成向用户提问；不要写分析读者情绪或付费心理的长 brief。

反例 A：通篇只写大类却不带笔记里的具体作品名、产品名或主题专名（若笔记本身很宽，可用「这类软件」但后面要跟具体补什么，不要只剩空话）。
反例 B：封闭式考据 trivia。
反例 C：「你觉得…？」「如何理解…？」类发问句。
反例 D：五条都像需求文档——例如「效率阅读笔记软件核心功能模块设计」「用户体验优化策略」「跨平台同步机制探讨」——太死板，要改成怎么做、好软件清单、真实案例等活人话。
反例 E：大段论文式题目。

正例·影视（风格参考，按笔记实际作品名替换）：放羊的星星演员介绍；放羊的星星幕后花絮；放羊的星星同类型剧推荐。
正例·宽泛主题·想做某类软件（笔记里没有具体产品名时）：做效率向笔记软件可从哪些步骤入手；国内外口碑较好的效率与笔记软件举例；小团队做阅读或笔记类产品的案例与取舍。

严格输出 JSON：{"questions":["…","…","…","…","…"]}`;
    const raw = await generateWithContent(sys, user, images, {
      maxOutputTokens: 2048,
    });
    try {
      return parseQuestionsJson(raw);
    } catch {
      return fallbackQuestionsFromLines(raw);
    }
  }

  if (task === "quick_action") {
    const qa = payload.quickAction;
    const map = {
      dive:
        "请「深入展开」：多给信息增量——概念延展、相关背景、可对比的点、能继续搜的关键词；短段或「-」列表，不要写成长篇论述。语言与笔记一致（中文笔记就用中文）。",
      explain:
        "请「解释说明」：用几句话把笔记里难懂的点讲清楚是什么、为什么，可打比方；目标是听懂，不是写一篇说明文。语言与笔记一致。",
      simplify:
        "请「简化表述」：只保留关键信息点，能短则短；条目列出即可，不要扩写成段落作文。语言与笔记一致。",
      example:
        "请「举例说明」：给一两个和主题贴切的例子或信息点（事实/场景即可），帮助理解；不要写范文或长篇案例故事。语言与笔记一致。",
    };
    const instr = map[qa];
    if (!instr) {
      const err = new Error("无效的 quickAction");
      err.code = "BAD_QUICK_ACTION";
      throw err;
    }
    const sys =
      `${weightHint}${visionHint} 你是笔记学习助手，只输出正文，不要开场白套话。${ASSIST_PURPOSE_ZH} ${ASSIST_REPLY_TONE_ZH} 总字数约 300～700 字为宜，以短段与「-」列表为主；不要用 # 标题、不要用星号加粗或 Markdown。`;
    const user = `${ctxBlock}\n\n${instr}`;
    const text = await generateWithContent(sys, user, images, {
      maxOutputTokens: 900,
    });
    const cleaned = sanitizeAnswerPlainText(text);
    return { text: truncate(cleaned, MAX_CHAT_REPLY_CHARS) };
  }

  if (task === "chat") {
    const message = truncate(payload.message ?? "", MAX_CHAT);
    if (!message.trim()) {
      const err = new Error("消息不能为空");
      err.code = "EMPTY_MESSAGE";
      throw err;
    }
    const sys =
      `${weightHint}${visionHint} 你是笔记学习助手。用户输入可能是具体问题，也可能是一条「延伸线索」。请补充与笔记相关的信息：要点、背景、对比、小知识、可进一步检索的方向；不要当成命题作文去扩写长文，不要重复整篇笔记，不要反问用户。${ASSIST_PURPOSE_ZH} ${ASSIST_REPLY_TONE_ZH} 总字数约 350～800 字为宜，条目与短段优先。语言与笔记一致时优先用中文。不要使用 Markdown（不要用星号加粗、不要用 # 标题）。`;
    const user = `${ctxBlock}\n\n【用户消息】\n${message}`;
    const text = await generateWithContent(sys, user, images, {
      maxOutputTokens: 900,
    });
    const cleaned = sanitizeAnswerPlainText(text);
    return { text: truncate(cleaned, MAX_CHAT_REPLY_CHARS) };
  }

  const err = new Error("无效任务");
  err.code = "BAD_TASK";
  throw err;
}
