import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultState } from "../js/state.js";
import { STOCK_GUIDE, requiredQuantity } from "../js/data/stock-guide.js";
import {
  dateKey,
  stockStatus,
  readiness,
  todaysAction,
  expiringSupplies,
  shortSupplies,
  reminderBanner,
  insuranceSuggestions,
  searchProcedures,
} from "../js/derive.js";

const supply = (over = {}) => ({ id: over.id ?? Math.random().toString(36), name: "品", category: "other", quantity: 0, minimumQuantity: 1, unit: "個", expiresOn: null, locationId: null, isGoBag: false, isReady: false, note: "", recommendedKey: null, createdAt: 0, updatedAt: 0, ...over });

test("stockStatus: 水27L必要・30Lあれば充足", () => {
  const s = { ...defaultState(), household: { adults: 2, children: 1, stockDays: 3, emergencyContacts: "", updatedAt: 0 },
    supplies: [supply({ recommendedKey: "water", quantity: 30, unit: "L" })] };
  const w = stockStatus(s).find(x => x.key === "water");
  assert.deepEqual({ r: w.required, h: w.have, f: w.fulfilled }, { r: 27, h: 30, f: true });
});
test("readiness: 初期状態は全カテゴリtodoで0%", () => {
  const r = readiness(defaultState());
  assert.equal(r.percent, 0);
  assert.ok(r.categories.every(c => c.level === "todo"));
});
test("todaysAction: 初期状態は家族カード作成を提案", () => {
  assert.equal(todaysAction(defaultState()).id, "family-card");
});
test("expiringSupplies: 30日以内は含む・31日後は含まない", () => {
  const today = new Date("2026-08-22T00:00:00");
  const s = { ...defaultState(), supplies: [supply({ id: "a", expiresOn: "2026-09-21" }), supply({ id: "b", expiresOn: "2026-09-22" })] };
  assert.deepEqual(expiringSupplies(s, today).map(x => x.id), ["a"]);
});
test("reminderBanner: 8/22は防災の日期間・却下済みならnull", () => {
  const today = new Date("2026-08-22T00:00:00");
  assert.equal(reminderBanner(defaultState(), today).periodKey, "bousai-2026");
  assert.equal(reminderBanner({ ...defaultState(), dismissedReminders: ["bousai-2026"] }, today), null);
});
test("searchProcedures: 災害+段階で絞り込める", () => {
  const r = searchProcedures("", "tsunami", "now", [], false);
  assert.ok(r.length >= 2 && r.every(p => p.hazard === "tsunami" && p.phase === "now"));
});

// ── ここから: ブリーフの6テストが届かない範囲を補うための追加テスト ──

test("dateKey: 月日を2桁ゼロ埋めしたYYYY-MM-DD", () => {
  assert.equal(dateKey(new Date("2026-01-05T00:00:00")), "2026-01-05");
});

test("stockStatus: 同じrecommendedKeyの複数登録は数量を合算する(1件が過不足でも合計で判定)", () => {
  const household = { adults: 1, children: 0, stockDays: 3, emergencyContacts: "", updatedAt: 0 };
  const s = { ...defaultState(), household, supplies: [
    supply({ recommendedKey: "mainFood", quantity: 5 }),
    supply({ recommendedKey: "mainFood", quantity: 4 }),
  ] };
  const food = stockStatus(s).find(x => x.key === "mainFood");
  // 主食 required = rate3 × 1人 × 3日 = 9
  assert.equal(food.required, 9);
  assert.equal(food.have, 9);
  assert.equal(food.fulfilled, true);
  assert.equal(food.registered, true);
});

test("stockStatus: registeredは登録の有無、fulfilledは数量充足で別々に判定する", () => {
  const notRegistered = stockStatus(defaultState()).find(x => x.key === "water");
  assert.equal(notRegistered.registered, false);
  assert.equal(notRegistered.fulfilled, false);

  const registeredButShort = stockStatus({ ...defaultState(), supplies: [supply({ recommendedKey: "water", quantity: 0 })] }).find(
    x => x.key === "water"
  );
  assert.equal(registeredButShort.registered, true);
  assert.equal(registeredButShort.fulfilled, false);
});

