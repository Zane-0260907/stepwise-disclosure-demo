"""Prepare 24 transparent development probes, not an original tau-bench leaderboard."""
import json, pathlib, hashlib, zipfile, re
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=ROOT/'data/research/v9-sources'
OUT=ROOT/'data/research/v9-development-inputs'
OUT.mkdir(parents=True,exist_ok=True)
def digest(x):return hashlib.sha256(str(x).encode()).hexdigest()
cases=[];labels={}
retail=json.loads((SOURCE/'tau/data/tau2/domains/retail/db.json').read_text())
products=sorted(retail['products'].values(),key=lambda x:digest(x['product_id']))[:8]
for i,p in enumerate(products):
    rows=[{'item_id':v['item_id'],'price':v['price'],'available':v['available'],**v['options']} for v in p['variants'].values()]
    option=sorted(p['variants'][next(iter(p['variants']))]['options'])[i%len(rows[0].keys()-{'item_id','price','available'})]
    values=sorted({str(r[option]) for r in rows}); wanted=values[i%len(values)]
    eligible=[r for r in rows if r['available'] and str(r[option])==wanted]
    fallback=not eligible
    candidates=eligible or [r for r in rows if r['available']]
    price=min([r['price'] for r in candidates],default=None)
    acceptable=[{'item_id':r['item_id'],'price':r['price'],'fallback':fallback} for r in candidates if r['price']==price]
    cid=f'retail-dev-{i+1:02}'
    cases.append({'id':cid,'family':'retail','sourceGroup':'tau-product:'+p['product_id'],'provenance':{'kind':'author-derived read-only task over original tau product records','sourceId':p['product_id']},'question':f'For {p["name"]}, find the cheapest available item whose {option} is {wanted}. If none is available with that option, find the cheapest available item regardless of {option}. Return item_id, price, and fallback (true only if the preferred option had no available item). Do not place an order.','tables':{'variants':{'description':p['name']+' variants','rows':rows}},'answerFormat':{'item_id':'string','price':'number','fallback':'boolean'}})
    labels[cid]={'kind':'exact-object','acceptable':acceptable}
air=json.loads((SOURCE/'tau/data/tau2/domains/airline/db.json').read_text())
routes={}
for f in air['flights'].values():routes.setdefault((f['origin'],f['destination']),[]).append(f)
for i,(route,flights) in enumerate(sorted(routes.items(),key=lambda x:digest(x[0]))[:8]):
    date=f'2024-05-{16+i:02}';rows=[]
    for f in flights:
        for day,v in f['dates'].items():
            for cabin in ['basic_economy','economy','business']:
                rows.append({'flight_number':f['flight_number'],'origin':f['origin'],'destination':f['destination'],'date':day,'cabin':cabin,'status':v['status'],'seats':v.get('available_seats',{}).get(cabin,0),'price':v.get('prices',{}).get(cabin),'departure_time':f['scheduled_departure_time_est']})
    cabin=['economy','business','basic_economy'][i%3];n=1+i%4
    candidates=[r for r in rows if r['date']==date and r['cabin']==cabin and r['status']=='available' and r['seats']>=n]
    price=min([r['price'] for r in candidates],default=None)
    acceptable=[{'flight_number':r['flight_number'],'price':r['price'],'found':True} for r in candidates if r['price']==price] or [{'flight_number':None,'price':None,'found':False}]
    cid=f'airline-dev-{i+1:02}'
    cases.append({'id':cid,'family':'airline','sourceGroup':'tau-route:'+':'.join(route),'provenance':{'kind':'author-derived read-only task over original tau flight records','sourceId':list(route)},'question':f'Find the cheapest available {cabin} flight from {route[0]} to {route[1]} on {date} with at least {n} seats. Return flight_number and per-passenger price, with found=true. If no qualifying flight exists, return found=false and both other values null. Do not book anything.','tables':{'flights':{'description':'Flight dates, cabins and seat inventory','rows':rows}},'answerFormat':{'flight_number':'string or null','price':'number or null','found':'boolean'}})
    labels[cid]={'kind':'exact-object','acceptable':acceptable}
archive=zipfile.ZipFile(SOURCE/'cuad/data.zip')
train_titles={c['title'] for c in json.loads(archive.read('train_separate_questions.json'))['data']}
contracts=[c for c in json.loads(archive.read('CUADv1.json'))['data'] if c['title'] in train_titles]
# Select contracts only by source hash and size, before reading answer values.
contracts=[c for c in contracts if 3500<=len(c['paragraphs'][0]['context'])<=24000]
contracts=sorted(contracts,key=lambda c:digest(c['title']))[:8]
categories=['Governing Law','Termination For Convenience','Anti-Assignment','Renewal Term','Notice Period To Terminate Renewal','Exclusivity','Non-Compete','Cap On Liability']
for i,c in enumerate(contracts):
    p=c['paragraphs'][0];category=categories[i]
    q=next(q for paragraph in c['paragraphs'] for q in paragraph['qas'] if q['id'].endswith('__'+category))
    context=p['context'];rows=[]
    # Fixed overlapping character windows, independent of annotation spans.
    for j,start in enumerate(range(0,len(context),900)):
        rows.append({'chunk_id':f'c{j:03}','start':start,'text':context[start:start+1100]})
    cid=f'contract-dev-{i+1:02}'
    cases.append({'id':cid,'family':'contract','sourceGroup':'cuad:'+c['title'],'provenance':{'kind':'original CUAD question, chunked source; no original model benchmark claim','sourceId':q['id']},'question':q['question']+' Return answers as an array of verbatim relevant excerpts. Return an empty array only if no relevant clause exists. Do not give legal advice.','tables':{'contract':{'description':'Overlapping chunks of the original contract','rows':rows}},'answerFormat':{'answers':'array of verbatim strings'}})
    labels[cid]={'kind':'cuad-span-f1','answers':q['answers'],'impossible':q['is_impossible']}
assert len(cases)==24
(OUT/'cases.json').write_text(json.dumps(cases,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'labels.json').write_text(json.dumps(labels,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'manifest.json').write_text(json.dumps({'scope':'development only; 16 author-derived database questions and 8 original CUAD questions','sourceManifest':json.loads((SOURCE/'manifest.json').read_text()),'caseSha256':digest((OUT/'cases.json').read_text(encoding='utf-8')),'labelsSha256':digest((OUT/'labels.json').read_text(encoding='utf-8')),'count':len(cases)},indent=2),encoding='utf-8')
print(json.dumps({'cases':len(cases),'families':{f:sum(c['family']==f for c in cases) for f in ['retail','airline','contract']},'rows':[len(next(iter(c['tables'].values()))['rows']) for c in cases]}))
