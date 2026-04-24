import type { CSSProperties, ReactNode } from "react";
import { RailIcon, type RailIconKey } from "./RailIcon";
import { CollectionIconGlyph } from "./CollectionIconGlyph";
import { toContrastyGlyphColor } from "../sidebarDotColor";
import type { RailKey } from "./SidebarRail";
import type { Collection, NoteCard } from "../types";
import { plainTextFromNoteHtml } from "../notePlainText";
import {
  DiceIcon,
  HeroStickerStack,
  SelectionHandleFrame,
  SparkleIcon,
  SprinkleCluster,
} from "./OverviewDecor";
import {
  OverviewMusicPlayer,
  type OverviewMusicTrack,
} from "./OverviewMusicPlayer";
import {
  OverviewPhotoAlbum,
  type OverviewPhotoItem,
} from "./OverviewPhotoAlbum";
import "./OverviewDashboard.css";

export type OverviewPill = {
  key: string;
  label: string;
  /** true 时用热粉色强调（逾期 / 关键告警） */
  hot?: boolean;
};

export type OverviewTypeWidget = {
  /** widget 唯一 key（预设 baseId 或合集 id，用于 React key + 去重） */
  key: string;
  /** 点 widget 整卡跳的 rail；自定义合集走 "notes" + collectionId */
  railKey: RailKey;
  /** 若带合集 id：点击直接打开该合集（自定义合集 widget 用） */
  collectionId?: string;
  label: string;
  /** 预设 widget 用 rail 图标；自定义合集 widget 用 collectionIcon 代替 */
  icon?: RailIconKey;
  collectionIcon?: {
    shape: Collection["iconShape"];
    dotColor: string;
  };
  color: string;
  /** null 表示该类型未启用（无预设 / 无数据） */
  mainCount: number | null;
  /** 副行胶囊，可空数组 */
  pills: OverviewPill[];
  /** 最近 2 条卡片（标题/预览 + 跳转目标） */
  recentCards: Array<{
    id: string;
    collectionId: string;
    title: string;
  }>;
};

export type OverviewReminderItem = {
  card: NoteCard;
  col: Collection;
  /** 时间显示：`HH:mm` 或 `逾期 N 天` */
  timeLabel: string;
  /** 是否逾期（用于红色胶囊） */
  overdue?: boolean;
};

/** Hero 右侧「随手一翻」：随机挑一张笔记卡的预览 */
export type OverviewRandomCard = {
  card: NoteCard;
  col: Collection;
  /** 去 HTML 后的正文片段（~120 字） */
  snippet: string;
  /** 显示日期（YMD 或 "今天" / "昨天" 等） */
  dateLabel: string;
};

export type OverviewDashboardProps = {
  todayLabel: string;
  weekNewCount: number;
  typeWidgets: OverviewTypeWidget[];
  todayCalendar: OverviewReminderItem[];
  upcomingReminders: OverviewReminderItem[];
  /** 收藏合集已作为自定义 widget 放在类型汇总区；这里保留 prop 供右列未来扩展用，当前不再渲染 */
  recentCollections: Collection[];
  /** Hero 右侧当前抽到的随机笔记；库里一张笔记都没有时为 null */
  randomCard: OverviewRandomCard | null;
  /** 当前登录用户昵称；未登录本地模式下传空串 */
  userNickname: string;
  /** 音乐播放器候选轨（仅带封面的音频附件）；空数组则显示空态 */
  audioTracks: OverviewMusicTrack[];
  /** 相册候选图片附件；空数组则显示空态 */
  photos: OverviewPhotoItem[];
  onPick: (key: RailKey, opts?: { collectionId?: string }) => void;
  onOpenCard: (colId: string, cardId: string) => void;
  /** 点"换一条"：重新随机抽 */
  onRerollRandom: () => void;
  i18n: {
    brandTop: string;
    brandTopSub: string;
    heroWeekNew: (n: number) => string;
    heroGreeting: string;
    randomKicker: string;
    randomOpen: string;
    randomReroll: string;
    randomEmpty: string;
    musicKicker: string;
    musicNoTracks: string;
    musicPrev: string;
    musicNext: string;
    musicPlay: string;
    musicPause: string;
    musicShuffle: string;
    photoKicker: string;
    photoEmpty: string;
    photoReroll: string;
    photoPlay: string;
    photoPause: string;
    sectionTypes: string;
    sectionNotifications: string;
    sectionTodayCalendar: string;
    sectionUpcoming: string;
    sectionRecent: string;
    viewAll: string;
    emptyRecent: string;
    emptyNotifications: string;
    emptyWidgetCards: string;
  };
};

