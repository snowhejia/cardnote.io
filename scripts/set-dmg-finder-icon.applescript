-- 为 .dmg 文件设置访达中的自定义图标（与 .app 使用同一套 icon.icns）
use framework "Foundation"
use framework "AppKit"

on run argv
	if (count of argv) < 2 then error "用法：icon.icns 路径 与 .dmg 路径（均为 POSIX）"
	set iconPath to item 1 of argv
	set dmgPath to item 2 of argv
	set ws to current application's NSWorkspace's sharedWorkspace()
	set img to current application's NSImage's alloc()'s initWithContentsOfFile:iconPath
	if img is missing value then error "无法读取 icns：" & iconPath
	set ok to ws's setIcon:img forFile:dmgPath options:0
	if ok is false then error "setIcon 失败：" & dmgPath
end run
