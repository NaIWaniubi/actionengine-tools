// 纯文本理解：无表格、无固定标签时的兜底。
//
// 为什么必须有这一层：现场最可能的输入不是我们准备的 CSV，是评委把自己手上
// 一段话（群里发的日报、随访记录、活动复盘）粘进来。表格统计在这种情况下
// 一条 issue 都产不出来，界面上就是"没有建议"——那一秒产品就死了。
//
// 这一层不做 NLP，只做两件确定性的事：
//   ① 把句子里"数字 + 单位"抽成事实（可被引用）
//   ② 把含风险词的句子抽成问题（severity 按风险词的硬度分级）
// 全部同步、纯函数、零依赖，可以在没有网络的机器上跑。

import type { StructuredInsight } from './contracts/types';

export interface TextFinding {
  facts: StructuredInsight['facts'];
  issues: StructuredInsight['issues'];
}

/** 风险词表：按"多硬"分级。3 = 已经出问题，2 = 有苗头，1 = 只是弱信号 */
const RISK_PATTERNS: { re: RegExp; severity: 1 | 2 | 3; tag: string }[] = [
  // —— 硬失败：已经发生、且一定要有人负责
  { re: /落后|延期|延误|超期|逾期|拖了|拖到|来不及|赶不上/, severity: 3, tag: '进度落后' },
  { re: /未完成|没完成|没有完成|缺交|没交|没做|缺席|断供/, severity: 3, tag: '未完成' },
  { re: /打不通|联系不上|联系不到|失联|没联系上/, severity: 3, tag: '触达失败' },
  { re: /超差|不良|报废|返工|故障|报警|停线/, severity: 3, tag: '质量异常' },
  { re: /下降|下滑|掉了|跌了|退群|流失|投诉/, severity: 3, tag: '指标下降' },
  // —— 苗头：还没坏透，但需要马上处理
  { re: /只(有|写了|发了|到了|做了)|仅(有|完成)/, severity: 2, tag: '完成度偏低' },
  { re: /不够|不足|太少|偏低|偏少|缺口/, severity: 2, tag: '量不足' },
  { re: /卡在|阻塞|堵住|等着|排队/, severity: 2, tag: '阻塞' },
  { re: /风险|隐患|担心|可能来不及|来不及/, severity: 2, tag: '风险' },
  { re: /异常|波动|不稳定|时好时坏/, severity: 2, tag: '异常波动' },
  { re: /抄|代写|雷同|作弊/, severity: 2, tag: '合规风险' },
];

/** 抽「数字 + 可选单位」以及它前面最多 8 个汉字作为量纲词。 */
const NUMBER_RE = /([\u4e00-\u9fa5]{0,8})\s*(\d+(?:\.\d+)?)\s*(%|人|件|份|条|个|次|位|名|天|小时|分钟|分|元|台|单|场)?/g;

/** 按句切分：中文句号/分号/感叹/问号 + 换行。逗号留着，一句话内的因果关系别拆断。 */
function splitSentences(raw: string): string[] {
  return raw
    .split(/[。；;！!？?\n\r]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    // 表单序列化出来的是「标签：值」逐行文本，不是散文。
    // 不过滤的话，"当日不良件数：48" 会被风险词「不良」当成一条问题，
    // 把表格统计出来的真问题挤掉。
    //
    // 但不能一刀切按前缀丢：真实日报常常也是"本周随访：……"开头的散文
    // （health 的样例就是这么写的）。判据是冒号后面是不是一个"短值"——
    // 表单行冒号后没有句内逗号且很短；散文有逗号、也长。
    .filter((s) => {
      const m = s.match(/^[\u4e00-\u9fa5A-Za-z0-9]{1,12}：(.+)$/);
      if (!m) return true;
      const rest = m[1];
      return rest.includes('，') || rest.length > 20;
    });
}

function trimTo(s: string, n: number): string {
  const t = s.trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

/** 主入口：一段自由文本 → 事实 + 问题 */
export function analyzeText(raw: string): TextFinding {
  const text = raw.trim();
  if (text === '') return { facts: [], issues: [] };

  const sentences = splitSentences(text);

  // —— 事实：数字 + 单位（最多 6 条，按出现顺序）
  const facts: StructuredInsight['facts'] = [];
  const seenFact = new Set<string>();
  for (const [i, s] of sentences.entries()) {
    NUMBER_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = NUMBER_RE.exec(s)) !== null) {
      const label = (m[1] || '').trim();
      const value = m[2];
      const unit = m[3] || '';
      // 光秃秃的数字（没有量纲词也没有单位）信息量太低，跳过
      if (label === '' && unit === '') continue;
      const key = `${label}${value}${unit}`;
      if (seenFact.has(key)) continue;
      seenFact.add(key);
      facts.push({
        key: label === '' ? `数值（第 ${i + 1} 句）` : label,
        value: `${value}${unit}`,
        confidence: 'high',
      });
      if (facts.length >= 6) break;
    }
    if (facts.length >= 6) break;
  }

  // —— 问题：一句里既有风险词又有数字
  const issues: StructuredInsight['issues'] = [];
  const seenIssue = new Set<string>();
  for (const [i, s] of sentences.entries()) {
    const hit = RISK_PATTERNS.find((p) => p.re.test(s));
    if (!hit) continue;
    NUMBER_RE.lastIndex = 0;
    const hasNumber = NUMBER_RE.test(s);
    // 没有数字的句子不进 issue —— "建议"层要引用具体值，否则就是空话
    if (!hasNumber) continue;
    const desc = trimTo(s, 52);
    if (seenIssue.has(desc)) continue;
    seenIssue.add(desc);
    issues.push({
      description: desc,
      severity: hit.severity,
      evidence: `原文第 ${i + 1} 句（${hit.tag}）`,
    });
    if (issues.length >= 5) break;
  }

  // 如果一句风险句都没有，但文本里有数字：给一条"确认口径"的低置信问题，
  // 让建议层至少能引用数据、而不是屏幕空白
  if (issues.length === 0 && facts.length > 0) {
    const f = facts[0];
    issues.push({
      description: `${f.key}为 ${f.value}，需要确认口径与对比基准`,
      severity: 1,
      evidence: '原文数字抽取',
    });
  }

  return { facts, issues };
}

/** 摘要文案：供 L2 的 summary 拼接，避免"共读取 0 张表"这种空话。 */
export function describeText(finding: TextFinding): string {
  if (finding.facts.length === 0 && finding.issues.length === 0) return '';
  return `文本抽取 ${finding.facts.length} 项数据、${finding.issues.length} 个关注点`;
}