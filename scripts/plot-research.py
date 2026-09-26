"""Render figures from recorded results; never synthesize data or intervals."""
from pathlib import Path
import argparse
import json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--lang',choices=['zh','en'],default='zh')
lang=parser.parse_args().lang
en=lang=='en'
folder=root/'evidence'/'research'/'results'
data=json.loads((folder/'summary.json').read_text(encoding='utf-8'))
cases=json.loads((folder/'case-aggregates.json').read_text(encoding='utf-8'))
font=next((p for p in [Path('C:/Windows/Fonts/msyh.ttc'),Path('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')] if p.exists()),None)
if font: font_manager.fontManager.addfont(str(font));plt.rcParams['font.family']=font_manager.FontProperties(fname=str(font)).get_name()
plt.rcParams.update({'font.size':8.5,'axes.linewidth':.75,'axes.spines.top':False,'axes.spines.right':False,'pdf.fonttype':42,'svg.fonttype':'none','savefig.facecolor':'white'})
methods=['full','pii','entry','per_step','joint'];labels=['Full context','PII masking','Entry projection','Step projection','Joint decision'] if en else ['完整上下文','普通脱敏','入口裁剪','逐次裁剪','完整机制'];colors=['#999999','#ffa526','#f34539','#76a9c8','#2677ad']
summ={r['method']:r for r in data['summary']}
fig=plt.figure(figsize=(12.4,4.5),layout='constrained');grid=fig.add_gridspec(1,3,width_ratios=[1,1.1,1.5])
ax=fig.add_subplot(grid[0]);ys=np.arange(5)
for i,m in enumerate(methods):
    r=summ[m];v=r['structuredSuccess']*100;lo,hi=np.array(r['successCI'])*100
    ax.errorbar(v,i,xerr=[[max(0,v-lo)],[max(0,hi-v)]],fmt='o',color=colors[i],markersize=6,elinewidth=1.1,capsize=3)
ax.set_yticks(ys,labels);ax.invert_yaxis();ax.set_xlim(0,103);ax.set_xlabel('Strict structured success (%)' if en else '严格结构检查通过率（%）');ax.set_title('a  Task outcome' if en else 'a  任务结果',loc='left',fontweight='bold',pad=13);ax.grid(axis='x',color='#e4e6e8',linewidth=.5);ax.set_axisbelow(True)
ax=fig.add_subplot(grid[1]);ids=sorted({r['caseId'] for r in cases});lookup={(r['caseId'],r['method']):r for r in cases}
for caseid in ids:
    vals=[lookup[(caseid,m)]['unnecessary'] for m in methods]
    ax.plot(range(5),vals,color='#9ab2c5',alpha=.18,linewidth=.65,zorder=1)
for i,m in enumerate(methods):
    vals=np.array([lookup[(c,m)]['unnecessary'] for c in ids]);unique,counts=np.unique(vals,return_counts=True)
    ax.scatter(np.full(len(unique),i),unique,s=counts*4+8,c=colors[i],alpha=.8,edgecolors='white',linewidth=.5,zorder=3)
    ax.plot([i-.16,i+.16],[vals.mean()]*2,color='#222222',linewidth=1.5,zorder=4)
ax.set_xticks(range(5),['Full\ncontext','PII\nmask','Entry\nview','Step\nview','Joint\ndecision'] if en else ['完整\n上下文','普通\n脱敏','入口\n裁剪','逐次\n裁剪','完整\n机制']);ax.set_ylabel('Unnecessary facts per task' if en else '每任务多余事实传输次数');ax.set_title('b  Paired case comparison' if en else 'b  逐案例配对比较',loc='left',fontweight='bold',pad=13);ax.grid(axis='y',color='#e4e6e8',linewidth=.5);ax.set_axisbelow(True)
inner=grid[2].subgridspec(1,2,wspace=.17)
for j,recipient in enumerate(['cloud-model','reference-service']):
    ax=fig.add_subplot(inner[j]);x=np.arange(5)
    total=np.array([summ[m]['byRecipient'][recipient]['total'] for m in methods]);extra=np.array([summ[m]['byRecipient'][recipient]['unnecessary'] for m in methods])
    ax.bar(x,total-extra,color='#76a9c8',width=.64,label='Required' if en else '当前操作所需');ax.bar(x,extra,bottom=total-extra,color='#e1b17e',width=.64,label='Unnecessary' if en else '多余内容')
    ax.set_xticks(x,['Full','PII','Entry','Step','Joint'] if en else ['全量','脱敏','入口','逐次','完整'],rotation=55,ha='right');ax.set_ylim(bottom=0);ax.set_ylabel('Mean facts sent per task' if j==0 and en else ('每任务平均事实传输次数' if j==0 else ''))
    ax.set_title(('c  ' if j==0 else '')+(('Cloud model' if j==0 else 'Reference service') if en else ('云端模型' if j==0 else '资料服务')),loc='left',fontweight='bold',pad=13)
    ax.grid(axis='y',color='#e4e6e8',linewidth=.5);ax.set_axisbelow(True)
    if j==1:ax.legend(frameon=False,fontsize=7.5,loc='upper right')
fig.get_layout_engine().set(rect=(0,.14,1,.83))
fig.text(.01,.055,'60 synthetic cases × 5 methods × 3 repeats; case-level bootstrap intervals. In b, dot area counts overlapping cases; lines pair the same case.' if en else '60 个合成案例 × 5 种方法 × 3 次重复；区间按案例自助抽样。b：圆点面积表示重合案例数，细线连接同一案例。',fontsize=8,color='#52606b')
fig.text(.01,.015,'Success checks structured labels, amounts and references only; free text was not independently reviewed. Failures remain in the denominator.' if en else '通过率仅检查结构化分类、金额及引用；自由文本尚未独立人工评审。失败运行计入分母；接收记录统计已实际发送的内容。',fontsize=8,color='#52606b')
suffix='.en' if en else ''
for ext in ['png','svg','pdf']:fig.savefig(folder/f'experiment-overview{suffix}.{ext}',dpi=220)
plt.close(fig)
print(folder/f'experiment-overview{suffix}.png')
