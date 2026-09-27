"""Source-coordinate diagnostic, not official CUAD metrics or human legal review."""
import argparse
import hashlib
import json
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parents[1]


def union(spans):
    result = set()
    for span in spans:
        if not isinstance(span['start'], int) or not isinstance(span['end'], int) or span['start'] < 0 or span['end'] < span['start']:
            raise ValueError('Invalid source coordinates')
        result.update(range(span['start'], span['end']))
    return result


def score(record, expected, text):
    if record['status'] != 'completed':
        return {'precision': 0, 'recall': 0, 'f1': 0, 'validSourceQuotes': False, 'emptyAnswer': False}
    spans = record['result']['evidence']
    valid = all(text[s['start']:s['end']] == s['quote'] for s in spans)
    if not valid:
        return {'precision': 0, 'recall': 0, 'f1': 0, 'validSourceQuotes': False, 'emptyAnswer': not spans}
    predicted, gold = union(spans), union(expected['spans'])
    overlap = len(predicted & gold)
    precision = overlap / len(predicted) if predicted else int(not gold)
    recall = overlap / len(gold) if gold else int(not predicted)
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0
    return {'precision': precision, 'recall': recall, 'f1': f1, 'validSourceQuotes': True,
            'emptyAnswer': not spans, 'predictedCharacters': len(predicted), 'goldCharacters': len(gold)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-id', required=True)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if not args.run_id.startswith('gap-') or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in args.run_id):
        parser.error('Invalid run ID')
    directory = ROOT / 'data/research/gap-runs' / args.run_id
    protocol = json.loads((directory / 'protocol.json').read_text(encoding='utf-8'))
    manifest = json.loads((directory / 'input-manifest.json').read_text(encoding='utf-8'))
    labels_raw = (ROOT / 'data/research/gap-inputs/evaluation-only.json').read_bytes()
    if hashlib.sha256(labels_raw).hexdigest() != manifest['evaluationSha256']:
        raise ValueError('Evaluation source changed')
    inputs_raw = (directory / 'frozen/inputs.json').read_bytes()
    if hashlib.sha256(inputs_raw).hexdigest() != protocol['inputSha256']:
        raise ValueError('Frozen input changed')
    inputs = {x['id']: x for x in json.loads(inputs_raw)}
    labels = json.loads(labels_raw)
    rows = []
    for cid in protocol['caseIds']:
        for method in protocol['methods']:
            path = directory / f'{cid}--{method}.json'
            if not path.exists():
                rows.append({'caseId': cid, 'method': method, 'status': 'not_run'})
                continue
            record = json.loads(path.read_text(encoding='utf-8'))
            if record['caseId'] != cid or record['method'] != method or record['sourceHash'] != inputs[cid]['sourceSha256']:
                raise ValueError('Record identity mismatch')
            if record['status'] == 'not_started':
                rows.append({'caseId': cid, 'method': method, 'status': 'not_run', 'reason': record.get('error')})
            else:
                rows.append({'caseId': cid, 'sourceGroup': inputs[cid]['sourceGroup'], 'method': method,
                             'status': record['status'], 'metrics': record['metrics'],
                             'score': score(record, labels[cid], inputs[cid]['text'])})
    aggregates = {}
    for method in protocol['methods']:
        observed = [r for r in rows if r['method'] == method and r['status'] != 'not_run']
        aggregates[method] = {'attempts': len(observed), 'completed': sum(r['status'] == 'completed' for r in observed),
                              'meanF1': mean(r['score']['f1'] for r in observed) if observed else None,
                              'sourceCharacters': sum(r['metrics']['uniqueSourceCharacters'] for r in observed),
                              'modelCalls': sum(r['metrics']['modelCalls'] for r in observed)}
    paired = []
    for cid in protocol['caseIds']:
        pair = {r['method']: r for r in rows if r['caseId'] == cid and r['method'] in ['on_demand','gap_repair'] and r['status'] != 'not_run'}
        if len(pair) == 2:
            a, b = pair['on_demand'], pair['gap_repair']
            paired.append({'caseId': cid, 'baselineF1': a['score']['f1'], 'candidateF1': b['score']['f1'],
                           'f1Difference': b['score']['f1'] - a['score']['f1'],
                           'sourceCharacterDifference': b['metrics']['uniqueSourceCharacters'] - a['metrics']['uniqueSourceCharacters'],
                           'modelCallDifference': b['metrics']['modelCalls'] - a['metrics']['modelCalls']})
    output = {'scope': 'development source-span diagnostic; not official CUAD or privacy evaluation',
              'runId': args.run_id, 'aggregates': aggregates, 'paired': paired, 'rows': rows,
              'limits': ['No statistical superiority inferred from this pilot.', 'No human semantic-quality scores.',
                         'Cross-reference matching alone does not prove necessity or sufficiency.',
                         'Source characters and bytes are not semantic privacy risk.']}
    output_path = directory / 'scores.json'
    if args.check:
        if json.loads(output_path.read_text(encoding='utf-8')) != output:
            raise ValueError('Saved diagnostic scores differ from recomputation')
    else:
        output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'aggregates': aggregates, 'paired': paired}, ensure_ascii=False))


if __name__ == '__main__':
    main()
