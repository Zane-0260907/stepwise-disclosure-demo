# 从启动到复核最新实验

这份指南对应 v6：600 次任务、1,210 次真实 DeepSeek 调用、60 页公开表格和 57 份公司年度报告。旧表格实验存在已确认的表头转换问题，见[更正说明](table-adapter-correction.md)。最新数字、界面案例和历史记录分开保存。

## 一 无密钥体验界面

安装 Node.js 24，在克隆的仓库根目录执行：

```sh
npm ci
npm start
```

打开 `http://127.0.0.1:4793/`。这条路径不需要 Python、模型密钥或商业客户端。页面中的“本机规则执行器”“真实记录重放”“DeepSeek 现场调用”含义不同：前两者免费离线可用，只有现场调用会请求模型。

先点左侧**结构核对 · 本地计算**，等待自动推进：

1. 选择“核对表结构与数值角色”，检查年份被保留为表头，而业务数值仍在本地。
2. 选择“规划当前计算步骤”，右侧看到问题、表结构及本次未发送的数值。展开原始表头、单元格标签或实际请求，即可核对最终字节。
3. 选择“在本地执行计算”，检查有限算式及实际读取的源字段。营运资金例使用 2015 年和 2016 年的两个本地值，得到约 `0.2543097574`，即 25.43% 的增幅。数值结果没有发回模型。
4. 重放同一问题的**结构核对 · 全数值对照**，查看两种路径的请求差异。两条记录均来自真实调用；这个开发示例不属于 600 次测试任务。

再看**补充必要事实**：模型申请缺失的延期天数，本地授权后构造下一次请求。该次调用同时索取多余合同金额，解释中也有错误比较，原始记录没有删改。**引用条款**展示新资料查询步骤：资料服务只接收编号与版本。**发送前人工撤权**有一个专门的干预点；其他正常任务无需反复点击继续。

中栏自动执行，右栏按当前步骤跟随。点击旧步骤会暂停跟随，点“跟随当前步骤”恢复。“文件”“预览”和下载按钮展示该次运行的输入、结果及记录。为了看清过程，回放间隔经过调整；实验时间始终来自原始执行，不把等待动画算进去。

## 二 无密钥复算 600 次任务

安装 Python 3.10 或更新版本，仅用于标准库解压。命令均从仓库根目录执行：

```sh
npm test
python -m zipfile -e evidence/validation-v6/reproduction-records.zip .
npm run verify:v6
node scripts/verify-corrected-showcase.mjs
```

如果本机 Python 命令叫 `python3`，替换命令名即可。解压只写入已忽略的 `data/research/validation/`，不会安装模型或产生付费请求。

预期输出为 `jobs: 600`、`verifiedProviderCalls: 1210`、`verifiedPrograms: 1310`、`reports: 57`。演示案例另核对三次运行、五次供应商调用，不混入实验总数。

| 方法 | 正确／计划任务 | 外发业务数值／任务 | 真实调用 |
|:--|--:|--:|--:|
| `full_once` 全量数值 | 96/120 | 14.833333 | 120 |
| `local_once` 单次本地计算 | 98/120 | 0 | 120 |
| `requested_cells` 按需单元格 | 94/120 | 2.416667 | 236 |
| `blind_review` 无数值复核 | 95/120 | 0 | 366 |
| `conflict_review` 分歧补充 | 96/120 | 0.075 | 368 |

验证器会重新检查冻结源码摘要、完整任务清单、旧报告排除、原表数值及表头角色，并重新执行每个有限算式。它也检查候选规范化、补充字段选择、最终程序、请求长度和摘要，以及每条接收记录对应的唯一供应商请求与响应。统计结果来自重新评分，不是复制汇总表。

`summary.json` 是统计汇总，`case-aggregates.json` 是案例内平均值，`scores.jsonl` 是逐任务评分，`failures.json` 保留失败。要追查某次错误，用其中的 `runId` 打开解压目录下同名运行文件，再匹配 `provider-egress/` 中的真实请求。

