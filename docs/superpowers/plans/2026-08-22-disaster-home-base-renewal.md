# 防災ホームベース フルリニューアル 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 災害11種×段階別手順・家族共有(Firebase合言葉方式)・備蓄量自動計算・PWA対応を備えた防災アプリへのフルリニューアル。

**Architecture:** ビルド不要の静的ES Modules構成。localStorage(v2)が第一保存先で、共有ON時のみFirestore(無料Sparkプラン・匿名認証)が世帯データの正本になる。UIは責務別モジュール(`js/ui/*`)+イベント委譲。

**Tech Stack:** Vanilla JS (ES Modules) / Firebase JS SDK 10.12.5 (CDN・共有ON時のみ動的import) / Service Worker + Web App Manifest / node --test

**Spec:** `docs/superpowers/specs/2026-08-22-renewal-design.md`

## Global Constraints

- **有料サービス一切禁止**。Firebaseは無料Sparkプラン固定・クレジットカード登録なし。Blazeプラン・Cloud Functions・有料APIは使用しない
- 外部通信は「共有ON時のFirestore」と「gstatic CDNのFirebase SDK」のみ。それ以外の外部リクエストを一切追加しない
- npm依存パッケージを追加しない(devDependenciesも不可)。テストはNode標準の `node --test` のみ
- localStorageキー: v1 `a008.disaster-home-base.v1`(読み取り専用・残す)、v2 `a008.disaster-home-base.v2`
- 実名・住所・証券番号全文・生年月日の入力を求めない。「公的な指示を優先」の文言を緊急系画面に必ず表示
- タップ領域44px以上、`prefers-reduced-motion` 対応、aria属性・role付与、360/768/1280pxで破綻しない
- コミットメッセージは日本語で `feat:`/`fix:`/`docs:`/`test:` プレフィックス、末尾に `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- 作業はfeatureブランチ `renewal` で行う(Task 1で作成)。**push・デプロイは計画外**(ユーザー確認必須)
- 手動確認用サーバー: `python3 -m http.server 8008`(アプリのフォルダーで実行)

---

### Task 1: スキャフォールド(旧コード撤去・新構成準備)

**Files:**
- Delete: `app.js`, `rules.js`, `rules.test.js`, `ui-static.test.js`
- Modify: `package.json`
- Create: `tests/smoke.test.js`

**Interfaces:**
- Produces: ディレクトリ規約 `js/`, `js/data/`, `js/ui/`, `tests/`。テストコマンド `npm test`(= `node --test tests/`)

- [ ] **Step 1: ブランチ作成と旧ファイル削除**

```bash
git checkout -b renewal
git rm app.js rules.js rules.test.js ui-static.test.js
mkdir -p js/data js/ui tests icons docs
```

(旧 `index.html`/`styles.css` はTask 8で全面置換するため一旦残す)

- [ ] **Step 2: package.json を更新**

```json
{
  "name": "disaster-home-base",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test tests/" }
}
```

- [ ] **Step 3: smokeテストを書く**

```js
// tests/smoke.test.js
import { test } from "node:test";
import assert from "node:assert/strict";

test("テストランナーが動く", () => { assert.equal(1 + 1, 2); });
```

- [ ] **Step 4: `npm test` がPASSすることを確認**

- [ ] **Step 5: Commit** — `feat: リニューアルの土台(旧コード撤去・テスト構成)`

---

### Task 2: validate.js(入力検証)

**Files:**
- Create: `js/validate.js`
- Test: `tests/validate.test.js`

**Interfaces:**
- Produces:
  - `uid(now?) -> string`
  - `validDate(v) -> boolean`(null許容・YYYY-MM-DD実在日)
  - `validateSupply(input, locationIds) -> {valid, errors, value}` — valueは `{name, category, quantity, minimumQuantity, unit, expiresOn, locationId, isGoBag, isReady, note, recommendedKey}`
  - `validateLocation(input)` / `validateFamily(input)` / `validateInsurance(input)` — 旧rules.jsと同仕様
  - `validateHousehold(input) -> {valid, errors, value:{adults, children, stockDays, emergencyContacts}}`
  - `CATEGORIES = ["water","food","medical","light","hygiene","documents","other"]`

- [ ] **Step 1: 失敗するテストを書く**

旧 `rules.test.js` の検証観点(git履歴 `ed89562` 参照)を引き継ぎつつ、新規分を追加:

```js
// tests/validate.test.js
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
```

- [ ] **Step 2: 実行してFAILを確認**(`npm test` — モジュール未作成エラー)

- [ ] **Step 3: 実装**

旧 `rules.js`(git履歴)の `validateSupply/validateLocation/validateFamily/validateInsurance/validDate/uid/CATEGORIES` を整形して移植し、以下を追加:

```js
// validateSupply の value に追加(検証は「文字列で30文字以内 or null」のみ):
const recommendedKey = typeof input.recommendedKey === "string" && input.recommendedKey.length <= 30 ? input.recommendedKey : null;

