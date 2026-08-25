import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultState, safeState, migrateV1, loadState, saveState, STORAGE_KEY, STORAGE_KEY_V1 } from "../js/state.js";

const memStorage = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), map: m };
};

test("defaultState: schemaVersion2で世帯は大人2人3日", () => {
  const s = defaultState();
  assert.equal(s.schemaVersion, 2);
  assert.deepEqual({ a: s.household.adults, d: s.household.stockDays }, { a: 2, d: 3 });
});
test("safeState: null・文字列・schemaVersion違いは既定値", () => {
  for (const raw of [null, "x", { schemaVersion: 99 }]) assert.deepEqual(safeState(raw), defaultState());
});
test("safeState: 不正な品目は落ち、正しい品目は残る", () => {
  const raw = { ...defaultState(), supplies: [
    { id: "a", name: "水", category: "water", quantity: 6, minimumQuantity: 6, unit: "L", expiresOn: null, locationId: null, isGoBag: false, isReady: true, note: "", recommendedKey: "water", createdAt: 1, updatedAt: 1 },
    { id: "b", name: "", quantity: 1 },
  ] };
  const s = safeState(raw);
  assert.equal(s.supplies.length, 1);
  assert.equal(s.supplies[0].id, "a");
});
test("safeState: emergency中でも災害不正ならnormalへ", () => {
  const s = safeState({ ...defaultState(), mode: "emergency", selectedHazard: "meteor" });
  assert.equal(s.mode, "normal");
});
test("migrateV1: v1の品目・家族・保険を引き継ぎrecommendedKey=nullを補う", () => {
  const v1 = { schemaVersion: 1, mode: "normal", selectedHazard: null, emergencyCheckedIds: [],
    supplies: [{ id: "s1", name: "缶詰", category: "food", quantity: 3, minimumQuantity: 6, unit: "個", expiresOn: null, locationId: null, isGoBag: true, isReady: false, note: "", createdAt: 1, updatedAt: 1 }],
    locations: [{ id: "l1", name: "玄関", note: "" }],
    familyMembers: [{ id: "f1", label: "父", contactNote: "", meetingPlace: "小学校", considerations: "" }],
    favoriteProcedureIds: ["eq-drop", "存在しないID"],
    insurance: { status: "insured", coverages: { earthquake: true, stormFlood: false, household: false }, policyLocation: "金庫", renewalOn: null, lastCheckedOn: "2026-01-01", note: "" },
    ui: { view: "supplies", supplyTab: "stock", hazardFilter: "all" } };
  const s = migrateV1(v1);
  assert.equal(s.schemaVersion, 2);
  assert.equal(s.supplies[0].recommendedKey, null);
  assert.equal(s.familyMembers[0].meetingPlace, "小学校");
  assert.equal(s.insurance.status, "insured");
  assert.ok(!s.favoriteProcedureIds.includes("存在しないID"));
});
test("loadState: v2なし・v1ありなら移行して通知を返す", () => {
  const st = memStorage({ [STORAGE_KEY_V1]: JSON.stringify({ schemaVersion: 1, supplies: [], locations: [], familyMembers: [], favoriteProcedureIds: [], emergencyCheckedIds: [], mode: "normal", selectedHazard: null, insurance: {}, ui: {} }) });
  const { state, notice } = loadState(st);
  assert.equal(state.schemaVersion, 2);
  assert.ok(notice);
});
test("loadState: 壊れたJSONは既定値+エラー通知", () => {
  const { state, isError } = loadState(memStorage({ [STORAGE_KEY]: "{壊" }));
  assert.deepEqual(state, defaultState());
  assert.equal(isError, true);
});
test("saveState→loadStateで往復できる", () => {
  const st = memStorage();
  const s = defaultState();
  saveState(s, st);
  assert.deepEqual(loadState(st).state, s);
});

// ── ここから brief のテストではカバーされない正規化ルールの追加テスト ──