test("readiness: fraction・levelのしきい値(1/4=0.25=todo, 2/4=0.5=almost, 4/4=1=done)", () => {
  const household = { adults: 1, children: 0, stockDays: 3, emergencyContacts: "", updatedAt: 0 };
  const base = { ...defaultState(), household };

  // 電源・照明カテゴリ(4キー)は分母4なので、0.5ちょうどの境界を作れる。
  const quarter = { ...base, supplies: [supply({ recommendedKey: "mobileBattery", quantity: 1 })] };
  const p1 = readiness(quarter).categories.find(c => c.id === "power");
  assert.equal(p1.fraction, 0.25);
  assert.equal(p1.level, "todo"); // 0でもfraction>0だがalmostにはならない

  const half = { ...base, supplies: [
    supply({ recommendedKey: "mobileBattery", quantity: 1 }),
    supply({ recommendedKey: "flashlight", quantity: 1 }),
  ] };
  const p2 = readiness(half).categories.find(c => c.id === "power");
  assert.equal(p2.fraction, 0.5);
  assert.equal(p2.level, "almost");

  const full = { ...base, supplies: [
    supply({ recommendedKey: "mobileBattery", quantity: 1 }),
    supply({ recommendedKey: "flashlight", quantity: 1 }),
    supply({ recommendedKey: "batteries", quantity: 2 }),
    supply({ recommendedKey: "radio", quantity: 1 }),
  ] };
  const p3 = readiness(full).categories.find(c => c.id === "power");
  assert.equal(p3.fraction, 1);
  assert.equal(p3.level, "done");
});

test("readiness: infoカテゴリはimportantCopies/cashの充足+保険lastCheckedOnの3条件目", () => {
  const docsOnly = { ...defaultState(), supplies: [
    supply({ recommendedKey: "importantCopies", quantity: 1 }),
    supply({ recommendedKey: "cash", quantity: 1 }),
  ] };
  const info1 = readiness(docsOnly).categories.find(c => c.id === "info");
  assert.equal(info1.fraction, 2 / 3);
  assert.equal(info1.level, "almost");

  const docsAndInsurance = { ...docsOnly, insurance: { ...defaultState().insurance, lastCheckedOn: "2026-01-01" } };
  const info2 = readiness(docsAndInsurance).categories.find(c => c.id === "info");
  assert.equal(info2.fraction, 1);
  assert.equal(info2.level, "done");

  const insuranceOnly = { ...defaultState(), insurance: { ...defaultState().insurance, lastCheckedOn: "2026-01-01" } };
  const info3 = readiness(insuranceOnly).categories.find(c => c.id === "info");
  assert.equal(info3.fraction, 1 / 3);
  assert.equal(info3.level, "todo");
});

test("readiness: familyカテゴリは[家族カード≥1, 集合場所あり, 緊急連絡メモあり]の3条件", () => {
  const cardOnly = { ...defaultState(), familyMembers: [
    { id: "f1", label: "本人", contactNote: "", meetingPlace: "", considerations: "", updatedAt: 0 },
  ] };
  const fam1 = readiness(cardOnly).categories.find(c => c.id === "family");
  assert.equal(fam1.fraction, 1 / 3);
  assert.equal(fam1.level, "todo");

  const cardAndMeeting = { ...cardOnly, familyMembers: [{ ...cardOnly.familyMembers[0], meetingPlace: "近所の公園" }] };
  const fam2 = readiness(cardAndMeeting).categories.find(c => c.id === "family");
  assert.equal(fam2.fraction, 2 / 3);
  assert.equal(fam2.level, "almost");

  const all3 = { ...cardAndMeeting, household: { ...defaultState().household, emergencyContacts: "祖父母:090-xxxx-xxxx" } };
  const fam3 = readiness(all3).categories.find(c => c.id === "family");
  assert.equal(fam3.fraction, 1);
  assert.equal(fam3.level, "done");
});

test("shortSupplies: guideはstockStatusの不足分、manualはrecommendedKeyなしでquantity<minimumQuantityのもの", () => {
  const s = { ...defaultState(), supplies: [
    supply({ id: "manual-short", recommendedKey: null, quantity: 0, minimumQuantity: 2 }),
    supply({ id: "manual-ok", recommendedKey: null, quantity: 2, minimumQuantity: 2 }),
    supply({ id: "guide-short", recommendedKey: "flashlight", quantity: 0 }),
  ] };
  const { guide, manual } = shortSupplies(s);
  assert.ok(guide.some(g => g.key === "flashlight" && !g.fulfilled));
  assert.deepEqual(manual.map(m => m.id), ["manual-short"]);
});

test("expiringSupplies: state.suppliesの並び順を書き換えない(純粋関数)", () => {
  const today = new Date("2026-08-22T00:00:00");
  const original = [
    supply({ id: "late", expiresOn: "2026-09-10" }),
    supply({ id: "early", expiresOn: "2026-08-25" }),
  ];
  const s = { ...defaultState(), supplies: original };
  const sorted = expiringSupplies(s, today);
  assert.deepEqual(sorted.map(x => x.id), ["early", "late"]);
  assert.deepEqual(original.map(x => x.id), ["late", "early"]); // 元配列は不変のまま
  assert.equal(s.supplies, original); // 参照そのものも差し替わっていない
});

