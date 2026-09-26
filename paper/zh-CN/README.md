# 中文最新稿

- `按步执行与信息共享_中文最新稿.docx`：可编辑正文，四个原生 OMML 公式及英文伪代码。
- `按步执行与信息共享_中文最新稿.pdf`：由同一 Word 文件导出的四页阅读版。
- `公式与算法源码.md`：逐条 LaTeX 公式及等价算法源码。
- `build_paper.py`、`layout.py`、`equations.omml.json`：构建源文件与原生公式缓存。

正文使用本轮 256 次同能力强对照和 240 次 FinQA 受限子集任务。图 1 沿用既定设计示意；图 2 是研究界面的实际浏览器截图；图 3 从已复核记录绘制。所有数值对应仓库 `evidence/validation-v4/`，不把旧批次拼接成更大的独立样本。

重建 Word 需要 Python 3.10+、`python-docx` 和 `lxml`。当前公式缓存已包含所有公式，因此重建不需要 Microsoft Office 的转换样式表。字体使用宋体、黑体、Linux Libertine 与 Cambria Math；字体差异可能影响分页，重建后必须重新检查四页版面。

```sh
pip install python-docx lxml
python paper/zh-CN/build_paper.py
```

这是中文编辑工作稿。正式提交仍需按会议当时有效的英文 ACM `sigconf` 模板核验作者信息、版面和提交字段；不可将这份中文 Word 工作稿直接宣称为已经满足所有投稿条件。ORCID 与真人自由文本评阅仍待作者补充。视频按作者此前安排暂不处理。