export function validateHousehold(input) {
  const errors = {};
  const adults = Number(input.adults), children = Number(input.children);
  const stockDays = Number(input.stockDays);
  const emergencyContacts = String(input.emergencyContacts ?? "").trim();
  if (!Number.isInteger(adults) || adults < 0 || adults > 20) errors.adults = "大人の人数は0〜20で入力してください。";
  if (!Number.isInteger(children) || children < 0 || children > 20) errors.children = "子どもの人数は0〜20で入力してください。";
  if (!errors.adults && !errors.children && adults + children < 1) errors.adults = "家族の人数を1人以上にしてください。";
  if (![3, 7].includes(stockDays)) errors.stockDays = "備蓄日数は3日か7日を選んでください。";
  if (emergencyContacts.length > 500) errors.emergencyContacts = "緊急連絡メモは500文字以内で入力してください。";
  return { valid: !Object.keys(errors).length, errors, value: { adults, children, stockDays, emergencyContacts } };
}
```

- [ ] **Step 4: `npm test` PASS確認**
- [ ] **Step 5: Commit** — `feat: 入力検証モジュール(世帯設定・recommendedKey対応)`

---

### Task 3: 災害11種と段階別手順データ

**Files:**
- Create: `js/data/hazards.js`, `js/data/procedures.js`
- Test: `tests/procedures.test.js`

**Interfaces:**
- Produces:
  - `HAZARDS = ["earthquake","tsunami","typhoon","heavyRain","flood","landslide","heavySnow","powerOutage","waterOutage","fire","heatwave"]`
  - `HAZARD_LABELS`(地震/津波/台風/豪雨/洪水/土砂災害/大雪/停電/断水/火災/猛暑)、`HAZARD_GLYPHS`(1文字表示: 揺/波/風/雨/洪/崖/雪/暗/水/火/暑)
  - `PHASES = ["prepare","alert","now","after","recover"]`、`PHASE_LABELS = {prepare:"ふだんの備え", alert:"警報・直前", now:"発生時", after:"直後", recover:"生活再建"}`
  - `PROCEDURES: {id, hazard, phase, title, body, keywords[]}[]`

- [ ] **Step 1: 構造を強制するテストを書く**

```js
// tests/procedures.test.js
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
```

- [ ] **Step 2: FAIL確認**

- [ ] **Step 3: hazards.js を実装**(上記Interfacesの定数をそのまま定義)

- [ ] **Step 4: procedures.js を実装**

内閣府・消防庁・気象庁の公開防災指針の一般的内容を、命令形の短文で記述。ID規約は `{hazard略}-{連番or英単語}`。**津波を品質基準の完全実例とする**(このまま採用):

```js
{id:"ts-prep-route", hazard:"tsunami", phase:"prepare", title:"高台への避難経路を家族で歩いて確認する", body:"自宅・職場・学校から最寄りの高台や津波避難ビルまで、実際に歩いて時間を測っておきます。夜間の経路も確認しましょう。", keywords:["高台","経路","避難ビル"]},
{id:"ts-prep-map", hazard:"tsunami", phase:"prepare", title:"ハザードマップで浸水想定を確認する", body:"自治体のハザードマップで自宅の浸水想定と避難先を確認し、家族カードの集合場所に反映しておきます。", keywords:["ハザードマップ","浸水"]},
{id:"ts-alert-info", hazard:"tsunami", phase:"alert", title:"津波警報・注意報をすぐ確認する", body:"強い揺れや長い揺れを感じたら、テレビ・ラジオ・防災無線で津波情報を確認します。揺れが小さくても油断しないでください。", keywords:["警報","揺れ"]},
{id:"ts-now-run", hazard:"tsunami", phase:"now", title:"ためらわず、より高い場所へすぐ避難する", body:"津波警報が出たら、荷物より避難を優先し、高台や津波避難ビルへ移動します。「遠く」より「高く」が原則です。", keywords:["高台","すぐ","避難"]},
{id:"ts-now-nocar", hazard:"tsunami", phase:"now", title:"原則、車を使わず徒歩で避難する", body:"渋滞に巻き込まれると逃げ遅れます。原則徒歩で、海や川から離れる方向へ避難してください。", keywords:["車","徒歩","渋滞"]},
{id:"ts-now-river", hazard:"tsunami", phase:"now", title:"川沿いから離れる", body:"津波は川をさかのぼります。海だけでなく川からも直角に離れる方向へ避難してください。", keywords:["川","遡上"]},
{id:"ts-after-stay", hazard:"tsunami", phase:"after", title:"警報解除まで絶対に戻らない", body:"津波は繰り返し襲来し、第2波以降が高いこともあります。警報・注意報が解除されるまで高い場所にとどまります。", keywords:["第2波","戻らない"]},
{id:"ts-after-family", hazard:"tsunami", phase:"after", title:"家族の安否を伝言サービスで確認する", body:"直接会えないときは171(災害用伝言ダイヤル)やSNSで安否を残します。集合場所は家族カードで確認できます。", keywords:["安否","171"]},
{id:"ts-recover-check", hazard:"tsunami", phase:"recover", title:"建物の安全を確認してから片付ける", body:"浸水した家屋は感電や衛生面の危険があります。ブレーカーを切り、写真で被害を記録してから片付けを始めます。", keywords:["浸水","記録","ブレーカー"]},
```

残り10災害は同じ品質・文体で、以下のトピックを必ず含めて各8〜12件書く:

| 災害 | 必須トピック(段階) |
|---|---|
| earthquake | 家具固定・寝室の安全(prepare)/ 備蓄と持ち出し品点検(prepare)/ 頭を守り揺れが収まるまで待つ(now)/ あわてて外に出ない(now)/ 火元・出口確保(after)/ 靴・ガラス片(after)/ 余震警戒(after)/ 通電火災・ブレーカー(recover)/ 罹災証明の写真記録(recover) |
| tsunami | 上記実例9件 |
| typhoon | 窓・飛散物対策(prepare)/ 停電・断水への備え(alert)/ 早めの避難判断(alert)/ 暴風中は外出しない(now)/ 窓から離れる(now)/ 浸水時は上階へ(now)/ 通過後の倒木・電線に注意(after)/ 保険の被害記録(recover) |
| heavyRain | 警戒レベルの意味を知る(prepare)/ 避難情報の入手手段(prepare)/ レベル4までに全員避難(alert)/ 低地・地下から離れる(now)/ 冠水路に入らない(now)/ 垂直避難の判断(now)/ 川や用水路を見に行かない(now)/ 雨後の地盤緩み(after) |
| flood | ハザードマップ確認(prepare)/ 土のう・止水(alert)/ 上階・高所へ垂直避難(now)/ 流れる水に入らない(now)/ 電気設備に近づかない(after)/ 消毒と乾燥(recover)/ 被害写真(recover) |
| landslide | 前兆現象を知る(小石落下・湧き水・異音)(prepare)/ 警戒区域の確認(prepare)/ 大雨時は崖から離れて早めに避難(alert)/ 前兆を感じたら直ちに離れる(now)/ 斜面と反対側の2階へ(now)/ 二次崩壊に注意(after) |
| heavySnow | 雪下ろし用具・冬タイヤ準備(prepare)/ 燃料・食料の早め確保(alert)/ 不要不急の外出を控える(now)/ 雪下ろしは2人以上・命綱(now)/ 車中泊のマフラー埋没・一酸化炭素(now)/ FF給排気口の除雪(now)/ 水道凍結対策(after)/ 屋根からの落雪注意(after) |
| powerOutage | モバイル電源・乾電池備蓄(prepare)/ 懐中電灯を使う・ろうそくは避ける(now)/ 冷蔵庫の開閉を減らす(now)/ 電熱器具のプラグを抜く(now)/ 通電火災防止にブレーカーOFFで避難(now)/ 電池節約(after)/ 医療機器利用者の電源確保(prepare) |
| waterOutage | 飲料水・生活水の備蓄(prepare)/ 断水予告時の水確保(alert)/ 蛇口を閉める(now)/ 飲料水優先で使う(now)/ 簡易トイレの使い方(now)/ 給水拠点の情報確認(after)/ 復旧後は濁り水を流してから使う(after) |
| fire | 住警器・消火器の点検(prepare)/ コンロ・たこ足の予防(prepare)/ 大声で知らせ119番(now)/ 初期消火は天井に届く前まで(now)/ 煙は低く姿勢で避難(now)/ 一度逃げたら戻らない(now)/ 隣家へ知らせる(after) |
| heatwave | エアコン点検・遮光(prepare)/ 水分と塩分の備え(prepare)/ こまめな水分補給(now)/ 暑さ指数と外出判断(now)/ 高齢者・子どもへの声かけ(now)/ 熱中症のサインと応急処置(now)/ 停電時の暑さ対策(after) |

- [ ] **Step 5: `npm test` PASS確認**
- [ ] **Step 6: Commit** — `feat: 災害11種×段階別の手順データ(100件超)`

---

### Task 4: 備蓄ガイドデータ(人数×日数→必要量)

**Files:**
- Create: `js/data/stock-guide.js`
- Test: `tests/stock-guide.test.js`

**Interfaces:**
- Produces:
  - `STOCK_GUIDE: {key, name, category, unit, perPerson, perDay, rate, isGoBag, note}[]`(14項目)
  - `requiredQuantity(item, {adults, children, stockDays}) -> number`(切り上げ整数)

- [ ] **Step 1: 失敗するテストを書く**

```js
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
```

- [ ] **Step 2: FAIL確認**

- [ ] **Step 3: 実装**

```js
// js/data/stock-guide.js
export const STOCK_GUIDE = [
  { key: "water",          name: "飲料水",                 category: "water",     unit: "L",   perPerson: true,  perDay: true,  rate: 3,   isGoBag: false, note: "1人1日3Lが目安。ペットボトルで備蓄" },
  { key: "mainFood",       name: "主食(ご飯・麺など)",     category: "food",      unit: "食",  perPerson: true,  perDay: true,  rate: 3,   isGoBag: false, note: "アルファ米・レトルト・缶詰など" },
  { key: "cassetteStove",  name: "カセットコンロ",         category: "food",      unit: "台",  perPerson: false, perDay: false, rate: 1,   isGoBag: false, note: "温かい食事は体力と気力を保つ" },
  { key: "gasCanister",    name: "カセットボンベ",         category: "food",      unit: "本",  perPerson: true,  perDay: true,  rate: 0.5, isGoBag: false, note: "1人1日約1/2本が目安" },
  { key: "mobileBattery",  name: "モバイルバッテリー",     category: "light",     unit: "個",  perPerson: true,  perDay: false, rate: 1,   isGoBag: true,  note: "満充電にしておく" },
  { key: "flashlight",     name: "懐中電灯・ランタン",     category: "light",     unit: "個",  perPerson: true,  perDay: false, rate: 1,   isGoBag: true,  note: "1人1灯。ろうそくは火災の危険" },
  { key: "batteries",      name: "乾電池(予備)",           category: "light",     unit: "セット", perPerson: false, perDay: false, rate: 2, isGoBag: false, note: "使う機器に合うサイズを確認" },
  { key: "radio",          name: "携帯ラジオ",             category: "light",     unit: "台",  perPerson: false, perDay: false, rate: 1,   isGoBag: true,  note: "停電時の情報源" },
  { key: "simpleToilet",   name: "簡易トイレ",             category: "hygiene",   unit: "回分", perPerson: true, perDay: true,  rate: 5,   isGoBag: false, note: "断水時に必須。1人1日5回分" },
  { key: "wetTissue",      name: "ウェットティッシュ",     category: "hygiene",   unit: "個",  perPerson: true,  perDay: false, rate: 1,   isGoBag: true,  note: "断水時の清拭・手指衛生に" },
  { key: "firstAid",       name: "救急セット",             category: "medical",   unit: "式",  perPerson: false, perDay: false, rate: 1,   isGoBag: true,  note: "絆創膏・消毒・常備薬など" },
  { key: "medicine",       name: "常備薬・お薬手帳の控え", category: "medical",   unit: "式",  perPerson: false, perDay: false, rate: 1,   isGoBag: true,  note: "処方薬は1週間分を目安に" },
  { key: "importantCopies", name: "重要書類のコピー",      category: "documents", unit: "式",  perPerson: false, perDay: false, rate: 1,   isGoBag: true,  note: "保険証・免許証など。原本は保管場所に" },
  { key: "cash",           name: "現金(小銭含む)",         category: "documents", unit: "式",  perPerson: false, perDay: false, rate: 1,   isGoBag: true,  note: "停電時はカードが使えないことがある" },
];

