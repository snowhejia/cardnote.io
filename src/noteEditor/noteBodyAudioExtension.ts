import { mergeAttributes, Node } from "@tiptap/core";

export type NoteBodyAudioOptions = {
  HTMLAttributes: Record<string, unknown>;
};

/** 正文内嵌 HTML5 音频（附件拖入等），序列化为带 controls 的 audio 标签 */
export const NoteBodyAudio = Node.create<NoteBodyAudioOptions>({
  name: "noteBodyAudio",

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
        tag: "audio",
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
      "audio",
      mergeAttributes(
        {
          controls: true,
          preload: "metadata",
          class: "note-inline-audio",
        },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
    ];
  },
});
