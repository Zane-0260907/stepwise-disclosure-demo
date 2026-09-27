from pathlib import Path
import json
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
root=Path(__file__).resolve().parents[1];c=json.loads((root/'evidence/model-showcase-v8/case.json').read_text(encoding='utf8'))
out=root/'fixtures/model-showcase-v8/documents/model-table.pdf';out.parent.mkdir(parents=True,exist_ok=True)
styles=getSampleStyleSheet();story=[Paragraph('Public financial table',styles['Title']),Paragraph(c['sourceId'],styles['Normal']),Spacer(1,12),Paragraph(c['question'],styles['Normal']),Spacer(1,12)]
rows=[[Paragraph(str(x).replace('&','&amp;'),styles['Normal'])for x in row]for row in c['originalTable']]
table=Table(rows,colWidths=[260]+[80]*(max(map(len,rows))-1),repeatRows=1);table.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.4,colors.HexColor('#d9e2ea')),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#edf3f7')),('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
story+=[table,Spacer(1,14),Paragraph('Reading preview reconstructed from the public FinQA table. This is not a scan of the original report. The original structured table and model record are included in the repository.',styles['Normal'])]
SimpleDocTemplate(str(out),pagesize=(612,792),rightMargin=36,leftMargin=36).build(story)