export function requiredQuantity(item, { adults = 0, children = 0, stockDays = 3 } = {}) {
  const persons = adults + children;
  let q = item.rate;
  if (item.perPerson) q *= persons;
  if (item.perDay) q *= stockDays;
  return Math.ceil(q);
}
```

- [ ] **Step 4: PASS確認**
- [ ] **Step 5: Commit** — `feat: 備蓄ガイドデータと必要量計算`

---

### Task 5: state.js(v2状態・永続化・v1移行)

**Files:**
- Create: `js/state.js`
- Test: `tests/state.test.js`

**Interfaces:**
- Consumes: `validate.js` の各validate関数、`data/hazards.js` の `HAZARDS`、`data/procedures.js` の `PROCEDURES`
- Produces:
  - `STORAGE_KEY = "a008.disaster-home-base.v2"` / `STORAGE_KEY_V1 = "a008.disaster-home-base.v1"`
  - `defaultState() -> State`(下記shape)
  - `safeState(raw) -> State`(破損・不正データを既定値へ正規化)
  - `migrateV1(rawV1) -> State`
  - `loadState(storage = localStorage) -> {state, notice, isError}`
  - `saveState(state, storage = localStorage)`(失敗時throw)
  - `SHARED_KEYS = ["household","supplies","locations","familyMembers","insurance"]`

State shape v2:

```js
{
  schemaVersion: 2,
  // ── 世帯データ(共有対象) ──
  household: { adults: 2, children: 0, stockDays: 3, emergencyContacts: "", updatedAt: 0 },
  supplies: [],      // validateSupply.value + {id, createdAt, updatedAt}
  locations: [],     // validateLocation.value + {id, updatedAt}
  familyMembers: [], // validateFamily.value + {id, updatedAt}
  insurance: { status:"unknown", coverages:{earthquake:false,stormFlood:false,household:false}, policyLocation:"", renewalOn:null, lastCheckedOn:null, note:"", updatedAt: 0 },
  // ── 端末データ(共有しない) ──
  shopping: [],      // {id, name, done, updatedAt} 買い足しリスト
  mode: "normal", selectedHazard: null, emergencyCheckedIds: [],
  favoriteProcedureIds: [], dismissedReminders: [],
  ui: { view: "home", supplyTab: "goBag", search: "", hazardFilter: "all", phaseFilter: "all" },
  sync: { enabled: false, passphrase: null, householdId: null }
}
```

- [ ] **Step 1: 失敗するテストを書く**

```js
// tests/state.test.js
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
    ui: { view: "supplies", supplyTab: "stock", search: "", hazardFilter: "all" } };
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
```

- [ ] **Step 2: FAIL確認**

- [ ] **Step 3: 実装**

方針(旧 `safeState` の考え方をv2向けに再実装):

- `safeState`: 世帯エンティティは各validate関数を通し、validのみ採用(`slice(-200)`/`-30`/`-20` の上限も踏襲)。`updatedAt`/`createdAt` は `Number.isFinite` でなければ0。`household` は `validateHousehold`、`insurance` は `validateInsurance`。`favoriteProcedureIds`/`emergencyCheckedIds` は `PROCEDURES` 照合。`ui.view` は `["home","supplies","procedures","family","emergency"]`、`supplyTab` は `["goBag","stock","rolling","locations","insurance"]`、`phaseFilter` は `["all",...PHASES]`。`sync` は `{enabled:Boolean, passphrase:string|null(80字以内), householdId: /^[0-9a-f]{64}$/ or null}`、enabledでもhouseholdId不正ならOFF。`shopping` は `{id:string, name:1..40字, done:Boolean, updatedAt}` のみ採用・`slice(-100)`
- `migrateV1`: v1のraw→v2形へ写像(suppliesに `recommendedKey:null` と `updatedAt` 補完、locations/familyMembersに `updatedAt:0` 補完、household/shopping/sync等はdefault)→ 最後に `safeState` へ通して返す
- `loadState`: v2 → parse+safeState(修復があれば notice)。v2なし&v1あり → migrateV1して `saveState` まで行い notice「以前のデータを新しい形式に引き継ぎました。」。どちらもなし → default。throw時 → default + isError
- `saveState`: `storage.setItem(STORAGE_KEY, JSON.stringify(state))`

- [ ] **Step 4: PASS確認**
- [ ] **Step 5: Commit** — `feat: v2状態モデルとlocalStorage永続化・v1移行`

---

### Task 6: derive.js(準備率・今日やる1つ・派生値)

**Files:**
- Create: `js/derive.js`
- Test: `tests/derive.test.js`

**Interfaces:**
- Consumes: `STOCK_GUIDE`/`requiredQuantity`、State shape(Task 5)
- Produces:
  - `dateKey(date?) -> "YYYY-MM-DD"`
  - `stockStatus(state) -> {key, name, unit, category, required, have, fulfilled, registered}[]`(STOCK_GUIDE全14件分。`have`=recommendedKey一致品の数量合計、`registered`=1件でも登録あり)
  - `readiness(state) -> {categories: {id, label, fraction, level}[], percent}`(6カテゴリ、level: "done"|"almost"|"todo"、percent=fraction平均の%)
  - `todaysAction(state, today?) -> {id, label, view, tab} | null`
  - `expiringSupplies(state, today?) -> Supply[]`(期限が今日から30日以内 or 過ぎたもの、期限昇順)
  - `shortSupplies(state) -> {guide: stockStatusの不足分[], manual: Supply[]}`(manual=recommendedKeyなしで quantity<minimumQuantity)
  - `reminderBanner(state, today?) -> {periodKey, title, text} | null`
  - `insuranceSuggestions(insurance, today?) -> string[]`(旧rules.jsと同仕様で移植)
  - `searchProcedures(query, hazard, phase, favorites, onlyFavorites) -> Procedure[]`

READINESS_CATEGORIES 定義(derive.js内、exportする):

```js
export const READINESS_CATEGORIES = [
  { id: "water",   label: "水",         keys: ["water"] },
  { id: "food",    label: "食料",       keys: ["mainFood", "cassetteStove", "gasCanister"] },
  { id: "power",   label: "電源・照明", keys: ["mobileBattery", "flashlight", "batteries", "radio"] },
  { id: "hygiene", label: "衛生・トイレ", keys: ["simpleToilet", "wetTissue", "firstAid", "medicine"] },
  { id: "info",    label: "情報・書類", keys: ["importantCopies", "cash"], extra: "insurance" },
  { id: "family",  label: "家族・連絡", keys: [], extra: "family" },
];
```

fraction: keysは `stockStatus` のfulfilled割合。`extra:"insurance"` は「lastCheckedOnあり」を1条件として分母に足す。`extra:"family"` は [家族カード≥1, 集合場所あり, 緊急連絡メモあり] の3条件。level: fraction>=1→done、>=0.5→almost、それ未満→todo(0でもfraction>0ならalmost扱いにしない。0.5未満はtodo)。

todaysAction の優先順(最初に該当したものを返す):

1. 家族カード0件 → `{id:"family-card", label:"家族カードを1枚つくる", view:"family"}`
2. 集合場所が全員未登録 → `{id:"meeting", label:"家族の集合場所を決める", view:"family"}`
3. 緊急連絡メモ空 → `{id:"contacts", label:"緊急連絡メモを書く", view:"family"}`
4. water未充足 → `{id:"water", label:"飲料水を目安量まで備える", view:"supplies", tab:"stock"}`
5. simpleToilet未充足 → `{id:"toilet", label:"簡易トイレを備える", view:"supplies", tab:"stock"}`
6. mobileBattery未充足 → `{id:"battery", label:"モバイルバッテリーを準備する", view:"supplies", tab:"goBag"}`
7. mainFood未充足 → `{id:"food", label:"主食を目安量まで備える", view:"supplies", tab:"stock"}`
8. expiringSupplies>0 → `{id:"expiring", label:"期限が近い備蓄を入れ替える", view:"supplies", tab:"rolling"}`
9. 残りのstockStatus未充足あり → `{id:"stock", label:"不足している備えを1つ足す", view:"supplies", tab:"stock"}`
10. 保険 lastCheckedOn なし or 1年超 → `{id:"insurance", label:"保険の確認メモを更新する", view:"supplies", tab:"insurance"}`
11. すべて満たす → `null`(UIは「今日の備えはバッチリです」を表示)

reminderBanner の期間: `bousai-{年}` = 8/18〜9/15(題「防災の日の点検」)、`shinsai-{年}` = 2/25〜3/25(題「3.11の見直し」)。`dismissedReminders` に periodKey があれば null。text は「備蓄の期限・家族の集合場所・保険を見直しましょう。」。

- [ ] **Step 1: 失敗するテストを書く**

```js
// tests/derive.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultState } from "../js/state.js";
import { stockStatus, readiness, todaysAction, expiringSupplies, reminderBanner, searchProcedures } from "../js/derive.js";

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
```

- [ ] **Step 2: FAIL確認**
- [ ] **Step 3: 実装**(上記Interfaces・定義どおり。`insuranceSuggestions` は旧rules.jsから移植)
- [ ] **Step 4: PASS確認**
- [ ] **Step 5: Commit** — `feat: 準備率6カテゴリ・今日やる1つ・派生値計算`

---

### Task 7: sync-logic.js(合言葉・世帯ID・マージ — 純粋ロジック)

**Files:**
- Create: `js/sync-logic.js`
- Test: `tests/sync-logic.test.js`

**Interfaces:**
- Produces:
  - `WORDS: string[]`(512語・ひらがな2〜5文字・重複なし)
  - `generatePassphrase() -> string`(例 `"さくら・つばめ・ひかり・やま・4172"`。単語4+4桁数字、区切りは `・`。`crypto.getRandomValues` 使用、単語は `Uint32 % 512`(2^32は512の倍数なので一様)、数字は`Uint32`を10000の倍数上限で棄却サンプリング)
  - `normalizePassphrase(input) -> string`(空白・読点・カンマ・`･`を`・`に統一、全角数字→半角、前後の区切り除去)
  - `householdIdFromPassphrase(pass) -> Promise<string>`(SHA-256 hex 64文字。`globalThis.crypto.subtle`)
  - `mergeEntities(local, remote) -> Entity[]`(id単位のlast-write-wins。localの順序を保持し、remoteのみのidは末尾に追加)

- [ ] **Step 1: 失敗するテストを書く**

```js
// tests/sync-logic.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { WORDS, generatePassphrase, normalizePassphrase, householdIdFromPassphrase, mergeEntities } from "../js/sync-logic.js";