## 三 自备密钥生成新记录

若只想现场体验，停止自己之前启动的服务，在 Windows PowerShell 运行：

```powershell
./scripts/start-demo.ps1 -UseDeepSeek
```

脚本通过隐藏输入读取个人密钥。不要把密钥粘进源码、README 或浏览器代码；仓库不提供作者的密钥。

若要重新执行完整 600 次实验，使用新名字；这会产生付费模型调用：

```powershell
$secret = Read-Host 'DeepSeek API key' -AsSecureString
$env:DEEPSEEK_API_KEY = [System.Net.NetworkCredential]::new('', $secret).Password
try {
  npm run experiment:v6 -- --run-id=my-v6-01
} finally {
  Remove-Item Env:DEEPSEEK_API_KEY
}
node scripts/verify-v6.mjs --run-id=my-v6-01
```

Linux/macOS 的 Bash：

```bash
read -rsp 'DeepSeek API key: ' DEEPSEEK_API_KEY; echo
export DEEPSEEK_API_KEY
npm run experiment:v6 -- --run-id=my-v6-01
unset DEEPSEEK_API_KEY
node scripts/verify-v6.mjs --run-id=my-v6-01
```

同名运行只恢复缺失作业；已完成的错误答案不会为了提高分数重跑。并发锁防止两个进程同时写同一实验。进程崩溃后，先确认已经退出，再删除该实验目录中的 `running.lock` 并恢复。新记录写入 `data/research/validation/my-v6-01/`，复算输出在其 `analysis/` 内，不覆盖公开证据。服务升级和模型随机性可能改变新结果；无密钥复算旧记录与重新调用模型是两回事。

## 四 实验到底比较什么

所有方法使用相同的完整表结构、权限、模型和本地解释器。全量方法发送全部业务值；单次本地计算只发送结构；按需方法先申请至多 12 个单元格。后两种多方案方法都先生成三个候选，并在不一致时复核，只有分歧补充方法发送至多三个额外字段。因为增加的调用没有带来可靠收益，它被标为实验选项，默认仍是单次本地计算。

数据来自固定版本的公开 FinQA，遵循 MIT 许可。只保留表格内可解、算子受支持、原始操作数可唯一定位的题目；原标注用于定义兼容子集及独立评分，不发给模型。本轮按固定摘要顺序选择页面，并排除 v4/v5 已用公司年度报告；不是完整 FinQA 基准，也无法证明模型训练时从未见过。

答案容差为 `0.00005`，异常和失败计入分母。字段按实际请求累计，重复发送重复计数。两次重复先在案例内平均，再按年度报告进行 4,000 次配对重采样。单次本地计算相对全量的差为 +1.67 个百分点，区间为 −5.83 至 +9.02，不能声称显著优于或不劣。

零业务数值外发仍暴露问题、行列标签、年份和单位；合法的算式也可能答错题。分歧补充中有 18 次任务的三个候选结构一致但结果错误。真人解释质量评阅仍待完成，不把自动数值评分说成专家认可。

## 五 重绘与故障处理

```sh
pip install -r requirements-plots.txt
python scripts/plot-v6.py --lang zh
python scripts/plot-v6.py --lang en
```

统计图的 PNG、SVG、PDF 都由真实记录生成。Word 构建方法见 `paper/zh-CN/README.md`。浏览器检查需先启动服务，再运行 `npm run test:corrected-ui`；Windows 使用 Edge，其他系统可安装 Playwright Chromium。可用 `DEMO_BASE` 指定检查地址。

端口被占用时停止自己的旧服务，或设置 `DEMO_PORT`。冻结摘要失败时请使用干净克隆，不要重写协议让错误“通过”。模型报错不影响无密钥回放和复算。旧批次仍可分别复核，见[历史 v4 教程](reproduction-v4.md)及[完整英文技术说明](reproduction-v6.md)；不要合并不同版本的成功率。
