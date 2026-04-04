/**
 * iOS `tauri ios dev` 的 beforeDevCommand：
 * - 5173 空闲则启动 Vite（监听 0.0.0.0，供真机访问）
 * - 已有进程占用 5173 则复用，避免 strictPort 报错退出
 */
import { createConnection } from "node:net";
import { spawn } from "node:child_process";

function isPortListening(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const s = createConnection({ port, host }, () => {
      s.destroy();
      resolve(true);
    });
    s.on("error", () => resolve(false));
  });
}

async function main() {
  const port = 5173;
  if (await isPortListening(port)) {
    console.log(
      `[tauri-ios] 端口 ${port} 已有服务，复用现有 dev server（勿关另一个终端里的 npm run dev）。`,
    );
    setInterval(() => {}, 86400_000);
    return;
  }

  const child = spawn(
    "npx",
    ["vite", "--host", "0.0.0.0", "--port", String(port), "--strictPort"],
    { stdio: "inherit", shell: true, cwd: process.cwd() },
  );
  child.on("exit", (code, signal) => {
    process.exit(signal ? 1 : (code ?? 0));
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
