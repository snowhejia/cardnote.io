import type { ReactNode, Ref } from "react";
import { resolveMediaUrl, type AuthUser } from "../api/auth";
import type { AppDataMode } from "../appDataModeStorage";
import { getAdminToken } from "../auth/token";
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
  return (
    <div className="sidebar__user-menu-dropdown" role="menu">
      <button
        type="button"
        className="sidebar__user-menu-item"
        role="menuitem"
        disabled={dataMode !== "remote" || profileBusy}
        title={
          dataMode !== "remote"
            ? "请先切换到云端同步后再打开个人中心"
            : undefined
        }
        onClick={() => {
          onOpenProfile();
        }}
      >
        个人中心
      </button>
      <button
        type="button"
        className="sidebar__user-menu-item"
        role="menuitem"
        onClick={() => {
          onOpenNoteSettings();
        }}
      >
        笔记设置
      </button>
      <button
        type="button"
        className="sidebar__user-menu-item"
        role="menuitem"
        onClick={() => {
          onOpenDataStats();
        }}
      >
        数据统计
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
              aria-label="账户菜单"
              title="账户菜单"
            >
              {currentUser.avatarUrl ? (
                <img
                  src={resolveMediaUrl(currentUser.avatarUrl)}
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
            <span className="sidebar__workspace-name">恢复会话…</span>
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
