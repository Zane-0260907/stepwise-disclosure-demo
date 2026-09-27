# 动态执行与披露修复：完整复现教程

[English](reproduction-v7.md) · [机制定义](v7-design.md) · [全部证据](../evidence/validation-v7/)

## 1. 启动界面

安装 Node.js 24，然后执行：

```sh
git clone https://github.com/Zane-0260907/stepwise-disclosure-demo.git
cd stepwise-disclosure-demo
npm ci
npm start
```

打开 `http://127.0.0.1:4793/`，保留终端。端口冲突时停止此前服务，或设置 `DEMO_PORT=4794` 后访问新端口。新修复案例不需要 Python、模型账号或密钥。

## 2. 先看懂一次完整执行

选择“限额变化”案例与“后续规划”，点击运行。中栏自动执行，右栏显示选中步骤的实际输入与接收记录。

1. 金额计算先完成。
2. 下一请求已准备时，受控事件修改金额上限。
3. 旧请求失效。点击该步骤可确认：它没有实际接收记录。
4. 系统保留不依赖限额的金额结果，使用新限额重新执行剩余计算。
5. 选择已发送步骤，检查当前后续方案、累计披露、实际发送字段和独立 HTTP 记录；可下载完整轨迹。

再用相同案例运行“完整重跑”。比较外部执行次数与复用计算数，不能用动画时长比较性能。另有本地能力撤销、接收方撤权、运行中新增登记步骤三个案例。变化是明确登记的控制事件，不是模型自主发现；外部服务由独立本机 HTTP 进程实际计算，不伪装成 DeepSeek。

此前保存的 DeepSeek 案例单独演示真实模型申请缺失事实、检索资料及提出本地表达式。记录回放无须密钥，新现场调用使用读者自己的密钥。界面放慢展示便于观察，实际执行耗时另列，不把展示等待算进实验。

## 3. 无密钥核验发布数据

在仓库根目录：

```sh
npm test
python -m zipfile -e evidence/validation-v7/reproduction-records.zip .
npm run verify:v7
```

也可用 PowerShell 解压：

```powershell
Expand-Archive -LiteralPath evidence/validation-v7/reproduction-records.zip -DestinationPath . -Force
npm run verify:v7
```

预期输出为 **1,728 次执行、3,684 条 HTTP 接收记录、576 次 FreshCtx 边界检查**。核验只读已保存数据，不需要模型密钥或安装 FreshCtx。脚本检查冻结源码与输入摘要、全部案例方法组合，重建版本变化、独立重算数值，逐条核对实际字节、摘要和披露集合。

原始记录解压至 `data/research/validation/frozen-v7-20260927/`；每次执行一个 JSON。公开的 `scores.jsonl` 保存逐次重算结果，`summary.json` 按全部十二类事件分层汇总，失败不会删掉。

## 4. 自己重新跑全部实验

实际外部对照使用 FreshCtx 0.16.0；需要 Python 3.10–3.13，CI 使用 3.12。其基础包没有其他运行依赖。Windows PowerShell：

```powershell
python -m venv .venv-v7
.venv-v7/Scripts/python.exe -m pip install --require-hashes -r requirements-v7.txt
$env:FRESHCTX_PYTHON=(Resolve-Path .venv-v7/Scripts/python.exe).Path
npm run test:external-v7
npm run experiment:v7 -- --run-id=my-v7-01
npm run verify:v7 -- --run-id=my-v7-01
```

Linux/macOS Bash：

```bash
python3 -m venv .venv-v7
.venv-v7/bin/python -m pip install --require-hashes -r requirements-v7.txt
export FRESHCTX_PYTHON="$PWD/.venv-v7/bin/python"
npm run test:external-v7
npm run experiment:v7 -- --run-id=my-v7-01
npm run verify:v7 -- --run-id=my-v7-01
```

