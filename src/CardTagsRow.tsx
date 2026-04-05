import { useEffect, useState } from "react";
import type { NoteCard } from "./types";

export function formatTagsForInput(tags: string[] | undefined): string {
  return (tags ?? []).join("，");
}

export function parseTagsFromInput(raw: string): string[] {
  return raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function CardTagsRow({
  colId,
  card,
  canEdit,
  onCommit,
}: {
  colId: string;
  card: NoteCard;
  canEdit: boolean;
  onCommit: (colId: string, cardId: string, tags: string[]) => void;
}) {
  const tags = card.tags ?? [];
  const tagsKey = tags.join("\u0001");
  const [draft, setDraft] = useState(() => formatTagsForInput(tags));

  useEffect(() => {
    setDraft(formatTagsForInput(tags));
  }, [card.id, tagsKey]);

  return (
    <div className="card__tags-row">
      <span className="card__tags-label">标签：</span>
      {canEdit ? (
        <input
          type="text"
          className="card__tags-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onCommit(colId, card.id, parseTagsFromInput(draft))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label="标签"
        />
      ) : (
        <span className="card__tags-view">{formatTagsForInput(tags)}</span>
      )}
    </div>
  );
}
