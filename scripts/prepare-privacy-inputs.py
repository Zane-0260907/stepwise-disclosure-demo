"""Prepare a label-separated external candidate pool, not experiment results.

No model, judge, business backend or upstream Python code is executed. The local
inputs contain private context and are NOT a pre-approved cloud payload.
"""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
REVISION = '9c2ee07b080dc54ed4924af11d9751e81753c94d'
SOURCE = ROOT / 'data/research/privacylens-source'
OUTPUT = ROOT / 'data/research/privacylens-inputs'
REPORT = ROOT / 'evidence/input-candidates/privacylens.json'
FILES = {
    'main_data.json': ('data/main_data.json', '2a8b3bfa470ffa9e50b12866857b17d62b422a2fea926b1249220a0244991941'),
    'LICENSE': ('LICENSE', '8079ebdd44998d089304fc2a2b4302afc1e112e89c2d91f51713fd89fa87fc15'),
    'README.md': ('README.md', '9e9090e58cf7e42eb3fe635352308a7c7e3917c74f971e895f60c1f227b16c75'),
}
INPUT_KEYS = ('user_name', 'user_email', 'user_instruction', 'toolkits', 'executable_trajectory')
NORM_KEYS = ('data_type', 'data_subject', 'data_sender', 'data_recipient', 'transmission_principle')


def encode(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode('utf-8')


def sha(value):
    return hashlib.sha256(value).hexdigest()


def prepare(rows):
    cases, labels, group_members = [], {}, {}
    for row in rows:
        cid = 'pl-' + sha(('PrivacyLens:' + row['name']).encode())[:20]
        if cid in labels:
            raise ValueError('Duplicate source name')
        trajectory = row['trajectory']
        if any(key not in trajectory for key in INPUT_KEYS):
            raise ValueError('Missing runtime input field')
        # Group repeated exact privacy norms independently of the scenario's
        # personal names. This is not a semantic near-duplicate detector.
        norm = {key: ' '.join(str(row['seed'][key]).casefold().split()) for key in NORM_KEYS}
        group = sha(encode(norm))
        group_members.setdefault(group, []).append(cid)
        cases.append({'id': cid, **{key: trajectory[key] for key in INPUT_KEYS}})
        labels[cid] = {'sourceName': row['name'], 'normGroup': group,
            'seed': row['seed'], 'vignette': row['vignette'],
            'expectedFinalActionType': trajectory['final_action'],
            'sensitiveInfoItems': trajectory['sensitive_info_items']}
    # Reserve all but the first approximately 40 examples by whole norm group.
    # This is a preparation split; final study registration remains pending.
    ordered_groups = sorted(group_members, key=lambda group: sha(('privacy-candidate-v1:' + group).encode()))
    development, reserved = [], []
    for group in ordered_groups:
        target = development if len(development) < 40 else reserved
        target.extend(sorted(group_members[group]))
    splits = {'development': development, 'reserved': reserved}
    assert not set(development) & set(reserved)
    assert set(development + reserved) == set(labels)
    return sorted(cases, key=lambda case: case['id']), labels, splits


def write_unchanged_or_new(path, content, check):
    if path.exists():
        if path.read_bytes() != content:
            raise ValueError(f'Refusing to overwrite changed evidence/input file: {path.name}')
    elif check:
        raise FileNotFoundError(path)
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch', action='store_true', help='Fetch missing hash-pinned public source files')
    parser.add_argument('--check', action='store_true', help='Require prepared files and report to match; no writes')
    args = parser.parse_args()
    if args.fetch and args.check:
        parser.error('--fetch and --check are separate operations')
    for name, (remote, expected) in FILES.items():
        path = SOURCE / name
        if not path.exists():
            if not args.fetch:
                raise FileNotFoundError(f'{name} missing; run with --fetch to obtain the pinned public source')
            url = f'https://raw.githubusercontent.com/SALT-NLP/PrivacyLens/{REVISION}/{remote}'
            raw = urllib.request.urlopen(url, timeout=45).read()
            if sha(raw) != expected:
                raise ValueError('Downloaded source hash mismatch: ' + name)
            write_unchanged_or_new(path, raw, False)
        if sha(path.read_bytes()) != expected:
            raise ValueError('Local source hash mismatch: ' + name)
    rows = json.loads((SOURCE / 'main_data.json').read_text(encoding='utf-8'))
    cases, labels, splits = prepare(rows)
    files = {'local-inputs.json': encode(cases), 'evaluation-only.json': encode(labels), 'splits.json': encode(splits)}
    for name, raw in files.items():
        write_unchanged_or_new(OUTPUT / name, raw, args.check)
    report = {
        'status': 'candidate-input-preparation-only; no model evaluation or new results',
        'source': {'repository': 'https://github.com/SALT-NLP/PrivacyLens', 'revision': REVISION,
            'sourceFilesSha256': {name: expected for name, (_, expected) in FILES.items()},
            'license': 'Upstream repository MIT; original notice retained in local source directory'},
        'records': len(cases), 'exactNormGroups': len({v['normGroup'] for v in labels.values()}),
        'developmentRecords': len(splits['development']), 'reservedRecords': len(splits['reserved']),
        'runtimeInputKeys': ['id', *INPUT_KEYS],
        'evaluationExcludedFromRuntimeInput': ['seed', 'vignette', 'expectedFinalActionType', 'sensitiveInfoItems', 'normGroup', 'sourceName'],
        'outputsSha256': {name: sha(raw) for name, raw in files.items()},
        'modelCalls': 0,
        'limits': [
            'Recorded prefixes and final-action privacy evaluation do not replace original multi-turn state-changing tasks.',
            'Local inputs contain original private context; they are not sanitized or authorized for direct cloud transmission.',
            'No runtime tool schemas/backend or official leakage/helpfulness judge has been executed by this preparation script.',
            'Exact norm grouping cannot eliminate all semantic similarity; a final study protocol and independent review remain pending.',
            'The reserved pool is not evidence of generalization; no candidate mechanism has been run or selected using these scores.',
        ],
    }
    write_unchanged_or_new(REPORT, encode(report), args.check)
    print(json.dumps({key: report[key] for key in ['status', 'records', 'exactNormGroups', 'developmentRecords', 'reservedRecords', 'modelCalls']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
