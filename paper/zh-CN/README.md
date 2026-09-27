# 中文最新稿

- `按步执行与信息共享_中文最新稿.docx`：可编辑正文，六个原生 OMML 公式及英文伪代码。
- `按步执行与信息共享_中文最新稿.pdf`：由同一 Word 文件导出的四页阅读版。
- `公式与算法源码.md`：逐条 LaTeX 公式及等价算法源码。
- `build_paper.py`、`layout.py`、`equations.omml.json`：构建源文件与原生公式缓存。

正文围绕“已登记执行位置与接收方视图的精确选择”组织，分开报告三类证据：

- 最终规划实验：48 个构造负载、144 个预算设置；完整机制 144/144 与独立整数规划一致，消融完成 129/144。表 1 报告正确性与状态上限，表 2 报告不同披露项和重复字段传输的交换关系。
- 实际执行集成：48 份真实模型计划、五种条件、两个执行器，共 480 次重新执行和 522 条实际 HTTP 接收记录。本轮没有新增模型调用。
- 既有模型质量：24 道题、96 次真实调用；48 份计划中 28 份与原始标签一致。旧实验的调用节省归于结果复用，不归于新规划器。

`evidence.json` 保存正文数字和来源摘要；`node scripts/sync-paper-evidence.mjs --check` 检查来源。`python scripts/audit-paper.py` 核对六个 OMML 公式、三张图、两张表、双栏和关键数字。实际版面另由 Word 导出 PDF 逐页检查。

`build_paper.py` 是入口，`build_current.py` 为当前正文，`layout.py` 管理版式。图 1 沿用认可的系统示意；图 2 是本轮执行器的真实界面截图，附三个编号；图 3 明确保留为旧模型计划的执行证据，新的算法结果在表 1—2。开发失败另见[完整实验目录](../../evidence/frontier-study/README.md)，未改写为成功结果。

重建 Word 需要 Python 3.10+、`python-docx` 和 `lxml`。当前公式缓存已包含所有公式，因此重建不需要 Microsoft Office 的转换样式表。字体使用宋体、黑体、Linux Libertine 与 Cambria Math；字体差异可能影响分页，重建后必须重新检查四页版面。本次由 Microsoft Word 2021 导出 PDF，再用 Poppler 逐页检查；Windows 环境未提供打包 LibreOffice，因此不声称经过 LibreOffice 或 WPS 实机渲染验证。

```sh
pip install python-docx lxml
python paper/zh-CN/build_paper.py
python scripts/audit-paper.py
# Windows with Microsoft Word installed; exports to ignored data/layout-audit/current
pwsh -NoProfile -File scripts/render-paper-windows.ps1
```

这是中文编辑工作稿。正式提交仍需按会议当时有效的英文 ACM `sigconf` 模板核验作者信息、版面和提交字段；不可将这份中文 Word 工作稿直接宣称为已经满足所有投稿条件。ORCID 与真人自由文本评阅仍待作者补充。视频按作者此前安排暂不处理。
