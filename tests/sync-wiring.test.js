// レビュー指摘(Important 1)の回帰テスト。
//
// js/main.js の handleRemoteCollection は、Firestoreから届いたエンティティを
// REMOTE_VALIDATORS[kind](x).value に id/createdAt/updatedAt を足して整形してから
// state[kind] へ積む。createdAt は supplies のスキーマにしかないため、
// locations/familyMembers にまで一律で付けてしまうと、safeState() が持たない余分な
// キーが1つ混ざる。その結果 loadState() の deepEqual ガード(js/state.js)が
// 「保存されていたデータの一部を修復しました。」という誤った通知を毎回出してしまう
// (家族共有をONにしている利用者が対象、直りようがない)。
//
// main.js はDOM前提でboot()を即実行するためNodeへ直接importできない。ここでは
// handleRemoteCollectionの整形部分(2行)をそのまま再現し、safeState()に通した結果と
// キー集合が一致することを検証する。main.js側を変えずにこの整形ロジックを変えた場合、
// このテストが先に落ちる。
import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultState, safeState } from "../js/state.js";
import { validateLocation, validateFamily, validateSupply } from "../js/validate.js";

const finiteOr0 = n => (Number.isFinite(n) ? n : 0);

// js/main.js の handleRemoteCollection 内の整形ロジックそのまま(意図的に複製)。
function shapeRemote(kind, x, validate) {
  const v = validate(x);
  assert.ok(v.valid, `fixture should validate: ${kind}`);
  return { ...v.value, id: x.id, ...(kind === "supplies" ? { createdAt: finiteOr0(x.createdAt) } : {}), updatedAt: finiteOr0(x.updatedAt) };
}

function keysOf(obj) {
  return Object.keys(obj).sort();
}

test("リモートlocationの整形結果は、safeState()が返すlocationとキー集合が一致する(createdAtを持たない)", () => {
  const remote = { id: "loc-1", name: "玄関", note: "", updatedAt: 12345 };
  const shaped = shapeRemote("locations", remote, validateLocation);

  const raw = { ...defaultState(), locations: [shaped] };
  const state = safeState(raw);

  assert.equal(state.locations.length, 1);
  assert.deepEqual(keysOf(shaped), keysOf(state.locations[0]));
  assert.ok(!("createdAt" in shaped), "locationにcreatedAtを持たせてはいけない");
});

test("リモートfamilyMemberの整形結果は、safeState()が返すfamilyMemberとキー集合が一致する(createdAtを持たない)", () => {
  const remote = { id: "fam-1", label: "母", contactNote: "", meetingPlace: "小学校", considerations: "", updatedAt: 99 };
  const shaped = shapeRemote("familyMembers", remote, validateFamily);

  const raw = { ...defaultState(), familyMembers: [shaped] };
  const state = safeState(raw);

  assert.equal(state.familyMembers.length, 1);
  assert.deepEqual(keysOf(shaped), keysOf(state.familyMembers[0]));
  assert.ok(!("createdAt" in shaped), "familyMemberにcreatedAtを持たせてはいけない");
});

test("リモートsuppliesの整形結果は、safeState()が返すsupplyとキー集合が一致する(createdAtを持つ)", () => {
  const remote = {
    id: "sup-1", name: "水", category: "water", quantity: 6, minimumQuantity: 6, unit: "L",
    expiresOn: null, locationId: null, isGoBag: false, isReady: true, note: "", recommendedKey: null,
    createdAt: 1, updatedAt: 2,
  };
  const shaped = shapeRemote("supplies", remote, x => validateSupply(x, []));

  const raw = { ...defaultState(), supplies: [shaped] };
  const state = safeState(raw);

  assert.equal(state.supplies.length, 1);
  assert.deepEqual(keysOf(shaped), keysOf(state.supplies[0]));
  assert.ok("createdAt" in shaped, "supplyはcreatedAtを持つべき");
});
