"""Standard-library tests: evaluator annotations must never become model inputs."""
import copy
import importlib.util
from pathlib import Path
import unittest

script = Path(__file__).resolve().parents[1] / 'scripts/prepare-privacy-inputs.py'
spec = importlib.util.spec_from_file_location('privacy_inputs', script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def row(i):
    return {'name': f'source-{i}', 'seed': {key: 'NORM SECRET ' + str(i // 2) for key in module.NORM_KEYS},
        'vignette': {'story': 'ANNOTATION ONLY'},
        'trajectory': {'user_name': 'Example User', 'user_email': 'user@example.test',
            'user_instruction': 'Complete the stated task', 'toolkits': ['example'],
            'executable_trajectory': 'Recorded observation', 'final_action': 'EVALUATION ANSWER',
            'sensitive_info_items': ['SECRET ANSWER'], 'unexpected_future_annotation': 'DO NOT INCLUDE'}}


class InputSeparation(unittest.TestCase):
    def test_only_allowlisted_runtime_fields_are_retained(self):
        cases, labels, _ = module.prepare([row(0)])
        self.assertEqual(set(cases[0]), {'id', *module.INPUT_KEYS})
        runtime = module.encode(cases).decode()
        for secret in ['NORM SECRET', 'ANNOTATION ONLY', 'EVALUATION ANSWER', 'SECRET ANSWER', 'DO NOT INCLUDE']:
            self.assertNotIn(secret, runtime)
        self.assertIn('EVALUATION ANSWER', module.encode(labels).decode())

    def test_repeated_norms_stay_together_and_input_order_does_not_change_split(self):
        rows = [row(i) for i in range(84)]
        cases, labels, splits = module.prepare(rows)
        self.assertEqual(module.prepare(list(reversed(rows))), (cases, labels, splits))
        dev, reserved = map(set, [splits['development'], splits['reserved']])
        self.assertFalse(dev & reserved)
        self.assertEqual(len(dev | reserved), 84)
        for group in {label['normGroup'] for label in labels.values()}:
            members = {cid for cid, label in labels.items() if label['normGroup'] == group}
            self.assertTrue(members <= dev or members <= reserved)

    def test_duplicate_source_names_and_missing_inputs_fail(self):
        item = row(1)
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            module.prepare([item, copy.deepcopy(item)])
        del item['trajectory']['user_instruction']
        with self.assertRaisesRegex(ValueError, 'Missing'):
            module.prepare([item])


if __name__ == '__main__':
    unittest.main()
