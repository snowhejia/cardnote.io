/**
 * lazyFeatureFlag.ts — 控制"懒加载模式"是否启用
 *
 * 行为（2026-04-25 起默认开启）：
 *   - 默认：启用
 *   - 环境变量 VITE_LAZY_COLLECTIONS=0 可全局关闭（构建期）
 *   - localStorage 里 `cardnote.lazyCollections` 可个人覆盖（调试 / 回滚）：
 *       localStorage.setItem("cardnote.lazyCollections", "0")  → 关（个人降级到老路径）
 *       localStorage.setItem("cardnote.lazyCollections", "1")  → 开（对抗误设的 env=0）
 *   - 只读一次（启动时确定），避免中途切换导致状态不一致
 *
 * 启用后：视图从客户端全树遍历切换到调用 /api/overview/summary /api/search
 * 等新端点；合集详情走 useCardsForCollection 按需拉卡。
 */

const LS_KEY = "cardnote.lazyCollections";

function readOverride(): boolean | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v === "1" || v === "true") return true;
    if (v === "0" || v === "false") return false;
    return null;
  } catch {
    return null;
  }
}

function readEnvDefault(): boolean {
  /* 默认开启；只有显式 VITE_LAZY_COLLECTIONS=0 或 "false" 才关 */
  const raw = (import.meta.env.VITE_LAZY_COLLECTIONS as string | undefined)?.trim();
  if (raw === "0" || raw === "false") return false;
  return true;
}

/** 启动时快照；整个会话期间固定值，方便条件分支稳定 */
const SNAPSHOT: boolean = (() => {
  const override = readOverride();
  if (override !== null) return override;
  return readEnvDefault();
})();

export function isLazyCollectionsEnabled(): boolean {
  return SNAPSHOT;
}
