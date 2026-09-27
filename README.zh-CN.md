<a id="readme-top"></a>

<div align="center">
  <p>
    <a href="https://github.com/Zane-0260907/stepwise-disclosure-demo/actions/workflows/checks.yml"><img alt="自动检查" src="https://github.com/Zane-0260907/stepwise-disclosure-demo/actions/workflows/checks.yml/badge.svg"></a>
    <a href="LICENSE"><img alt="Apache-2.0" src="https://img.shields.io/badge/License-Apache--2.0-315c52.svg"></a>
    <a href="package.json"><img alt="Node.js 24" src="https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white"></a>
  </p>
  <img src="web/assets/hy-mark-dark.svg" alt="氢云研究演示标识" width="86" height="86">
  <h1>逐步共享判定</h1>
  <p>在智能体运行中，决定每一步在哪里执行，以及当前接收方可以获得哪些事实。</p>
  <p>
    <a href="#快速开始"><strong>快速开始 »</strong></a><br>
    <a href="#演示流程">查看演示</a> ·
    <a href="#复核实验">复核结果</a> ·
    <a href="https://github.com/Zane-0260907/stepwise-disclosure-demo/issues">报告问题</a> ·
    <a href="README.md">English</a>
  </p>
</div>

<details>
  <summary><strong>目录</strong></summary>

  - [项目概述](#项目概述)
    - [技术栈](#技术栈)
  - [快速开始](#快速开始)
  - [演示流程](#演示流程)
  - [复核实验](#复核实验)
  - [证据与边界](#证据与边界)
  - [仓库结构](#仓库结构)
  - [参与改进](#参与改进)
  - [许可与引用](#许可与引用)
</details>

## 项目概述

智能体读取本地资料或收到工具结果后，可能在运行中发现新的步骤。新步骤需要的执行能力、接收方和输入可能与前一步不同。本原型在每个登记步骤重新判断：本地规则能够完成的操作留在本地；否则为实际接收方构造字段视图，在最终请求发出前复核，并保存接收方实际获得的内容。

<p align="center"><img src="evidence/frontier-showcase/model.zh-CN.png" alt="中文界面的真实模型计划、能力变化和实际 HTTP 接收视图" width="920"></p>
<p align="center"><em>中文界面的真实 HTTP 修复运行。右栏可逐步检查条件变化、实际发送内容与接收记录。</em></p>

这是使用合成合同、学情记录及公开 FinQA 表格子集的独立研究原型，不是商业客户端。离线执行器采用有限规则；保存的 DeepSeek 记录来自真实模型调用，在页面中作为重放展示。新增数值路径由模型根据表结构提出有限表达式，再由本地解释器读取依赖的数值并计算。

### 技术栈

<p>
  <a href="https://nodejs.org/"><img alt="Node.js" src="https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white"></a>
  <a href="https://developer.mozilla.org/docs/Web/JavaScript"><img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-ES_modules-F7DF1E?logo=javascript&logoColor=111111"></a>
  <a href="https://mozilla.github.io/pdf.js/"><img alt="PDF.js" src="https://img.shields.io/badge/PDF.js-6.3-FFB13B?logo=mozilla&logoColor=111111"></a>
  <a href="https://playwright.dev/"><img alt="Playwright" src="https://img.shields.io/badge/Playwright-UI_tests-2EAD33?logo=playwright&logoColor=white"></a>
  <a href="https://matplotlib.org/"><img alt="Matplotlib" src="https://img.shields.io/badge/Matplotlib-evidence_plots-11557C"></a>
</p>

Node.js 承担步骤规划、接收进程和页面服务；PDF.js 解析合成 PDF。Playwright 检查界面，Python/Matplotlib 从保存的实验记录绘图。当前现场适配器与新一轮实验使用 DeepSeek；原始 Qwen-Plus 批次按原版本保留。

<p align="right"><a href="#readme-top">返回顶部 ↑</a></p>

## 当前版本：可核查的按步执行与精确规划

[四页中文 Word](paper/zh-CN/按步执行与信息共享_中文最新稿.docx) · [PDF](paper/zh-CN/按步执行与信息共享_中文最新稿.pdf) · [公式与伪代码](paper/zh-CN/公式与算法源码.md) · [详细复现教程](docs/reproduction-frontier.zh-CN.md)

新规划器压缩后续不再相关的披露状态，在统一字段预算下组合独立成本分量。完整接收方历史仍然保留；新步骤和条件变化触发重新规划。候选必须预先登记且输出等价，具体前提与正确性见[方法证明](docs/live-frontier-proof.md)。

| 本轮证据 | 结果 | 它说明什么 |
| :-- | :-- | :-- |
| 48 个构造负载、三档预算 | 144/144 与独立整数规划同最优值 | 有限选择问题的精确性 |
| 关键机制消融 | 129/144 完成，其余 15 次达状态上限 | 压缩和分解的实际作用 |
| 真实模型计划的重新执行 | 480 次完成，522 条 HTTP 接收记录 | 方案与实际执行接通 |
| 0% / 25% / 100% 额外字段预算 | 不同披露项减少 1.94% / 14.62% / 27.47% | 收益依赖预算；传输可能增加 |

这些不是 144 道自然任务或新模型调用。原模型计划标签一致性仍为 28/48；规划器不修复模型答案。[全部结果、失败和计时修正](evidence/frontier-study/README.md)均公开。

## 快速开始

**环境要求：**[Node.js 24](https://nodejs.org/)。离线演示和真实记录重放都不需要模型密钥。

```sh
git clone https://github.com/Zane-0260907/stepwise-disclosure-demo.git
cd stepwise-disclosure-demo
npm ci
npm start
```

打开 **http://127.0.0.1:4793/**，保留启动终端。服务默认只监听本机。自动复算检查覆盖 Windows 和 Ubuntu；交互浏览器验收在 Windows 完成。Docker 配置已提供，但未单独完成部署验收。

若要重新发起 DeepSeek 现场调用，请在本地设置 `DEEPSEEK_API_KEY` 后重启。适配器使用 `deepseek-flash` 非思考模式。不要把密钥提交到仓库，也不要把带密钥的实例直接暴露到公网；本演示没有多用户鉴权。

### 第一次应该选择什么

| 方式 | 是否需要密钥 | 实际发生的事情 |
|:--|:--:|:--|
| 本机规则执行器 | 否 | 重新读取合成输入、执行有限规则、生成新记录 |
| 真实模型记录重放 | 否 | 按原有事件顺序展示已经保存的真实请求和回复 |
| DeepSeek 现场运行 | 自备 | 重新请求模型，产生新的步骤、接收记录和结果 |
| 批量实验复核 | 否 | 从公开原始记录重新评分，不请求模型 |

先选择**真实模型计划 · 本地能力变化**，点击开始执行。步骤会自动推进；点击某一步查看右栏中的实际输入和接收记录，点击**跟随当前步骤**恢复自动跟随。**文件**和**预览**显示源材料与结果；执行结束后可下载报告和原始记录。页面放慢展示，不把展示时间算成实验耗时。

### 配置自己的 DeepSeek 现场调用

Windows PowerShell，在仓库根目录执行：

```powershell
./scripts/start-demo.ps1 -UseDeepSeek
```

脚本会以隐藏输入方式询问密钥。先停止已运行的服务终端再重启。密钥只保存在本机进程环境中，不写入源码、网页脚本或公开记录。

Linux / Bash：

```bash
read -rsp 'DeepSeek API key: ' DEEPSEEK_API_KEY; echo
export DEEPSEEK_API_KEY
npm start
# 停止服务后清除变量：
unset DEEPSEEK_API_KEY
```

在页面选择 **DeepSeek · 自备密钥**。若 4793 被占用，启动前设置 `DEMO_PORT=4794`，再访问对应端口。离线演示不需要 Python；下方的 ZIP 解包复算需要 Python 3.10 以上。

<p align="right"><a href="#readme-top">返回顶部 ↑</a></p>

## 演示流程

1. 选择**真实模型计划 · 本地能力变化**，保留默认的压缩规划方法，点击开始。
2. 左栏自动执行；右栏查看执行位置、输入、实际接收正文和预算。首步后本地能力被预定干预撤销，已完成的有效结果得到保留。
3. 点击旧步骤检查，再用**跟随当前步骤**恢复跟随；文件、预览和下载入口保留完整材料。
4. 切换**条件变化后全部重跑**作对照。真实模型计划来自保存的调用，本次计算和 HTTP 请求重新执行，不需要密钥。

页面放慢展示不计入实验耗时。短模型计划不显示贪心与精确规划的最优值差异；较长负载通过独立实验报告。[逐步教程和常见问题](docs/reproduction-frontier.zh-CN.md)。

## 复核实验

```sh
npm test
node scripts/verify-frontier-study.mjs
python scripts/analyze-frontier-study.py --check
python -m zipfile -e evidence/validation-v8/reproduction-records.zip .
node scripts/run-live-integration.mjs --check
```

预期核验 4,380 条记录路径、重新求解 144 个最终设置，并实际复跑 480 次执行。Python 检查只用标准库；这些命令不请求模型。

需要完整重跑独立整数规划或测量自己机器上的耗时，按[完整教程](docs/reproduction-frontier.zh-CN.md#3-完整重跑独立整数规划对照)安装 `requirements-frontier.txt`，运行 `node scripts/run-disclosure-study.mjs --out=data/research/frontier-local`。新记录写入单独目录，保留公开实验不变。

## 证据与边界

- 不同披露项计数不是语义隐私保证；预算放宽 25% 时，披露项减少 14.62%，字段传输增加 18.90%。
- 规划精确性限于登记的等价候选及当前已知后缀；完整运行历史不删除，不预知未知未来。
- 原始模型的错误、开发失败和零收益结果均保留，不合并为一个漂亮的成功率。
- 页面是独立研究界面，商业客户端没有开源。中文稿是编辑工作稿；ORCID、延后的视频和真人盲审尚未补齐。

<details>
<summary><strong>历史实验与开发记录</strong></summary>

- [v8 真实模型计划](docs/reproduction-v8.zh-CN.md)：24 道题、48 份计划、96 次模型调用；原有短任务上的规划增益为零。
- [v7 动态修复](docs/reproduction-v7.md) · [v6 模型实验](docs/reproduction-v6.md)。
- [v9 未通过的候选](evidence/development-v9/README.md) · [v10 原生业务开发](evidence/development-v10/README.md) · [机制归因核查](docs/mechanism-gate.zh-CN.md)。
- [早期适配器修正](docs/table-adapter-correction.md) · [本轮全部阶段](evidence/frontier-study/README.md)。

不同批次不可合并为独立样本；开发结果不等于独立确认。

</details>

## 仓库结构

| 目录 | 内容 |
| :-- | :-- |
| [`src/research/`](src/research/) | 规划、视图、策略复核、接收进程、模型适配与评价 |
| [`web/`](web/) | 与商业产品分离的双语研究界面 |
| [`fixtures/research/`](fixtures/research/) | 合成 PDF、任务目录、引用资料与独立评价标签 |
| [`fixtures/finqa-v6/`](fixtures/finqa-v6/) | 公开表格受限子集、原始数值标签、选择规则与数据许可 |
| [`evidence/validation-v7/`](evidence/validation-v7/) | 保留的受控修复实验协议、全部原始记录、分层结果和双语图表 |
| [`evidence/validation-v6/`](evidence/validation-v6/) | 单独保留的真实模型调用及数值评价 |
| [`evidence/corrected-showcase/`](evidence/corrected-showcase/) | 同一公开表格三种方法的真实记录与双语截图 |
| [`evidence/research/`](evidence/research/) | 冻结协议、运行记录、统计、边界测试、真实调用与截图 |
| [`scripts/`](scripts/) | 输入核验、独立复算、汇总与绘图 |
| [`paper/zh-CN/`](paper/zh-CN/) | 最新中文 Word、四页 PDF、原生公式与构建源文件 |

<p align="right"><a href="#readme-top">返回顶部 ↑</a></p>

## 参与改进

欢迎通过 [GitHub Issues](https://github.com/Zane-0260907/stepwise-disclosure-demo/issues) 提交故障与复现问题。修改实现前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。冻结结果必须保持可复算；改变实验输入或评价器应另建协议版本。

<p align="right"><a href="#readme-top">返回顶部 ↑</a></p>

## 许可与引用

软件以 [Apache-2.0](LICENSE) 开源。仓库中的标识与产品名称用于识别本研究演示，软件许可不授予商标权。素材来源见 [ASSETS.md](ASSETS.md)，软件引用信息见 [CITATION.cff](CITATION.cff)。论文形成稳定出版记录后再补论文引用。

<p align="right"><a href="#readme-top">返回顶部 ↑</a></p>