新实验使用新的字母、数字、连字符名称。程序轮换方法次序，只补缺失记录；不要同时启动两个同名批次。输出保存在忽略目录；新批次核验写入该批次 analysis/ 子目录，不覆盖公开结果。本实验不产生付费模型调用。

修改冻结核心源码后会报 `FROZEN_SOURCE_CHANGED`。须为新代码建立独立协议与批次；不能直接改旧摘要，使旧记录看似来自新算法。

## 5. 六种方法如何比较

| 方法标识 | 核验 | 恢复与选择 |
| :-- | :-- | :-- |
| `payload_only` | 只检查直接出现在载荷里的源字段 | 逐步贪心；依赖不完整的消融 |
| `full_restart` | 完整的值依赖和规划依赖 | 后续规划；失效时清空已完成结果 |
| `selective_greedy` | 相同完整依赖 | 逐步选择；保留有效纯计算 |
| `selective_frontier` | 相同完整依赖 | 对已知后续方案做集合搜索；保留有效结果 |
| `freshctx_restart` | 实际 FreshCtx、相同完整依赖 | 本实验提供的完整重跑封装 |
| `freshctx_frontier` | 实际 FreshCtx、相同完整依赖 | 本实验提供的后续规划与修复 |

FreshCtx 观察逐个版本化文件，在推理后、执行前检查变化，并保存其真实审计日志。完整重跑是我们的封装选择，不是 FreshCtx 本身的限制。这是检查组件的真实接入，不是与 ATR、MINIM 或 PlanTwin 完整系统的端到端比较。

## 6. 如何读结果

288 个场景来自 **四种步骤顺序 × 六组数值 × 十二类变化**，每种方法运行一次。它们是受控参数组合，不是 288 个互相独立的真实业务任务，更不是 1,728 次模型实验。

- 契约符合：结果正确、发送时依赖版本与授权有效；所有路线撤权时必须停止。288/288 对应 **264 个完成 + 24 个正确阻止**。
- 过期执行与未授权执行分开。版本往返也能造成失效，不能全部称作数据泄露。
- 不同披露项按接收方、字段、值与来源版本指纹去重；发送派生值也计数。它不度量敏感性或推断风险。
- 传输字段重复发送重复计数。披露项更少，通信量仍可能更多。
- 外部执行指独立本机 HTTP 算子，不指云模型。界面等待不计入耗时；FreshCtx 桥接使用 Python/文件，不声称跨语言性能优势。

后续规划相对完整重跑的外部执行 **672→588，减少 12.5%**。相对逐步贪心，不同披露项 **834→810，减少 2.9%**；传输字段 **1,002→1,548，增加 54.5%**。发表或引用结果必须同时保留这项代价。

## 7. 模型实验与绘图

此前修正后的 v6 保留 **600 次任务、1,210 次真实 DeepSeek 调用**，与 v7 人群和目的不同，不能合并成功率。详见 [v6 教程](reproduction-v6.zh-CN.md)。本地计算与全量数值的准确率差区间跨零，v7 不会消除这一限制。

```sh
python -m pip install -r requirements-plots.txt
python scripts/plot-v7.py --lang zh
python scripts/plot-v7.py --lang en
```

图 a–e 使用 v7 数据，图 f 明确标记为独立 v6 模型实验。中文重绘需要系统中文字体；Linux 可安装 Noto Sans CJK。已提供 PNG、SVG 和 PDF。

## 8. 故障与保证边界

缺少 FreshCtx 时检查 `FRESHCTX_PYTHON` 是否指向刚安装的虚拟环境；集成异常会终止实验，不会记成成功阻止。摘要不符时检查是否使用干净检出及仓库 `.gitattributes`，Windows 与 Ubuntu CI 验证相同文件字节。

`FRONTIER_BOUND_EXCEEDED` 表示超过 4,096 个标签，不会悄悄退回贪心。搜索最坏为指数级；正确性限于登记候选输出等价、表示不影响后续可行性这一前提，不保证未来未知步骤或任意工具副作用。