test("safeState: sync は正しいhouseholdId(hex64)と80字以内のpassphraseならenabledを保持する", () => {
  const householdId = "a".repeat(64);
  const s = safeState({ ...defaultState(), sync: { enabled: true, passphrase: "ひみつ", householdId } });
  assert.deepEqual(s.sync, { enabled: true, passphrase: "ひみつ", householdId });
});

test("safeState: sync.householdIdが不正(桁不足・大文字・非16進)ならnull化しenabledも強制OFF", () => {
  for (const bad of ["a".repeat(63), "A".repeat(64), "g".repeat(64), 12345, null]) {
    const s = safeState({ ...defaultState(), sync: { enabled: true, passphrase: null, householdId: bad } });
    assert.equal(s.sync.householdId, null, `householdId=${bad}`);
    assert.equal(s.sync.enabled, false, `householdId=${bad}`);
  }
});

test("safeState: sync.passphraseが81字以上ならnullへ", () => {
  const s = safeState({ ...defaultState(), sync: { enabled: false, passphrase: "あ".repeat(81), householdId: null } });
  assert.equal(s.sync.passphrase, null);
});

test("safeState: shoppingは{id,name,done,updatedAt}のみ採用し、名前が空/41字はNG・101件目以降はslice(-100)で切り捨て", () => {
  const many = Array.from({ length: 101 }, (_, i) => ({ id: `sh${i}`, name: `品${i}`, done: false, updatedAt: i }));
  const raw = { ...defaultState(), shopping: [
    ...many,
    { id: "empty", name: "", done: false, updatedAt: 1 },
    { id: "toolong", name: "あ".repeat(41), done: false, updatedAt: 1 },
    { id: "ok", name: "あ".repeat(40), done: true, updatedAt: 5 },
  ] };
  const s = safeState(raw);
  // 不正な2件(empty/toolong)は採用前に除外されるため、有効な102件(many101件+ok)から
  // slice(-100)で先頭2件(sh0, sh1)だけが切り捨てられる。
  assert.equal(s.shopping.length, 100);
  assert.ok(!s.shopping.some(x => x.id === "sh0"), "先頭は切り捨てられているはず");
  assert.ok(!s.shopping.some(x => x.id === "sh1"), "先頭は切り捨てられているはず");
  assert.ok(s.shopping.some(x => x.id === "sh2"));
  assert.ok(!s.shopping.some(x => x.id === "empty"));
  assert.ok(!s.shopping.some(x => x.id === "toolong"));
  assert.ok(s.shopping.some(x => x.id === "ok"), "不正な行は採用前に除かれるためokは残るはず");
});

test("safeState: ui.supplyTab / ui.phaseFilterはホワイトリスト外なら既定値へフォールバック", () => {
  const s = safeState({ ...defaultState(), ui: { view: "home", supplyTab: "invalid-tab", hazardFilter: "all", phaseFilter: "invalid-phase" } });
  assert.equal(s.ui.supplyTab, "goBag");
  assert.equal(s.ui.phaseFilter, "all");
});

test("safeState: ui.supplyTab / ui.phaseFilterは正しい値ならそのまま通す", () => {
  const s = safeState({ ...defaultState(), ui: { view: "supplies", supplyTab: "rolling", hazardFilter: "all", phaseFilter: "prepare" } });
  assert.equal(s.ui.supplyTab, "rolling");
  assert.equal(s.ui.phaseFilter, "prepare");
});

test("safeState: locations/familyMembersは上限(-30/-20)を超えると先頭から切り捨てる", () => {
  const locations = Array.from({ length: 32 }, (_, i) => ({ id: `loc${i}`, name: `場所${i}`, note: "" }));
  const familyMembers = Array.from({ length: 22 }, (_, i) => ({ id: `fam${i}`, label: `人${i}`, contactNote: "", meetingPlace: "", considerations: "" }));
  const s = safeState({ ...defaultState(), locations, familyMembers });
  assert.equal(s.locations.length, 30);
  assert.equal(s.familyMembers.length, 20);
  assert.ok(!s.locations.some(x => x.id === "loc0"));
  assert.ok(s.locations.some(x => x.id === "loc31"));
  assert.ok(!s.familyMembers.some(x => x.id === "fam0"));
  assert.ok(s.familyMembers.some(x => x.id === "fam21"));
});

