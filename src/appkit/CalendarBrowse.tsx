import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { localDateString } from "./dateUtils";

/** 年月分栏输入；避免 type=month 受控时逐字改年会被浏览器解析成 1902 等错误值 */
export function CalendarYearMonthFields({
  calendarViewMonth,
  setCalendarViewMonth,
}: {
  calendarViewMonth: Date;
  setCalendarViewMonth: (d: Date) => void;
}) {
  const syncKey = `${calendarViewMonth.getFullYear()}-${calendarViewMonth.getMonth()}`;
  const [yearField, setYearField] = useState(() =>
    String(calendarViewMonth.getFullYear())
  );
  const [monthField, setMonthField] = useState(() =>
    String(calendarViewMonth.getMonth() + 1)
  );

  useEffect(() => {
    setYearField(String(calendarViewMonth.getFullYear()));
    setMonthField(String(calendarViewMonth.getMonth() + 1));
  }, [syncKey]);

  const commit = useCallback(() => {
    const cy = calendarViewMonth.getFullYear();
    const cm = calendarViewMonth.getMonth() + 1;
    let y = parseInt(yearField.replace(/\D/g, ""), 10);
    let mo = parseInt(monthField.replace(/\D/g, ""), 10);
    if (yearField.trim() === "" || !Number.isFinite(y) || y < 1000 || y > 9999) {
      y = cy;
      setYearField(String(y));
    }
    if (
      monthField.trim() === "" ||
      !Number.isFinite(mo) ||
      mo < 1 ||
      mo > 12
    ) {
      mo = cm;
      setMonthField(String(mo));
    }
    setCalendarViewMonth(new Date(y, mo - 1, 1));
  }, [yearField, monthField, calendarViewMonth, setCalendarViewMonth]);

  return (
    <div className="sidebar__cal-title-wrap sidebar__cal-ym-fields">
      <input
        type="text"
        className="sidebar__cal-year-field"
        aria-label="年（四位数字）"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={yearField}
        onChange={(e) => {
          setYearField(e.target.value.replace(/\D/g, "").slice(0, 4));
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      <span className="sidebar__cal-ym-sep" aria-hidden>
        年
      </span>
      <input
        type="text"
        className="sidebar__cal-month-field"
        aria-label="月（1–12）"
        inputMode="numeric"
        autoComplete="off"
        maxLength={2}
        value={monthField}
        onChange={(e) => {
          setMonthField(e.target.value.replace(/\D/g, "").slice(0, 2));
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      <span className="sidebar__cal-ym-sep" aria-hidden>
        月
      </span>
    </div>
  );
}

export type CalendarCellRow = (null | { day: number; dateStr: string })[];

export function CalendarBrowsePanel({
  calendarViewMonth,
  setCalendarViewMonth,
  calendarCells,
  calendarDay,
  datesWithNotesSet,
  datesWithRemindersSet,
  onDayClick,
}: {
  calendarViewMonth: Date;
  setCalendarViewMonth: (d: Date) => void;
  calendarCells: CalendarCellRow;
  calendarDay: string | null;
  /** 有笔记的日期 → 格内底部蓝点 */
  datesWithNotesSet: ReadonlySet<string>;
  /** 有提醒的日期 → 格内右上角角标 */
  datesWithRemindersSet: ReadonlySet<string>;
  onDayClick: (dateStr: string) => void;
}) {
  return (
    <>
      <div className="sidebar__cal-head">
        <button
          type="button"
          className="sidebar__cal-nav-btn"
          aria-label="上一月"
          onClick={() => {
            const d = new Date(calendarViewMonth);
            d.setMonth(d.getMonth() - 1);
            setCalendarViewMonth(
              new Date(d.getFullYear(), d.getMonth(), 1)
            );
          }}
        >
          ‹
        </button>
        <CalendarYearMonthFields
          calendarViewMonth={calendarViewMonth}
          setCalendarViewMonth={setCalendarViewMonth}
        />
        <button
          type="button"
          className="sidebar__cal-nav-btn"
          aria-label="下一月"
          onClick={() => {
            const d = new Date(calendarViewMonth);
            d.setMonth(d.getMonth() + 1);
            setCalendarViewMonth(
              new Date(d.getFullYear(), d.getMonth(), 1)
            );
          }}
        >
          ›
        </button>
      </div>
      <div className="sidebar__cal-weekdays" aria-hidden>
        {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
          <span key={w} className="sidebar__cal-wd">
            {w}
          </span>
        ))}
      </div>
      <div className="sidebar__cal-grid">
        {calendarCells.map((cell, i) =>
          cell ? (
            <button
              key={cell.dateStr}
              type="button"
              className={
                "sidebar__cal-day" +
                (cell.dateStr === calendarDay ? " is-selected" : "") +
                (cell.dateStr === localDateString() ? " is-today" : "") +
                (datesWithNotesSet.has(cell.dateStr) ? " has-notes" : "") +
                (datesWithRemindersSet.has(cell.dateStr)
                  ? " has-reminder"
                  : "")
              }
              onClick={() => onDayClick(cell.dateStr)}
            >
              {cell.day}
            </button>
          ) : (
            <span
              key={`pad-${i}`}
              className="sidebar__cal-day sidebar__cal-day--pad"
              aria-hidden
            />
          )
        )}
      </div>
    </>
  );
}
