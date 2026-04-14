import type { LoginUiLang } from "../auth/loginUiI18n";
import { useAppUiLang } from "../appUiLang";
import { useAppChrome } from "../i18n/useAppChrome";
import type { NoteCard } from "../types";
import { reminderCompletionDisplayLine } from "../reminderTaskLine";
import type { ReminderCompletionEntry } from "./collectionModel";

function formatCompletedAt(iso: string, lang: LoginUiLang): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const opts: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    const y = d.getFullYear();
    const yNow = new Date().getFullYear();
    if (y !== yNow) opts.year = "numeric";
    return d.toLocaleString(lang === "en" ? "en-US" : "zh-CN", opts);
  } catch {
    return iso;
  }
}

export function ReminderCompletionTimeline({
  entries,
  onOpenCard,
}: {
  entries: ReminderCompletionEntry[];
  onOpenCard: (colId: string, card: NoteCard) => void;
}) {
  const c = useAppChrome();
  const { lang } = useAppUiLang();

  if (entries.length === 0) {
    return (
      <div className="reminder-completion reminder-completion--empty">
        <h2 className="reminder-completion__title">{c.completionTimelineTitle}</h2>
        <p className="reminder-completion__empty">{c.completionTimelineEmpty}</p>
      </div>
    );
  }

  return (
    <div className="reminder-completion">
      <h2 className="reminder-completion__title">{c.completionTimelineTitle}</h2>
      <ol className="reminder-completion__list" aria-label={c.completionTimelineAria}>
        {entries.map(({ col, card, completedAt }) => (
          <li key={`${col.id}-${card.id}-done`} className="reminder-completion__item">
            <div className="reminder-completion__rail" aria-hidden>
              <span className="reminder-completion__dot" />
            </div>
            <button
              type="button"
              className="reminder-completion__row"
              onClick={() => onOpenCard(col.id, card)}
            >
              <span className="reminder-completion__time" title={completedAt}>
                {formatCompletedAt(completedAt, lang)}
              </span>
              <span className="reminder-completion__label">
                {reminderCompletionDisplayLine(card, c.taskListUntitled)}
              </span>
              <span className="reminder-completion__col">{col.name}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
