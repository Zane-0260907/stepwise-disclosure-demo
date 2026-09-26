import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTableView } from '../src/research/table-view.mjs';

test('year headers survive value hiding and keep their original source positions', () => {
  const table = [['', 'At December 31'], ['(In thousands)', '2016', '2015'], ['Working capital', '1279337', '1019953']];
  const view = buildTableView(table, { r1c1: 2016, r1c2: 2015, r2c1: 1279337, r2c2: 1019953 });
  assert.deepEqual(view.facts, { r2c1: 1279337, r2c2: 1019953 });
  assert.deepEqual(view.schema.map(c => c.column), ['2016', '2015']);
  assert.deepEqual(view.tableStructure[2].cells, ['Working capital', '{r2c1}', '{r2c2}']);
  assert.equal(JSON.stringify(view.tableStructure).includes('1279337'), false);
  assert.deepEqual(view.classification.promotedNumericHeaders, ['r1c1', 'r1c2']);
});
test('ambiguous merged headings are preserved without inventing column spans', () => {
  const view = buildTableView([['December 31', 'Exposure', 'Nonperforming'], ['(in millions)', '2010', '2009', '2010', '2009'], ['Total', '10', '11', '12', '13']],
    { r1c1: 2010, r1c2: 2009, r1c3: 2010, r1c4: 2009, r2c1: 10, r2c2: 11, r2c3: 12, r2c4: 13 });
  assert.deepEqual(view.schema.map(c => c.column), ['2010', '2009', '2010', '2009']);
  assert.deepEqual(view.headerRows[0].cells, ['December 31', 'Exposure', 'Nonperforming']);
});
test('year-like business values are not promoted without an explicit header role', () => {
  const view = buildTableView([['Item', 'A', 'B'], ['Net income', '2015', '2014']], { r1c1: 2015, r1c2: 2014 });
  assert.deepEqual(view.classification.promotedNumericHeaders, []);
  assert.deepEqual(view.facts, { r1c1: 2015, r1c2: 2014 });
});
