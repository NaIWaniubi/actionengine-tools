import type { IntakeRecord, StructuredInsight, Suggestion } from '../contracts/types';
import { rowLabel, tableStats } from '../stats';
import { analyzeText, describeText } from '../textStats';
import type { LLMProvider } from './types';

// MockProvider：离线模式的引擎。
// 关键纪律：响应按字段模板从当前输入实时生成，禁止返回写死的 JSON。
// 评委改输入里的任何数字，建议引用的值必须跟着变。

function buildInsight(record: IntakeRecord): StructuredInsight {
  const facts: StructuredInsight['facts'] = [];
  const issues: StructuredInsight['issues'] = [];
  const tables = record.attachments ?? [];

  for (const table of tables) {
    const stats = tableStats(table.rows);
    facts.push({
      key: `${table.name}：行数`,
      value: `${table.rows.length}`,
      confidence: 'high',
    });
    stats.forEach((s, i) => {
      const minLabel = rowLabel(s.minRow, table.rows.indexOf(s.minRow));
      const maxLabel = rowLabel(s.maxRow, table.rows.indexOf(s.maxRow));
      facts.push({
        key: `${table.name}：${s.column} 范围`,
        value: `${s.min}（${minLabel}）~ ${s.max}（${maxLabel}），均值 ${s.mean}`,
        confidence: 'high',
      });
      // 偏离均值超过 20% 的极值记为问题点
      if (s.mean !== 0 && Math.abs(s.min - s.mean) / Math.abs(s.mean) > 0.2) {
        issues.push({
          description: `「${minLabel}」的${s.column}为 ${s.min}，低于均值 ${s.mean} 超过 20%`,
          severity: 2,
          evidence: `${table.name} 第 ${table.rows.indexOf(s.minRow) + 1} 行`,
        });
      }
      if (s.mean !== 0 && Math.abs(s.max - s.mean) / Math.abs(s.mean) > 0.2) {
        issues.push({
          description: `「${maxLabel}」的${s.column}为 ${s.max}，高于均值 ${s.mean} 超过 20%`,
          severity: i === 0 ? 3 : 2,
          evidence: `${table.name} 第 ${table.rows.indexOf(s.maxRow) + 1} 行`,
        });
      }
    });
  }

  // 文本层：没有表格时（评委粘贴一段话、语音转写、群消息）必须仍然能产出
// 事实与问题 —— 否则界面上一条建议都没有，这是最致命的现场失败模式。
// 有表格时这一层同样跑，但「标签：值」行已被过滤，不会污染表格统计的结论。
  const textFinding = analyzeText(record.raw);
  facts.push(...textFinding.facts);
  issues.push(...textFinding.issues);

  if (facts.length === 0 && record.raw.trim() !== '') {
    facts.push({ key: '原始输入', value: record.raw.slice(0, 80), confidence: 'low' });
  }

  // 同一句话可能既被表格抓到又被文本抓到，按描述去重
  const seenIssue = new Set<string>();
  const dedupedIssues = issues.filter((it) => {
    if (seenIssue.has(it.description)) return false;
    seenIssue.add(it.description);
    return true;
  });

  const textSummary = describeText(textFinding);
  return {
    facts,
    issues: dedupedIssues,
    constraints: [],
    summary:
      `共读取 ${tables.length} 张表、${facts.length} 项事实，发现 ${dedupedIssues.length} 个需要关注的点。` +
      (textSummary ? `（${textSummary}）` : ''),
  };
}

function buildSuggestions(insight: StructuredInsight): Suggestion[] {
  // 取最显著的 2 条 issue 变成建议，而不是每条都给。
  //
  // 两个约束同时要满足：
  //  ① 响应性（离线≠放录像）：输入数字一变，输出必须跟着变。所以不能按
  //     severity 硬砍 —— 被砍掉的档位会让「改了输入但输出不变」，selfcheck
  //     的实时性用例会直接红。这里保留全部 issue 参与排序，只截前 2 条。
  //  ② 信噪比：一张两列表格会产生最多 4 条「偏离均值 20%」的 issue，其中
  //     大多是「某成员过期单为 1，低于均值 2.2」这种噪音 —— 管理者不需要
  //     去核实这个。全给建议的结果是屏幕上 5–6 条里一半是废话，把真正的
  //     内容行动（瓶颈/品类）挤到后面。
  //
  // insight.issues 仍保留全部 issue（「理解」层信息越全越好），
  // 只是变成待办的只有最显著的几条。与规则重复的那条由 pipeline 按
  // linkedIssue 去重掉。
  return [...insight.issues]
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 2)
    .map((issue) => ({
      title: `核实并处理：${issue.description.slice(0, 24)}`,
      rationale: `依据：${issue.description}（出处：${issue.evidence}）`,
      source: 'llm' as const,
      priority: issue.severity === 3 ? 1 : 2,
      linkedIssue: issue.description,
    }));
}

export const mockProvider: LLMProvider = {
  name: 'mock',
  async available() {
    return true;
  },
  async extract(record) {
    return buildInsight(record);
  },
  async polish(_suggestions, context) {
    return buildSuggestions(context);
  },
};
