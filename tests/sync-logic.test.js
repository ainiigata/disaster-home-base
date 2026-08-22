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

// --- 追加テスト ---

test("mergeEntities: updatedAtが同値のときはremoteを優先する(将来の同期取り込みを反映するため)", () => {
  const local = [{ id: "a", v: "L", updatedAt: 5 }];
  const remote = [{ id: "a", v: "R", updatedAt: 5 }];
  const m = mergeEntities(local, remote);
  assert.deepEqual(m.map(x => x.id + x.v), ["aR"]);
});

test("mergeEntities: localの順序を保持し、remoteのみのidは末尾に追加。入力を変更しない", () => {
  const local = [{ id: "a", v: "L", updatedAt: 1 }, { id: "b", v: "L", updatedAt: 1 }];
  const remote = [{ id: "c", v: "R", updatedAt: 1 }, { id: "a", v: "R", updatedAt: 2 }];
  const localSnapshot = JSON.parse(JSON.stringify(local));
  const remoteSnapshot = JSON.parse(JSON.stringify(remote));
  const m = mergeEntities(local, remote);
  assert.deepEqual(m.map(x => x.id), ["a", "b", "c"]);
  assert.deepEqual(local, localSnapshot, "localを変更してはいけない");
  assert.deepEqual(remote, remoteSnapshot, "remoteを変更してはいけない");
});

test("mergeEntities: 空配列を渡しても壊れない", () => {
  assert.deepEqual(mergeEntities([], []), []);
  const remote = [{ id: "a", v: "R", updatedAt: 1 }];
  assert.deepEqual(mergeEntities([], remote).map(x => x.id), ["a"]);
  const local = [{ id: "a", v: "L", updatedAt: 1 }];
  assert.deepEqual(mergeEntities(local, []).map(x => x.id), ["a"]);
});

test("normalizePassphrase: 全角スペース・カンマ・連続区切り・前後の区切りを吸収する", () => {
  assert.equal(
    normalizePassphrase("　さくら,つばめ,,ひかり、、やま　4172　"),
    "さくら・つばめ・ひかり・やま・4172"
  );
});

test("normalizePassphrase: 先頭・末尾が区切り文字だけのケースを吸収する", () => {
  assert.equal(normalizePassphrase("・さくら・つばめ・"), "さくら・つばめ");
});

test("normalizePassphrase: 全角数字混じりの4桁を半角化する", () => {
  assert.equal(normalizePassphrase("さくら・つばめ・ひかり・やま・０４１２"), "さくら・つばめ・ひかり・やま・0412");
});
