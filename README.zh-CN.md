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

<p align="center"><img src="evidence/research/ui/07-deepseek-recorded-result.png" alt="中文界面中保存的 DeepSeek 运行记录、步骤时间线和接收方视图" width="920"></p>
<p align="center"><em>中文界面中的 DeepSeek 真实记录重放。右栏可逐步检查实际发送内容与接收记录。</em></p>

这是使用合成合同与学情记录的独立研究原型，不是商业客户端。离线执行器采用有限规则；保存的 DeepSeek 记录来自真实模型调用，但在页面中作为重放展示。界面明确区分两种模式。

### 技术栈

<p>
  <a href="https://nodejs.org/"><img alt="Node.js" src="https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white"></a>
  <a href="https://developer.mozilla.org/docs/Web/JavaScript"><img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-ES_modules-F7DF1E?logo=javascript&logoColor=111111"></a>
  <a href="https://mozilla.github.io/pdf.js/"><img alt="PDF.js" src="https://img.shields.io/badge/PDF.js-6.3-FFB13B?logo=mozilla&logoColor=111111"></a>
  <a href="https://playwright.dev/"><img alt="Playwright" src="https://img.shields.io/badge/Playwright-UI_tests-2EAD33?logo=playwright&logoColor=white"></a>
  <a href="https://matplotlib.org/"><img alt="Matplotlib" src="https://img.shields.io/badge/Matplotlib-evidence_plots-11557C"></a>
</p>

Node.js 承担步骤规划、接收进程和页面服务；PDF.js 解析合成 PDF。Playwright 检查界面，Python/Matplotlib 从保存的实验记录绘图。可选的现场模型适配器调用 DeepSeek；冻结批次使用 Qwen-Plus。

<p align="right"><a href="#readme-top">返回顶部 ↑</a></p>

## 快速开始