test("WORDS: 512語・重複なし・ひらがな2〜5文字", () => {
  assert.equal(WORDS.length, 512);
  assert.equal(new Set(WORDS).size, 512);
  for (const w of WORDS) assert.match(w, /^[ぁ-んー]{2,5}$/u, w);
});
test("generatePassphrase: 形式が 語・語・語・語・4桁", () => {
  for (let i = 0; i < 20; i++) {
    const parts = generatePassphrase().split("・");
    assert.equal(parts.length, 5);
    for (const w of parts.slice(0, 4)) assert.ok(WORDS.includes(w));
    assert.match(parts[4], /^\d{4}$/);
  }
});
test("normalizePassphrase: 区切りゆらぎと全角数字を吸収", () => {
  assert.equal(normalizePassphrase(" さくら、つばめ･ひかり やま・４１７２ "), "さくら・つばめ・ひかり・やま・4172");
});
test("householdId: 決定的で64桁hex・合言葉が違えば別ID", async () => {
  const a = await householdIdFromPassphrase("さくら・つばめ・ひかり・やま・4172");
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, await householdIdFromPassphrase("さくら・つばめ・ひかり・やま・4172"));
  assert.notEqual(a, await householdIdFromPassphrase("さくら・つばめ・ひかり・やま・4173"));
});
test("mergeEntities: 新しいremoteが勝ち、古いremoteは負け、片側のみは残る", () => {
  const local = [{ id: "a", v: "L", updatedAt: 5 }, { id: "b", v: "L", updatedAt: 5 }, { id: "c", v: "L", updatedAt: 5 }];
  const remote = [{ id: "a", v: "R", updatedAt: 9 }, { id: "b", v: "R", updatedAt: 1 }, { id: "d", v: "R", updatedAt: 9 }];
  const m = mergeEntities(local, remote);
  assert.deepEqual(m.map(x => x.id + x.v), ["aR", "bL", "cL", "dR"]);
});
```

- [ ] **Step 2: FAIL確認**

- [ ] **Step 3: 実装**

WORDSは常用の平易な名詞のみ(不快語・固有名詞・紛らわしい同音語を避ける)。書き出しの例:

```
あさひ いなほ うみかぜ えがお おかし かえで きつね くじら けやき こむぎ さくら しずく すずめ せかい そらまめ たいよう ちきゅう つばめ てがみ とけい なのはな にじいろ ぬのはし ねこやなぎ のはら はるかぜ ひかり ふうりん へちま ほしぞら まつり みどり むぎちゃ めだか もみじ やまびこ ゆきぐに よあけ らくだ りんご るりいろ れんげ わかば
```

このトーンで512語まで埋める(テストが語数・文字種・重複を強制する)。

- [ ] **Step 4: PASS確認**(Node 18+は `globalThis.crypto` 標準)
- [ ] **Step 5: Commit** — `feat: 合言葉生成・世帯ID導出・LWWマージ`

---

### Task 8: アプリシェル(index.html・styles.css・main.js)

**Files:**
- Rewrite: `index.html`, `styles.css`
- Create: `js/main.js`, `js/ui/render.js`, `js/firebase-config.js`
- Test: `tests/ui-static.test.js`

**Interfaces:**
- Consumes: Task 2-7の全モジュール
- Produces:
  - `js/ui/render.js`: `esc(v)`(HTMLエスケープ)、`$ / $$`(querySelector系)
  - `js/firebase-config.js`: `export const firebaseConfig = null;`(未設定プレースホルダー。設定時はオブジェクトに差し替え)
  - `js/main.js` がexportする ctx(各uiモジュールの `bind(ctx)` に渡す):
    - `getState() -> State` / `commit(next, {success, syncOps}) -> boolean`(saveState+通知+render。`syncOps: {kind:"supplies"|"locations"|"familyMembers", entity}|{kind, removedId}|{shared:"insurance"|"household"|"all"}` の配列。共有ON時のみ実行)
    - `showView(name, opts)` / `notice(text, isError)` / `confirmAction(title, msg, label, fn)` / `render()`
  - index.htmlの主要ID(ui-static.test.jsが強制): `view-home` `view-emergency` `view-supplies` `view-procedures` `view-family` `emergency-open` `hazard-dialog` `supply-dialog` `location-dialog` `family-dialog` `household-dialog` `confirm-dialog` `share-create-dialog` `share-join-dialog` `notice`

- [ ] **Step 1: 静的テストを書く**

```js
// tests/ui-static.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("必須要素IDがそろっている", () => {
  for (const id of ["view-home","view-emergency","view-supplies","view-procedures","view-family",
    "emergency-open","hazard-dialog","supply-dialog","location-dialog","family-dialog",
    "household-dialog","confirm-dialog","share-create-dialog","share-join-dialog","notice"])
    assert.ok(html.includes(`id="${id}"`), id);
});
test("PWA・アクセシビリティの基本", () => {
  assert.ok(html.includes('rel="manifest"'));
  assert.ok(html.includes('lang="ja"'));
  assert.ok(html.includes("skip-link"));
});
test("公的指示優先の文言・TODOなし", () => {
  assert.ok(html.includes("公的な指示を優先"));
  assert.ok(!/TODO|FIXME|placeholder/.test(html));
});
```

- [ ] **Step 2: FAIL確認**

- [ ] **Step 3: index.html を全面書き換え**

構成(旧版の骨格を踏襲しつつ拡張。dialogのform構造・data属性ディスパッチ方式は旧版と同じパターン):

- header: ブランド+`#emergency-open`(緊急モード)
- nav: side-nav(PC)/bottom-nav(モバイル) — ホーム/準備/手順/家族 の4項目(`data-view`)
- `#view-home`: hero(準備率6カテゴリ表示 `#readiness`)+`#today-action`(今日やる1つ)+`#reminder-banner`+`#alerts`+ショートカット+プライバシーノート
- `#view-emergency`: 緊急バー・`#emergency-procedures`(now/afterチェックリスト)・持ち出し品・集合場所/家族・`#emergency-contacts`・171使い方ブロック(静的HTML: 「171に電話→1で録音/2で再生→自宅などの番号を入力」)・災害変更/通常へ戻るボタン
- `#view-supplies`: タブ5つ `data-supply-tab`: `goBag`(持ち出し品)/`stock`(備蓄)/`rolling`(入れ替え)/`locations`(保管場所)/`insurance`(保険)+`#supply-panel`
- `#view-procedures`: 検索フォーム+災害フィルター(11種)+段階フィルター(`#phase-filter`)+お気に入りチェック+`#procedure-results`
- `#view-family`: 家族カード一覧+`#household-card`(世帯設定表示+編集ボタン)+`#share-section`(共有UI、Task 12でui/share.jsが描画)
- dialogs: `hazard-dialog`(11災害グリッド、`HAZARD_GLYPHS`使用)/`supply-dialog`(旧版+recommendedKey hidden入力)/`location-dialog`/`family-dialog`(旧版どおり)/`household-dialog`(大人・子ども・備蓄日数(3日/7日 radio)・緊急連絡メモtextarea)/`confirm-dialog`(旧版どおり)/`share-create-dialog`(生成された合言葉の大きな表示+「家族に伝えてください」+コピー)/`share-join-dialog`(合言葉入力+統合方法radio: `merge`「自分のデータと合流」/`replace`「世帯のデータで置き換え」)
- `<link rel="manifest" href="./manifest.webmanifest">`・`<meta name="theme-color">`・apple-touch-icon(Task 13で実ファイル)

