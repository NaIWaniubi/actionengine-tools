import type { IntakeRecord, StructuredInsight, Suggestion } from './types';

/** L3 规则：确定性问题用规则，不用 LLM。规则集属于主题包内容 */
export interface Rule {
  id: string;
  when(insight: StructuredInsight, record: IntakeRecord): boolean;
  suggest(insight: StructuredInsight, record: IntakeRecord): Suggestion;
}