**环境要求：**[Node.js 24](https://nodejs.org/)。离线演示和真实记录重放都不需要模型密钥。

```sh
git clone https://github.com/Zane-0260907/stepwise-disclosure-demo.git
cd stepwise-disclosure-demo
npm ci
npm start
```

打开 **http://127.0.0.1:4793/**。服务默认只监听本机。目前完成验收的是 Windows；Docker 与 Linux 入口可供尝试，尚未完成接受性验证。

若要重新发起 DeepSeek 现场调用，请在本地设置 `DEEPSEEK_API_KEY` 后重启。适配器使用 `deepseek-flash` 非思考模式。不要把密钥提交到仓库，也不要把带密钥的实例直接暴露到公网；本演示没有多用户鉴权。

<p align="right"><a href="#readme-top">返回顶部 ↑</a></p>

## 演示流程

先选择**本机规则执行器**，再比较以下合成案例：

| 案例 | 应检查的内容 |
| :-- | :-- |
| 标准条款 | 解析 PDF，本地规则完成步骤，不发送模型分析请求。 |
| 引用条款 | 运行中新增资料查询；经核验的视图到达独立本机 HTTP 接收进程，下一步使用返回的指定版本资料。 |
| 发送前撤权 | 在暂停点撤销授权，待发请求被阻断；允许后的另一轮运行产生可对照的接收记录。 |

点击中栏步骤，可检查接收方、实际发送事实、本地保留事实、请求摘要与结果。离线执行器每次重新解析 PDF、执行规则并保存新记录，但不能证明语言模型理解能力。左栏两条 **DeepSeek 重放**无需密钥，不会重新请求供应商。页面放慢的展示节奏不计入实验耗时。

<p align="right"><a href="#readme-top">返回顶部 ↑</a></p>

## 复核实验

冻结批次 `frozen-v1-20260925` 包含 **60 个合成案例 × 5 种方法 × 每例 3 次重复，共 900 次任务运行**；云端模型配置为 Qwen-Plus，一次任务可能包含多次模型调用。五种方法均在本仓库实现；其中四种是本项目的机制对照，并非对外部系统的复现。

主指标是按独立标签核验的**严格结构化任务通过率**，不等于专业人员对自由文本的评审。先在案例内汇总三次重复，再计算配对差异。

| 方法 | 结构化任务通过率 | 每任务平均多余发送事实数 |
| :-- | --: | --: |
| 完整上下文 | 76.7% | 9.6 |
| 普通个人信息遮盖 | 75.0% | 4.6 |
| 入口裁剪 | 82.2% | 0.33 |
| 逐步裁剪、固定执行域 | 82.8% | 0 |
| 联合逐步判定 | **91.1%** | **0** |

<p align="center"><img src="evidence/research/results/experiment-overview.svg" alt="由冻结运行记录生成的中文五方法实验图" width="900"></p>
<p align="center"><em>图中数值来自保存的运行记录；区间与配对比较以案例为单位，不将 900 次重复视作独立案例。</em></p>

检查控制路径、合成输入及保存的真实调用记录：

```sh
npm run check:inputs
npm test
npm run test:boundaries
node scripts/verify-deepseek-records.mjs
```

**无须模型密钥**，从 900 份保存的任务记录重新评分：

```sh
python -m zipfile -e evidence/research/reproduction-records.zip .
node scripts/verify-recorded-scores.mjs frozen-v1-20260925
node scripts/summarize-research.mjs frozen-v1-20260925
```

解压内容进入被 Git 忽略的 `data/research/experiments/`。重绘中文图表需安装 Python 3.11+ 和 `requirements-plots.txt`，再运行 `npm run plot`；Linux 上的中文标签可能需要 CJK 字体。[冻结协议](evidence/research/frozen-protocol.json)保存源码与输入摘要；修改核心、输入、评价器或锁文件后，应建立新的实验版本。

详细数值、区间、失败记录和逐案例结果在 [`evidence/research/results/`](evidence/research/results/)。

<p align="right"><a href="#readme-top">返回顶部 ↑</a></p>

## 证据与边界

[DeepSeek 真实记录包](evidence/research/deepseek-live-20260926/)保存了同一份合成合同的联合方法与完整上下文对照。**每条**各有两次模型调用和一次合成资料查询，累计外发请求分别为 **5,089 字节**与 **6,273 字节**。这是单案例轨迹，不属于 900 次 Qwen-Plus 冻结批次，也不是跨模型质量比较。原始请求、摘要、接收记录、事件帧、结果与英文展示译文分别留存，仓库不包含密钥。

- 批次只检验受控合成任务的结构化结果。开发与评价共享操作家族，不能据此推断陌生模板泛化或真实企业部署效果。
- 独立本机接收进程记录真实 HTTP 请求，模型适配器另存出站请求。这些是应用层审计记录，不是云服务商认证，也不能覆盖任意旁路流量。
- 授权变化可以阻断**尚未发送**的内容，不能收回已经发出的事实。
- 多余事实计数只覆盖登记的结构化字段，不能识别语义推断或登记出口之外的泄漏。
- 内核耗时、端到端耗时和界面播放时间口径不同；放慢播放的时长不作为执行速度。

<p align="right"><a href="#readme-top">返回顶部 ↑</a></p>

## 仓库结构

| 目录 | 内容 |
| :-- | :-- |
| [`src/research/`](src/research/) | 规划、视图、策略复核、接收进程、模型适配与评价 |
| [`web/`](web/) | 与商业产品分离的双语研究界面 |
| [`fixtures/research/`](fixtures/research/) | 合成 PDF、任务目录、引用资料与独立评价标签 |
| [`evidence/research/`](evidence/research/) | 冻结协议、运行记录、统计、边界测试、真实调用与截图 |
| [`scripts/`](scripts/) | 输入核验、独立复算、汇总与绘图 |

<p align="right"><a href="#readme-top">返回顶部 ↑</a></p>

## 参与改进

欢迎通过 [GitHub Issues](https://github.com/Zane-0260907/stepwise-disclosure-demo/issues) 提交故障与复现问题。修改实现前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。冻结结果必须保持可复算；改变实验输入或评价器应另建协议版本。

<p align="right"><a href="#readme-top">返回顶部 ↑</a></p>

## 许可与引用

软件以 [Apache-2.0](LICENSE) 开源。仓库中的标识与产品名称用于识别本研究演示，软件许可不授予商标权。素材来源见 [ASSETS.md](ASSETS.md)，软件引用信息见 [CITATION.cff](CITATION.cff)。论文形成稳定出版记录后再补论文引用。

<p align="right"><a href="#readme-top">返回顶部 ↑</a></p>
