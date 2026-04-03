/** 从剪贴板或拖拽 DataTransfer 取出文件（含截图粘贴等） */
export function filesFromDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  if (dt.files?.length) return Array.from(dt.files);
  const items = dt.items;
  if (!items?.length) return [];
  const out: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it?.kind === "file") {
      const f = it.getAsFile();
      if (f) out.push(f);
    }
  }
  return out;
}
