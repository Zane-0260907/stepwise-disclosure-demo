# 中文最新稿

- `按步执行与信息共享_中文最新稿.docx`：可编辑正文，六个原生 OMML 公式及英文伪代码。
- `按步执行与信息共享_中文最新稿.pdf`：由同一 Word 文件导出的四页阅读版。
- `公式与算法源码.md`：逐条 LaTeX 公式及等价算法源码。
- `build_paper.py`、`layout.py`、`equations.omml.json`：构建源文件与原生公式缓存。

正文已同步以下证据，未将不同批次混为独立样本：

- 财务路径：24 道公开题、96 次真实调用、48 份模型计划与 1,440 次配对执行。局部复用减少 21.1% HTTP 调用，后续规划相对贪心未显示额外收益。
- 原生业务路径：六个训练任务、54 次开发尝试、952 次真实模型调用。表 1 列出末批三种方法的状态一致结果与六类字段计数，同时说明模拟确认环节仍可见原值。
- 归因核查：固定 12 条轨迹的 107 个提案，仅移除引用用途和来源检查，执行没有改变，因此不把 6/6 作为该检查的因果收益。
- 信息补充执行器：三阶段、两次真实回环 HTTP 的构造检查；未接入模型批次或现有页面，不计入真实任务样本数。

`evidence.json` 从上述原始汇总与轨迹生成，并保存来源 SHA-256。构建脚本读取其中的关键数值。运行 `node scripts/sync-paper-evidence.mjs --check` 核对来源和数字；运行 `python scripts/audit-paper.py` 检查原生公式、双栏、表格、引用和图像结构。

图 1 沿用既定系统示意；图 2 是公开模型计划重新执行的真实浏览器截图，含编号标注，不增加批次样本数；图 3 从 v8 已复核记录绘制。正文报告实际复用收益与后续规划的零新增收益，不声称通用算法首次提出或全面优于已有系统。

重建 Word 需要 Python 3.10+、`python-docx` 和 `lxml`。当前公式缓存已包含所有公式，因此重建不需要 Microsoft Office 的转换样式表。字体使用宋体、黑体、Linux Libertine 与 Cambria Math；字体差异可能影响分页，重建后必须重新检查四页版面。本次由 Microsoft Word 2021 导出 PDF，再用 Poppler 逐页检查；Windows 环境未提供打包 LibreOffice，因此不声称经过 LibreOffice 或 WPS 实机渲染验证。

```sh
pip install python-docx lxml
python paper/zh-CN/build_paper.py
python scripts/audit-paper.py
# Windows with Microsoft Word installed; exports to ignored data/layout-audit/current
pwsh -NoProfile -File scripts/render-paper-windows.ps1
```

这是中文编辑工作稿。正式提交仍需按会议当时有效的英文 ACM `sigconf` 模板核验作者信息、版面和提交字段；不可将这份中文 Word 工作稿直接宣称为已经满足所有投稿条件。ORCID 与真人自由文本评阅仍待作者补充。视频按作者此前安排暂不处理。
