/** 与 favicon 一致的未来罐，手机底栏「新建小笔记」用 */
export function MobileDockJarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="34"
      height="34"
      viewBox="0 0 32 32"
      aria-hidden
    >
      <rect
        x="9"
        y="7"
        width="14"
        height="5"
        rx="2.5"
        fill="var(--mikujar-logo-lid)"
      />
      <rect
        x="12"
        y="11"
        width="8"
        height="5"
        rx="1"
        fill="var(--mikujar-logo-jar)"
      />
      <rect
        x="10"
        y="15"
        width="12"
        height="11"
        rx="2"
        fill="var(--mikujar-logo-jar)"
      />
      <circle cx="13" cy="18.5" r="1.25" fill="#fff" opacity="0.5" />
      <circle cx="16" cy="21.8" r="0.9" fill="#fff" opacity="0.38" />
    </svg>
  );
}

/** 合集排序拖动手柄（三杠），与顶栏示意图标共用 */
export function CollectionDragGripIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M8 6h10M8 12h10M8 18h10" />
    </svg>
  );
}

/** 圆角星形（描边 / 填充），主栏标题与侧栏收藏共用 */
export function CollectionStarIcon({
  filled,
  className,
}: {
  filled: boolean;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        d="M12 2.25 15.09 8.51 22 9.52 17 14.39 18.18 21.25 12 18.02 5.82 21.25 7 14.39 2 9.52 8.91 8.51 12 2.25z"
        fill={filled ? "currentColor" : "none"}
        stroke={filled ? "none" : "currentColor"}
        strokeWidth={filled ? 0 : 1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 未登录 / 恢复会话时：与浏览器标签页一致的软件图标 */
export function SidebarWorkspaceAppMark() {
  return (
    <img
      src={`${import.meta.env.BASE_URL}favicon.svg`}
      alt=""
      className="sidebar__workspace-app-icon"
      aria-hidden
    />
  );
}

/** 侧栏管理：登录=锁，已登录=退出箭头 */
export function AdminHeaderIcon({ mode }: { mode: "login" | "logout" }) {
  const cls = "sidebar__admin-icon-svg";
  if (mode === "login") {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="5" y="11" width="14" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    );
  }
  return (
    <svg
      className={cls}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/** 时间线单列 = 列表视图（顶栏切换用） */
export function IconTimelineMasonry1Col({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="15" y2="17" />
    </svg>
  );
}

/** 时间线双列 = 瀑布流（顶栏切换用，错落块示意） */
export function IconTimelineMasonry2Col({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="8" height="6" rx="1.25" />
      <rect x="13" y="4" width="8" height="9" rx="1.25" />
      <rect x="3" y="13" width="8" height="7" rx="1.25" />
      <rect x="13" y="15" width="8" height="5" rx="1.25" />
    </svg>
  );
}

/** 侧栏「全部笔记」：列表（时间线流），与垃圾桶行同 18px 描边风格 */
export function SidebarNavAllNotesIcon({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="5.5" cy="6" r="1.5" />
      <circle cx="5.5" cy="12" r="1.5" />
      <circle cx="5.5" cy="18" r="1.5" />
      <line x1="10" y1="6" x2="20" y2="6" />
      <line x1="10" y1="12" x2="20" y2="12" />
      <line x1="10" y1="18" x2="18" y2="18" />
    </svg>
  );
}

/** 侧栏「我的待办」 */
export function SidebarNavRemindersIcon({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a2 2 0 0 0 3.4 0" />
    </svg>
  );
}

/** 侧栏「笔记探索」：节点连线 */
export function SidebarNavExploreIcon({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

/** 侧栏「所有附件」：回形针 */
export function SidebarNavAttachmentsIcon({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21.44 11.05 12.25 20.24a5.47 5.47 0 0 1-7.75-7.75l9.19-9.19a3.65 3.65 0 0 1 5.16 5.16l-8.49 8.49a2.43 2.43 0 0 1-3.44-3.44l7.78-7.78" />
    </svg>
  );
}
