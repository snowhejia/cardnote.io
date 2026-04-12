import type { ReactNode } from "react";
import { useAppUiLang } from "../appUiLang";
import { formatReminderDateLabel } from "../cardTimeLabel";
import { useAppChrome } from "../i18n/useAppChrome";
import type { NoteCard } from "../types";
import type { ReminderListEntry } from "./collectionModel";
import { MasonryShortestColumns } from "./MasonryShortestColumns";

export function AllRemindersView({
  entries,
  renderCard,
  columnCount = 1,
}: {
  entries: ReminderListEntry[];
  renderCard: (colId: string, card: NoteCard) => ReactNode;
  columnCount?: 1 | 2 | 3 | 4 | 5 | 6;
}) {
  const c = useAppChrome();
  const { lang } = useAppUiLang();

  if (entries.length === 0) {
    return (
      <div className="timeline__empty all-reminders-page__empty">
        {c.allRemEmpty}
      </div>
    );
  }

  const sections: ReactNode[] = [];
  for (let i = 0; i < entries.length; ) {
    const date = entries[i].reminderOn;
    const group: ReminderListEntry[] = [];
    while (i < entries.length && entries[i].reminderOn === date) {
      group.push(entries[i]);
      i++;
    }
    sections.push(
      <section
        key={date}
        className="timeline__pin-section timeline__reminder-section"
        aria-label={`${c.reminderAriaPrefix} ${formatReminderDateLabel(date, lang)}`}
      >
        <h2 className="timeline__pin-heading">
          {formatReminderDateLabel(date, lang)}
        </h2>
        <MasonryShortestColumns columnCount={columnCount}>
          {group.map((ent) => renderCard(ent.col.id, ent.card))}
        </MasonryShortestColumns>
      </section>
    );
  }

  return (
    <div className="all-reminders-page">
      <p className="all-reminders-page__intro">
        {c.allRemFooter(entries.length)}
      </p>
      {sections}
    </div>
  );
}
