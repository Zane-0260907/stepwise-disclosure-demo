"""Measured tradeoffs only: stronger controls and an external table subset."""
from pathlib import Path
import json, argparse
from decimal import Decimal, ROUND_HALF_UP
import numpy as np
import matplotlib
matplotlib.use('Agg')
from matplotlib import pyplot as plt, font_manager
root=Path(__file__).resolve().parents[1]
ap=argparse.ArgumentParser();ap.add_argument('--lang',choices=['zh','en'],default='zh');en=ap.parse_args().lang=='en'
font=next((p for p in [Path('C:/Windows/Fonts/msyh.ttc'),Path('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')] if p.exists()),None)
if font:font_manager.fontManager.addfont(str(font));plt.rcParams['font.family']=font_manager.FontProperties(fname=str(font)).get_name()
plt.rcParams.update({'font.size':7,'axes.linewidth':.65,'axes.spines.top':False,'axes.spines.right':False,'pdf.fonttype':42,'svg.fonttype':'none','savefig.facecolor':'white','legend.frameon':False})
fig,axes=plt.subplots(2,3,figsize=(7,3.65),gridspec_kw={'width_ratios':[1.08,1.04,1]})
fig.subplots_adjust(left=.15,right=.985,top=.92,bottom=.20,hspace=.85,wspace=.52)
groups=[('controls',['no_acquisition','allowed_eager','numeric_prefetch','joint'],
 ['No acquisition','All allowed','Numeric prefetch','Progressive'] if en else ['关闭补充','获准字段全量','预取业务数值','按需补充'],['#a9a9a9','#f4a340','#76a9c8','#2677ad']),
 ('finqa',['eager_allowed','requested_cells','local_program'],
 ['All values','Requested cells','Local program'] if en else ['全部数值','按需单元格','本地表达式'],['#f4a340','#76a9c8','#2677ad'])]
for row,(suite,methods,names,colors) in enumerate(groups):
 folder=root/'evidence'/'validation-v4'/suite
 summary={r['method']:r for r in json.loads((folder/'summary.json').read_text(encoding='utf8'))['summary']}
 records=[json.loads(line) for line in (folder/'scores.jsonl').read_text(encoding='utf8').splitlines()]
 y=np.arange(len(methods)); ax=axes[row,0]
 for i,m in enumerate(methods):
  r=summary[m];ax.barh(i,100*r['success'],color=colors[i],height=.55)
  ax.text(100*r['success']+1.5,i,f"{r['passed']}/{r['runs']}",va='center',fontsize=6.5)
 ax.set_yticks(y,names);ax.invert_yaxis();ax.set_xlim(0,115);ax.set_xticks([0,50,100]);ax.set_xlabel('Correct tasks (%)' if en else '任务通过率（%）')
 ax.set_title(('a  Stronger controls' if en else 'a  同能力强对照') if row==0 else ('d  Public table subset' if en else 'd  公开表格子集'),loc='left',fontweight='bold')
 ax.grid(axis='x',color='#e7eaed',lw=.5);ax.set_axisbelow(True)
 ax=axes[row,1]
 vals=[summary[m]['disclosed'] for m in methods]
 for i,(v,c)in enumerate(zip(vals,colors)):
  label=str(Decimal(str(v)).quantize(Decimal('0.001'),rounding=ROUND_HALF_UP)).rstrip('0').rstrip('.')
  ax.barh(i,v,color=c,height=.55);ax.text(v+(max(vals)or 1)*.035,i,label,va='center',fontsize=6.4)
 ax.set_yticks(y,['']*len(y));ax.invert_yaxis();ax.set_xlim(0,max(vals)*1.35)
 ax.set_xlabel(('Extra fields / task' if en else '多余字段／任务') if row==0 else ('Raw cells / task' if en else '原始数值单元格／任务'))
 ax.set_title(('b  Allowed yet unneeded' if en else 'b  获准但不必要的传输') if row==0 else ('e  Numeric disclosure' if en else 'e  数值传输量'),loc='left',fontweight='bold')
 ax.grid(axis='x',color='#e7eaed',lw=.5);ax.set_axisbelow(True)
 ax=axes[row,2]
 for m,n,c in zip(methods,names,colors):
  vals=np.sort([r['elapsedMs']/1000 for r in records if r['method']==m]);ax.step(vals,np.arange(1,len(vals)+1)/len(vals),where='post',color=c,lw=1.1,label=n)
 ax.set_ylim(0,1.02);ax.set_yticks([0,.5,1]);ax.set_xlabel('Execution time (s)' if en else '实际执行时间（秒）');ax.set_ylabel('ECDF' if en else '累计比例')
 ax.set_title(('c  Execution cost' if en else 'c  执行代价') if row==0 else ('f  Execution cost' if en else 'f  执行代价'),loc='left',fontweight='bold')
 ax.legend(fontsize=5.8,loc='lower right',handlelength=1.3,labelspacing=.25);ax.grid(color='#e7eaed',lw=.5);ax.set_axisbelow(True)
fig.text(.15,.018,'Top: 256 synthetic tasks. Bottom: 240 table tasks. Failures included; playback delay excluded.' if en else '上排：256 次合成任务；下排：240 次公开表格任务。失败计入分母，展示延迟不计入耗时。',fontsize=6.2,color='#52606b')
out=root/'evidence'/'validation-v4';suffix='.en' if en else '.zh-CN'
for ext in ['png','svg','pdf']:fig.savefig(out/f'tradeoffs{suffix}.{ext}',dpi=400)
svg=out/f'tradeoffs{suffix}.svg';svg.write_text('\n'.join(l.rstrip()for l in svg.read_text(encoding='utf8').splitlines())+'\n',encoding='utf8',newline='\n')
plt.close(fig);print(out/f'tradeoffs{suffix}.png')
