import { createCloudProvider } from './cloud';
import { mockProvider } from './mock';
import { ruleOnlyProvider } from './ruleOnly';
import type { LLMProvider, RunMode } from './types';

export type { LLMProvider, RunMode } from './types';
export { RUN_MODE_LABEL } from './types';
export { ruleOnlyProvider };
// 本地引擎也要对外暴露：pipeline 在云端失败时要降级到它。
// 不导出的话 pipeline 只能落 ruleOnly（只做统计、不产出建议），
// 云端一 500 屏幕上就一条建议都没有 —— 而「断网也能出建议」是核心叙事。
export { mockProvider };

export interface SelectedProvider {
  provider: LLMProvider;
  mode: RunMode;
}

/** 降级链：云端健康检查（2 秒）→ 离线本地引擎。切换对调用方透明 */
export async function selectProvider(): Promise<SelectedProvider> {
  const cloud = createCloudProvider();
  if (cloud.configured && (await cloud.available())) {
    return { provider: cloud, mode: 'cloud' };
  }
  return { provider: mockProvider, mode: 'offline' };
}
