import { createPortal } from "react-dom";
import type { Dispatch, SetStateAction } from "react";
import type { PublicUser } from "../api/users";

type Role = "user" | "admin";

export type UserAdminModalProps = {
  open: boolean;
  onClose: () => void;
  adminUsersErr: string | null;
  userAdminFormErr: string | null;
  newUserUsername: string;
  setNewUserUsername: Dispatch<SetStateAction<string>>;
  newUserPassword: string;
  setNewUserPassword: Dispatch<SetStateAction<string>>;
  newUserDisplayName: string;
  setNewUserDisplayName: Dispatch<SetStateAction<string>>;
  newUserRole: Role;
  setNewUserRole: Dispatch<SetStateAction<Role>>;
  newUserBusy: boolean;
  submitNewUser: () => void | Promise<void>;
  adminUsers: PublicUser[];
  adminUsersLoading: boolean;
  rowBusyId: string | null;
  pwdResetByUser: Record<string, string>;
  setPwdResetByUser: Dispatch<SetStateAction<Record<string, string>>>;
  onRoleChange: (u: PublicUser, role: Role) => void | Promise<void>;
  applyPasswordReset: (u: PublicUser) => void | Promise<void>;
  onDeleteUser: (u: PublicUser) => void | Promise<void>;
};

export function UserAdminModal(p: UserAdminModalProps) {
  const {
    open,
    onClose,
    adminUsersErr,
    userAdminFormErr,
    newUserUsername,
    setNewUserUsername,
    newUserPassword,
    setNewUserPassword,
    newUserDisplayName,
    setNewUserDisplayName,
    newUserRole,
    setNewUserRole,
    newUserBusy,
    submitNewUser,
    adminUsers,
    adminUsersLoading,
    rowBusyId,
    pwdResetByUser,
    setPwdResetByUser,
    onRoleChange,
    applyPasswordReset,
    onDeleteUser,
  } = p;

  if (!open) return null;

  return createPortal(
    <div
      className="auth-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="auth-modal user-admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-admin-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="user-admin-title" className="auth-modal__title">
          小伙伴管理台
        </h2>
        <p className="auth-modal__hint">
          在这儿给新来的发入住许可～
          登录后每人都有自己的笔记小窝和附件格子；站长还能改身份、换口令、送走来访者。
        </p>
        {adminUsersErr || userAdminFormErr ? (
          <p className="auth-modal__err" role="alert">
            {adminUsersErr ?? userAdminFormErr}
          </p>
        ) : null}
        <div className="user-admin__new">
          <p className="user-admin__new-title">拉新坑位</p>
          <input
            type="text"
            className="auth-modal__input"
            autoComplete="off"
            placeholder="登录用小 ID"
            value={newUserUsername}
            disabled={newUserBusy}
            onChange={(e) => setNewUserUsername(e.target.value)}
          />
          <input
            type="password"
            className="auth-modal__input"
            autoComplete="new-password"
            placeholder="开局口令（至少 4 位）"
            value={newUserPassword}
            disabled={newUserBusy}
            onChange={(e) => setNewUserPassword(e.target.value)}
          />
          <input
            type="text"
            className="auth-modal__input"
            autoComplete="off"
            placeholder="对外昵称（可选，不填就用小 ID）"
            value={newUserDisplayName}
            disabled={newUserBusy}
            onChange={(e) => setNewUserDisplayName(e.target.value)}
          />
          <div className="user-admin__new-row">
            <label className="user-admin__role-label">
              身份
              <select
                className="user-admin__role-select"
                value={newUserRole}
                disabled={newUserBusy}
                onChange={(e) =>
                  setNewUserRole(
                    e.target.value === "admin" ? "admin" : "user"
                  )
                }
              >
                <option value="user">住民</option>
                <option value="admin">站长</option>
              </select>
            </label>
            <button
              type="button"
              className="auth-modal__btn auth-modal__btn--primary"
              disabled={
                newUserBusy ||
                !newUserUsername.trim() ||
                newUserPassword.length < 4
              }
              onClick={() => void submitNewUser()}
            >
              {newUserBusy ? "…" : "发放入住许可"}
            </button>
          </div>
        </div>
        <div className="user-admin__table-wrap">
          {adminUsersLoading ? (
            <p className="user-admin__loading">名单抓抓中…</p>
          ) : (
            <table className="user-admin__table">
              <thead>
                <tr>
                  <th>昵称</th>
                  <th>登录 ID</th>
                  <th>身份</th>
                  <th>换口令</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {adminUsers.map((u) => (
                  <tr key={u.id}>
                    <td>{u.displayName}</td>
                    <td className="user-admin__mono">{u.username}</td>
                    <td>
                      <select
                        className="user-admin__role-select user-admin__role-select--inline"
                        value={u.role}
                        disabled={rowBusyId === u.id}
                        onChange={(e) =>
                          void onRoleChange(
                            u,
                            e.target.value === "admin" ? "admin" : "user"
                          )
                        }
                      >
                        <option value="user">住民</option>
                        <option value="admin">站长</option>
                      </select>
                    </td>
                    <td className="user-admin__pwd-cell">
                      <div className="user-admin__pwd-inner">
                        <input
                          type="password"
                          className="user-admin__pwd-input"
                          autoComplete="new-password"
                          placeholder="新口令（≥4）"
                          value={pwdResetByUser[u.id] ?? ""}
                          disabled={rowBusyId === u.id}
                          onChange={(e) =>
                            setPwdResetByUser((prev) => ({
                              ...prev,
                              [u.id]: e.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="user-admin__mini-btn"
                          disabled={rowBusyId === u.id}
                          onClick={() => void applyPasswordReset(u)}
                        >
                          生效
                        </button>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="user-admin__mini-btn user-admin__mini-btn--danger"
                        disabled={rowBusyId === u.id}
                        onClick={() => void onDeleteUser(u)}
                      >
                        送走
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="auth-modal__actions">
          <button
            type="button"
            className="auth-modal__btn auth-modal__btn--ghost"
            onClick={onClose}
          >
            收工
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
