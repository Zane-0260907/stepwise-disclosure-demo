"""Prepare 24 new CUAD development sources; no evaluator labels in runtime input."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_SHA = 'f8161d18bea4e9c05e78fa6dda61c19c846fb8087ea969c172753bc2f45b999a'
CATEGORIES = ['Termination For Convenience', 'Anti-Assignment', 'Cap On Liability',
              'Renewal Term', 'Notice Period To Terminate Renewal', 'Governing Law']


def sha(value):
    return hashlib.sha256(value).hexdigest()


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


def prepare():
    source = ROOT / 'data/research/v9-sources/cuad/data.zip'
    raw = source.read_bytes()
    if sha(raw) != ARCHIVE_SHA:
        raise ValueError('CUAD source hash mismatch')
    previous = json.loads((ROOT / 'data/research/v9-development-inputs/cases.json').read_text(encoding='utf-8'))
    excluded = {x['sourceGroup'].removeprefix('cuad:') for x in previous if x['family'] == 'contract'}
    with zipfile.ZipFile(source) as archive:
        # Read train titles only; the official test questions/answers are unused.
        training = {x['title'] for x in json.loads(archive.read('train_separate_questions.json'))['data']}
        corpus = json.loads(archive.read('CUADv1.json'))['data']
    eligible = [x for x in corpus if x['title'] in training and x['title'] not in excluded
                and 6000 <= len(x['paragraphs'][0]['context']) <= 60000]
    eligible.sort(key=lambda x: sha(('gap-pilot-v1:' + x['title']).encode()))
    inputs, labels = [], {}
    for index, item in enumerate(eligible[:24]):
        category = CATEGORIES[index % len(CATEGORIES)]
        qa = next(q for p in item['paragraphs'] for q in p['qas'] if q['id'].endswith('__' + category))
        text = item['paragraphs'][0]['context']
        cid = f'gap-dev-{index + 1:02}'
        inputs.append({'id': cid, 'sourceGroup': item['title'], 'questionId': qa['id'],
                       'question': qa['question'], 'category': category, 'text': text,
                       'sourceSha256': sha(text.encode()), 'coordinateUnit': 'Unicode code points'})
        spans = []
        for answer in qa['answers']:
            start, excerpt = answer['answer_start'], answer['text']
            if text[start:start + len(excerpt)] != excerpt:
                raise ValueError('Upstream annotation offset does not match source: ' + qa['id'])
            spans.append({'start': start, 'end': start + len(excerpt), 'text': excerpt})
        labels[cid] = {'spans': spans, 'impossible': qa['is_impossible']}
    if len(inputs) != 24 or len({x['sourceGroup'] for x in inputs}) != 24:
        raise ValueError('Unexpected source count')
    manifest = {'scope': 'development selection; not held-out evaluation', 'archiveSha256': ARCHIVE_SHA,
                'upstreamRevision': '67faa0e6023b04fcaae6cc09497ab00e5d63a2a2',
                'selection': 'sha256(gap-pilot-v1: + title), train only, 6000..60000 code points',
                'categoryRotation': CATEGORIES, 'excludedPreviouslyUsedSources': sorted(excluded),
                'eligibleSources': len(eligible), 'independentSources': len(inputs),
                'runtimeKeys': list(inputs[0]), 'inputSha256': sha(encoded(inputs)),
                'evaluationSha256': sha(encoded(labels)), 'modelCalls': 0}
    return {'inputs.json': inputs, 'evaluation-only.json': labels, 'manifest.json': manifest}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    target = ROOT / 'data/research/gap-inputs'
    files = prepare()
    for name, value in files.items():
        path, raw = target / name, encoded(value)
        if path.exists():
            if path.read_bytes() != raw:
                raise ValueError('Existing preparation differs: ' + name)
        elif args.check:
            raise FileNotFoundError(path)
        else:
            target.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
    print(json.dumps({'independentSources': 24, 'previousSourcesExcluded': 8,
                      'modelCalls': 0, 'inputSha256': files['manifest.json']['inputSha256']}))


if __name__ == '__main__':
    main()
