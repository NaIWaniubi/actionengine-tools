# @naiawaniubi/actionengine-tools

> 行动引擎 ActionEngine 的**赛题无关工具层**。切主题只换表单 Schema / 提示词 / 规则集，
> 这一层一行不改。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## 这是什么

一个把「原始数据（表格 / 表单 / 群消息）」变成「带依据的行动清单」的骨架里的**底层工具**。
它不关心你的行业是什么，只关心四件事：

| 模块 | 干什么 |
|---|---|
| `providers/` | **Provider 三级降级链**：云端 LLM → 本地引擎 → 纯规则引擎。断网 / API 500 时自动降级，**照样出建议**。 |
| `stats.ts` | 表格数值统计（均值 / 极值 / 极值行）。所有引用值都从当前输入实时算出来。 |
| `textStats.ts` | 纯文本兜底：句级切分 + 风险词分级 + 数字量纲抽取。没有表格也能出带数字的建议。 |
| `csv.ts` | CSV 解析（papaparse）。 |
| `ics.ts` | 行动清单 → ICS 日历文件（零依赖，50 行）。 |

## 核心设计：降级链

```
selectProvider()
  ├─ 云端可用？  → cloudProvider（真 LLM）
  └─ 不可用      → mockProvider（本地引擎）
                    └─ 也失败 → ruleOnlyProvider（只做统计）
```

`mockProvider` 才是真正的「本地引擎」——它按当前输入**实时生成**响应，
不是播放录像。改一个输入里的数字，输出必须跟着变。

## 安装

```bash
npm install @naiawaniubi/actionengine-tools
```

## 用法

```ts
import {
  runPipeline,          // 主仓库的 pipeline；这里只给工具
  selectProvider,
  mockProvider,
  parseCsv,
  buildIcs,
} from '@naiawaniubi/actionengine-tools';

// 1. 采集：解析 CSV
const rows = parseCsv('成员,在制单,延期单\n成员A,8,3\n成员B,9,1');

// 2. 理解 + 建议（自动降级）
const provider = await selectProvider();
const insight = await provider.extract(record, promptTemplate);
const suggestions = await provider.polish([], insight);

// 3. 行动：转成 ICS
const ics = buildIcs(actions);
```

## 完整作品在哪

这个包是**工具层**，不是完整作品。完整作品（四个模块的流水线 UI、五主题包、
2 分钟 Demo 视频、项目介绍网站）保留在主仓 `NaIWaniubi/bayhack-actionengine-skeleton`，
该仓为 **private** —— 按赛事要求，参赛期间保持私有。

评委看这个公开包是为了确认：工具层是真实可跑的工程（不是 PPT），
而且**通用骨架赛前已开源**符合黑客松惯例。主题相关的场景定义、提示词、
规则集与演示数据在主仓与现场产出里。

## 为什么单独发这个包

完整作品在 **BayHack 2026** 现场 48 小时开发窗口内完成（12/18–12/20，广东佛山）。
这个工具层是赛题无关的基础设施，**赛前发布**有两个理由：

1. 黑客松通行惯例允许自带开源工具 / 库；把它做成独立包并公开，是最清晰的合规姿势。
2. 它本身有独立价值 —— 任何做「LLM 输出要可核对」的东西的人都能直接用。

主题相关的业务内容（场景定义 / 提示词 / 规则集 / 演示数据）**不在这个包里**，
在主仓库与现场产出里。

## 开发

```bash
npm install
npm run typecheck
```

本包零运行时依赖（仅 papaparse）。测试在主仓库跑：`npm run selfcheck` / `npm run eval`。

## License

MIT
