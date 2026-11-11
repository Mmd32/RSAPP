/*
 * F&B picks type x format x service; a row is asked only when it has an X for every choice.
 * Fashion keeps its single format. Run: npm run test:fr
 */
import assert from 'node:assert/strict';
import catalog from '../src/data/catalog.json';
import { generateDynamicChecklistWithAudit } from '../src/engine/ruleEngine';
import type { Indicator, LocationContextCode } from '../src/types';

const all = (catalog as { indicators: Indicator[] }).indicators;
const ask = (businessType: string, locationContext: LocationContextCode, extra: Record<string, string> = {}) =>
  generateDynamicChecklistWithAudit(all, { assessmentType: 'STORE', businessType, locationContext, attributes: {}, ...extra } as any).indicators;

// The eight F&B combinations (counts from the six workbooks: the rows with an X in all three columns).
const expected: [string, LocationContextCode, string, number][] = [
  ['RESTAURANT', 'STREET_STORE', 'TABLE_SERVICE', 261],
  ['RESTAURANT', 'STREET_STORE', 'COUNTER_SERVICE', 258],
  ['RESTAURANT', 'FOOD_COURT', 'TABLE_SERVICE', 244],
  ['RESTAURANT', 'FOOD_COURT', 'COUNTER_SERVICE', 248],
  ['COFFEE_SHOP', 'STREET_STORE', 'TABLE_SERVICE', 262],
  ['COFFEE_SHOP', 'STREET_STORE', 'COUNTER_SERVICE', 261],
  ['COFFEE_SHOP', 'FOOD_COURT', 'TABLE_SERVICE', 247],
  ['COFFEE_SHOP', 'FOOD_COURT', 'COUNTER_SERVICE', 251],
];
for (const [fbType, fmt, fbService, n] of expected) {
  const rows = ask('F_B', fmt, { fbType, fbService });
  assert.equal(rows.length, n, `${fbType} ${fmt} ${fbService}`);
  for (const r of rows) assert.ok([fbType, fmt, fbService].every((c) => r.applicableFormats!.includes(c as LocationContextCode)), `${r.code} lacks an X`);
  assert.deepEqual(rows.map((r) => r.displayOrder), [...rows.map((r) => r.displayOrder)].sort((a, b) => a - b), 'workbook order');
}
// Without the extra choices (a branch saved before) the format alone decides, as before.
assert.equal(ask('F_B', 'FOOD_COURT').length, 268);
assert.equal(ask('F_B', 'STREET_STORE').length, 285);
// Other sectors are not touched.
assert.equal(ask('Fashion', 'KIOSK').length, 148);
assert.equal(ask('Fashion', 'STREET_STORE').length, 200);
assert.equal(ask('Shoe_Bag', 'STREET_STORE').length, ask('Shoe_Bag', 'KIOSK').length, 'sectors without format workbooks do not split');
console.log('F&B selection: all checks passed');
