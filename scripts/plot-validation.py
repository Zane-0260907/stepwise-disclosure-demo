"""Plot only the independently re-scored, frozen v3 records."""
from pathlib import Path
import json, argparse
import numpy as np
import matplotlib
matplotlib.use('Agg')
from matplotlib import pyplot as plt, font_manager
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--lang',choices=['zh','en'],default='zh');en=parser.parse_args().lang=='en'
folder=root/'evidence'/'validation-v3';data=json.loads((folder/'summary.json').read_text(encoding='utf8'))
font=next((p for p in [Path('C:/Windows/Fonts/msyh.ttc'),Path('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')] if p.exists()),None)
if font:font_manager.fontManager.addfont(str(font));plt.rcParams['font.family']=font_manager.FontProperties(fname=str(font)).get_name()
plt.rcParams.update({'font.size':7.3,'axes.linewidth':.65,'axes.spines.top':False,'axes.spines.right':False,'pdf.fonttype':42,'svg.fonttype':'none','savefig.facecolor':'white'})
methods=['full','pii','entry','per_step','no_acquisition','placement_full','joint']
names=['Full context','PII masking','Entry view','Per-step view','No acquisition','Matched local + full','Full mechanism'] if en else ['完整上下文','普通脱敏','入口视图','逐步视图','关闭事实补充','同本地规则＋全文','完整机制']
colors=['#999999','#ffa526','#f34539','#76a9c8','#b0b0b0','#505050','#2677ad']
lookup={r['method']:r for r in data['summary']}
fig=plt.figure(figsize=(7.0,2.85),layout='constrained');grid=fig.add_gridspec(1,3,width_ratios=[1.15,1.0,1.05])
ax=fig.add_subplot(grid[0]);y=np.arange(len(methods))
for i,m in enumerate(methods):
 r=lookup[m];v=100*r['success'];lo,hi=np.array(r['successCI'])*100
 ax.errorbar(v,i,xerr=[[v-lo],[hi-v]],fmt='o',color=colors[i],capsize=2,markersize=4,elinewidth=.8)
ax.set_yticks(y,names);ax.invert_yaxis();ax.set_xlim(50,101);ax.set_xticks([50,75,100]);ax.set_xlabel('Structured success (%)' if en else '结构化任务通过率（%）');ax.set_title('a  Task outcome' if en else 'a  任务完成',loc='left',fontweight='bold');ax.grid(axis='x',color='#e7eaed',linewidth=.5)
ax=fig.add_subplot(grid[1]);groups=['supported-parameters','new-computable-wording','new-semantic-wording','new-reference-wrapper'];x=np.arange(4)
for j,(m,name,color)in enumerate([('no_acquisition','No acquisition' if en else '关闭补充','#b0b0b0'),('joint','Full mechanism' if en else '完整机制','#2677ad')]):
 vals=[next(r['success']*100 for r in data['byGroup'] if r['method']==m and r['group']==g)for g in groups]
 ax.bar(x+(j-.5)*.34,vals,width=.32,label=name,color=color,edgecolor='white',linewidth=.5)
ax.set_xticks(x,['Known\nrule','New\nrule','New\nwording','New\nwrapper'] if en else ['既有\n规则','新述\n规则','语义\n改写','引用\n变体']);ax.set_ylim(0,112);ax.set_yticks([0,50,100]);ax.set_ylabel('Success (%)' if en else '通过率（%）');ax.set_title('b  Fact acquisition' if en else 'b  补充事实的作用',loc='left',fontweight='bold');ax.legend(frameon=False,fontsize=6.4,loc='lower left',bbox_to_anchor=(.02,.015),ncol=1);ax.grid(axis='y',color='#e7eaed',linewidth=.5);ax.set_axisbelow(True)
ax=fig.add_subplot(grid[2]);vals=[lookup[m]['extraFacts']for m in methods]
ax.barh(y,vals,color=colors,height=.6);ax.invert_yaxis();ax.set_yticks(y,['Full','PII','Entry','Step','No acq.','Matched','Joint'] if en else ['全文','脱敏','入口','逐步','不补充','同本地','完整']);ax.set_xscale('symlog',linthresh=.05,linscale=.6);ax.set_xticks([0,.03125,.3,3,10],['0','.031','.3','3','10']);ax.tick_params(axis='x',labelsize=6.2);ax.set_xlim(0,12);ax.set_xlabel('Extra facts / task (symlog)' if en else '多余字段／任务（对称对数）');ax.set_title('c  Disclosure' if en else 'c  实际多余传输',loc='left',fontweight='bold');ax.grid(axis='x',color='#e7eaed',linewidth=.5);ax.set_axisbelow(True)
fig.get_layout_engine().set(rect=(0,.12,1,.88))
fig.text(.015,.028,'32 synthetic cases × 7 methods × 2 repeats. a: descriptive case bootstrap 95% intervals; b: 8 cases per group.' if en else '32 个合成案例 × 7 种方法 × 2 次重复。a：案例级描述性 95% 区间；b：每组 8 例。',fontsize=6.7,color='#52606b')
suffix='.en' if en else ''
for ext in ['png','svg','pdf']:fig.savefig(folder/f'experiment-overview{suffix}.{ext}',dpi=300)
plt.close(fig);print(folder/f'experiment-overview{suffix}.png')
