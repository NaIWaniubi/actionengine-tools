// 表格统计：mock 与 ruleOnly 两个 Provider 共用。
// 这是"离线模式不是放录像"的地基——所有引用值都从当前输入实时算出来。

export interface ColumnStat {
  column: string;
  count: number;
  mean: number;
  min: number;
  minRow: Record<string, string>;
  max: number;
  maxRow: Record<string, string>;
}

/** 取行的展示名：第一个非数值字段的值，取不到就用行号 */
export function rowLabel(row: Record<string, string>, index: number): string {
  for (const [k, v] of Object.entries(row)) {
    if (v.trim() !== '' && Number.isNaN(Number(v))) return v;
    if (v.trim() !== '' && k.match(/名|事项|人|编号|称/)) return v;
  }
  return `第 ${index + 1} 行`;
}

/** 对 CSV 行做数值列统计 */
export function tableStats(rows: Record<string, string>[]): ColumnStat[] {
  if (rows.length === 0) return [];
  const columns = Object.keys(rows[0]);
  const stats: ColumnStat[] = [];
  for (const column of columns) {
    const values = rows.map((r) => Number(r[column]));
    if (values.some((v) => Number.isNaN(v))) continue; // 非数值列跳过
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    let minIdx = 0;
    let maxIdx = 0;
    values.forEach((v, i) => {
      if (v < values[minIdx]) minIdx = i;
      if (v > values[maxIdx]) maxIdx = i;
    });
    stats.push({
      column,
      count: values.length,
      mean: Math.round(mean * 100) / 100,
      min: values[minIdx],
      minRow: rows[minIdx],
      max: values[maxIdx],
      maxRow: rows[maxIdx],
    });
  }
  return stats;
}
