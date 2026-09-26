const clean = value => String(value ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const year = value => /^(?:19|20)\d{2}$/.test(clean(value));
const unitRow = value => /^(?:\(?\s*in\b|\$|amounts?\b|years?\b|fiscal\b|\s*$)/i.test(clean(value));
const fieldId = (row, column) => `r${row}c${column}`;

// Header cells have a different role from business values. Preserve their
// provenance and position; never infer missing merged-cell spans.
export function buildTableView(table, numericFacts) {
  if (!Array.isArray(table) || !table.length || !table.every(Array.isArray)) throw Error('INVALID_TABLE');
  for (const [id, value] of Object.entries(numericFacts)) {
    const match = /^r(\d+)c(\d+)$/.exec(id);
    if (!match) throw Error('INVALID_CELL_ID');
    const raw = clean(table[Number(match[1])]?.[Number(match[2])]).replace(/[$,%\s]/g, '');
    const parsed = /^\(\d+(?:\.\d+)?\)$/.test(raw) ? -Number(raw.slice(1, -1)) : /^-?\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : null;
    if (parsed === null || parsed !== value) throw Error('SOURCE_TABLE_VALUE_MISMATCH');
  }
  const headers = new Set([0]);
  for (let row = 1; row < Math.min(table.length, 4); row++) {
    const cells = table[row].slice(1).filter(value => clean(value));
    if (headers.has(row - 1) && unitRow(table[row][0]) && cells.length >= 2 && cells.every(year)) headers.add(row);
    else break;
  }
  const facts = Object.fromEntries(Object.entries(numericFacts).filter(([id]) => !headers.has(Number(/^r(\d+)c/.exec(id)?.[1]))));
  const width = Math.max(...table.map(row => row.length));
  const schema = Object.keys(facts).map(id => {
    const [, r, c] = /^r(\d+)c(\d+)$/.exec(id), row = Number(r), column = Number(c);
    const path = [...headers].map(index => {
      if (table[index].length === width) return clean(table[index][column]);
      return ''; // unknown spans remain visible in the original header grid below
    }).filter(Boolean);
    const unitHints = [...headers].map(index => clean(table[index][0])).filter(Boolean);
    return { id, row: clean(table[row][0]), column: path.join(' | ') || `source column ${column}`,
      columnIndex: column, unitHint: unitHints.join(' | '), valueUnit: /%/.test(String(table[row][column])) ? 'percent (stored as displayed numeric value)' : 'source units' };
  });
  const headerRows = [...headers].map(row => ({ sourceRow: row, cells: table[row].map(clean) }));
  const sourceView = table.map((cells, row) => ({ sourceRow: row, role: headers.has(row) ? 'header' : 'data',
    cells: cells.map((value, column) => headers.has(row) || column === 0 ? clean(value) : Object.hasOwn(facts, fieldId(row, column)) ? `{${fieldId(row, column)}}` : clean(value) ? `{unparsed:${fieldId(row, column)}}` : '') }));
  return { facts, schema, tableStructure: sourceView, headerRows,
    classification: { headerRows: [...headers], promotedNumericHeaders: Object.keys(numericFacts).filter(id => !Object.hasOwn(facts, id)) } };
}
