import type { ReactNode } from "react";
import { useAppUiLang } from "../appUiLang";
import {
  formatReminderScheduleDayTitle,
  formatReminderScheduleTime,
} from "../cardTimeLabel";
import { useAppChrome } from "../i18n/useAppChrome";
import { reminderTaskPrimaryLine } from "../reminderTaskLine";
import type { NoteCard } from "../types";
import type { ReminderListEntry } from "./collectionModel";

export function AllRemindersView({
  entries,
  onOpenCard,
  onCompleteTask,
  canEdit,
}: {
  entries: ReminderListEntry[];
  onOpenCard: (colId: string, card: NoteCard) => void;
  onCompleteTask?: (colId: string, cardId: string) => void;
  canEdit: boolean;
}) {
  const c = useAppChrome();
  const { lang } = useAppUiLang();
  const showCheck = canEdit && typeof onCompleteTask === "function";

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
        className="all-reminders-page__task-section"
        aria-label={`${c.reminderAriaPrefix} ${formatReminderScheduleDayTitle(date, lang)}`}
      >
        <h2 className="timeline__pin-heading all-reminders-page__task-heading">
          {formatReminderScheduleDayTitle(date, lang)}
        </h2>
        <ul className="task-list" role="list">
          {group.map((ent) => (
            <li key={`${ent.col.id}-${ent.card.id}`} className="task-list__item">
              <div className="task-list__card">
                {showCheck ? (
                  <input
                    type="checkbox"
                    className="task-list__check"
                    aria-label={c.taskListCompleteAria}
                    title={c.taskListCompleteAria}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onCompleteTask!(ent.col.id, ent.card.id);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : null}
                <button
                  type="button"
                  className="task-list__row"
                  onClick={() => onOpenCard(ent.col.id, ent.card)}
                >
                  <span className="task-list__title">
                    {reminderTaskPrimaryLine(ent.card, c.taskListUntitled)}
                  </span>
                  <span className="task-list__meta">
                    <span className="task-list__time">
                      {formatReminderScheduleTime(ent.card)}
                    </span>
                    <span className="task-list__meta-sep" aria-hidden>
                      {" · "}
                    </span>
                    <span className="task-list__col-name">{ent.col.name}</span>
                  </span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div className="all-reminders-page">
      <p className="all-reminders-page__intro">{c.allRemFooter(entries.length)}</p>
      {sections}
    </div>
  );
}
