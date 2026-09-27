"""Structural/source consistency only. Visual rendering remains a separate gate."""
from pathlib import Path
import json
import re
import xml.etree.ElementTree as ET
from zipfile import ZipFile

ROOT=Path(__file__).resolve().parents[1]
PAPER=ROOT/'paper/zh-CN'
facts=json.loads((PAPER/'evidence.json').read_text(encoding='utf-8'))
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'm':'http://schemas.openxmlformats.org/officeDocument/2006/math',
    'wp':'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'}
with ZipFile(PAPER/'按步执行与信息共享_中文最新稿.docx') as z:
    xml=ET.fromstring(z.read('word/document.xml'))
    settings=ET.fromstring(z.read('word/settings.xml'))
text=''.join(xml.itertext())
assert len(xml.findall('.//m:oMath',ns))==6, 'Six editable native equations are required'
assert len(xml.findall('.//wp:inline',ns))==3, 'Retain the three approved figures'
assert len(xml.findall('.//w:tbl',ns))==2, 'Planner and budget tables are required'
assert any(x.get('{%s}num'%ns['w'])=='2' for x in xml.findall('.//w:cols',ns)), 'Two-column sections missing'
assert settings.find('w:view',ns).get('{%s}val'%ns['w'])=='print', 'Default to print layout'
for dims in xml.findall('.//w:pgSz',ns):
    assert (dims.get('{%s}w'%ns['w']),dims.get('{%s}h'%ns['w']))==('12240','15840'), 'US letter size required'
for phrase in ['算法 1','Input:','20: return RestoreOriginalStepOrder','144/144','129/144','28/48','后续可行性','完整 H','不是一般多项式保证','未知未来','没有新增模型调用']:
    assert phrase in text, 'Missing statement: '+phrase
study=facts['planning']
for key in ['runs','httpRequests']:
    assert str(study['integration'][key]) in text
for r in study['final']['budgets']:
    assert f'{r["disclosures"]} / {r["greedyDisclosures"]}' in text
    assert f'{r["fields"]} / {r["greedyFields"]}' in text
assert str(study['final']['methods']['disclosure-frontier']['maxPeak']) in text
assert '生成式工具使用说明' not in text
assert '[6]' in text and '[7]' not in text, 'Bibliography mismatch'
assert not re.search(r'\\(?:frac|begin|end|sum|cup)\b',text), 'Unrendered LaTeX in the main text'
assert not xml.findall('.//w:del',ns) and not xml.findall('.//w:ins',ns), 'Unresolved tracked revisions'
print(json.dumps({'equations':6,'figures':3,'tables':2,'layout':'Letter/two-column/print','evidence':'current','visualReview':'separate'},ensure_ascii=True))
