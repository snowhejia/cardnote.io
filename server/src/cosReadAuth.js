import { cosAvatarPrefix, cosMediaPrefix } from "./storage.js";

/**
 * 判断 JWT 会话是否有权通过 /api/upload/cos-read 换取某 COS 对象的 GET 预签名 URL。
 * @param {string} key 对象键（无前导 /）
 * @param {{ sub: string | null; role?: string; apiToken?: boolean }} session
 */
function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function canSessionReadCosObjectKey(key, session) {
  const k = String(key || "").replace(/^\//, "");
  const mediaP = cosMediaPrefix();

  if (session.apiToken || session.role === "admin") return true;

  const uid = session.sub;
  if (!uid) return false;

  const avatarPrefixes = [...new Set([cosAvatarPrefix(), "mikujar/avatars"])];
  for (const ap of avatarPrefixes) {
    if (k === `${ap}/${uid}-thumb.webp`) return true;
    const avatarRe = new RegExp(
      "^" + escapeRe(ap) + "/([a-zA-Z0-9._-]+)\\.[a-zA-Z0-9]+$"
    );
    const ma = avatarRe.exec(k);
    if (ma && ma[1] === uid) return true;
  }

  const esc = escapeRe(mediaP);
  const scoped = new RegExp(`^${esc}/([a-zA-Z0-9._-]+)/`);
  const mm = scoped.exec(k);
  if (mm && mm[1] === uid) return true;

  const legacyPrefixes = [...new Set([mediaP, "mikujar/media"])];
  for (const lp of legacyPrefixes) {
    const legacy = new RegExp(`^${escapeRe(lp)}/[^/]+$`);
    if (legacy.test(k)) return true;
  }

  return false;
}
