# 当前规划器的操作与复现

[English](reproduction-frontier.md) · [完整结果与开发记录](../evidence/frontier-study/README.md) · [证明与前提](live-frontier-proof.md)

## 1. 先运行页面，不需要密钥

安装 Node.js 24，进入仓库根目录：

```sh
npm ci
npm start
```

打开 <http://127.0.0.1:4793/>。选择**真实模型计划 · 本地能力变化**，保留默认的压缩规划方法，点击开始。左边自动推进，右边检查当前步骤；点击旧步骤可查看当时的输入和接收记录，再点击**跟随当前步骤**恢复跟随。右上角切换中英文。

这次运行复用真实 DeepSeek 回复中提出的计算程序，重新执行本地计算和回环 HTTP 请求。首个计算完成后，预先登记的条件撤销本地加减能力；系统保留一个有效结果，剩余两次请求到达 HTTP 接收端。切换**条件变化后全部重跑**，观察多出的工作。条件变化是受控干预，不是模型自行发现的故障。

页面可检查执行位置、输入视图、字段预算、保留状态数、实际请求和返回结果。文件与预览显示来源材料或报告，结束后可下载记录。展示节奏为便于阅读而放慢，实验计时不包含这段等待。短模型计划上贪心和精确规划得到相同最优值；较长负载的算法差异由下面的独立实验验证，不在界面里人为制造。

默认方式**没有新增模型调用**。需要重新生成计划时使用自己的密钥，见[真实模型运行说明](reproduction-v8.zh-CN.md)。开源内容包括记录和接口，不包括任何作者凭据。

## 2. 离线复核已发表的记录

```sh
npm test
node scripts/verify-frontier-study.mjs
python scripts/analyze-frontier-study.py --check
node scripts/sync-paper-evidence.mjs --check
python scripts/audit-paper.py
```

Python 检查只需 3.10 以上标准库，不用安装 SciPy。规划核验应输出 **4,380 条路径、144 个最终最优设置**；它重新计算可行性和成本，并运行当前 JavaScript 规划器，与保存的独立整数规划最优值比较。这一步没有重新启动整数规划求解器。正文数字和原生公式结构分别核查，图文版面还需实际渲染查看。

要重新运行 HTTP 闭环：

```sh
python -m zipfile -e evidence/validation-v8/reproduction-records.zip .
node scripts/run-live-integration.mjs --check
```

应得到 **480 次执行、522 条 HTTP 接收记录**。样本为 48 份旧模型计划 × 五种条件 × 两个执行器，来源仍是 24 道题和此前的 96 次模型调用。时间戳、运行 ID 和耗时不要求逐字一致；请求正文、结果、披露集合及计数必须一致。接收端使用随机回环端口，结束后关闭。

## 3. 完整重跑独立整数规划对照

建议建立单独的 Python 3.10—3.12 环境：

```powershell
python -m venv .venv-frontier
.\.venv-frontier\Scripts\Activate.ps1
python -m pip install -r requirements-frontier.txt
node scripts/run-disclosure-study.mjs --out=data/research/frontier-local
```

Linux 激活命令为 `source .venv-frontier/bin/activate`。若 `python` 未指向新环境，设置 `PYTHON` 为该环境解释器的完整路径。

脚本重新生成 48 个最终负载、三档预算，并执行逐步贪心、仅退出无关项的消融、完整机制及独立 SciPy/HiGHS 模型。每设置三次，共 1,728 条运行记录，连同协议与源代码快照写入 `data/`。已经完成的输出目录会被拒绝；下一次换一个目录名。**公开证据不会被覆盖。**

目标依次最小化不同新增披露项、工作量、字段次数，同时遵守阶段字段预算。最终公开结果为：完整机制 144/144 达到独立最优值，消融 129/144 完成，贪心 48/144 达到相同最优值。状态上限、超时或未证明最优的结果都计为失败，不能从分母中删去。

## 4. 在自己的机器上计时

关闭其他重负载程序，再运行：

```sh
node scripts/time-disclosure-study.mjs --out=data/research/frontier-timing
```

采用公开最终负载，每设置预热一次、测量五次，并轮换方法顺序。JavaScript 计入规划本身；Python 计入整数模型构造和求解，不计进程导入和进程间通信。每次实际重新计算贪心，没有使用缓存结果代替计时。记录写入新的本地目录。

公开机器参数见 [machine.json](../evidence/frontier-study/machine.json)。本次没有独占隔离 CPU；比较中位数、尾部及失败数，不能要求不同机器的毫秒数相同。

## 5. 如何理解结论

- 新算法只在**已登记、输出等价**的候选中精确选择，不自动判定自然语言摘要是否足够。
- 退出的是搜索状态中的项目标识，完整运行历史没有删除。新步骤出现后使用完整历史重规划。
- 分解的是披露成本，实际执行顺序保持原样；共享副作用不在分解前提内。
- 不同披露项减少，可能伴随重复传输增加。字段计数不是推断隐私泄露的度量。
- 原始模型答案只有 28/48 与题目标签一致；执行程序正确不等于模型理解正确。

## 常见问题

| 问题 | 处理 |
| :-- | :-- |
| 4793 被占用 | PowerShell 设置 `$env:DEMO_PORT='4794'` 后重启，访问新端口 |
| 提示模型记录不存在 | 先解压 v8 记录；页面内置示例不需要这一步 |
| 找不到 SciPy | 在 `PYTHON` 指向的解释器中安装 `requirements-frontier.txt` |
| 输出目录已存在 | 换一个新的 `--out=data/...`，不要覆盖公开记录 |
| 想验证浏览器 | 启动后运行 `npm run test:frontier-ui`；Linux 先执行 `npx playwright install chromium` |
| 想更换验证地址 | 设置 `DEMO_BASE`，例如 `http://127.0.0.1:4794` |

全部路径、输入、结果和限制见[结果目录](../evidence/frontier-study/README.md)。作者 ORCID、暂缓的视频和真人盲审仍为独立待办，不能由算法脚本代替。
