import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('scorer', Path(__file__).resolve().parents[1] / 'scripts/score-gap-pilot.py')
scorer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scorer)


class SourceScoreTests(unittest.TestCase):
    def record(self, spans, status='completed'):
        return {'status': status, 'result': {'evidence': spans}}

    def test_extra_output_is_penalized(self):
        text = 'abcdefghijklmnopqrstuvwxyz'
        gold = {'spans': [{'start': 0, 'end': 5}]}
        short = self.record([{'start': 0, 'end': 5, 'quote': text[:5]}])
        long = self.record([{'start': 0, 'end': 20, 'quote': text[:20]}])
        self.assertEqual(scorer.score(short, gold, text)['f1'], 1)
        self.assertLess(scorer.score(long, gold, text)['f1'], 0.5)

    def test_failures_do_not_match_empty_gold(self):
        result = scorer.score(self.record([], 'failed'), {'spans': []}, 'source')
        self.assertEqual(result['f1'], 0)

    def test_false_quotes_fail(self):
        r = self.record([{'start': 0, 'end': 2, 'quote': 'wrong'}])
        self.assertFalse(scorer.score(r, {'spans': []}, 'source')['validSourceQuotes'])

    def test_correct_empty_and_duplicate_spans(self):
        self.assertEqual(scorer.score(self.record([]), {'spans': []}, 'source')['f1'], 1)
        span = {'start': 0, 'end': 3, 'quote': 'sou'}
        self.assertEqual(scorer.score(self.record([span, span]), {'spans': [span]}, 'source')['f1'], 1)


if __name__ == '__main__':
    unittest.main()
