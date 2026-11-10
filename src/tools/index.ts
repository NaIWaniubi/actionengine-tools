// 工具层统一出口。
//
// 为什么不从 tools.ts 直接导：providers/index.ts 里的 Provider 接口与
// contracts/types.ts 里的数据契约是两组不同的类型，合并导出时名字会撞
// （StructuredInsight / Suggestion 在两处都出现语义）。
// 这里按用途分组导出，调用方 import 时能看清自己拿的是哪一类。

export type {
  ActionItem,
  IntakeRecord,
  StructuredInsight,
  Suggestion,
  ThemeId,
} from './contracts/types';

export type { Rule } from './contracts/rules';

export { mockProvider, ruleOnlyProvider, selectProvider } from './providers';
export { createCloudProvider } from './providers/cloud';
export type { LLMProvider, RunMode, SelectedProvider } from './providers';
export { RUN_MODE_LABEL } from './providers/types';

export { parseCsv } from './csv';
export { buildIcs } from './ics';
export { rowLabel, tableStats } from './stats';
export type { ColumnStat } from './stats';
export { analyzeText, describeText } from './textStats';
export type { TextFinding } from './textStats';
