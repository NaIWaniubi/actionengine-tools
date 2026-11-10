import type { IntakeRecord, StructuredInsight, Suggestion } from '../contracts/types';
import type { LLMProvider } from './types';

// CloudProvider：OpenAI 兼容协议，默认走本地代理（proxy/server.mjs）隐藏 API Key。
// 配置来源：localStorage（ae_baseUrl / ae_apiKey / ae_model），缺省视为未配置。

interface CloudConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

function readConfig(): CloudConfig | null {
  if (typeof localStorage === 'undefined') return null; // Node 环境（selfcheck）视为未配置
  const baseUrl = localStorage.getItem('ae_baseUrl') ?? '';
  const apiKey = localStorage.getItem('ae_apiKey') ?? '';
  const model = localStorage.getItem('ae_model') ?? 'deepseek-chat';
  if (!baseUrl) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey, model };
}

function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

async function chat(config: CloudConfig, system: string, user: string): Promise<string> {
  const { signal, done } = withTimeout(30000);
  try {
    const resp = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });
    if (!resp.ok) throw new Error(`LLM HTTP ${resp.status}`);
    const data = await resp.json();
    return data.choices?.[0]?.message?.content ?? '';
  } finally {
    done();
  }
}

function parseJson<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('LLM 返回中未找到 JSON');
  return JSON.parse(match[0]) as T;
}

export function createCloudProvider(): LLMProvider & { configured: boolean } {
  const config = readConfig();
  return {
    name: 'cloud',
    configured: config !== null,
    async available() {
      if (!config) return false;
      const { signal, done } = withTimeout(2000);
      try {
        const resp = await fetch(`${config.baseUrl}/models`, {
          signal,
          headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
        });
        return resp.ok;
      } catch {
        return false;
      } finally {
        done();
      }
    },
    async extract(record: IntakeRecord, promptTemplate: string): Promise<StructuredInsight> {
      if (!config) throw new Error('云端未配置');
      const payload = JSON.stringify({
        raw: record.raw,
        attachments: record.attachments?.map((a) => ({ name: a.name, rows: a.rows.slice(0, 200) })),
      });
      const text = await chat(config, promptTemplate, payload);
      const parsed = parseJson<StructuredInsight>(text);
      if (!Array.isArray(parsed.facts) || !Array.isArray(parsed.issues)) {
        throw new Error('LLM 返回结构不合法');
      }
      return {
        facts: parsed.facts,
        issues: parsed.issues,
        constraints: parsed.constraints ?? [],
        summary: parsed.summary ?? '',
      };
    },
    async polish(suggestions: Suggestion[], context: StructuredInsight): Promise<Suggestion[]> {
      if (!config || suggestions.length === 0) return suggestions;
      try {
        const text = await chat(
          config,
          '你是建议润色器。输入建议数组与上下文，输出同一 JSON 数组，只改进 title 的表述（动宾结构、不超过 20 字），不得改动 rationale 中的任何数值。',
          JSON.stringify({ suggestions, summary: context.summary }),
        );
        const parsed = parseJson<{ suggestions?: Suggestion[] } | Suggestion[]>(text);
        const list = Array.isArray(parsed) ? parsed : parsed.suggestions;
        if (!list || list.length !== suggestions.length) return suggestions;
        return suggestions.map((s, i) => ({ ...s, title: list[i]?.title ?? s.title }));
      } catch {
        return suggestions; // 润色失败静默回退原标题
      }
    },
  };
}
