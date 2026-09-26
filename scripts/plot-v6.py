"""Current measured outcomes; every mark is derived from the frozen v6 records."""
from pathlib import Path
import json, argparse
import numpy as np
import matplotlib
matplotlib.use('Agg')
from matplotlib import pyplot as plt, font_manager
root=Path(__file__).resolve().parents[1]
ap=argparse.ArgumentParser();ap.add_argument('--lang',choices=['zh','en'],default='zh');en=ap.parse_args().lang=='en'
font=next((p for p in [Path('C:/Windows/Fonts/msyh.ttc'),Path('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')] if p.exists()),None)
if font:font_manager.fontManager.addfont(str(font));plt.rcParams['font.family']=font_manager.FontProperties(fname=str(font)).get_name()
plt.rcParams.update({'font.size':6.8,'axes.linewidth':.65,'axes.spines.top':False,'axes.spines.right':False,'pdf.fonttype':42,'svg.fonttype':'none','savefig.facecolor':'white','legend.frameon':False})
out=root/'evidence/validation-v6';data=json.loads((out/'summary.json').read_text())
rows=[json.loads(line) for line in (out/'scores.jsonl').read_text().splitlines()]
methods=['full_once','local_once','requested_cells','blind_review','conflict_review']
names=['All values','Local calculation','Requested cells','Blind review','Conflict view'] if en else ['全部数值','本地计算','按需单元格','无数值复核','分歧补充']
colors=['#f4a340','#2677ad','#76a9c8','#a8aaad','#ab7061']
summary={r['method']:r for r in data['summary']};y=np.arange(5)
fig,axes=plt.subplots(2,3,figsize=(7,3.95));fig.subplots_adjust(left=.14,right=.987,bottom=.14,top=.94,wspace=.54,hspace=.88)
def bars(ax,values,maxval,fmt):
 for i,(v,c) in enumerate(zip(values,colors)):
  ax.barh(i,v,color=c,height=.58);ax.text(v+maxval*.023,i,fmt(i,v),va='center',fontsize=6.1)
 ax.set_yticks(y,names);ax.invert_yaxis();ax.set_xlim(0,maxval);ax.grid(axis='x',color='#e5e9ed',lw=.45);ax.set_axisbelow(True)
ax=axes[0,0];bars(ax,[100*summary[m]['success'] for m in methods],120,lambda i,v:f"{summary[methods[i]]['passed']}/120")
ax.set_xticks([0,50,100]);ax.set_xlabel('Correct tasks (%)' if en else '任务通过率（%）');ax.set_title('a  '+('Numerical correctness' if en else '数值正确性'),loc='left',fontweight='bold')
ax=axes[0,1];bars(ax,[summary[m]['transmittedCells'] for m in methods],19,lambda i,v:f'{v:.3f}'.rstrip('0').rstrip('.'))
ax.set_yticklabels([]);ax.set_xlabel('Business cells / task' if en else '外发业务数值／任务');ax.set_title('b  '+('Value disclosure' if en else '业务数值外发'),loc='left',fontweight='bold')
ax=axes[0,2]
for m,n,c in zip(methods,names,colors):
 vals=np.sort([r['elapsedMs']/1000 for r in rows if r['method']==m]);ax.step(vals,np.arange(1,len(vals)+1)/len(vals),where='post',color=c,lw=1.05,label=n)
ax.set_xlabel('Core runtime (s)' if en else '核心执行时间（秒）');ax.set_ylim(0,1.02);ax.set_yticks([0,.5,1]);ax.set_title('c  '+('Execution cost' if en else '执行代价'),loc='left',fontweight='bold');ax.legend(fontsize=5.2,loc='lower right',labelspacing=.15,handlelength=1.2);ax.grid(color='#e5e9ed',lw=.45)
ax=axes[1,0]
controls=['full_once','requested_cells','blind_review','conflict_review']
for i,m in enumerate(controls):
 r=data['paired']['local_once_vs_'+m];v=100*r['difference'];lo,hi=np.array(r['descriptiveReportCluster95'])*100
 ax.errorbar(v,i,xerr=[[v-lo],[hi-v]],fmt='o',color='#2677ad',markersize=3.3,capsize=2,lw=.8)
ax.axvline(0,color='#92999f',lw=.7,ls='--');ax.set_yticks(range(4),[names[methods.index(m)] for m in controls]);ax.invert_yaxis();ax.set_xlim(-8,11);ax.set_xticks([-5,0,5,10]);ax.set_xlabel('Difference (percentage points)' if en else '通过率差（百分点）');ax.set_title('d  '+('Local calculation − control' if en else '本地计算减去对照'),loc='left',fontweight='bold');ax.grid(axis='x',color='#e5e9ed',lw=.45)
ax=axes[1,1];bars(ax,[summary[m]['modelCalls']/120 for m in methods],3.9,lambda i,v:str(summary[methods[i]]['modelCalls']))
ax.set_yticklabels([]);ax.set_xticks([0,1,2,3]);ax.set_xlabel('Calls / task; labels: total' if en else '调用／任务；标注为总次数');ax.set_title('e  '+('Provider calls' if en else '真实供应商调用'),loc='left',fontweight='bold')
ax=axes[1,2]
for i,m in enumerate(['blind_review','conflict_review']):
 r=summary[m];good=r['agreementPassed'];wrong=r['agreementRuns']-good;other=120-r['agreementRuns']
 ax.barh(i,good,color='#2677ad',height=.43);ax.barh(i,wrong,left=good,color='#ab7061',height=.43);ax.barh(i,other,left=good+wrong,color='#dfe3e6',height=.43)
 for start,v in [(0,good),(good,wrong),(good+wrong,other)]:ax.text(start+v/2,i,str(v),ha='center',va='center',fontsize=6.1,color='white' if start<good+wrong else '#333')
ax.set_yticks([0,1],names[-2:]);ax.invert_yaxis();ax.set_xlim(0,120);ax.set_xticks([0,60,120]);ax.set_xlabel('Tasks' if en else '任务数');ax.set_title('f  '+('Consistent but wrong' if en else '一致不等于正确'),loc='left',fontweight='bold')
from matplotlib.patches import Patch
fig.legend(handles=[Patch(color=c,label=n)for c,n in zip(['#2677ad','#ab7061','#dfe3e6'],['Agree + correct','Agree + wrong','Other'] if en else ['一致且正确','一致但错误','其他'])],fontsize=5.4,loc='upper right',bbox_to_anchor=(.99,.055),ncol=3,handlelength=.8,columnspacing=.7)
fig.text(.14,.025,'600 tasks · failures included · paired report-cluster intervals' if en else '600 次任务，失败计入分母；区间按年度报告配对聚类重采样。',fontsize=6,color='#52606b')
suffix='.en' if en else '.zh-CN'
for ext in ['png','svg','pdf']:fig.savefig(out/f'tradeoffs{suffix}.{ext}',dpi=400)
svg=out/f'tradeoffs{suffix}.svg';svg.write_text('\n'.join(l.rstrip()for l in svg.read_text(encoding='utf-8').splitlines())+'\n',encoding='utf-8',newline='\n')
plt.close(fig);print(out/f'tradeoffs{suffix}.png')
