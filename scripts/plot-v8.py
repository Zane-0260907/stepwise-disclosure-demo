from pathlib import Path
import argparse,json
import numpy as np
import matplotlib
matplotlib.use('Agg')
from matplotlib import pyplot as plt,font_manager
root=Path(__file__).resolve().parents[1];out=root/'evidence/validation-v8'
p=argparse.ArgumentParser();p.add_argument('--lang',choices=['zh','en'],default='zh');en=p.parse_args().lang=='en'
font=next((p for p in [Path('C:/Windows/Fonts/msyh.ttc'),Path('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')]if p.exists()),None)
if font:font_manager.fontManager.addfont(str(font));plt.rcParams['font.family']=font_manager.FontProperties(fname=str(font)).get_name()
plt.rcParams.update({'font.size':6.5,'axes.linewidth':.65,'axes.spines.top':False,'axes.spines.right':False,'pdf.fonttype':42,'svg.fonttype':'none','legend.frameon':False,'savefig.facecolor':'white'})
s=json.loads((out/'summary.json').read_text());fig,axs=plt.subplots(2,2,figsize=(7,3.5));fig.subplots_adjust(left=.085,right=.985,top=.94,bottom=.19,wspace=.36,hspace=.65)
methods=['restart_greedy','repair_greedy','repair_frontier','budget_0','budget_10','budget_25'];names=['Restart','Greedy','Frontier','Budget 0%','Budget 10%','Budget 25%']if en else['完整重跑','逐步贪心','后续规划','预算 0%','预算 10%','预算 25%'];colors=['#f4a340','#76a9c8','#2677ad','#527c96','#668a9f','#a8aaad']
for ax,key,title,label in [(axs[0,0],'remoteCalls','a  External executions'if en else'a  外部执行次数','HTTP requests'if en else'HTTP 请求'),(axs[0,1],'numericFields','b  Repeated transmission'if en else'b  重复传输量','Numeric fields sent'if en else'发送的数值字段')]:
 for i,(m,c)in enumerate(zip(methods,colors)):
  v=s['methods'][m][key];ax.barh(i,v,height=.63,color=c);ax.text(v+6,i,str(v),va='center',fontsize=6.2)
 ax.set_yticks(range(6),names);ax.invert_yaxis();ax.set_xlim(0,max(s['methods'][m][key]for m in methods)*1.19);ax.set_xlabel(label);ax.set_title(title,loc='left',fontweight='bold');ax.grid(axis='x',color='#e5e9ed',lw=.45);ax.set_axisbelow(True)
ax=axs[1,0];conditions=list(s['conditions']);x=np.arange(len(conditions));width=.33
for shift,m,c,label in [(-width/2,'restart_greedy','#f4a340','Restart'if en else'完整重跑'),(width/2,'budget_0','#2677ad','Reuse'if en else'保留有效结果')]:
 vals=[s['conditions'][k][m]['remoteCalls']for k in conditions];ax.bar(x+shift,vals,width,label=label,color=c)
ax.set_xticks(x,['Local','Stable','Used','Unused','Capability']if en else['全本地','无变化','已用值','未用值','能力撤销']);ax.set_ylabel('HTTP requests'if en else'HTTP 请求');ax.set_title('c  Matched conditions'if en else'c  相同条件下的配对比较',loc='left',fontweight='bold');ax.legend(fontsize=6,loc='upper left');ax.set_ylim(0,160);ax.grid(axis='y',color='#e5e9ed',lw=.45);ax.set_axisbelow(True)
ax=axs[1,1];x=np.arange(6);vals=[s['methods'][m]['uniqueDisclosures']for m in methods];ax.plot(x,vals,color='#2677ad',marker='o',ms=3,lw=1)
for i,v in enumerate(vals):ax.text(i,v+10,str(v),ha='center',fontsize=6)
ax.set_xticks(x,['R','G','F','0%','10%','25%']);ax.set_ylim(0,520);ax.set_ylabel('Distinct disclosure units'if en else'不同披露项');ax.set_title('d  No frontier gain observed'if en else'd  本批次未观察到额外规划收益',loc='left',fontweight='bold');ax.grid(axis='y',color='#e5e9ed',lw=.45);ax.set_axisbelow(True)
fig.text(.085,.078,'24 questions × 2 real model plans × 5 controlled conditions; 240 dependent arms per method.'if en else'24 道题 × 2 份真实模型计划 × 5 种受控条件；每方法 240 次配对执行，并非独立样本。',fontsize=6,color='#52606b')
fig.text(.085,.033,'48/48 executable plans; 28/48 original-label agreement. Completion is not answer correctness.'if en else'48/48 份计划可执行；28/48 与原始标签一致。执行成功不等于答案正确。',fontsize=6,color='#52606b')
suffix='en'if en else'zh-CN'
for ext in ['png','svg','pdf']:fig.savefig(out/f'tradeoffs.{suffix}.{ext}',dpi=400)
plt.close(fig)
svg=out/f'tradeoffs.{suffix}.svg'
svg.write_text('\n'.join(line.rstrip() for line in svg.read_text(encoding='utf8').splitlines())+'\n',encoding='utf8',newline='\n')
