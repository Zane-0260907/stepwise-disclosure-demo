"""Four-page Chinese editorial draft with native editable OMML mathematics."""
from layout import *
from docx.enum.text import WD_BREAK

def column_break(doc):
    p=doc.add_paragraph();p.paragraph_format.space_after=Pt(0);p.paragraph_format.space_before=Pt(0)
    p.paragraph_format.line_spacing=Pt(1);p.add_run().add_break(WD_BREAK.COLUMN)

def algorithm(doc):
    p=heading(doc,'算法 1  面向接收方的后续规划与局部修复')
    b=OxmlElement('w:pBdr');n=OxmlElement('w:top');n.set(qn('w:val'),'single');n.set(qn('w:sz'),'6');b.append(n);p._p.get_or_add_pPr().append(b)
    lines=['Input: versioned state S, graph Q, registry R, slack ρ', 'Output: checked results C and disclosure history H', '1:  C ← ∅; H ← ∅; B ← UNSET', '2:  while Q is not empty do', '3:      if StateChanged(S) then', '4:          C ← KeepValidPureResults(C, S)', '5:          Q ← Pending(Q, C); B ← UNSET', '6:      A ← EquivalentAlternatives(S, Q, R)', '7:      if B = UNSET then', '8:          B ← floor((1 + ρ) × Fields(Greedy(A,H)))', '9:      p ← BudgetFrontier(A, H, B)', '10:     if p is infeasible then return BLOCKED', '11:     a ← First(p); CheckCurrent(S, a)', '12:     if a.recipient = local then y ← Evaluate(a)', '13:     else', '14:         bytes ← Serialize(a); CheckCurrent(S, a)', '15:         y, receipt ← SendOnce(bytes)', '16:         VerifyReceipt(receipt, bytes)', '17:         H ← H ∪ DisclosureTokens(a)', '18:     B ← B − NumericFields(a)', '19:     C ← SavePureResult(C, y, SourceDeps(a))', '20:     Q ← RemoveCompleted(Q, a)', '21: return C, H']
    for i,line in enumerate(lines):
        p=doc.add_paragraph();p.paragraph_format.space_after=Pt(0);p.paragraph_format.line_spacing=1.02;p.paragraph_format.keep_with_next=i<len(lines)-1
        run(p,line,8,bold=i<2)
        if i==len(lines)-1:
            b=OxmlElement('w:pBdr');n=OxmlElement('w:bottom');n.set(qn('w:val'),'single');n.set(qn('w:sz'),'6');b.append(n);p._p.get_or_add_pPr().append(b)

