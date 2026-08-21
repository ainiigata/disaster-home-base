// tests/stock-guide.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { STOCK_GUIDE, requiredQuantity } from "../js/data/stock-guide.js";
import { CATEGORIES } from "../js/validate.js";

const HH = { adults: 2, children: 1, stockDays: 3 };
const item = key => STOCK_GUIDE.find(x => x.key === key);

test("14項目・keyユニーク・カテゴリ妥当", () => {
  assert.equal(STOCK_GUIDE.length, 14);
  assert.equal(new Set(STOCK_GUIDE.map(x => x.key)).size, 14);
  for (const x of STOCK_GUIDE) assert.ok(CATEGORIES.includes(x.category), x.key);
});
test("水: 3L×3人×3日=27", () => { assert.equal(requiredQuantity(item("water"), HH), 27); });
test("主食: 3食×3人×3日=27", () => { assert.equal(requiredQuantity(item("mainFood"), HH), 27); });
test("簡易トイレ: 5回×3人×3日=45", () => { assert.equal(requiredQuantity(item("simpleToilet"), HH), 45); });
test("カセットコンロ: 世帯で1", () => { assert.equal(requiredQuantity(item("cassetteStove"), HH), 1); });
test("ガスボンベ: 0.5本×3人×3日=5(切り上げ)", () => { assert.equal(requiredQuantity(item("gasCanister"), HH), 5); });
test("7日備蓄で水は63", () => { assert.equal(requiredQuantity(item("water"), { ...HH, stockDays: 7 }), 63); });
