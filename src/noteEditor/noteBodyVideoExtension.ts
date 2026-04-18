import { mergeAttributes, Node } from "@tiptap/core";

export type NoteBodyVideoOptions = {
  HTMLAttributes: Record<string, unknown>;
};

/** 正文内嵌 HTML5 视频（附件拖入等），序列化为带 controls 的 video 标签 */
export const NoteBodyVideo = Node.create<NoteBodyVideoOptions>({
  name: "noteBodyVideo",

  group: "block",

  atom: true,

  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      src: { default: null as string | null },
      title: { default: null as string | null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "video",
        getAttrs: (element) => {
          const el = element as HTMLElement;
          const src =
            el.getAttribute("src")?.trim() ||
            el.querySelector("source")?.getAttribute("src")?.trim();
          if (!src) return false;
          return {
            src,
            title: el.getAttribute("title"),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      mergeAttributes(
        {
          controls: true,
          playsInline: true,
          preload: "metadata",
          class: "note-inline-video",
        },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
    ];
  },
});
