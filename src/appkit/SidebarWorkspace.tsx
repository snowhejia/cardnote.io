import type { ReactNode, Ref } from "react";
import type { AuthUser } from "../api/auth";
import { useMediaDisplaySrc } from "../mediaDisplay";
import type { AppDataMode } from "../appDataModeStorage";
import { getAdminToken } from "../auth/token";
import { useAppChrome } from "../i18n/useAppChrome";
import { SidebarWorkspaceAppMark } from "./AppIcons";

/** 头像旁下拉：个人中心、笔记设置、数据统计（具体项在弹窗内） */
export function UserAccountMenuDropdown({
  dataMode,
  profileBusy,
  onOpenProfile,
  onOpenNoteSettings,
  onOpenDataStats,
}: {
  dataMode: AppDataMode;
  profileBusy: boolean;
  onOpenProfile: () => void;
  onOpenNoteSettings: () => void;
  onOpenDataStats: () => void;
}) {
  const c = useAppChrome();
  return (
    <div className="sidebar__user-menu-dropdown" role="menu">
      <button
        type="button"
        className="sidebar__user-menu-item"
        role="menuitem"
        disabled={dataMode !== "remote" || profileBusy}
        title={
          dataMode !== "remote" ? c.profileRemoteOnly : undefined
        }
        onClick={() => {
          onOpenProfile();
        }}
      >
        {c.menuProfile}
      </button>
      <button
        type="button"
        className="sidebar__user-menu-item"
        role="menuitem"
        onClick={() => {
          onOpenNoteSettings();
        }}
      >
        {c.menuNoteSettings}
      </button>
      <button
        type="button"
        className="sidebar__user-menu-item"
        role="menuitem"
        onClick={() => {
          onOpenDataStats();
        }}
      >
        {c.menuDataStats}
      </button>
    </div>
  );
}

/** 侧栏头像+昵称；点头像打开账户菜单（个人中心、数据模式） */
export function SidebarWorkspaceIdentity({
  writeRequiresLogin,
  currentUser,
  avatarBusy,
  menuWrapRef,
  onAvatarClick,
  menuOpen,
  menuDropdown,
}: {
  writeRequiresLogin: boolean;
  currentUser: AuthUser | null;
  avatarBusy: boolean;
  menuWrapRef: Ref<HTMLDivElement>;
  onAvatarClick: () => void;
  menuOpen: boolean;
  menuDropdown: ReactNode;
}) {
  const c = useAppChrome();
  const avatarDisplaySrc = useMediaDisplaySrc(
    writeRequiresLogin && (currentUser?.avatarThumbUrl || currentUser?.avatarUrl)
      ? (currentUser.avatarThumbUrl ?? currentUser.avatarUrl)
      : undefined
  );

  return (
    <div className="sidebar__workspace">
      {writeRequiresLogin && currentUser ? (
        <>
          <div
            className={
              "sidebar__user-menu-anchor" +
              (menuOpen ? " sidebar__user-menu-anchor--open" : "")
            }
            ref={menuWrapRef}
          >
            <button
              type="button"
              className={
                "sidebar__avatar-hit" +
                (avatarBusy ? " sidebar__avatar-hit--busy" : "")
              }
              onClick={onAvatarClick}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label={c.accountMenu}
              title={c.accountMenu}
            >
              {currentUser.avatarThumbUrl || currentUser.avatarUrl ? (
                <img
                  src={avatarDisplaySrc}
                  alt=""
                  className="sidebar__avatar-img"
                />
              ) : (
                <SidebarWorkspaceAppMark />
              )}
            </button>
            {menuDropdown}
          </div>
          <div className="sidebar__workspace-text">
            <span className="sidebar__workspace-name">
              {currentUser.displayName || currentUser.username}
            </span>
          </div>
        </>
      ) : writeRequiresLogin && getAdminToken() ? (
        <>
          <SidebarWorkspaceAppMark />
          <div className="sidebar__workspace-text">
            <span className="sidebar__workspace-name">{c.restoringSession}</span>
          </div>
        </>
      ) : (
        <>
          <SidebarWorkspaceAppMark />
          <span className="sidebar__workspace-name">mikujar</span>
        </>
      )}
    </div>
  );
}
