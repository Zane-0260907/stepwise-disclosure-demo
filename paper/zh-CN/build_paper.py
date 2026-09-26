"""Chinese editorial manuscript. Build with python-docx and native OMML equations."""
from layout import *
from docx.enum.text import WD_BREAK

def column_break(doc):
    p=doc.add_paragraph();p.paragraph_format.space_after=Pt(0);p.paragraph_format.space_before=Pt(0)
    p.paragraph_format.line_spacing=Pt(1);p.add_run().add_break(WD_BREAK.COLUMN)

def algorithm(doc):
    p=heading(doc,'算法 1  按步执行与出域判定')
    b=OxmlElement('w:pBdr');n=OxmlElement('w:top');n.set(qn('w:val'),'single');n.set(qn('w:sz'),'6');b.append(n);p._p.get_or_add_pPr().append(b)
    lines=[
      'Input: state S, operation registry R, policy P',
      'Output: local result and checked execution trace',
      '1:  while a registered operation o is pending do',
      '2:      if LocalRule(o, S) is applicable then',
      '3:          S ← Merge(S, LocalRule(o, S)); continue',
      '4:      (r, K) ← InitialView(o, R, S)',
      '5:      repeat within the registered round limit',
      '6:          B ← Serialize(o, Project(S, K))',
      '7:          T ← Bind(o, r, P.version, S[K], B)',
      '8:          RequireCurrentAndUnchanged(T)',
      '9:          y, receipt ← SendOnce(T, B)',
      '10:         RequireMatchingReceipt(receipt, B)',
      '11:         if y requests additional fields G then',
      '12:             RequireAllowedNewFields(G, o, r)',
      '13:             K ← K ∪ G',
      '14:         else if y requests local program p then',
      '15:             z, D ← InterpretChecked(p, S)',
      '16:             S ← Merge(S, z, D); break',
      '17:         else if y requests a reference then',
      '18:             S ← Merge(S, CheckedLookup(y))',
      '19:             K ← RebuildView(o, r, S)',
      '20:         else S ← Merge(S, Validate(y)); break',
      '21:     RequireOperationComplete(o)',
      '22: return AssembleLocally(S), Trace',
    ]
    for i,line in enumerate(lines):
        p=doc.add_paragraph();p.paragraph_format.space_after=Pt(0);p.paragraph_format.line_spacing=1.05;p.paragraph_format.keep_with_next=i<len(lines)-1
        run(p,line,8,bold=i<2)
        if i==len(lines)-1:
            b=OxmlElement('w:pBdr');n=OxmlElement('w:bottom');n.set(qn('w:val'),'single');n.set(qn('w:sz'),'6');b.append(n);p._p.get_or_add_pPr().append(b)

