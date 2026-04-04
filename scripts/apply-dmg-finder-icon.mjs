#!/usr/bin/env node
/**
 * Tauri 打出来的 .dmg 在访达里默认是通用磁盘/下载样式。
 * 构建完成后用 NSWorkspace 把 icon.icns 设到 .dmg 文件本身（与 .app 图标一致）。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const scpt = path.join(__dirname, "set-dmg-finder-icon.applescript");
const icnsDefault = path.join(root, "src-tauri/icons/icon.icns");
const dmgDirDefault = path.join(
  root,
  "src-tauri/target/release/bundle/dmg"
);

const icns = path.resolve(process.argv[2] || icnsDefault);
let dmg = process.argv[3]
  ? path.resolve(process.argv[3])
  : null;

if (!fs.existsSync(icns)) {
  console.error("找不到 icns：", icns);
  process.exit(1);
}

if (!dmg) {
  if (!fs.existsSync(dmgDirDefault)) {
    console.error("请先执行 npm run tauri:build，或传入 .dmg 路径");
    process.exit(1);
  }
  const dmgs = fs
    .readdirSync(dmgDirDefault)
    .filter((f) => f.endsWith(".dmg"))
    .map((f) => ({
      f,
      t: fs.statSync(path.join(dmgDirDefault, f)).mtimeMs,
    }))
    .sort((a, b) => b.t - a.t);
  if (!dmgs.length) {
    console.error("目录里没有 .dmg：", dmgDirDefault);
    process.exit(1);
  }
  dmg = path.join(dmgDirDefault, dmgs[0].f);
}

if (!fs.existsSync(dmg)) {
  console.error("找不到 dmg：", dmg);
  process.exit(1);
}

const r = spawnSync("osascript", [scpt, icns, dmg], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

if (r.status !== 0) {
  console.error(r.stderr || r.stdout || "osascript 失败");
  process.exit(r.status ?? 1);
}

console.log("已设置 DMG 访达图标：", dmg);
