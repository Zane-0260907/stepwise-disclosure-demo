# DeepSeek 现场运行记录

这里保存同一份合成合同的两次真实 DeepSeek API 运行：`joint` 为逐步执行与共享判定，`full` 为完整上下文对照。每项都包含原始运行轨迹、页面事件帧、生成报告、模型出口请求摘要与正文、结构化评价。出口记录不包含 Authorization 请求头或 API 密钥。

这只是两个独立运行，不构成统计实验。模型请求由 `deepseek-flash` 处理；资料查询通过本机独立接收进程访问合成参考库。`translations.json` 仅保存英文界面的结论、建议和参考条款展示文案，不改写 `trace.json` 中的中文模型原文。`evaluation.json` 是既有结构化指标，不是人工文本质量评审。可用 `node scripts/verify-deepseek-records.mjs` 复核文件摘要、接收记录、译文覆盖和评价。
