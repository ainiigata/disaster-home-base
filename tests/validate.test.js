import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSupply, validateHousehold, validDate, uid } from "../js/validate.js";

test("備蓄品: 正常入力が通り recommendedKey を保持する", () => {
  const r = validateSupply({ name: "飲料水", category: "water", quantity: "6", minimumQuantity: "9", unit: "L", recommendedKey: "water" }, []);
  assert.equal(r.valid, true);
  assert.equal(r.value.recommendedKey, "water");
});
test("備蓄品: 数量の境界 0/9999 OK・-1/10000 NG", () => {
  for (const [q, ok] of [[0, true], [9999, true], [-1, false], [10000, false]]) {
    const r = validateSupply({ name: "水", quantity: q, minimumQuantity: 1, unit: "個" }, []);
    assert.equal(r.valid, ok, `quantity=${q}`);
  }
});
test("備蓄品: 品名 空/41文字 NG・40文字 OK", () => {
  assert.equal(validateSupply({ name: "", quantity: 1, minimumQuantity: 1, unit: "個" }, []).valid, false);
  assert.equal(validateSupply({ name: "あ".repeat(41), quantity: 1, minimumQuantity: 1, unit: "個" }, []).valid, false);
  assert.equal(validateSupply({ name: "あ".repeat(40), quantity: 1, minimumQuantity: 1, unit: "個" }, []).valid, true);
});
test("備蓄品: 存在しない保管場所IDはNG", () => {
  assert.equal(validateSupply({ name: "水", quantity: 1, minimumQuantity: 1, unit: "個", locationId: "x" }, ["a"]).valid, false);
});
test("世帯設定: 大人2子ども1・3日 OK", () => {
  const r = validateHousehold({ adults: "2", children: "1", stockDays: "3", emergencyContacts: "父 090-xxxx" });
  assert.deepEqual(r.value, { adults: 2, children: 1, stockDays: 3, emergencyContacts: "父 090-xxxx" });
});
test("世帯設定: 合計0人・21人・日数5 はNG", () => {
  assert.equal(validateHousehold({ adults: 0, children: 0, stockDays: 3 }).valid, false);
  assert.equal(validateHousehold({ adults: 21, children: 0, stockDays: 3 }).valid, false);
  assert.equal(validateHousehold({ adults: 1, children: 0, stockDays: 5 }).valid, false);
});
test("validDate: null OK・2026-02-30 NG・2026-08-22 OK", () => {
  assert.equal(validDate(null), true);
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2026-08-22"), true);
});
test("uid: 呼ぶたびに異なる", () => { assert.notEqual(uid(), uid()); });
