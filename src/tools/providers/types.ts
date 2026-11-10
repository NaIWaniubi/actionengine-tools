import type { IntakeRecord, StructuredInsight, Suggestion } from '../contracts/types';

export interface LLMProvider {
  name: string;
  /** 2 秒超时健康检查 */
  available(): Promise<boolean>;
  extract(record: IntakeRecord, promptTemplate: string): Promise<StructuredInsight>;
  polish(suggestions: Suggestion[], context: StructuredInsight): Promise<Suggestion[]>;
}

/** 界面上只允许出现的两档模式名，严禁暴露 Provider 类名 */
export type RunMode = 'cloud' | 'offline';

export const RUN_MODE_LABEL: Record<RunMode, string> = {
  cloud: '云端模式',
  offline: '离线模式（本地引擎）',
};