test("reminderBanner: shinsai期間の境界(2/25〜3/25は含む、2/24・3/26は含まない)", () => {
  assert.equal(reminderBanner(defaultState(), new Date("2026-02-24T00:00:00")), null);
  assert.equal(reminderBanner(defaultState(), new Date("2026-02-25T00:00:00")).periodKey, "shinsai-2026");
  assert.equal(reminderBanner(defaultState(), new Date("2026-03-25T00:00:00")).periodKey, "shinsai-2026");
  assert.equal(reminderBanner(defaultState(), new Date("2026-03-26T00:00:00")), null);
});

test("reminderBanner: shinsai却下済みならnull・9/16はどちらの期間でもない", () => {
  const shinsaiDay = new Date("2026-03-01T00:00:00");
  assert.equal(
    reminderBanner({ ...defaultState(), dismissedReminders: ["shinsai-2026"] }, shinsaiDay),
    null
  );
  const outside = new Date("2026-09-16T00:00:00");
  assert.equal(reminderBanner(defaultState(), outside), null);
});

test("insuranceSuggestions: status=unknownは加入状況確認のみを提案する(旧rules.js同仕様)", () => {
  const today = new Date("2026-08-22T00:00:00");
  const insurance = {
    status: "unknown",
    coverages: { earthquake: false, stormFlood: false, household: false },
    policyLocation: "",
    renewalOn: null,
    lastCheckedOn: "2026-08-01",
    note: "",
    updatedAt: 0,
  };
  assert.deepEqual(insuranceSuggestions(insurance, today), ["加入状況を確認しましょう。"]);
});

test("insuranceSuggestions: insuredで補償欠けを個別提案し、問題なければ既定の安心メッセージ", () => {
  const today = new Date("2026-08-22T00:00:00");
  const partial = {
    status: "insured",
    coverages: { earthquake: true, stormFlood: false, household: true },
    policyLocation: "",
    renewalOn: null,
    lastCheckedOn: "2026-08-01",
    note: "",
    updatedAt: 0,
  };
  assert.deepEqual(insuranceSuggestions(partial, today), ["風災・水災が確認対象か、契約内容を見直しましょう。"]);

  const allGood = { ...partial, coverages: { earthquake: true, stormFlood: true, household: true } };
  assert.deepEqual(insuranceSuggestions(allGood, today), [
    "現在、急いで確認する項目はありません。次回確認日を決めておきましょう。",
  ]);
});

test("insuranceSuggestions: 1年超未確認+更新30日以内は両方の文言が並ぶ", () => {
  const today = new Date("2026-08-22T00:00:00");
  const insurance = {
    status: "insured",
    coverages: { earthquake: true, stormFlood: true, household: true },
    policyLocation: "",
    renewalOn: "2026-09-10",
    lastCheckedOn: "2024-01-01",
    note: "",
    updatedAt: 0,
  };
  assert.deepEqual(insuranceSuggestions(insurance, today), [
    "前回確認から1年以上です。契約内容と連絡先を確認しましょう。",
    "更新日まで30日以内です。変更点を確認しましょう。",
  ]);
});

test("searchProcedures: phaseはid文字列でなくphaseフィールドで判定する(procedures.jsのid/phase不一致対策)", () => {
  // ls-alert-shelter は id が alert を示唆するが phase フィールドは prepare。
  const byAlert = searchProcedures("", "landslide", "alert", [], false);
  assert.ok(!byAlert.some(p => p.id === "ls-alert-shelter"));
  const byPrepare = searchProcedures("", "landslide", "prepare", [], false);
  assert.ok(byPrepare.some(p => p.id === "ls-alert-shelter"));
});

test("searchProcedures: queryはtitle/body/keywordsを横断して部分一致し、onlyFavoritesで絞り込める", () => {
  const byQuery = searchProcedures("津波", "all", "all", [], false);
  assert.ok(byQuery.length > 0);
  assert.ok(byQuery.every(p => [p.title, p.body, ...p.keywords].join(" ").includes("津波")));

  const favIds = ["eq-now-cover", "ts-now-run"];
  const onlyFav = searchProcedures("", "all", "all", favIds, true);
  assert.deepEqual(onlyFav.map(p => p.id).sort(), [...favIds].sort());
});

// ── todaysAction: 11段の優先順チェーン。誤った順序はユーザーに間違った「今日の1つ」を
// 見せてしまい、テストがなければ気づけない。隣接するステップ同士を必ず対で確認する。

const readyHousehold = { adults: 1, children: 0, stockDays: 3, emergencyContacts: "祖父母:090-xxxx-xxxx", updatedAt: 0 };
const readyFamilyMembers = [{ id: "f1", label: "本人", contactNote: "", meetingPlace: "近所の公園", considerations: "", updatedAt: 0 }];