- [ ] **Step 4: main.js を実装**

旧app.jsの委譲パターンを整理して移植。責務: 起動(`loadState`→SW登録→render)、`commit`(saveState失敗時「保存できませんでした。入力は残っています。」+入力保持)、view切替(emergency中はemergency固定)、`data-view`/`data-supply-tab`/dialogディスパッチ、confirm-dialog管理、各uiモジュールの `bind(ctx)` 呼び出し、`render()`(全uiモジュールのrenderを呼ぶ)。`syncOps` はsync未有効時はno-op。SW登録:

```js
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
```

- [ ] **Step 5: styles.css — frontend-designスキルでデザイン実装**

Skillツールで `frontend-design` を起動してから書く。デザインブリーフ:

- コンセプト「静かな安心」: 平時は深緑(#174a55系を洗練)×生成り紙色、セリフ寄り見出し(游明朝系フォールバック)+ゴシック本文。カード角丸・繊細な罫線・十分な余白
- 緊急モード: `body.emergency-active` で白地に赤(#b42318)/黒の高コントラスト・文字1.15倍・1カラム・ナビ非表示
- 準備率は6カテゴリのセグメントバーまたはリング(done=深緑/almost=琥珀/todo=薄灰、色以外にラベル併記)
- 360px基準1カラム→768px 2カラム→1080px サイドナビ+右レール(旧版のレイアウト構造を継承してよい)
- 44px以上のタップ領域・`:focus-visible`明示・`prefers-reduced-motion` で動きを止める

- [ ] **Step 6: `npm test` PASS+手動確認**

`python3 -m http.server 8008` で起動し、ブラウザ(preview)で: 各ビュー遷移・コンソールエラーなし・360px表示を確認。この時点ではhome等の中身は空でよい(次タスク以降で実装)が、シェルとナビは動作すること。

- [ ] **Step 7: Commit** — `feat: 新アプリシェル(HTML/CSS/main.js・デザイン刷新)`

---

### Task 9: ui/home.js + ui/procedures.js

**Files:**
- Create: `js/ui/home.js`, `js/ui/procedures.js`
- Modify: `js/main.js`(bind/render呼び出し追加)

**Interfaces:**
- Consumes: `derive.js` 全般、ctx(Task 8)
- Produces: 各モジュール `export function bind(ctx)` / `export function render(ctx)`

- [ ] **Step 1: ui/home.js を実装**

```js
// 描画内容(render):
// 1) #readiness: readiness(state) の6カテゴリを level色+ラベルで表示、中央に percent%
// 2) #today-action: todaysAction(state) を大きなボタンで表示(クリックで view/tab へ遷移)。
//    nullなら「今日の備えはバッチリです ✓」
// 3) #reminder-banner: reminderBanner(state) があれば表示。「点検した」ボタンで
//    commit({...state, dismissedReminders:[...state.dismissedReminders, periodKey]})
// 4) #alerts: expiringSupplies件数・shortSupplies件数の警告カード(旧版と同様)。ゼロなら平常カード
// bind: クリック委譲は main.js の data-view ディスパッチを利用(遷移のみなので追加リスナー最小)
```

- [ ] **Step 2: ui/procedures.js を実装**

旧renderProceduresを移植し、段階フィルター(`#phase-filter`、PHASE_LABELS)を追加。`searchProcedures(query, hazard, phase, favorites, onlyFavorites)` を使用。手順カードに災害ラベル+段階ラベルを表示。お気に入りトグル(`data-favorite`)、0件時の「条件をすべて解除」も旧版どおり。検索50文字制限も維持。

- [ ] **Step 3: 手動確認** — 検索「水」/災害=津波/段階=発生時 の組み合わせ、0件→解除、お気に入り登録→リロードで保持
- [ ] **Step 4: Commit** — `feat: ホーム(準備率・今日やる1つ)と手順検索`

---

### Task 10: ui/supplies.js(台帳・推奨セット・ローリングストック)

**Files:**
- Create: `js/ui/supplies.js`
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `stockStatus`/`expiringSupplies`/`shortSupplies`、`validateSupply`/`validateLocation`/`validateInsurance`、ctx
- Produces: `bind(ctx)`/`render(ctx)`。data属性: `data-add-supply` `data-edit-supply` `data-ready` `data-add-location` `data-edit-location` `data-add-recommended`(key指定で1件追加)`data-add-recommended-all` `data-consume`(rollingタブ)`data-shopping-done` `data-shopping-remove`

- [ ] **Step 1: タブ実装**

- `goBag`/`stock`: 旧supplyRowsを踏襲。**stockタブ上部に「備蓄の目安」パネル**: `stockStatus(state)` の各行(名前・必要量・現在量・充足/不足/未登録バッジ)。未登録行に「台帳に追加」(`data-add-recommended`)、全未登録一括の「おすすめセットをまとめて追加」(`data-add-recommended-all`)。追加時は `{name: guide.name, category: guide.category, unit: guide.unit, quantity: 0, minimumQuantity: requiredQuantity(item, household), isGoBag: guide.isGoBag, recommendedKey: key}` で `validateSupply` を通しcommit(syncOps付き)
- `rolling`(入れ替えタブ・新規): `expiringSupplies` を期限順に表示(期限切れ=赤・30日以内=琥珀)。各行「消費した」ボタン(`data-consume`)→ 数量を1減らし(0未満にしない)、`shopping` に同名がなければ `{id: uid(), name, done:false, updatedAt: Date.now()}` を追加。下部に買い足しリスト(チェック `data-shopping-done` で done トグル、`data-shopping-remove` で削除)。買い足しは端末ローカル(syncOpsなし)
- `locations`/`insurance`: 旧版を移植(保険はvalidateInsurance+`syncOps:[{shared:"insurance"}]`)

- [ ] **Step 2: 品目フォーム** — 旧supply-dialogロジック移植+hidden `recommendedKey` 維持。保存時 `syncOps:[{kind:"supplies", entity}]`
- [ ] **Step 3: 手動確認** — 世帯(大人2・3日)でおすすめ一括追加→水27L必要の不足表示→数量30入力で充足に変わる。期限を昨日にした品目がrollingに出て「消費した」で買い足しに載る
- [ ] **Step 4: Commit** — `feat: 準備台帳(推奨セット・ローリングストック・買い足しリスト)`

---

### Task 11: ui/family.js + ui/emergency.js

**Files:**
- Create: `js/ui/family.js`, `js/ui/emergency.js`
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `validateFamily`/`validateHousehold`、`PROCEDURES`/`HAZARD_LABELS`/`HAZARD_GLYPHS`、ctx
- Produces: `bind(ctx)`/`render(ctx)`。family保存 `syncOps:[{kind:"familyMembers", entity}]`、世帯設定保存 `syncOps:[{shared:"household"}]`

- [ ] **Step 1: ui/family.js** — 旧家族カード(一覧・追加・編集)+`#household-card`: 世帯人数(大人/子ども)・備蓄日数・緊急連絡メモの表示と「世帯設定を編集」→`household-dialog`(validateHousehold・エラー表示は旧fillErrorsパターン)。人数変更後は備蓄目安が変わる旨をnoticeで案内
- [ ] **Step 2: ui/emergency.js** — 旧renderEmergencyを11災害対応で移植。構成: now手順チェックリスト(冪等トグル・`data-emergency-check`)→after手順→持ち出し品→集合場所/家族(配慮事項)→`#emergency-contacts`(household.emergencyContacts、未記入なら案内)→171ブロック(静的)。「この災害のすべての手順」リンク→proceduresへhazardフィルター済みで遷移。災害変更/終了の確認ダイアログは旧仕様(チェックリセット・キャンセル可)
- [ ] **Step 3: 手動確認** — 11災害それぞれで緊急開始→now手順表示→チェック→リロード復元→通常へ戻る。未選択で開始不可
- [ ] **Step 4: Commit** — `feat: 家族カード・世帯設定・緊急モード11災害対応`

---

### Task 12: Firebase同期(sync.js + ui/share.js)

**Files:**
- Create: `js/sync.js`, `js/ui/share.js`
- Modify: `js/main.js`(リモート受信ハンドラー・commitのsyncOps実行)

**Interfaces:**
- Consumes: `sync-logic.js`、`firebase-config.js`、validate各関数(リモートデータのサニタイズ)、ctx
- Produces(sync.js):
  - `isConfigured() -> boolean`
  - `startSync(householdId, {onRemoteCollection(kind, upserts, removedIds), onRemoteShared(kind, data), onStatus(status)}) -> Promise<void>`
  - `pushEntity(householdId, kind, entity)` / `removeEntity(householdId, kind, id)` / `pushShared(householdId, kind, data)` / `pushAll(householdId, state)`(いずれも**awaitしないfire-and-forget**・失敗は`.catch`でstatusへ)
  - `stopSync()`
  - kind→コレクション名: `{supplies:"supplies", locations:"locations", familyMembers:"members"}`、shared docパス: `households/{hid}/shared/{insurance|household|meta}`

- [ ] **Step 1: sync.js を実装**

```js
// js/sync.js の骨子
import { firebaseConfig } from "./firebase-config.js";
const SDK = "https://www.gstatic.com/firebasejs/10.12.5";
let fb = null, unsubs = [], status = { phase: "off", error: null }, statusCb = null;

export function isConfigured() { return Boolean(firebaseConfig?.apiKey); }
function setStatus(patch) { status = { ...status, ...patch }; statusCb?.(status); }

async function ensureFirebase() {
  if (fb) return fb;
  const [appM, authM, fsM] = await Promise.all([
    import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-firestore.js`)]);
  const app = appM.initializeApp(firebaseConfig);
  const db = fsM.initializeFirestore(app, {
    localCache: fsM.persistentLocalCache({ tabManager: fsM.persistentMultipleTabManager() }) });
  await authM.signInAnonymously(authM.getAuth(app));
  return (fb = { db, fs: fsM });
}

