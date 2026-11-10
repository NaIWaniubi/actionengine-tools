import type { IntakeRecord, StructuredInsight, Suggestion } from '../contracts/types';
import { tableStats } from '../stats';
import type { LLMProvider } from './types';

// RuleOnlyProvider：终极兜底。断网且 mock 未覆盖时的纯规则路径。
// 输出标注低置信度，UI 上以"待人工复核"样式呈现。

export const ruleOnlyProvider: LLMProvider = {
  name: 'ruleOnly',
  async available() {
    return true;
  },
  async extract(record: IntakeRecord): Promise<StructuredInsight> {
    const facts: StructuredInsight['facts'] = [];
    for (const table of record.attachments ?? []) {
      for (const s of tableStats(table.rows)) {
        facts.push({
          key: `${table.name}：${s.column} 均值`,
          value: `${s.mean}`,
          confidence: 'low',
        });
      }
    }
    return {
      facts,
      issues: [],
      constraints: [],
      summary: '本地规则引擎仅完成基础统计，结果待人工复核。',
    };
  },
  async polish(_suggestions, context): Promise<Suggestion[]> {
    return context.facts.slice(0, 5).map((f) => ({
      title: `人工复核：${f.key}`,
      rationale: `规则引擎仅识别到数值 ${f.value}，未做语义判断，请人工确认是否需要处理。`,
      source: 'rule' as const,
      priority: 3,
    }));
  },
};
