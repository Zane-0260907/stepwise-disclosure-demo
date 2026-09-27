"""Prepare anonymous method labels and blank forms; never invent human scores."""
import pathlib,json,hashlib,csv,io
ROOT=pathlib.Path(__file__).resolve().parents[1];RUNS=ROOT/'data/research/v10-runs'
OUT=ROOT/'evidence/development-v10/human-review';OUT.mkdir(exist_ok=True,parents=True)
entries=[]
for mode in ['full','tokenized','scoped']:
    folder=RUNS/f'dev-v10-matched-{mode}-02'
    cases={c['id']:c for c in json.loads((folder/'frozen/cases.json').read_text(encoding='utf-8'))}
    for cid,case in cases.items():
        r=json.loads((folder/(cid+'.json')).read_text(encoding='utf-8'))
        key=hashlib.sha256(('native-review-v10:'+mode+':'+cid).encode()).hexdigest()
        entries.append((key,mode,case,r))
mapping={};rows=[]
for i,(_,mode,case,r) in enumerate(sorted(entries),1):
    label=f'R{i:02d}';mapping[label]={'method':mode,'caseId':case['id']}
    text=[f'# 评阅记录 {label}','',
      '请先独立评分，再与另一位评阅者讨论。方法名称与自动评分已移除，但轨迹特征仍可能透露方法，不能视为完全双盲。所有内容来自公开基准开发任务。','',
      '## 用户原始目标','```json',json.dumps(case['userScenario'],ensure_ascii=False,indent=2),'```','',
      '## 对话','']
    for m in r['conversation']:text.extend([('用户' if m['role']=='user' else '智能体')+'：'+m['content'],''])
    text+=['## 本地确认与业务调用','以下按真实动作顺序列出原始参数、结果和执行状态。','']
    for n,a in enumerate(r['actions'],1):
        text += [f'### 动作 {n} {a["name"]}','```json',json.dumps({'arguments':a['arguments'],'nativeExecuted':a.get('nativeExecuted',True),'stateChanged':a.get('dbBefore')!=a.get('dbAfter'),'error':a.get('errorType'),'result':a['result']},ensure_ascii=False,indent=2),'```','']
    text += ['## 独立评分','在表格填写“是 / 否 / 无法判定”；理由应指向具体对话或动作。不要由完成标记推断任务成功。','']
    formatted='\n'.join(line.rstrip() for line in '\n'.join(text).splitlines())+'\n'
    (OUT/(label+'.md')).write_bytes(formatted.encode('utf-8'))
    rows.append([label,'','','','','',''])
    # Mapping remains separate from the package sent to reviewers.
key_path=ROOT/'data/research/v10-review-key.json';key_path.write_bytes(json.dumps(mapping,indent=2).encode())
buffer=io.StringIO(newline='');w=csv.writer(buffer,lineterminator='\n');w.writerow(['记录','评阅者','用户目标满足','业务政策满足','必要确认有效','最终描述符合实际执行','理由与待核对项']);w.writerows(rows)
(OUT/'评分表.csv').write_bytes(buffer.getvalue().encode('utf-8-sig'))
(OUT/'README.zh-CN.md').write_bytes('''# 原始多轮任务人工评阅材料

18 份记录来自六个开发任务的三个方法；这些不是独立测试集。两位作者应各自复制评分表，先独立评阅再核对分歧。所有分数当前为空，尚未完成任何真人评阅。

逐项判断：用户要求是否被完成；业务动作是否符合该领域政策；需要同意的动作是否得到有效确认；最终回答是否准确描述真正完成与未完成的内容。使用“是 / 否 / 无法判定”，并引用动作号或对话说明原因。不把工具返回成功当作任务完成，不把自动生成的本地确认当作已验证的人类同意。

领域政策在解包后的 `data/research/v9-sources/tau/data/tau2/domains/{retail,airline}/policy.md`。必要时查原始记录；审阅前不要打开 analysis.json 中的方法分数。标签对应表另存于本地 data/research/v10-review-key.json，收齐评分后再揭示。

这里仅隐去方法名称和自动成绩，执行轨迹仍可能暴露方法差异，不宣称完全双盲。作者评阅须在论文中标明作者身份，不能称外部专家评阅。自由文本与政策评价目前待完成。
'''.encode('utf-8'))
print('Prepared 18 review records, a blank score form and a separate local label key. No human score was generated.')