def build():
    evidence=json.loads((ROOT/'evidence.json').read_text(encoding='utf8'))
    f=evidence['financial'];business=evidence['business'];paired=evidence['mechanism']
    doc=Document();page(doc.sections[0],1)
    doc.core_properties.title='面向动态智能体任务的按步执行与信息共享'
    doc.core_properties.author='Yaojunzhe Zhai; Chao-Hsien Hsieh'
    doc.core_properties.subject='系统演示：逐步选择执行位置、接收方输入与状态变化后的结果复用'
    doc.core_properties.comments=''
    normal=doc.styles['Normal'];normal.font.name='Linux Libertine';normal.font.size=Pt(9);normal.paragraph_format.space_after=Pt(0)
    p=doc.add_paragraph(style='Title');p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.space_after=Pt(3)
    b=OxmlElement('w:pBdr');n=OxmlElement('w:bottom');n.set(qn('w:val'),'nil');b.append(n);p._p.get_or_add_pPr().append(b)
    run(p,'面向动态智能体任务的按步执行与信息共享',14,True,cjk='SimHei')
    p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.space_after=Pt(2)
    run(p,'Yaojunzhe Zhai¹  ·  Chao-Hsien Hsieh²',9)
    p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.space_after=Pt(4)
    run(p,'¹ Monash University Malaysia   ² Xi’an International University',8)
    col_section(doc)
    heading(doc,'摘要')
    paragraph(doc,f'智能体处理本地资料时，运行中新增的步骤可能需要云端模型或外部工具。沿用完整上下文会扩大共享范围，固定裁剪又可能遗漏后续输入。本文介绍按步执行与信息共享原型：由本地控制器选择登记的执行方式和接收方视图，在发送前核对来源、能力与授权，状态变化后保留仍有效的计算结果。双栏界面将任务步骤与实际接收内容对应展示。{f["questions"]} 道公开财务问题产生 {f["plans"]} 份真实模型计划；受控配对执行中，结果复用使 HTTP 算子调用从 {f["restartCalls"]} 次降至 {f["reuseCalls"]} 次。零售与航空多轮开发任务进一步检验原生业务操作和本地引用绑定。实验分别报告任务答案、执行一致性与实际外发，避免把成功执行等同于语义正确。',first=False,size=9)
    paragraph(doc,'关键词：智能体执行；接收方视图；累计披露；局部修复；系统演示。',first=False,size=8)
    heading(doc,'1  问题与系统目标')
    paragraph(doc,'企业智能体常先读取内部资料，再向云端模型或工具提出请求。以合同检查为例，解释条款需要条款内容，核算金额可能只需几个数值，后续检索又需要新的查询条件。任务开始时通常无法确定所有步骤，因此，每次新增操作都需要重新判断在哪里执行、当前接收方需要哪些输入。')
    paragraph(doc,'即使请求字段没有变化，原来的执行方式也可能失效。例如，本地计算能力被撤销后，待执行步骤必须改用外部服务；已经算出的、来源仍有效的中间结果却无需重复计算。系统需要同时管理执行候选、接收方已见信息与结果来源，而不能仅在任务开始时做一次脱敏。')
    paragraph(doc,'PlanTwin [1] 通过规划抽象和本地门控限制云端观察；PrivScope [2] 按子任务控制披露范围与抽象程度；MINIM [3] 根据敏感性和任务必要性处理界面观察。这些工作已覆盖本地裁剪、抽象与披露控制，本文不将这些组成技术单独作为首次提出的方法。')
    paragraph(doc,'本演示面向智能体应用开发者与数据管理员，将上述决策落实为可检查的执行过程：数值路径比较登记的等价输入并复用有效结果；业务路径以不透明引用保留本地精确值，在执行具体工具时完成绑定。两条路径共用“模型提案—本地核验—实际执行—接收记录”的观察方式，其适用条件和证据分别报告。')
    paragraph(doc,'系统的展示重点是决策与实际数据流之间的对应关系。观众可以检查模型提出的计算，改变本地能力或源值，比较哪些步骤被重算，并直接查看接收端收到的内容。本文贡献为具备可复核执行记录的研究原型，以及对复用、规划和引用检查作用的分项评估；不声称已解决任意自然语言任务的最小充分信息判定。')
    col_section(doc,count=1)
    full_figure(doc,'assets/system.png','图 1  按步执行的系统结构。原始资料保留在本地；模型与工具通过登记出口交互。新步骤或状态变化触发重新判定，外部结果写回本地状态。')

    col_section(doc,WD_SECTION_START.NEW_PAGE,2)
    heading(doc,'2  逐步执行与接收方视图')
    heading(doc,'2.1  执行候选与披露历史',2)
    paragraph(doc,'版本化状态 S 保存源值、授权与本地能力。数值路径中，模型先读取不含业务数值的表结构，再提交计算图；控制器只接受六种登记算子组成的前向程序，所有节点都须参与最终结果。候选 a 指定执行位置、接收方 r 和输入视图 V；视图可以是原值与子表达式，也可以是已算出的直接操作数。')
    paragraph(doc,'一次披露以接收方、源字段或派生表达式及来源版本的指纹标识。令 E(a) 为候选披露项，H 为确认发送的集合；本地执行的 E(a) 为空。每次得到匹配接收记录后更新：')
    math(doc,'<msub><mi>H</mi><mrow><mi>t</mi><mo>+</mo><mn>1</mn></mrow></msub><mo>=</mo><msub><mi>H</mi><mi>t</mi></msub><mo>∪</mo><mi>E</mi><mo>(</mo><msub><mi>a</mi><mi>t</mi></msub><mo>)</mo>',1)
    paragraph(doc,'同一字段发送给不同接收方分别计数；派生值也计数。源版本变化后再次发送计为新项。H 不随重试或局部修复回退。该指标描述显式披露，不度量敏感性，也不排除接收方通过多个值联合推断。')
    heading(doc,'2.2  比较当前已知的后续方案',2)
    paragraph(doc,'设 Q 为当前已知待执行图，P(Q,S) 为满足授权、能力和剩余预算的候选组合；W(p) 是本地及接收端实际求值的算子数，T(p) 是发送的数值字段次数。原始字段重复发送仍计入 T，新增披露集合为：')
    math(doc,'<mi>D</mi><mo>(</mo><mi>p</mi><mo>)</mo><mo>=</mo><mo>(</mo><munder><mo>⋃</mo><mrow><mi>a</mi><mo>∈</mo><mi>p</mi></mrow></munder><mi>E</mi><mo>(</mo><mi>a</mi><mo>)</mo><mo>)</mo><mo>∖</mo><mi>H</mi>',2)
    math(doc,'<msup><mi>p</mi><mo>∗</mo></msup><mo>=</mo><munder><mtext>arg min lex</mtext><mrow><mi>p</mi><mo>∈</mo><mi>P</mi><mo>(</mo><mi>Q</mi><mo>,</mo><mi>S</mi><mo>)</mo></mrow></munder><mo>(</mo><mo>|</mo><mi>D</mi><mo>(</mo><mi>p</mi><mo>)</mo><mo>|</mo><mo>,</mo><mi>W</mi><mo>(</mo><mi>p</mi><mo>)</mo><mo>,</mo><mi>T</mi><mo>(</mo><mi>p</mi><mo>)</mo><mo>)</mo>',3)
    paragraph(doc,'式（3）依次比较不同披露项、算子求值与传输字段。阶段开始时，以相同状态下逐步贪心的传输量为基准设预算 B；默认不增加字段，敏感性设置允许增加 10% 或 25%。执行每一步都扣减同一余额，不能重新取得整份额度。')
    math(doc,'<mi>B</mi><mo>=</mo><mo>⌊</mo><mo>(</mo><mn>1</mn><mo>+</mo><mi>ρ</mi><mo>)</mo><mi>T</mi><mo>(</mo><msub><mi>p</mi><mi>g</mi></msub><mo>)</mo><mo>⌋</mo>',4)
    paragraph(doc,'同一深度的标签记录披露集合、累计求值与传输 (E,w,b)。下式成立时第二个标签可被剪枝：')
    math(doc,'<msub><mi>E</mi><mn>1</mn></msub><mo>⊆</mo><msub><mi>E</mi><mn>2</mn></msub><mo>∧</mo><msub><mi>w</mi><mn>1</mn></msub><mo>≤</mo><msub><mi>w</mi><mn>2</mn></msub><mo>∧</mo><msub><mi>b</mi><mn>1</mn></msub><mo>≤</mo><msub><mi>b</mi><mn>2</mn></msub>',5)
    paragraph(doc,'若候选输出等价且后续可行性不依赖表示，追加同一后缀保持集合包含与两项成本关系，因此剪枝不会丢失受限问题的最优解。未来派生值用表达式及源版本标识，无需预先计算其数值。最坏搜索仍为指数级，超过 4,096 个标签明确失败。')
    heading(doc,'一个逐步选择失效的例子',2)
    paragraph(doc,'设两个步骤均可向服务甲发送同一对原值 {x,y}；另一条路径向服务乙分别发送一个派生值 {u} 与两个不同派生值 {v,w}。逐步贪心先选乙，只披露一项；第二步无论选哪条路径，累计都至少为三项。后续规划连续选择甲，累计只有两项，但会传输四个字段。该例说明为什么披露集合与传输次数须分别衡量。')
    column_break(doc)
    heading(doc,'2.3  核验决策，而不只核验请求字段',2)
    paragraph(doc,'控制器区分两类依赖：源值决定结果是否仍有效；能力和授权决定执行方式是否仍可行。发送前，两类依赖的记录版本都必须与当前版本一致：')
    math(doc,'<mi>Δ</mi><mo>=</mo><msub><mi>Δ</mi><mtext>值</mtext></msub><mo>∪</mo><msub><mi>Δ</mi><mtext>规划</mtext></msub><mo>,</mo><mspace width="0.3em"/><mo>∀</mo><mi>k</mi><mo>∈</mo><mi>Δ</mi><mo>:</mo><mi>v</mi><mo>(</mo><mi>k</mi><mo>)</mo><mo>=</mo><msub><mi>v</mi><mtext>当前</mtext></msub><mo>(</mo><mi>k</mi><mo>)</mo>',6)
    paragraph(doc,'源版本、当前能力和授权在序列化前同步检查；状态变化后重新选择剩余步骤，缓存仅按值依赖判断是否保留。受控版本往返测试使用单调版本号。已失效结果不得作为新请求的操作数，未用源字段改变则不使该结果失效。')
    algorithm(doc)
    paragraph(doc,'算法 1 在每个状态稳定阶段维持一个余额。阶段内，剩余旧方案为下一次受限选择提供可行解；累计实际发送字段因而不超过阶段预算。新的干预会开启新阶段，这个局部界限不能替代整轮任务的实测传输量。')
    paragraph(doc,'接收端记录原始字节、摘要与结果，核验器逐请求重算。新模型图实验使用同一 Node 进程内的回环 HTTP 监听器；真实模型请求由另一个代理保存供应商载荷与响应摘要。它们均不构成供应商签名回执或生产分布式事务证明。')
    paragraph(doc,'自动复用仅限登记的无副作用计算。接收授权撤销不能收回既往披露；网络返回不确定时停止，不假设未获回执就没有信息外发。任意脚本、带副作用工具及不可信控制器均不在保证范围内。')
    heading(doc,'2.4  业务绑定与信息补充',2)
    paragraph(doc,'业务适配器将六类登记字段替换为不透明引用，在原生工具调用前恢复精确值，并可检查目标参数和来源当前值；改变业务状态的操作另需本地确认。独立的信息补充执行器只接受已登记的结构需求，在本地完成、派生结果与获准原值之间选择，拒绝模型自行扩大的字段请求。它已通过构造案例的真实 HTTP 检查，尚未接入本文批量模型实验；其有限契约不能判定自由文本是否充分。')

    col_section(doc,WD_SECTION_START.NEW_PAGE,1)
    full_figure(doc,'../../evidence/model-showcase-v8/paper-ui.png','图 2  公开财务表格的实际执行界面。① 从保存的真实模型回复创建计算步骤；② 受控撤销本地能力，保留已完成结果；③ HTTP 接收端收到中间值与所需源值。截图为冻结批次中一个计划的独立重执行，裁去导航并添加编号，不增加测试样本数。',width=6.65)
    col_section(doc)
    heading(doc,'3  交互演示')
    paragraph(doc,'界面沿用客户端的双栏任务布局。左侧执行自动推进，右侧随选中步骤展示接收方、发送内容、保留字段与接收记录。观众可暂停跟随检查旧请求，再回到当前步骤；无需逐步点击才能完成任务。展示节奏单独放慢，不计入实验耗时。')
    paragraph(doc,'场景一展示公开财务表格。模型通过真实工具调用读取表结构，提交“相加、相加、相除”的计算图。观众运行保存的计划；首步完成后，预定事件撤销本地加减能力。系统保留首步结果，把后续计算交给 HTTP 算子。切换完整重跑，首步会重复执行。右栏显示这一差异对应的实际请求，观众无需从最终统计数字猜测发生了什么。')
    paragraph(doc,'场景二比较已用与未用源值更新。前者使相关结果失效，后者保留已有计算。右侧显示发送的原值或中间值，以及本阶段剩余预算。全本地设置展示不需要外部数值服务的情况；混合能力是受控配置，不表示加减乘除天然需要云端。两种干预均由程序执行，不是截图中的装饰性状态。')
    paragraph(doc,'无密钥模式重用真实模型计划，重新执行计算与 HTTP 请求。现场模型调用使用读者自己的密钥；密钥不随仓库发布。合同案例保留模型运行中提出检索步骤的记录。零售和航空适配器提供独立批次与离线复核命令，尚未并入图 2 的可视界面，因此不将其描述为已完成的页面演示。')
    column_break(doc)
    heading(doc,'4  实验设计')
    paragraph(doc,'数值实验在模型调用前冻结提示词、执行器、评价器与事件安排。FinQA [4] 子集包含 24 题、24 份此前未用的公司年度报告，原 test 与 dev 划分各 12 题；兼容筛选限定可由表格和登记算子处理的问题，另四题仅作开发。执行器不读取答案标签。')
    paragraph(doc,'每题生成两份 DeepSeek 计划，每份使用两次工具调用，共 48 份计划、96 次请求。各计划在五种条件下比较完整重跑、复用加贪心、无预算后续规划及三档预算方法。五种条件为全本地、混合能力稳定、已用值更新、未用值更新和能力撤销。每种方法 240 次执行，共 1,440 次；它们共享计划，不是独立模型样本。')
    paragraph(doc,f'业务开发实验使用 τ²-bench [5] 的三个零售和三个航空训练任务，保留原生工具、状态和参数校验，增加统一的本地确认层。比较完整工具返回、普通引用与受限引用；每种方法最后一批各执行六个任务。开发过程中共 {business["attempts"]} 次尝试、{business["allModelCalls"]} 次真实调用，所有失败保留。这六个任务被反复使用，不能作为独立测试集。')
    paragraph(doc,'数值评价区分模型答案与按图执行一致性，并按源问题聚类统计。业务评价检查完整数据库是否与参考操作所得状态一致，不冒充官方综合得分。另固定普通与受限引用的全部末批轨迹，在两个新数据库中仅切换引用检查；若结果分歧即停止，避免把后续保存动作误当成有效反事实。')

    col_section(doc,WD_SECTION_START.NEW_PAGE,1)
    full_figure(doc,'../../evidence/validation-v8/tradeoffs.zh-CN.png','图 3  新模型图实验，每种方法 240 次配对执行。a、b：实际 HTTP 调用与数值字段传输；c：按干预条件拆分；d：R、G、F 分别为重跑、贪心与后续规划，后三项为传输预算设置。本批次的五种修复方法结果相同，不支持额外规划收益。',width=6.78)
    col_section(doc)
    heading(doc,'5  结果与讨论')
    paragraph(doc,f'数值路径中，{f["plans"]} 份计划均可执行，但原问题标签一致性仅为 {f["labelMatches"]}/{f["plans"]}。结果复用将 HTTP 调用从 {f["restartCalls"]} 次降至 {f["reuseCalls"]} 次，减少 {f["reductionPct"]:.1f}%；数值字段传输从 {f["restartFields"]} 次降至 {f["reuseFields"]} 次。按 24 题聚类的探索性自助区间为 [19.1%, 23.8%]。收益主要来自能力撤销和未用源值变化后的结果保留。')
    paragraph(doc,'图 3 中，贪心、后续规划和三档预算的披露项及传输字段均相同，未观察到规划的额外收益。按图执行一致也不意味着答案正确：错误涉及年份选择、差值方向和百分比单位；两道疑似标签错误的平均数题仍保留原评分，未据此提高结果。')
    table(doc,'表 1  原生业务开发任务的末批结果',[
        ['方法','状态一致','原值出现','检查拒绝'],
        *[[name,f'{r["stateMatches"]}/{r["attempts"]}',str(r['protectedToolLeavesShownRaw']),str(r['bindingGuardRefusals'])]
          for name,r in zip(['完整返回','普通引用','受限引用'],business['methods'])]
    ],[1.02,.73,.81,.77])
    paragraph(doc,'“原值出现”仅统计发给规划模型的不同工具消息中六类登记字段的非空原值，排除用户对话和确认模拟器；它不是语义泄露率。普通引用同样将该计数降为零，不能把这一效果归于新增用途检查。',first=False,size=8)
    paragraph(doc,f'为核查表 1 的完成差异，对两种引用方法的 {paired["recordedTrajectories"]} 条轨迹、{paired["actionsCompared"]} 个业务提案逐一切换检查。两侧调用和最终状态全部一致。这说明本批次没有体现新增检查的执行收益；不同采样对话中的 4/6 与 6/6 不足以建立因果关系。')
    column_break(doc)
    heading(doc,'6  适用范围与开放实现')
    paragraph(doc,'系统已实现可视执行、版本核验、有效结果复用和原生业务工具适配。证据支持这些组件能够运行并被复核，也支持受控变化下的复用收益；尚不支持后续规划或受限引用优于强对照。登记视图的等价性来自本地规则，不能推广为自动理解任意业务内容。')
    paragraph(doc,'实验仅使用一个模型。业务任务的用户与确认环节也由 DeepSeek 模拟，后者可见原始参数，因此不能宣称模型供应商完全看不到原值。数据库一致性不覆盖全部业务政策；人类对自由文本解释和操作合理性的评阅尚未完成。软件检查、开发样本与独立质量评价不能互相替代。')
    paragraph(doc,'开源包独立于商业客户端，包含双语页面、任务输入、真实模型记录、接收记录和离线核验器。构造的信息补充案例可重跑三阶段决策与两次 HTTP 发送，但不计入模型实验。所有失败、无收益结果和版本来源均保留；读者可以追溯正文数字并复核界面所示过程。',space=1)
    paragraph(doc,'代码与复现：https://github.com/Zane-0260907/stepwise-disclosure-demo',first=False,size=7.7)
    heading(doc,'参考文献')
    refs=[
      '[1] G. Yu 等. PlanTwin: Privacy-Preserving Planning Abstractions for Cloud-Assisted LLM Agents. arXiv:2603.18377, 2026.',
      '[2] S. R. Seeam 等. PrivScope: Task-scoped Disclosure Control for Hybrid Agentic Systems. arXiv:2605.16630, 2026.',
      '[3] H. Yu 等. MINIM: Privacy-Aware Minimal View for Agents via Trusted Local Sanitization. arXiv:2606.13949, 2026.',
      '[4] Z. Chen 等. FinQA: A Dataset of Numerical Reasoning over Financial Data. EMNLP, 2021, 3697–3711.',
      '[5] V. Barres 等. τ²-Bench: Evaluating Conversational Agents in a Dual-Control Environment. arXiv:2506.07982, 2025.'
    ]
    for text in refs:
        p=paragraph(doc,text,first=False,size=8,space=1,align=WD_ALIGN_PARAGRAPH.LEFT);p.paragraph_format.left_indent=Inches(.14);p.paragraph_format.first_line_indent=Inches(-.14)
    view=OxmlElement('w:view');view.set(qn('w:val'),'print');doc.settings.element.insert(0,view)
    doc.save(OUT);print(OUT)

if __name__=='__main__':build()
