import { test } from "node:test";
import assert from "node:assert/strict";
import { HAZARDS, HAZARD_LABELS, PHASES } from "../js/data/hazards.js";
import { PROCEDURES } from "../js/data/procedures.js";

test("災害は11種でラベル完備", () => {
  assert.equal(HAZARDS.length, 11);
  for (const h of HAZARDS) assert.ok(HAZARD_LABELS[h]);
});
test("IDは全件ユニーク", () => {
  const ids = PROCEDURES.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length);
});
test("全災害に8件以上・now段階が2件以上ある", () => {
  for (const h of HAZARDS) {
    const list = PROCEDURES.filter(p => p.hazard === h);
    assert.ok(list.length >= 8, `${h}: ${list.length}件`);
    assert.ok(list.filter(p => p.phase === "now").length >= 2, `${h}: now不足`);
  }
});
test("hazard/phaseが正しく、title40字以内・body120字以内・keywordsあり", () => {
  for (const p of PROCEDURES) {
    assert.ok(HAZARDS.includes(p.hazard), p.id);
    assert.ok(PHASES.includes(p.phase), p.id);
    assert.ok(p.title.length > 0 && p.title.length <= 40, p.id);
    assert.ok(p.body.length > 0 && p.body.length <= 120, p.id);
    assert.ok(Array.isArray(p.keywords) && p.keywords.length >= 1, p.id);
  }
});
test("全体で100件以上", () => { assert.ok(PROCEDURES.length >= 100, String(PROCEDURES.length)); });
