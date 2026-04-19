/** 笔记设置「对象类型」预设展示（Capacities 式栅格）；后续可与 schema / 合集绑定 */
export type PresetObjectTypeItem = {
  id: string;
  nameZh: string;
  nameEn: string;
  emoji: string;
  /** 图标背后浅底色 */
  tint: string;
};

export const PRESET_OBJECT_TYPES_MAIN: PresetObjectTypeItem[] = [
  { id: "note", nameZh: "笔记", nameEn: "Note", emoji: "📝", tint: "rgba(91, 141, 239, 0.18)" },
  { id: "book", nameZh: "书籍", nameEn: "Books", emoji: "📚", tint: "rgba(139, 92, 246, 0.16)" },
  { id: "quote", nameZh: "摘录", nameEn: "Quote", emoji: "❝", tint: "rgba(239, 68, 68, 0.14)" },
  { id: "account", nameZh: "账户", nameEn: "Account", emoji: "👤", tint: "rgba(59, 130, 246, 0.16)" },
  { id: "organization", nameZh: "组织", nameEn: "Organization", emoji: "🏢", tint: "rgba(249, 115, 22, 0.14)" },
  { id: "definition", nameZh: "定义", nameEn: "Definition", emoji: "📖", tint: "rgba(180, 83, 9, 0.14)" },
  { id: "people", nameZh: "人物", nameEn: "People", emoji: "🧑", tint: "rgba(249, 115, 22, 0.16)" },
  { id: "tag", nameZh: "标签", nameEn: "Tags", emoji: "🏷", tint: "rgba(34, 197, 94, 0.14)" },
];

export const PRESET_OBJECT_TYPES_BASIC: PresetObjectTypeItem[] = [
  { id: "pdf", nameZh: "PDF", nameEn: "PDF", emoji: "📄", tint: "rgba(55, 53, 47, 0.08)" },
  { id: "file", nameZh: "文件", nameEn: "Files", emoji: "📎", tint: "rgba(55, 53, 47, 0.08)" },
  { id: "image", nameZh: "图片", nameEn: "Image", emoji: "🖼", tint: "rgba(236, 72, 153, 0.12)" },
  { id: "daily", nameZh: "每日笔记", nameEn: "Daily Note", emoji: "📅", tint: "rgba(14, 165, 233, 0.14)" },
  { id: "weblink", nameZh: "网页", nameEn: "Weblink", emoji: "🔗", tint: "rgba(37, 99, 235, 0.12)" },
];
