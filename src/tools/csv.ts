import Papa from 'papaparse';

/** CSV 文本解析为行对象数组，首行为表头 */
export function parseCsv(text: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
  });
  return result.data;
}
