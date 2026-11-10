// 四层流水线的数据契约。纯类型声明、零运行时代码，tools 与 pipeline 共用。
// 冻结纪律：11/18 报名提交后冻结会评审，11/21 起锁死，改动需全员同意。

export type ThemeId = 'industry' | 'manufacture' | 'health' | 'lifestyle' | 'education';

/** L1 输出：一次采集的结果 */
export interface IntakeRecord {
  id: string;
  theme: ThemeId;
  source: 'form' | 'csv' | 'voice';
  raw: string;
  attachments?: { name: string; rows: Record<string, string>[] }[];
  createdAt: number;
}

/** L2 输出：结构化理解结果 */
export interface StructuredInsight {
  facts: { key: string; value: string; confidence: 'high' | 'low' }[];
  issues: { description: string; severity: 1 | 2 | 3; evidence: string }[];
  constraints: string[];
  summary: string;
}

/** L3 输出：一条建议。rationale 必须引用 facts/issues 里的具体数据 */
export interface Suggestion {
  title: string;
  rationale: string;
  source: 'rule' | 'llm' | 'rule+llm';
  priority: 1 | 2 | 3;
  linkedIssue?: string;
}

/** L4 核心：一条可打勾执行的行动项 */
export interface ActionItem {
  id: string;
  title: string;
  owner: string;
  due: string; // ISO 日期
  status: 'todo' | 'done' | 'dismissed';
  fromSuggestion: string;
  note?: string;
}
