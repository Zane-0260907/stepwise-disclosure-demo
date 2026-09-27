"""Measured dynamic-repair results; no invented error bars or model calls."""
from pathlib import Path
import argparse,json
import numpy as np
import matplotlib
matplotlib.use('Agg')
from matplotlib import pyplot as plt,font_manager
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--lang',choices=['zh','en'],default='zh');en=p.parse_args().lang=='en'
font=next((p for p in [Path('C:/Windows/Fonts/msyh.ttc'),Path('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')] if p.exists()),None)
if font:font_manager.fontManager.addfont(str(font));plt.rcParams['font.family']=font_manager.FontProperties(fname=str(font)).get_name()
plt.rcParams.update({'font.size':6.7,'axes.linewidth':.65,'axes.spines.top':False,'axes.spines.right':False,'pdf.fonttype':42,'svg.fonttype':'none','savefig.facecolor':'white','legend.frameon':False})
out=root/'evidence/validation-v7';s=json.loads((out/'summary.json').read_text())['methods'];rows=[json.loads(x)for x in(out/'scores.jsonl').read_text().splitlines()]
methods=['payload_only','full_restart','selective_greedy','selective_frontier','freshctx_restart','freshctx_frontier']
names=['Payload','Restart','Greedy repair','Frontier repair','F + restart','F + frontier'] if en else ['仅查载荷','完整重跑','逐步贪心','后续方案','F＋重跑','F＋后续']
colors=['#a8aaad','#f4a340','#76a9c8','#2677ad','#d5a668','#527c96'];fig,axes=plt.subplots(2,3,figsize=(7,3.95));fig.subplots_adjust(left=.145,right=.984,bottom=.14,top=.94,wspace=.6,hspace=.84)
def bars(ax,key,limit,title,xlabel):
 for i,(m,c)in enumerate(zip(methods,colors)):
  v=s[m][key];ax.barh(i,v,color=c,height=.56);ax.text(v+limit*.025,i,str(v),va='center',fontsize=6)
 ax.set_yticks(range(6),names);ax.invert_yaxis();ax.set_xlim(0,limit);ax.grid(axis='x',color='#e5e9ed',lw=.45);ax.set_axisbelow(True);ax.set_title(title,loc='left',fontweight='bold');ax.set_xlabel(xlabel)
bars(axes[0,0],'success',350,'a  '+('Contract compliance' if en else '执行契约符合性'),'Cases (of 288)' if en else '符合场景数（共 288）')
bars(axes[0,1],'disclosures',1050,'b  '+('Distinct disclosures' if en else '不同披露项'),'Recipient / field / version' if en else '接收方／字段／版本');axes[0,1].set_yticklabels([])
bars(axes[0,2],'calls',800,'c  '+('Remote execution' if en else '外部执行次数'),'HTTP operations' if en else 'HTTP 算子执行');axes[0,2].set_yticklabels([])
ax=axes[1,0];indexed={(r['caseId'],r['method']):r for r in rows};diff=[indexed[(r['caseId'],'full_restart')]['calls']-r['calls'] for r in rows if r['method']=='selective_frontier'];vals,counts=np.unique(diff,return_counts=True);ax.bar(vals,counts,width=.55,color='#2677ad')
for x,v in zip(vals,counts):ax.text(x,v+5,str(v),ha='center',fontsize=6)
ax.set_ylim(0,max(counts)*1.18);ax.set_xticks(vals);ax.set_xlabel('Restart calls − repair calls' if en else '重跑次数减去修复次数');ax.set_ylabel('Cases' if en else '场景数');ax.set_title('d  '+('Paired work reduction' if en else '逐场景执行差异'),loc='left',fontweight='bold');ax.grid(axis='y',color='#e5e9ed',lw=.45);ax.set_axisbelow(True)
ax=axes[1,1]
for m,name,c,offset in [('full_restart','Restart' if en else '重跑','#f4a340',(-23,5)),('selective_greedy','Greedy' if en else '贪心','#76a9c8',(-14,7)),('selective_frontier','Frontier' if en else '后续方案','#2677ad',(5,-12))]:
 x,y=s[m]['disclosures']/288,s[m]['fields']/288;ax.scatter(x,y,s=23,color=c);ax.annotate(name,(x,y),xytext=offset,textcoords='offset points',fontsize=6)
ax.set_xlim(2.7,3.12);ax.set_ylim(3,7.2);ax.set_xlabel('Distinct units / case' if en else '不同披露项／场景');ax.set_ylabel('Fields sent / case' if en else '传输字段／场景');ax.set_title('e  '+('Disclosure vs traffic' if en else '披露与传输量取舍'),loc='left',fontweight='bold');ax.grid(color='#e5e9ed',lw=.45)
ax=axes[1,2];old=json.loads((root/'evidence/validation-v6/summary.json').read_text());look={r['method']:r for r in old['summary']}
for i,(m,c)in enumerate([('full_once','#f4a340'),('local_once','#2677ad')]):
 v=look[m]['passed'];ax.bar(i,v,color=c,width=.52);ax.text(i,v+4,f'{v}/120',ha='center',fontsize=6)
ax.set_xticks([0,1],['All values','Local calc.'] if en else ['全部数值','本地计算']);ax.set_ylim(0,140);ax.set_yticks([0,60,120]);ax.set_ylabel('Correct tasks' if en else '正确任务数');ax.set_title('f  '+('Separate model study' if en else '独立模型实验'),loc='left',fontweight='bold');ax.grid(axis='y',color='#e5e9ed',lw=.45);ax.set_axisbelow(True)
fig.text(.145,.028,'a–e: controlled operators; F = FreshCtx. f: preserved DeepSeek v6, separate population.' if en else 'a–e 为受控算子实验，F 表示 FreshCtx；f 为独立保存的 DeepSeek 实验，不合并统计。',fontsize=5.8,color='#52606b')
suffix='en' if en else 'zh-CN'
for ext in ['png','svg','pdf']:fig.savefig(out/f'tradeoffs.{suffix}.{ext}',dpi=400)
svg=out/f'tradeoffs.{suffix}.svg';svg.write_text('\n'.join(l.rstrip()for l in svg.read_text(encoding='utf-8').splitlines())+'\n',encoding='utf-8',newline='\n');plt.close(fig)
print(out/f'tradeoffs.{suffix}.png')