function fullyStockedSupplies(household) {
  return STOCK_GUIDE.map(item =>
    supply({ id: `full-${item.key}`, recommendedKey: item.key, quantity: requiredQuantity(item, household), unit: item.unit })
  );
}
function withShort(supplies, ...keys) {
  return supplies.map(s => (keys.includes(s.recommendedKey) ? { ...s, quantity: 0 } : s));
}
function readyState(supplies, overrides = {}) {
  return { ...defaultState(), household: readyHousehold, familyMembers: readyFamilyMembers, supplies, ...overrides };
}

test("todaysAction: 家族カード0件→集合場所全員未登録→緊急連絡メモ空、の順に最優先", () => {
  assert.equal(todaysAction(defaultState()).id, "family-card");

  const noMeeting = [{ id: "f1", label: "本人", contactNote: "", meetingPlace: "", considerations: "", updatedAt: 0 }];
  assert.equal(todaysAction({ ...defaultState(), familyMembers: noMeeting }).id, "meeting");

  const noContacts = { ...defaultState(), familyMembers: readyFamilyMembers, household: { ...defaultState().household, emergencyContacts: "" } };
  assert.equal(todaysAction(noContacts).id, "contacts");
});

test("todaysAction: 集合場所は1人でも登録されていれば(全員未登録でなければ)meetingを飛ばす", () => {
  const members = [
    { id: "f1", label: "本人", contactNote: "", meetingPlace: "", considerations: "", updatedAt: 0 },
    { id: "f2", label: "配偶者", contactNote: "", meetingPlace: "近所の公園", considerations: "", updatedAt: 0 },
  ];
  const state = { ...defaultState(), familyMembers: members, household: { ...defaultState().household, emergencyContacts: "祖父母:090-xxxx-xxxx" } };
  assert.notEqual(todaysAction(state).id, "meeting");
});

test("todaysAction: water/toilet/battery/foodが全部未充足でもwaterが最優先", () => {
  const short = withShort(fullyStockedSupplies(readyHousehold), "water", "simpleToilet", "mobileBattery", "mainFood");
  assert.equal(todaysAction(readyState(short)).id, "water");
});

test("todaysAction: waterが充足していればtoiletが優先", () => {
  const short = withShort(fullyStockedSupplies(readyHousehold), "simpleToilet", "mobileBattery", "mainFood");
  assert.equal(todaysAction(readyState(short)).id, "toilet");
});

test("todaysAction: water/toiletが充足していればbatteryが優先", () => {
  const short = withShort(fullyStockedSupplies(readyHousehold), "mobileBattery", "mainFood");
  assert.equal(todaysAction(readyState(short)).id, "battery");
});

test("todaysAction: water/toilet/batteryが充足していればfoodが優先(他の在庫不足より先)", () => {
  const short = withShort(fullyStockedSupplies(readyHousehold), "mainFood", "radio");
  assert.equal(todaysAction(readyState(short)).id, "food");
});

test("todaysAction: 4品目充足でも期限切れ間近があれば、残りの在庫不足より先にexpiringを提案", () => {
  const today = new Date("2026-08-22T00:00:00");
  const supplies = withShort(fullyStockedSupplies(readyHousehold), "radio"); // radioは在庫不足のまま残す
  supplies.push(supply({ id: "expiring-one", recommendedKey: null, expiresOn: "2026-09-01", quantity: 1, minimumQuantity: 1 }));
  assert.equal(todaysAction(readyState(supplies), today).id, "expiring");
});

test("todaysAction: 期限切れがなければ残りの在庫不足(stock)が保険確認より優先", () => {
  const supplies = withShort(fullyStockedSupplies(readyHousehold), "radio");
  const state = readyState(supplies, { insurance: { ...defaultState().insurance, lastCheckedOn: null } });
  assert.equal(todaysAction(state).id, "stock");
});

test("todaysAction: 在庫が全部充足していれば保険未確認(lastCheckedOnなし)を提案", () => {
  const state = readyState(fullyStockedSupplies(readyHousehold), { insurance: { ...defaultState().insurance, lastCheckedOn: null } });
  assert.equal(todaysAction(state).id, "insurance");
});

test("todaysAction: 保険確認から1年超でも(なしと同様に)保険確認を提案", () => {
  const today = new Date("2026-08-22T00:00:00");
  const state = readyState(fullyStockedSupplies(readyHousehold), { insurance: { ...defaultState().insurance, lastCheckedOn: "2024-01-01" } });
  assert.equal(todaysAction(state, today).id, "insurance");
});

test("todaysAction: すべて満たしていればnull(UIは「今日の備えはバッチリです」を表示)", () => {
  const today = new Date("2026-08-22T00:00:00");
  const state = readyState(fullyStockedSupplies(readyHousehold), { insurance: { ...defaultState().insurance, lastCheckedOn: "2026-08-01" } });
  assert.equal(todaysAction(state, today), null);
});
