# 逐步共享判定：研究演示原型

**在 Agent 运行中，逐步决定“在哪里执行”和“哪些事实可以发给当前接收方”。**

[![自动检查](https://github.com/Zane-0260907/stepwise-disclosure-demo/actions/workflows/checks.yml/badge.svg)](https://github.com/Zane-0260907/stepwise-disclosure-demo/actions/workflows/checks.yml)
[![Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

[English](README.md) · [快速运行](#三步运行) · [复核实验](#复核冻结实验) · [证据边界](#证据边界)

<img src="evidence/research/ui/02-running.png" alt="合同任务运行时，中央显示逐步执行，右侧显示当前步骤的候选发送内容和本地保留内容。" width="950">

*真实的离线执行过程。点击中央步骤可检查当前输入、发送前核验、接收记录和输出；英文模式会翻译展示结论，源文件和实际请求正文保留原文以便审计。*

## 研究问题

Agent 读取本地资料或收到工具结果后，可能临时发现下一步任务。新步骤所需的执行能力、接收方和输入，与入口阶段的判断不同。本原型在**每一步**联合确定执行位置与给定接收方的共享视图，在真正发送前再次核验授权，并在后续新增步骤时重新判定。

这是使用**合成合同与学习记录**的独立研究原型。它不是商业客户端，也不声称能防护任意程序、任意工具或任意外流渠道。

## 三步运行

安装 [Node.js 24](https://nodejs.org/) 后，在仓库根目录执行：

~~~sh
npm ci
npm start
~~~

访问 **http://127.0.0.1:4793/**。服务默认仅监听本机。

1. 保持“本机规则执行器”，运行**标准条款**：解析合成 PDF，确认本地能力足够，无须发送分析请求。
2. 运行**引用条款**：读取 PDF 后发现资料查询步骤，构造面向接收方的视图，经核验发送到本机独立 HTTP 接收进程，取得版本化合成参考资料后继续分析。
3. 运行**发送前撤权**：在视图形成后撤销授权，观察请求被发送前复核阻断；再允许执行，对照接收进程记录。

离线案例每次都会重新读取、计算、核验并保存记录，但执行器是**有限规则**，不能作为大模型理解能力的证据。左侧两条 DeepSeek 记录来自同一合成合同的真实模型调用，点击后**无密钥重放**原始事件，不会再次请求模型。页面明确区分新执行与记录重放；放慢的页面展示时间不计入实验耗时。

如需新的现场 DeepSeek 调用，请在本地设置环境变量 `DEEPSEEK_API_KEY` 后重启。离线案例与记录重放不需要密钥。切勿把密钥写入代码、日志或仓库；本演示没有多用户鉴权，带密钥运行时不要直接暴露到公网。现场适配器使用 `deepseek-flash` 的非思考模式。

<img src="evidence/research/ui/07-deepseek-recorded-result.png" alt="保存的 DeepSeek 运行记录：中央显示结论，右侧区分实际发送与留在本地的字段。" width="950">

*同一合同的 DeepSeek 运行记录：右侧展示当前步骤的实际发送与本地保留内容。*

## 复核冻结实验

正式批次是 **60 个合成案例 × 5 种方法 × 每例 3 次重复，共 900 次任务运行**。冻结编号 `frozen-v1-20260925`，模型标识为 `qwen-plus`；一次任务可能有多次模型调用。五种方法分别是完整上下文、普通个人信息遮盖、入口裁剪、逐步裁剪但固定执行域，以及联合逐步判定。前四种对照是**本项目自己的实现**，并非外部系统的复现。

主指标是根据不供执行器读取的标签进行**严格结构化任务核验**，不是对自由文本质量的人工评分。计算配对差异时，先在案例内部汇总三次重复。

| 方法 | 结构化任务通过率 | 每任务平均不必要发送事实数 |
| :-- | --: | --: |
| 完整上下文 | 76.7% | 9.6 |
| 普通个人信息遮盖 | 75.0% | 4.6 |
| 入口裁剪 | 82.2% | 0.33 |
| 逐步裁剪、固定执行域 | 82.8% | 0 |
| 联合逐步判定 | **91.1%** | **0** |

数据来自 [`summary.json`](evidence/research/results/summary.json)；区间、案例配对差异、失败记录和逐例结果都在同一目录。结论仅适用于冻结的合成任务协议。

<img src="evidence/research/results/experiment-overview.svg" alt="从冻结运行记录生成的五方法实验统计图。" width="850">

检查输入、控制路径及保存的 DeepSeek 记录：

~~~sh
npm run check:inputs
npm test
npm run test:boundaries
node scripts/verify-deepseek-records.mjs
~~~

**无需模型密钥**，从保存的 900 份任务记录重新评分和汇总：

~~~sh
python -m zipfile -e evidence/research/reproduction-records.zip .
node scripts/verify-recorded-scores.mjs frozen-v1-20260925
node scripts/summarize-research.mjs frozen-v1-20260925
~~~

解压内容进入被 Git 忽略的 `data/research/experiments/`。需要重绘统计图时，安装 Python 3.11+，运行 `python -m pip install -r requirements-plots.txt` 和 `npm run plot`。Linux 绘制中文标签可能需要 Noto Sans CJK 等字体。现有验收环境为 Windows；Docker 和 Linux 尚未完成接受性验证。

[`frozen-protocol.json`](evidence/research/frozen-protocol.json)保存核心代码、输入、评价器和依赖锁文件的摘要。修改这些内容会使原协议失效，应建立新的实验版本，不能把新运行混入已冻结结果。

## 两条 DeepSeek 现场记录

[保存的现场运行包](evidence/research/deepseek-live-20260926/)对同一份合成合同记录了联合方法与完整上下文方法。**每条**有两次 DeepSeek 模型调用、一次合成参考库查询。两条运行各自累计发送 **5,089 字节**和 **6,273 字节**。这只是**单案例说明**，不是 900 次 DeepSeek 实验，也不能证明统计显著性或跨模型的结果质量。原始供应商请求、摘要、接收进程记录、事件帧、生成结果与英文展示译文分开保存；仓库不含 API 密钥。

## 证据边界

- 本机规则执行器能验证逐步控制流程，不能证明语言模型理解质量。
- 900 次实验只覆盖受控合成案例上的结构化结果。开发集与评价集共享任务家族，不能推导真实企业部署或陌生模板泛化。
- 接收端是独立本机进程，记录真实 HTTP 请求。模型适配器另存供应商出口请求，但这些记录不是云厂商独立认证，也不能覆盖旁路出网和侧信道。
- 新授权状态可以阻断**尚未发送**的数据，不能收回已发送内容。
- 执行内核、包含 PDF 解析的 UI 运行、以及逐帧展示的耗时口径不同；页面展示时间不能冒充系统执行时间。
- 合成 PDF 有明确字段；原型不声称能自动理解任意复杂真实合同。

## 仓库与许可

`src/research/` 是执行、视图、策略、接收进程、模型适配和评价代码；`web/` 是从商业产品独立拆出的最小双语研究页面；`fixtures/research/` 存放合成输入与独立评价标签；`evidence/research/` 存放原始记录、冻结协议、统计与截图；`scripts/` 提供复核与绘图命令。本机运行生成的 `data/research/` 默认不进入 Git。

代码采用 [Apache-2.0](LICENSE) 许可。标识与产品名称用于识别本研究演示，软件许可不授予商标权；素材来源见 [ASSETS.md](ASSETS.md)。作者确认的软件署名和单位信息见 [CITATION.cff](CITATION.cff)；论文引用待形成稳定出版记录后再加入。