const COLLS = { supplies: "supplies", locations: "locations", familyMembers: "members" };

export async function startSync(hid, { onRemoteCollection, onRemoteShared, onStatus }) {
  statusCb = onStatus; setStatus({ phase: "connecting", error: null });
  const { db, fs } = await ensureFirebase();
  stopListeners();
  for (const [kind, coll] of Object.entries(COLLS)) {
    unsubs.push(fs.onSnapshot(fs.collection(db, "households", hid, coll), snap => {
      const removed = [], upserts = [];
      snap.docChanges().forEach(c => c.type === "removed" ? removed.push(c.doc.id) : upserts.push({ id: c.doc.id, ...c.doc.data() }));
      if (upserts.length || removed.length) onRemoteCollection(kind, upserts, removed);
      setStatus({ phase: "live" });
    }, err => setStatus({ phase: "error", error: err.code ?? String(err) })));
  }
  for (const kind of ["insurance", "household"]) {
    unsubs.push(fs.onSnapshot(fs.doc(db, "households", hid, "shared", kind),
      snap => { if (snap.exists()) onRemoteShared(kind, snap.data()); setStatus({ phase: "live" }); },
      err => setStatus({ phase: "error", error: err.code ?? String(err) })));
  }
}
// pushEntity/removeEntity/pushShared: setDoc/deleteDoc を void 実行(.catchでsetStatus)。
// pushAll: state.supplies/locations/familyMembers を各docへ、insurance/householdをsharedへ、
//          shared/meta に {createdAt, schemaVersion:2}(merge:true)。
// stopListeners/stopSync: unsubs解除、status offへ。
```

- [ ] **Step 2: main.js にリモート受信とsyncOps実行を実装**

```js
// リモート→ローカル(必ずvalidateでサニタイズしてから適用):
function handleRemoteCollection(kind, upserts, removedIds) {
  const validator = { supplies: x => validateSupply(x, state.locations.map(l => l.id)), locations: validateLocation, familyMembers: validateFamily }[kind];
  const clean = upserts.flatMap(x => { const v = validator(x); return v.valid ? [{ ...v.value, id: x.id, createdAt: x.createdAt ?? 0, updatedAt: x.updatedAt ?? 0 }] : []; });
  let list = mergeEntities(state[kind], clean);
  if (removedIds.length) list = list.filter(e => !removedIds.includes(e.id));
  state = { ...state, [kind]: list };
  try { saveState(state); } catch {}
  render();
}
function handleRemoteShared(kind, data) {
  if ((data.updatedAt ?? 0) <= (state[kind].updatedAt ?? 0)) return;
  const v = kind === "insurance" ? validateInsurance(data) : validateHousehold(data);
  if (!v.valid) return;
  state = { ...state, [kind]: { ...v.value, updatedAt: data.updatedAt } };
  try { saveState(state); } catch {}
  render();
}
// commit内: state.sync.enabled && isConfigured() のとき syncOps を実行
// {kind, entity}→pushEntity / {kind, removedId}→removeEntity /
// {shared:"insurance"|"household"}→pushShared / {shared:"all"}→pushAll
// 起動時: state.sync.enabled なら startSync(householdId, ...) を呼ぶ(失敗してもアプリは動く)
```

- [ ] **Step 3: ui/share.js を実装**

`#share-section`(family内)に描画:

