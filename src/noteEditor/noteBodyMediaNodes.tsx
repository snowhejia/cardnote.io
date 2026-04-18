import Image from "@tiptap/extension-image";
import { mergeAttributes, Node } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import {
  MediaThumbLoadingOverlay,
  useMediaDisplaySrc,
} from "../mediaDisplay";

function NoteBodyImageView(props: NodeViewProps) {
  const raw = String(props.node.attrs.src ?? "").trim();
  const displaySrc = useMediaDisplaySrc(raw || undefined);
  const alt = String(props.node.attrs.alt ?? "");
  const title = props.node.attrs.title as string | null | undefined;
  return (
    <NodeViewWrapper as="span" className="note-body-img-nodeview">
      {!displaySrc ? (
        <span
          className="note-inline-img note-inline-img--pending"
          aria-busy="true"
        />
      ) : (
        <img
          src={displaySrc}
          alt={alt}
          title={title ?? undefined}
          className="note-inline-img"
          draggable={false}
        />
      )}
    </NodeViewWrapper>
  );
}

/** 正文图片：持久化仍用 attrs.src 存存储 URL，展示经 COS/本地 解析 */
export const NoteBodyImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(NoteBodyImageView, {
      as: "span",
      update: ({ oldNode, newNode }) =>
        oldNode.type === newNode.type &&
        oldNode.attrs.src === newNode.attrs.src &&
        oldNode.attrs.alt === newNode.attrs.alt &&
        oldNode.attrs.title === newNode.attrs.title,
    });
  },
}).configure({
  inline: true,
  allowBase64: true,
  HTMLAttributes: { class: "note-inline-img" },
});

function NoteBodyVideoView(props: NodeViewProps) {
  const raw = String(props.node.attrs.src ?? "").trim();
  const src = useMediaDisplaySrc(raw || undefined);
  const title = props.node.attrs.title as string | null | undefined;
  return (
    <NodeViewWrapper className="note-inline-video-wrap">
      {!src ? (
        <div className="note-inline-video-pending" aria-busy="true">
          <MediaThumbLoadingOverlay />
        </div>
      ) : (
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          className="note-inline-video"
          title={title ?? undefined}
        />
      )}
    </NodeViewWrapper>
  );
}

export type NoteBodyVideoOptions = {
  HTMLAttributes: Record<string, unknown>;
};

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

  addNodeView() {
    return ReactNodeViewRenderer(NoteBodyVideoView, {
      update: ({ oldNode, newNode }) =>
        oldNode.type === newNode.type &&
        oldNode.attrs.src === newNode.attrs.src &&
        oldNode.attrs.title === newNode.attrs.title,
    });
  },
});

function NoteBodyAudioView(props: NodeViewProps) {
  const raw = String(props.node.attrs.src ?? "").trim();
  const src = useMediaDisplaySrc(raw || undefined);
  const title = props.node.attrs.title as string | null | undefined;
  return (
    <NodeViewWrapper className="note-inline-audio-wrap">
      {!src ? (
        <div className="note-inline-audio-pending" aria-busy="true">
          <MediaThumbLoadingOverlay />
        </div>
      ) : (
        <audio
          src={src}
          controls
          preload="metadata"
          className="note-inline-audio"
          title={title ?? undefined}
        />
      )}
    </NodeViewWrapper>
  );
}

export type NoteBodyAudioOptions = {
  HTMLAttributes: Record<string, unknown>;
};

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

  addNodeView() {
    return ReactNodeViewRenderer(NoteBodyAudioView, {
      update: ({ oldNode, newNode }) =>
        oldNode.type === newNode.type &&
        oldNode.attrs.src === newNode.attrs.src &&
        oldNode.attrs.title === newNode.attrs.title,
    });
  },
});
