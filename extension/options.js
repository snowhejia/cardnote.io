const $ = (id) => document.getElementById(id);

async function load() {
  const s = await chrome.storage.sync.get([
    "apiBase",
    "bearerToken",
    "userId",
    "collectionId",
    "insertNewNotesAtTop",
  ]);
  $("apiBase").value = s.apiBase || "";
  $("bearerToken").value = s.bearerToken || "";
  $("userId").value = s.userId || "";
  $("collectionId").value = s.collectionId || "";
  $("insertNewNotesAtTop").checked = s.insertNewNotesAtTop !== false;
}

function withUserId(url, userId) {
  const uid = String(userId || "").trim();
  if (!uid) return url;
  const u = new URL(url);
  u.searchParams.set("userId", uid);
  return u.toString();
}

$("save").addEventListener("click", async () => {
  const apiBase = $("apiBase").value.trim().replace(/\/$/, "");
  const bearerToken = $("bearerToken").value.trim();
  const userId = $("userId").value.trim();
  const collectionId = $("collectionId").value.trim();
  const status = $("status");
  status.textContent = "";

  if (!apiBase || !bearerToken) {
    status.textContent = "请填写 API 地址与 Token。";
    return;
  }

  let originPattern;
  try {
    originPattern = `${new URL(apiBase).origin}/*`;
  } catch {
    status.textContent = "API 地址格式不正确。";
    return;
  }

  const granted = await chrome.permissions.request({
    origins: [originPattern],
  });
  if (!granted) {
    status.textContent = "需要授权访问 API 域名才能保存。";
    return;
  }

  await chrome.storage.sync.set({
    apiBase,
    bearerToken,
    userId,
    collectionId,
    insertNewNotesAtTop: $("insertNewNotesAtTop").checked,
  });

  const meUrl = withUserId(`${apiBase}/api/auth/me`, userId);
  try {
    const r = await fetch(meUrl, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      status.textContent = `已保存选项，但 /api/auth/me 返回 ${r.status}，请核对 Token。`;
      return;
    }
    if (j.ok === false && !j.user && !j.admin) {
      status.textContent =
        "已保存选项；当前 Token 未识别为有效会话（若用 JWT 请确认未过期）。";
      return;
    }
    status.textContent = "已保存，Token 校验通过。";
  } catch (e) {
    status.textContent = `已保存选项，但请求失败：${e?.message || e}`;
  }
});

void load();