- 未設定時(`!isConfigured()`): 「共有機能は未設定です。docs/firebase-setup.md の手順で有効化できます(無料)。」
- OFF時: 説明+[家族グループを作る]+[合言葉で参加]。作成→ `generatePassphrase()` → `householdIdFromPassphrase` → `pushAll` → `startSync` → commit(`sync:{enabled:true, passphrase, householdId}`)→ `share-create-dialog` に合言葉を大きく表示+「この合言葉を家族に伝えてください。合言葉があれば誰でも参加できます」+コピー(`navigator.clipboard`、失敗時は選択案内)
- 参加: `share-join-dialog` で合言葉入力+統合方法radio。`normalizePassphrase` → hid算出 → `merge`なら参加後に `pushAll`(ローカル分を送る)、`replace`ならローカル世帯データをdefaultにしてから `startSync`。参加後の案内「家族の画面に何も出ない場合は合言葉を確認してください」
- ON時: 合言葉表示(タップで表示/非表示)・状態インジケーター(live=「同期中 ✓」/connecting=「接続中…」/error=「同期エラー(端末内では使えます)」/オフライン注記)・[共有をやめる](confirm経由。stopSync+`sync:{enabled:false,...}`。データは端末に残る旨を明記)

- [ ] **Step 4: 手動確認(2プロファイル)**

