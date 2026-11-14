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

本包尚未发布到 npm registry。用 git 直接安装，或 clone 后本地 link：

```bash
# 方式一：从 GitHub 直接装
npm install github:NaIWaniubi/actionengine-tools

# 方式二：clone 后本地链接（可改可调试）
git clone https://github.com/NaIWaniubi/actionengine-tools.git
cd actionengine-tools && npm install && npm link
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

这个包是**工具层**（Providers 降级链 / 统计 / 文本兜底 / CSV / ICS），不是完整作品。
它是**通用、赛题无关的基础设施**，赛前就已开源，符合黑客松「允许自带开源组件 / 库」的惯例。

主题相关的场景定义、提示词、规则集与演示数据，以及四层流水线 UI、演示视频、
项目网站，在主仓 `NaIWaniubi/bayhack-actionengine-skeleton` 里；该仓 **private**
—— 按赛事要求参赛期间保持私有，评委按需可访问。

> 关于开发时间线：本工具层与其通用引擎为赛前既有；**赛事期间（12/18–12/20）的现场
> 开发内容与范围，以主仓在窗口内的提交记录及现场说明为准。** 本 README 不对现场
> 将完成的具体范围作预先声明。

## 为什么单独发这个包

这个工具层是赛题无关的基础设施，**赛前发布**有两个理由：

1. 黑客松通行惯例允许自带开源工具 / 库；把它做成独立包并公开，是最清晰的合规姿势。
2. 它本身有独立价值 —— 任何做「LLM 输出要可核对」的东西的人都能直接用。

主题相关的业务内容（场景定义 / 提示词 / 规则集 / 演示数据）**不在这个包里**，
在主仓库里；赛事期间的现场开发范围以主仓窗口内的提交记录为准。

## 开发

```bash
npm install
npm run typecheck
```

本包零运行时依赖（仅 papaparse）。测试在主仓库跑：`npm run selfcheck` / `npm run eval`。

## License

MIT