export function OverviewDashboard(props: OverviewDashboardProps): ReactNode {
  const {
    todayLabel,
    weekNewCount,
    typeWidgets,
    todayCalendar,
    upcomingReminders,
    recentCollections,
    randomCard,
    userNickname,
    audioTracks,
    photos,
    onPick,
    onOpenCard,
    onRerollRandom,
    i18n,
  } = props;

  return (
    <div className="overview-dashboard">
      <div className="overview-dashboard__bg" aria-hidden />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header className="overview-dashboard__hero">
        <div className="overview-dashboard__brand-strip">
          <div className="overview-dashboard__brand-left">
            <span className="overview-dashboard__brand-kicker">
              {i18n.brandTop}
            </span>
            <span className="overview-dashboard__pill overview-dashboard__pill--hot">
              {i18n.heroWeekNew(weekNewCount)}
            </span>
          </div>
          <span className="overview-dashboard__brand-today">{todayLabel}</span>
        </div>

        <div className="overview-dashboard__hero-body">
          <div className="overview-dashboard__hero-stage">
            <HeroStickerStack
              className="overview-dashboard__sticker-stack"
              nickname={userNickname}
              greetingKicker={i18n.heroGreeting}
            />
            <SprinkleCluster className="overview-dashboard__sprinkle" />
            <SelectionHandleFrame
              style={{
                top: "12%",
                right: "6%",
                width: 92,
                height: 60,
              }}
            />
            <span className="overview-dashboard__design-pill">design</span>
          </div>

          <RandomNotePanel
            randomCard={randomCard}
            onOpenCard={onOpenCard}
            onPick={onPick}
            onRerollRandom={onRerollRandom}
            i18n={{
              kicker: i18n.randomKicker,
              open: i18n.randomOpen,
              reroll: i18n.randomReroll,
              empty: i18n.randomEmpty,
            }}
          />
        </div>
      </header>

      <div className="overview-dashboard__grid">
        {/* ── Left: Notifications + Type widgets ──────────────────────────── */}
        <section className="overview-dashboard__types">
          <div className="overview-dashboard__card overview-dashboard__card--notif overview-dashboard__card--notif-wide">
            <SparkleIcon
              size={16}
              color="#FECF6A"
              className="overview-dashboard__card-corner-star"
            />
            <h2 className="overview-dashboard__section-title overview-dashboard__section-title--onCard">
              {i18n.sectionNotifications}
            </h2>
            {/** 宽屏下今日 / 待办并排两列，窄屏回归单列 */}
            <div className="overview-dashboard__notif-columns">
              <div className="overview-dashboard__notif-block">
                <div className="overview-dashboard__notif-heading">
                  {i18n.sectionTodayCalendar}
                </div>
                {todayCalendar.length === 0 ? (
                  <div className="overview-dashboard__notif-empty">
                    {i18n.emptyNotifications}
                  </div>
                ) : (
                  <ul className="overview-dashboard__notif-list">
                    {todayCalendar.map((r) => (
                      <li key={r.card.id}>
                        <button
                          type="button"
                          className="overview-dashboard__notif-row"
                          onClick={() => onOpenCard(r.col.id, r.card.id)}
                        >
                          <span
                            className={
                              "overview-dashboard__pill overview-dashboard__pill--time" +
                              (r.overdue
                                ? " overview-dashboard__pill--hot"
                                : "")
                            }
                          >
                            {r.timeLabel}
                          </span>
                          <span className="overview-dashboard__notif-title">
                            {extractCardTitle(r.card)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="overview-dashboard__notif-block">
                <div className="overview-dashboard__notif-heading">
                  {i18n.sectionUpcoming}
                </div>
                {upcomingReminders.length === 0 ? (
                  <div className="overview-dashboard__notif-empty">
                    {i18n.emptyNotifications}
                  </div>
                ) : (
                  <ul className="overview-dashboard__notif-list">
                    {upcomingReminders.map((r) => (
                      <li key={r.card.id}>
                        <button
                          type="button"
                          className="overview-dashboard__notif-row"
                          onClick={() => onOpenCard(r.col.id, r.card.id)}
                        >
                          <span
                            className={
                              "overview-dashboard__pill overview-dashboard__pill--time" +
                              (r.overdue
                                ? " overview-dashboard__pill--hot"
                                : "")
                            }
                          >
                            {r.timeLabel}
                          </span>
                          <span className="overview-dashboard__notif-title">
                            {extractCardTitle(r.card)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <OverviewPhotoAlbum
            photos={photos}
            onOpenCard={onOpenCard}
            i18n={{
              kicker: i18n.photoKicker,
              empty: i18n.photoEmpty,
              reroll: i18n.photoReroll,
              play: i18n.photoPlay,
              pause: i18n.photoPause,
            }}
          />

          <h2 className="overview-dashboard__section-title">
            {i18n.sectionTypes}
          </h2>
          <div className="overview-dashboard__types-grid">
            {typeWidgets.map((w) => (
              <TypeWidgetCard
                key={w.key}
                widget={w}
                onPick={onPick}
                onOpenCard={onOpenCard}
                viewAllLabel={i18n.viewAll}
                emptyLabel={i18n.emptyWidgetCards}
              />
            ))}
          </div>
        </section>

        {/* ── Right column: music + favorites + recents ──────────────────── */}
        <aside className="overview-dashboard__aside">
          <OverviewMusicPlayer
            tracks={audioTracks}
            i18n={{
              kicker: i18n.musicKicker,
              noTracks: i18n.musicNoTracks,
              prev: i18n.musicPrev,
              next: i18n.musicNext,
              play: i18n.musicPlay,
              pause: i18n.musicPause,
              shuffle: i18n.musicShuffle,
            }}
          />
          <div className="overview-dashboard__card overview-dashboard__card--stack">
            <h2 className="overview-dashboard__section-title overview-dashboard__section-title--onCard">
              {i18n.sectionRecent}
            </h2>
            {recentCollections.length === 0 ? (
              <div className="overview-dashboard__notif-empty">
                {i18n.emptyRecent}
              </div>
            ) : (
              <div className="overview-dashboard__stickers">
                {recentCollections.slice(0, 8).map((col, i) => (
                  <StickerChip
                    key={col.id}
                    col={col}
                    index={i}
                    onPick={onPick}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Hero 右侧：随手一翻笔记预览卡 + 打开 / 换一条按钮 */
function RandomNotePanel({
  randomCard,
  onOpenCard,
  onPick,
  onRerollRandom,
  i18n,
}: {
  randomCard: OverviewRandomCard | null;
  onOpenCard: OverviewDashboardProps["onOpenCard"];
  onPick: OverviewDashboardProps["onPick"];
  onRerollRandom: () => void;
  i18n: { kicker: string; open: string; reroll: string; empty: string };
}): ReactNode {
  return (
    <div className="overview-dashboard__random">
      <div className="overview-dashboard__random-kicker">{i18n.kicker}</div>
      {!randomCard ? (
        <div className="overview-dashboard__random-empty">{i18n.empty}</div>
      ) : (
        <>
          <button
            type="button"
            className="overview-dashboard__random-meta"
            onClick={() =>
              onPick("notes", { collectionId: randomCard.col.id })
            }
            title={randomCard.col.name}
          >
            <CollectionIconGlyph
              shape={randomCard.col.iconShape}
              color={toContrastyGlyphColor(randomCard.col.dotColor)}
              size={14}
            />
            <span className="overview-dashboard__random-meta-col">
              {randomCard.col.name}
            </span>
            <span className="overview-dashboard__random-meta-dot">·</span>
            <span className="overview-dashboard__random-meta-date">
              {randomCard.dateLabel}
            </span>
          </button>
          <p className="overview-dashboard__random-body">
            {randomCard.snippet || "（无内容）"}
          </p>
          <div className="overview-dashboard__random-actions">
            <button
              type="button"
              className="overview-dashboard__pill overview-dashboard__pill--hot overview-dashboard__random-open"
              onClick={() =>
                onOpenCard(randomCard.col.id, randomCard.card.id)
              }
            >
              {i18n.open} →
            </button>
            <button
              type="button"
              className="overview-dashboard__pill overview-dashboard__pill--ghost overview-dashboard__random-reroll"
              onClick={onRerollRandom}
            >
              <DiceIcon size={14} style={{ marginRight: 4 }} />
              {i18n.reroll}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function TypeWidgetCard({
  widget,
  onPick,
  onOpenCard,
  viewAllLabel,
  emptyLabel,
}: {
  widget: OverviewTypeWidget;
  onPick: OverviewDashboardProps["onPick"];
  onOpenCard: OverviewDashboardProps["onOpenCard"];
  viewAllLabel: string;
  emptyLabel: string;
}): ReactNode {
  const accent: CSSProperties = {
    ["--widget-accent" as string]: widget.color,
  };
  return (
    <button
      type="button"
      className="overview-dashboard__widget"
      style={accent}
      onClick={() =>
        widget.collectionId
          ? onPick(widget.railKey, { collectionId: widget.collectionId })
          : onPick(widget.railKey)
      }
    >
      <SparkleIcon
        size={14}
        color="#FECF6A"
        className="overview-dashboard__widget-star"
      />
      <div className="overview-dashboard__widget-head">
        <span
          className="overview-dashboard__widget-icon"
          style={{ background: hexToRgba(widget.color, 0.16) }}
        >
          {widget.icon ? (
            <RailIcon shape={widget.icon} size={20} color={widget.color} />
          ) : widget.collectionIcon ? (
            <CollectionIconGlyph
              shape={widget.collectionIcon.shape}
              color={toContrastyGlyphColor(widget.collectionIcon.dotColor)}
              size={18}
            />
          ) : null}
        </span>
        <span className="overview-dashboard__widget-label">
          {widget.label}
        </span>
      </div>
      <div className="overview-dashboard__widget-count">
        {widget.mainCount === null ? "—" : formatCount(widget.mainCount)}
      </div>
      {widget.pills.length > 0 ? (
        <div className="overview-dashboard__widget-pills">
          {widget.pills.map((p) => (
            <span
              key={p.key}
              className={
                "overview-dashboard__pill" +
                (p.hot ? " overview-dashboard__pill--hot" : "")
              }
            >
              {p.label}
            </span>
          ))}
        </div>
      ) : null}
      {widget.recentCards.length > 0 ? (
        <ul className="overview-dashboard__widget-recent">
          {widget.recentCards.slice(0, 2).map((rc) => (
            <li key={rc.id}>
              <span
                role="button"
                tabIndex={0}
                className="overview-dashboard__widget-recent-row"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCard(rc.collectionId, rc.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenCard(rc.collectionId, rc.id);
                  }
                }}
              >
                <span className="overview-dashboard__widget-recent-dot" />
                <span className="overview-dashboard__widget-recent-title">
                  {rc.title || "（无标题）"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : widget.mainCount !== null && widget.mainCount > 0 ? null : (
        <div className="overview-dashboard__widget-empty">{emptyLabel}</div>
      )}
      <div className="overview-dashboard__widget-cta">
        <span className="overview-dashboard__pill overview-dashboard__pill--ghost">
          {viewAllLabel}
        </span>
      </div>
    </button>
  );
}

function StickerChip({
  col,
  index,
  onPick,
}: {
  col: Collection;
  index: number;
  onPick: OverviewDashboardProps["onPick"];
}): ReactNode {
  /** 用 index 做稳定旋转 -3° ~ +3°，看起来像贴纸堆但不跳动 */
  const rot = (((index * 37) % 7) - 3) * 0.8;
  return (
    <button
      type="button"
      className="overview-dashboard__sticker-chip"
      style={{ transform: `rotate(${rot}deg)` }}
      onClick={() => onPick("notes", { collectionId: col.id })}
      title={col.name}
    >
      <SparkleIcon
        size={10}
        color="#FECF6A"
        className="overview-dashboard__sticker-chip-star"
      />
      <CollectionIconGlyph
        shape={col.iconShape}
        color={toContrastyGlyphColor(col.dotColor)}
        size={14}
      />
      <span className="overview-dashboard__sticker-chip-label">
        {col.name}
      </span>
    </button>
  );
}

/** 从 card.text 提取 ≤ 40 字的第一行纯文本，用于最近条目标题 */
function extractCardTitle(card: NoteCard): string {
  const raw = plainTextFromNoteHtml(String(card.text || ""));
  if (!raw) return "（无标题）";
  return raw.length > 40 ? raw.slice(0, 40) + "…" : raw;
}

function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, "") + "w";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function hexToRgba(hex: string, alpha: number): string {
  /** 支持 #RRGGBB；其它格式走透明 fallback 不影响布局 */
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(232, 120, 102, ${alpha})`;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
