export function networkingPageLayout(width: number, height: number) {
  const columns = width < 560 ? 1 : width < 920 ? 2 : 3;
  const minimumHeight = columns === 1 ? 122 : 168;
  const rows = Math.max(1, Math.min(3, Math.floor((height + 12) / (minimumHeight + 12))));
  return { columns, rows, pageSize: columns * rows, compact: columns === 1 || (height - (rows - 1) * 12) / rows < 188 };
}