firebase-config.js未設定のままアプリ全機能が動くこと(共有欄に未設定案内)。※Firebase実プロジェクトでの疎通はTask 13の手順書作成後にユーザー設定を経て実施(Task 15の総合確認に含む)

- [ ] **Step 5: `npm test` PASS確認**
- [ ] **Step 6: Commit** — `feat: Firebase同期(合言葉方式)と共有UI`

---

### Task 13: Firebaseセットアップ手順書

**Files:**
- Create: `docs/firebase-setup.md`

- [ ] **Step 1: 手順書を書く**(以下を全て含める)

1. https://console.firebase.google.com で無料プロジェクト作成(**Sparkプランのまま。クレジットカード登録・Blazeアップグレードをしない**ことを太字で明記)
2. 匿名認証の有効化: Authentication → Sign-in method → 匿名 → 有効化
3. Cloud Firestore作成: ロケーション `asia-northeast1`、本番モードで開始
4. ルールに以下を貼り付け(全文掲載):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /households/{hid}/{doc=**} {
      allow read, delete: if request.auth != null && hid.size() == 64;
      allow create, update: if request.auth != null && hid.size() == 64
        && request.resource.data.size() < 40;
    }
  }
}
```

5. プロジェクト設定→ウェブアプリ追加→設定値を `js/firebase-config.js` へ貼る例:

```js
export const firebaseConfig = {
  apiKey: "...", authDomain: "....firebaseapp.com", projectId: "...",
  storageBucket: "....appspot.com", messagingSenderId: "...", appId: "..."
};
```

6. 注記: この設定値は公開識別子でありシークレットではない(アクセス制御はルールが担う)/ 無料枠(読取5万・書込2万/日・1GB)と、超過時は課金でなく同期停止のみでアプリは端末内データで動き続けること / 合言葉を知る人は誰でも世帯データを読めるため家族以外に教えないこと

- [ ] **Step 2: Commit** — `docs: Firebase無料セットアップ手順(Spark固定・ルール全文)`

---

### Task 14: PWA(manifest・アイコン・Service Worker)

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `icons/icon.svg`, `icons/make-icons.html`, `icons/icon-512.png`, `icons/apple-touch-icon.png`
- Modify: `index.html`(manifest/appleアイコンのlink確認)

- [ ] **Step 1: manifest.webmanifest**

```json
{
  "name": "防災ホームベース",
  "short_name": "防災ベース",
  "description": "平時の備えと災害時の行動を家族でまとめる防災アプリ",
  "lang": "ja",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#f5f7f3",
  "theme_color": "#174a55",
  "icons": [
    { "src": "icons/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 2: アイコン作成**

`icons/icon.svg`: 深緑(#174a55)の角丸背景+白い家+シールドのシンプルな図案(手書きSVG、テキスト不使用)。`icons/make-icons.html`: canvasにicon.svgを描いて512px PNGと180px apple-touch-icon.png をダウンロードする開発用ページ(アプリからはリンクしない)。ブラウザで開いて2枚のPNGを生成・保存し、index.htmlに `<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">` を追加。

- [ ] **Step 3: sw.js**

```js
const CACHE = "dhb-v1"; // デプロイのたびに番号を上げる(README化)
const SHELL = ["./", "./index.html", "./styles.css", "./manifest.webmanifest",
  "./icons/icon.svg", "./icons/icon-512.png", "./icons/apple-touch-icon.png",
  "./js/main.js", "./js/state.js", "./js/validate.js", "./js/derive.js",
  "./js/sync.js", "./js/sync-logic.js", "./js/firebase-config.js",
  "./js/data/hazards.js", "./js/data/procedures.js", "./js/data/stock-guide.js",
  "./js/ui/render.js", "./js/ui/home.js", "./js/ui/supplies.js",
  "./js/ui/procedures.js", "./js/ui/family.js", "./js/ui/emergency.js", "./js/ui/share.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.hostname.endsWith("googleapis.com")) return; // Firestore通信はSWを通さない
  if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) {
    e.respondWith(caches.open(CACHE).then(async c =>
      (await c.match(e.request)) ?? fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; })));
    return;
  }
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit =>
      hit ?? fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; })
        .catch(() => caches.match("./index.html"))));
  }
});
```

- [ ] **Step 4: オフライン検証** — http.serverで一度読み込み→サーバー停止→リロードで全画面が表示されること(preview/DevToolsのオフライン切替でも可)
- [ ] **Step 5: `npm test` PASS確認**
- [ ] **Step 6: Commit** — `feat: PWA対応(manifest・アイコン・オフラインキャッシュ)`

---

### Task 15: 総仕上げ(ドキュメント・総合確認)

**Files:**
- Modify: `README.md`, `APP.md`

- [ ] **Step 1: README.md 更新** — 概要・起動方法・テスト方法・Firebase設定(docs/firebase-setup.mdへの誘導)・**SWのCACHE版数をデプロイごとに上げる**運用メモ
- [ ] **Step 2: APP.md 更新** — 主要機能・画面構成・データ構造・状態遷移をv2の実装内容へ全面改訂(完成条件チェックリストも新機能で書き直す)
- [ ] **Step 3: 全テスト実行** — `npm test` 全PASS
- [ ] **Step 4: 手動総合確認**(previewブラウザで実施し、スクリーンショットで確認):
  - 初回フロー: 家族カード→集合場所→世帯設定→おすすめセット追加→準備率が上がる
  - 「今日やる1つ」が状態に応じて変わる
  - 11災害の緊急モード・リロード復元・171ブロック表示
  - v1データ移行(localStorageに旧形式を入れて起動→引き継ぎ通知)
  - 360px/768px/1280px表示・オフライン起動
  - (ユーザーがFirebase設定済みなら)2ブラウザで作成→参加→双方向反映→オフライン編集→復帰同期
- [ ] **Step 5: Commit** — `docs: README/APP.mdをリニューアル内容へ更新`
- [ ] **Step 6: ユーザーへ報告** — mainへのマージ・GitHub push・公開はユーザー確認を得てから(superpowers:finishing-a-development-branch を使用)

---

## Self-Review 結果

- **Spec coverage**: 仕様書§3(構成/PWA)→Task 8,14。§4(v2モデル/移行)→Task 5。§5(共有)→Task 7,12,13。§6(災害11種)→Task 3。§7.1→Task 4,10。§7.2→Task 10。§7.3→Task 6,9。§7.4→Task 11。§7.5→Task 6,9。§8(デザイン)→Task 8。§9(エラー処理)→Task 5,8,12。§10(テスト)→各タスク+15。ギャップなし
- **Placeholder scan**: コンテンツ系(手順512語リスト・残り10災害)は「テストが分量・形式を強制する+完全実例+必須トピック表」で規定済み。TBDなし
- **Type consistency**: `syncOps` の形・kind名(`familyMembers`→コレクション`members`)・`stockStatus`/`requiredQuantity` のシグネチャをTask間で照合済み