test("safeState: householdが不正(大人0人・子ども0人)なら既定値へ丸ごとフォールバック", () => {
  const s = safeState({ ...defaultState(), household: { adults: 0, children: 0, stockDays: 3, emergencyContacts: "", updatedAt: 999 } });
  assert.deepEqual(s.household, defaultState().household);
});

// ── レビュー指摘: migrateV1が手順id再編(タスク3)でv1のfavorite/emergency-checkedを
// 全滅させていた件の追加テスト ──

test("migrateV1: 現行スキームへ翻訳できるv1のfavoriteは新idとして残り、翻訳表にない未知のidは引き続き落ちる", () => {
  const v1 = { schemaVersion: 1, mode: "normal", selectedHazard: null, emergencyCheckedIds: [],
    supplies: [], locations: [], familyMembers: [],
    favoriteProcedureIds: ["eq-drop", "power-light", "存在しないID"],
    insurance: {}, ui: {} };
  const s = migrateV1(v1);
  assert.ok(s.favoriteProcedureIds.includes("eq-now-cover"), "eq-dropはeq-now-coverへ翻訳されて残るはず");
  assert.ok(s.favoriteProcedureIds.includes("pw-now-light"), "power-lightはpw-now-lightへ翻訳されて残るはず");
  assert.ok(!s.favoriteProcedureIds.includes("eq-drop"), "翻訳後は旧idそのものは残らない");
  assert.ok(!s.favoriteProcedureIds.includes("存在しないID"), "対応表にも現行PROCEDURESにも無いidは落ちる");
});

test("safeState: 現行スキームのfavoriteはそのまま残る。v1翻訳はmigrateV1専用でsafeStateには無い", () => {
  // "eq-drop" はv1の旧id。safeStateはv2データしか扱わない前提のため翻訳せず、
  // 現行PROCEDURESに存在しないidとして単純に除外される。
  const s = safeState({ ...defaultState(), favoriteProcedureIds: ["pw-now-light", "eq-drop"] });
  assert.deepEqual(s.favoriteProcedureIds, ["pw-now-light"]);
});

test("safeState: emergencyCheckedIdsはselectedHazardと異なる災害の手順idを落とす", () => {
  const s = safeState({
    ...defaultState(),
    mode: "emergency",
    selectedHazard: "earthquake",
    emergencyCheckedIds: ["eq-now-cover", "pw-now-light"],
  });
  assert.ok(s.emergencyCheckedIds.includes("eq-now-cover"), "selectedHazardと一致する手順idは残る");
  assert.ok(!s.emergencyCheckedIds.includes("pw-now-light"), "hazardが異なる手順idは落ちる");
});

test("loadState: v1移行後の保存(setItem)が失敗しても、移行済みstateを既定値へ巻き戻さずisErrorで伝える", () => {
  const v1 = JSON.stringify({
    schemaVersion: 1, mode: "normal", selectedHazard: null, emergencyCheckedIds: [],
    supplies: [], locations: [], familyMembers: [],
    favoriteProcedureIds: ["eq-drop"],
    insurance: {}, ui: {},
  });
  const st = memStorage({ [STORAGE_KEY_V1]: v1 });
  st.setItem = k => { if (k === STORAGE_KEY) throw new Error("quota exceeded"); };
  const { state, notice, isError } = loadState(st);
  assert.equal(state.schemaVersion, 2);
  assert.ok(state.favoriteProcedureIds.includes("eq-now-cover"), "保存に失敗しても移行結果自体は返るはず");
  assert.equal(isError, true);
  assert.ok(notice);
});

test("safeState: dismissedRemindersは文字列以外を除外し重複排除する", () => {
  const s = safeState({ ...defaultState(), dismissedReminders: ["r1", "r1", 123, null, "r2"] });
  assert.deepEqual(s.dismissedReminders, ["r1", "r2"]);
});