def build():
    doc=Document();page(doc.sections[0],1)
    doc.core_properties.title='面向动态智能体任务的按步执行与信息共享'
    doc.core_properties.author='Yaojunzhe Zhai; Chao-Hsien Hsieh'
    doc.core_properties.subject='系统演示：按步执行、接收方视图与可复核记录'
    doc.core_properties.comments=''
    normal=doc.styles['Normal'];normal.font.name='Linux Libertine';normal.font.size=Pt(9);normal.paragraph_format.space_after=Pt(0)
    p=doc.add_paragraph(style='Title');p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.space_after=Pt(3)
    b=OxmlElement('w:pBdr');n=OxmlElement('w:bottom');n.set(qn('w:val'),'nil');b.append(n);p._p.get_or_add_pPr().append(b)
    run(p,'面向动态智能体任务的按步执行与信息共享',14,True,cjk='SimHei')
    p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.space_after=Pt(2)
    run(p,'Yaojunzhe Zhai¹  ·  Chao-Hsien Hsieh²',9)
    p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.space_after=Pt(4)
    run(p,'¹ Monash University Malaysia   ² Xi’an International University',8)
    heading(doc,'摘要')
    paragraph(doc,'智能体运行中出现的新步骤，会改变执行位置、接收方及所需输入。一次性裁剪可能给后续工具多发信息，也可能遗漏下一步计算的必要事实。本文演示一个按步执行原型：已支持的操作在本地完成，外部步骤使用接收方视图；模型可以申请缺失事实或提出受限计算表达式，本地控制器分别核验权限、执行依赖和最终请求。双栏界面把任务推进与实际出站记录对应起来。我们补充了同能力强对照及公开表格验证，共 496 次新任务、592 次 DeepSeek 调用。合成任务中，按需补充与获准字段全量对照分别通过 57/64 和 58/64 次，前者减少多余传输但增加调用；公开表格中，只发送结构并在本地计算减少了原始数值外发，却降低了通过率。演示据此呈现完成任务、共享范围和执行代价之间的可核对取舍。',first=False,size=8.6)
    paragraph(doc,'关键词：智能体执行；数据视图；按需取数；本地计算；系统演示。',first=False,size=8)
    heading(doc,'1  问题与系统目标')
    paragraph(doc,'一份合同规定按延期天数计费。云端已收到条款，但延期天数仍在本地；如果不能申请补充，模型可能把“未传输”误判成“源数据不存在”。随后出现的资料查询只需要编号和版本，不需要合同金额或身份。任务推进改变了信息需求，执行位置和发送内容应随当前步骤重新确定。')
    full_figure(doc,'assets/system.png','图 1  按步执行与出域核验。原始资料在本地保存；模型和工具只通过登记出口交互。任务产生新步骤后重新确定执行位置与输入，结果回到本地状态。')
    col_section(doc)
    paragraph(doc,'本原型围绕三个可观察的决定展开：哪些操作可由本地能力完成；外部接收方当前需要看到什么；准备好的请求到真正发送时是否仍获准。它既要防止无关上下文沿工具链继续传播，也要允许任务在信息不足时继续执行。')
    paragraph(doc,'相关工作已研究本地规划抽象与受限能力 [1]、工具参数最小化 [2]、任务相关观察视图 [3]，以及保持回答效用的信息裁剪 [4]。本地网关、动态取数与计算下推均有先例。')
    column_break(doc)
    paragraph(doc,'本文的贡献是把这些决定落实为带有执行依赖与实际请求证据的交互原型，并用同能力对照检验其收益和代价，不主张提出通用最优共享算法。')
    paragraph(doc,'系统提供两条具体路径：缺少事实时申请获准字段；可表达为有限算式时，把模型提出的计算交给本地解释器。我们同时公开两条路径的失败结果，使观众能够检查“发送更少”和“完成更好”是否在同一任务上成立。')

    col_section(doc,WD_SECTION_START.NEW_PAGE,2)
    heading(doc,'2  按步执行机制')
    heading(doc,'2.1  执行位置与接收方视图',2)
    paragraph(doc,'本地状态 S 保存原始事实和后来取得的资料。每个登记操作 o 对应候选执行能力与接收方 r。确定性本地规则适用时直接执行；否则，按当前操作构造字段集合 K，并发送其投影视图：')
    math(doc,'<msub><mi>V</mi><mi>t</mi></msub><mo>=</mo><msub><mi>π</mi><msub><mi>K</mi><mi>t</mi></msub></msub><mo>(</mo><msub><mi>S</mi><mi>t</mi></msub><mo>)</mo>',1)
    paragraph(doc,'t 表示一次外部调用。初始选择器使用登记字段与文本规则，可能漏选；它不被假定为充分或最优。模型同时获知可申请字段的名称。若返回字段申请 G，本地检查源字段存在、操作授权、新增性与轮数限制，然后更新 K：')
    math(doc,'<msub><mi>K</mi><mrow><mi>t</mi><mo>+</mo><mn>1</mn></mrow></msub><mo>=</mo><msub><mi>K</mi><mi>t</mi></msub><mo>∪</mo><msub><mi>G</mi><mi>t</mi></msub><mo>,</mo><mspace width="0.4em"/><msub><mi>G</mi><mi>t</mi></msub><mo>⊆</mo><mi>A</mi><mo>(</mo><mi>o</mi><mo>,</mo><mi>r</mi><mo>)</mo>',2)
    paragraph(doc,'A(o,r) 是授权集合，独立于评价标签。身份、联系方式、账号、内部备注和无关记录不能通过业务事实接口申请。获准不等于必要：模型仍可能多索取合同金额。合同与学习任务最多补充两轮、分析六轮；超限或越权明确失败。')
    paragraph(doc,'若模型请求资料，控制器为该接收方新建视图，只发送登记编号与版本；返回正文和出处写入 S，后续分析再使用。先前获准给模型的字段不会自动传给资料服务。原型支持登记操作，不支持任意工具或任意网址。')
    heading(doc,'2.2  将可表达的计算留在本地',2)
    paragraph(doc,'数值任务提供另一种选择：云端先读问题及行列结构，提出由加、减、乘、除等有限算子组成的表达式 p。参数只能是获准字段、常数或前序结果。解释器拒绝未知算子、循环引用、非有限结果和不参与最终输出的中间计算，不执行模型生成的脚本。')
    paragraph(doc,'解释器返回计算值及实际读取的字段集合 Read(p)。记录的依赖摘要为：')
    math(doc,'<msub><mi>D</mi><mi>t</mi></msub><mo>=</mo><mi>H</mi><mo>(</mo><msub><mi>S</mi><mi>t</mi></msub><mo>[</mo><mi>Read</mi><mo>(</mo><msub><mi>p</mi><mi>t</mi></msub><mo>)</mo><mo>]</mo><mo>)</mo>',3)
    paragraph(doc,'实现逐字段保存摘要，结果在本地组装。本路径中，云端不接收表格数值或计算返回值；问题、标签和单位仍然可见。依赖记录说明程序读了哪些值，并不能证明程序正确理解了问题，也不能排除从问题或表结构推断信息。')
    paragraph(doc,'例如公开表格中的占比问题，模型根据行列标签提出 r1c1 除以 r2c1。本地读取 7,367 和 72,238，计算得到约 0.101982，并保存这两个单元格的依赖。其余数值不参与计算。若模型把分子与分母选反，权限检查仍可能通过，因此程序合法与答案正确必须分开评价。')
    column_break(doc)
    heading(doc,'2.3  复核最后实际发送的内容',2)
    paragraph(doc,'视图确定后，请求仍可能被改写。控制器为最终序列化载荷 B 建立一次性凭据，绑定操作、接收方、授权版本 v、所用源字段摘要 D 与请求摘要：')
    math(doc,'<msub><mi>T</mi><mi>t</mi></msub><mo>=</mo><mo>(</mo><msub><mi>o</mi><mi>t</mi></msub><mo>,</mo><msub><mi>r</mi><mi>t</mi></msub><mo>,</mo><msub><mi>v</mi><mi>t</mi></msub><mo>,</mo><msub><mi>D</mi><mi>t</mi></msub><mo>,</mo><mi>H</mi><mo>(</mo><msub><mi>B</mi><mi>t</mi></msub><mo>)</mo><mo>)</mo>',4)
    paragraph(doc,'发送前任一绑定项改变即拒绝。内部凭据与展示副本分离，避免修改展示元数据影响源值核验。接收进程记录实际字节；适配器另外记录加入固定非思考参数后的供应商载荷，两者由复算脚本对应核验。')
    algorithm(doc)
    paragraph(doc,'算法中的操作接口和轮数由登记表限定。模型提出的新步骤保存父步骤和工具调用标识；本地补充与下一次实际发送分别记录。控制器及适配器须可信，性质只覆盖登记出口；它不能阻止网络旁路，也不能撤回已经发送的信息。')
    heading(doc,'2.4  依赖检查的含义与代价',2)
    paragraph(doc,'依赖只包含本步使用的源值。若延期天数改变，已准备的相关请求必须重新核准；若只修改未使用的内部备注，当前请求仍可继续。外发字段与本地计算依赖分开记录：本地程序读取一个数值，不意味着该数值曾被发送；同样，某个字段未出现在本次请求中，也不意味着它此前从未外发。')
    paragraph(doc,'对含 m 个节点的有限表达式，解释器顺序检查并计算各节点，再遍历最终结果的依赖，时间与空间均为 O(m)。请求核验随使用字段和载荷长度线性增长。这里能保证的是访问范围、序列化一致性和可重算性；是否选对算式、是否需要所申请字段，仍由任务评价检验。')

    col_section(doc,WD_SECTION_START.NEW_PAGE,1)
    full_figure(doc,'assets/interaction.png','图 2  真实 DeepSeek 记录的执行详情。① 模型提出缺失事实申请，触发本地核验与后续分析；② 右栏对应当前步骤的实际发送和本次保留字段；③ 本地组装结果。该例正确计算 1,150 元，但额外索取合同总额，且解释存在无根据的金额比较；记录保留这一缺陷。',width=6.35)
    col_section(doc)
    heading(doc,'3  交互演示')
    paragraph(doc,'演示采用独立研究界面，沿用客户端任务布局。中栏自动推进，右栏显示选中步骤的执行位置、输入、保留字段和接收记录。观众可以取消跟随查看某一步，也可下载请求体、计算表达式和完整轨迹。新增步骤由实际工具调用触发，不由预设动画生成。')
    paragraph(doc,'首先运行本地规则适用的标准条款，修改金额后重新执行，观察数值变化及零外部调用。然后运行图 2 的补充案例：每日 230 元的条款最初缺少延期天数，模型申请后获得 5 天，再完成计算。选择前后两次分析，可比较接收内容的变化；案例也说明数值正确不保证解释正确。')
    paragraph(doc,'第三个场景是运行中查找指定版本资料。查询步骤只含编号和版本，后续分析增加正文。观众可在发送前撤权，对比请求被阻断与已产生接收记录的轨迹。第四个场景使用公开财务表格：对照发送全部数值、按需获取单元格和本地解释器三种路径，展开模型提出的算式与本地依赖。')
    paragraph(doc,'实现由 Node.js 控制器、独立 HTTP 接收进程和双语网页构成。合成 PDF 用 PDF.js 读取并与登记字段核对；公开表格读取结构化文件，PDF 仅作预览。无密钥时可执行有限本地规则或重放保存的真实调用；现场 DeepSeek 运行使用读者自己的密钥。展示间隔单独放慢，实验耗时不含这部分时间。')
    column_break(doc)
    heading(doc,'4  实验设计')
    paragraph(doc,'实验前冻结代码、输入、标签和调用配置，历史批次单独保留。以下实验均使用 deepseek-flash、temperature=0，每例重复两次，失败与异常全部进入分母。合成强对照共 32×4×2=256 次任务；公开表格共 40×3×2=240 次。592 次实际供应商调用均与接收记录逐项对应。')
    paragraph(doc,'合成部分复用已公开的 32 例，属于强对照复验，不是新留出集。四种方法共享本地规则、模型提示、评价器和资料服务视图：按需补充；关闭补充；提前发送全部获准业务字段；预取全部登记业务数值。后两者均排除五类私有字段，避免把泄露身份的弱基线当作主要优势来源。')
    paragraph(doc,'公开部分来自 FinQA [5] 的官方测试数据。按固定摘要顺序选择 40 个页面，涉及 38 份公司年度报告；只保留标注依赖表格、算子受支持且操作数可唯一定位的题目。这是受限子集，不是完整基准。只用三个开发集题目检查接口和输出单位，测试标签从未作为执行输入。公开数据可能在模型训练中出现。')
    paragraph(doc,'公开表格三种方法共享问题、表结构、解释器及评价器。全量方法先提供所有数值；按需方法先请求至多 12 个单元格，只能在这些字段上计算；本地表达式方法只提供结构，由本地读取表达式依赖的值。数值以原标签 exe_ans 评分，绝对容差为 0.00005；不把解释器成功执行当作答对。')

    col_section(doc,WD_SECTION_START.NEW_PAGE,1)
    full_figure(doc,'../../evidence/validation-v4/tradeoffs.zh-CN.png','图 3  强对照与公开表格结果。a–c，合成任务的通过率、多余字段及耗时；d–f，公开子集的数值通过率、实际发送单元格及耗时。次数包含失败；耗时为核心执行时间。上下两组共享量的定义不同，不跨组比较其数值大小。',width=6.78)
    col_section(doc)
    heading(doc,'5  结果与适用边界')
    paragraph(doc,'合成任务按问题代码、金额及引用联合评分。多余传输是各接收请求中不在预定必要字段集合内的字段数之和，同一字段重复发送重复计数。按需补充通过 57/64 次；关闭补充为 50/64，获准字段全量与数值预取均为 58/64。对比关闭补充的增量为 10.94 个百分点，案例配对的描述性 95% 区间为 [1.56, 21.88]。')
    paragraph(doc,'按需补充的多余字段均值为 0.031 次/任务，获准字段全量为 0.563，数值预取为 0.063；模型调用分别为 80、64、64 次。相对全量对照的通过率差为 −1.56 个百分点，区间 [−15.63, 12.50]。因此不能主张完成率更优或等效；当少数数值可预先识别时，直接预取是有竞争力的选择。')
    paragraph(doc,'公开表格的全量、按需、本地表达式分别通过 62/80、53/80 和 51/80 次，每任务发送数值单元格均值分别为 15.425、2.425 和 0。结构规划相对全量下降 13.75 个百分点，按年度报告聚类的区间为 [−24.43, −3.95]；问题理解、符号及单元格选择仍会出错。零原始数值传输是该路径的设计约束，并非零信息泄露证明。')
    paragraph(doc,'区间先在案例内平均重复，再进行 4,000 次配对重采样；表格按报告聚类，合成任务按案例采样。它们仅描述当前集合，不代表真实企业总体。原有请求绑定检查另保留 52 个变更与八个合法对照；本轮补充程序越权、非法引用及展示元数据改写测试。')
    column_break(doc)
    heading(doc,'6  开放实现与局限')
    paragraph(doc,'仓库提供界面、执行器、冻结协议、原始调用、失败样本及无密钥复算教程。所有新结果可从 496 份运行记录重算，旧批次单独保留。模型密钥与商业客户端未进入公开包。自由文本盲审材料已准备，真人评阅尚未完成；本文只报告结构化与数值结果，不宣称专家认可或真实部署成效。')
    paragraph(doc,'本原型说明了可检查的执行控制如何呈现共享取舍。算法仍依赖登记能力，未证明语义最小性，也未运行相关工作的完整系统对照。公开表格的失败结果进一步限定了仅凭结构选择计算的适用范围。',space=1)
    paragraph(doc,'代码与复现：https://github.com/Zane-0260907/stepwise-disclosure-demo',first=False,size=7.7)
    heading(doc,'参考文献')
    for text in [
      '[1] G. Yu 等. PlanTwin: Privacy-Preserving Planning Abstractions for Cloud-Assisted LLM Agents. arXiv:2603.18377, 2026.',
      '[2] W. Li, Y. Xu. ToolMinimize: Auditing and Rewriting LLM Agent Tool Calls to Minimize Privacy Exposure. arXiv:2608.24957, 2026.',
      '[3] H. Yu 等. MINIM: Privacy-Aware Minimal View for Agents via Trusted Local Sanitization. arXiv:2606.13949, 2026.',
      '[4] J. Zhou 等. Operationalizing Data Minimization for Privacy-Preserving LLM Prompting. arXiv:2510.03662, 2025.',
      '[5] Z. Chen 等. FinQA: A Dataset of Numerical Reasoning over Financial Data. EMNLP, 2021, 3697–3711.'
    ]:
        p=paragraph(doc,text,first=False,size=7.3,space=1,align=WD_ALIGN_PARAGRAPH.LEFT);p.paragraph_format.left_indent=Inches(.14);p.paragraph_format.first_line_indent=Inches(-.14)
    view=OxmlElement('w:view');view.set(qn('w:val'),'print');doc.settings.element.insert(0,view)
    doc.save(OUT);print(OUT)

if __name__=='__main__':build()
