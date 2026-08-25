// v2状態モデル・正規化・localStorage永続化・v1移行。
// DOM・windowへは触れない(Nodeへ直接importできること)。安全でない入力(壊れた
// localStorage・v1データ・将来はFirestore経由の他端末データ)を防ぐ唯一の関所として、
// safeStateだけがアプリへ渡す状態を決める。

import {
  validateSupply,
  validateLocation,
  validateFamily,
  validateInsurance,
  validateHousehold,
} from "./validate.js";
import { HAZARDS, PHASES } from "./data/hazards.js";
import { PROCEDURES } from "./data/procedures.js";

export const STORAGE_KEY = "a008.disaster-home-base.v2";
export const STORAGE_KEY_V1 = "a008.disaster-home-base.v1";

// 端末間で共有する対象のトップレベルキー(sync-logicが後で使う)。
export const SHARED_KEYS = ["household", "supplies", "locations", "familyMembers", "insurance"];

const UI_VIEWS = ["home", "supplies", "procedures", "family", "emergency"];
const SUPPLY_TABS = ["goBag", "stock", "rolling", "locations", "insurance"];
const HAZARD_FILTERS = ["all", ...HAZARDS];
const PHASE_FILTERS = ["all", ...PHASES];
const HOUSEHOLD_ID_RE = /^[0-9a-f]{64}$/;

const SUPPLIES_LIMIT = 200;
const LOCATIONS_LIMIT = 30;
const FAMILY_LIMIT = 20;
const SHOPPING_LIMIT = 100;
const DISMISSED_REMINDERS_LIMIT = 200;

// v1(旧rules.js)のPROCEDURES 15件 → 現行 js/data/procedures.js での後継id。
// タスク3の手順id再編で v1の全15idが現行データから消えたため、v1移行時に
// favoriteProcedureIds/emergencyCheckedIdsを翻訳してからPROCEDURES照合へ通す。
// 意味の対応が一意に定まらない3件(eq-evacuate/ty-secure/rain-early。いずれも
// 複数の新idに action が分割されており、どちらか一方を選ぶと残り半分の意味を
// 誤魔化すことになる)は、誤った統合を避けるためあえて含めていない。
// このマップはmigrateV1専用。safeStateはv2データしか扱わないため、翻訳はここでのみ行う。
const LEGACY_PROCEDURE_IDS = {
  "eq-drop": "eq-now-cover",
  "eq-fire": "eq-after-exit",
  "ty-charge": "ty-alert-power",
  "ty-stay": "ty-now-window",
  "rain-upper": "rain-now-lowland",
  "rain-no-car": "rain-now-noflood",
  "power-light": "pw-now-light",
  "power-plug": "pw-now-unplug",
  "power-battery": "pw-after-battery",
  "water-store": "wt-alert-fill",
  "water-valve": "wt-now-tap",
  "water-hygiene": "wt-now-priority",
};

const finiteOr0 = n => (Number.isFinite(n) ? n : 0);

export function defaultState() {
  return {
    schemaVersion: 2,
    // ── 世帯データ(共有対象) ──
    household: { adults: 2, children: 0, stockDays: 3, emergencyContacts: "", updatedAt: 0 },
    supplies: [],
    locations: [],
    familyMembers: [],
    insurance: {
      status: "unknown",
      coverages: { earthquake: false, stormFlood: false, household: false },
      policyLocation: "",
      renewalOn: null,
      lastCheckedOn: null,
      note: "",
      updatedAt: 0,
    },
    // ── 端末データ(共有しない) ──
    shopping: [],
    mode: "normal",
    selectedHazard: null,
    emergencyCheckedIds: [],
    favoriteProcedureIds: [],
    dismissedReminders: [],
    ui: { view: "home", supplyTab: "goBag", hazardFilter: "all", phaseFilter: "all" },
    sync: { enabled: false, passphrase: null, householdId: null },
  };
}

// {id, ...} 形式の配列を、渡した検証関数に通し、有効なものだけ末尾からlimit件残す。
// extra(x) は id/createdAt/updatedAt など検証関数の対象外だが引き継ぐ付随フィールドを返す。
function normalizeEntityList(raw, validate, extra, limit) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(x => x && typeof x.id === "string")
    .flatMap(x => {
      const v = validate(x);
      return v.valid ? [{ ...v.value, ...extra(x) }] : [];
    })
    .slice(-limit);
}

function normalizeLocations(raw) {
  return normalizeEntityList(raw, validateLocation, x => ({ id: x.id, updatedAt: finiteOr0(x.updatedAt) }), LOCATIONS_LIMIT);
}

function normalizeSupplies(raw, locationIds) {
  return normalizeEntityList(
    raw,
    x => validateSupply(x, locationIds),
    x => ({ id: x.id, createdAt: finiteOr0(x.createdAt), updatedAt: finiteOr0(x.updatedAt) }),
    SUPPLIES_LIMIT
  );
}

function normalizeFamilyMembers(raw) {
  return normalizeEntityList(raw, validateFamily, x => ({ id: x.id, updatedAt: finiteOr0(x.updatedAt) }), FAMILY_LIMIT);
}

// 単一オブジェクトのvalidate: 不正なら既定値へまるごとフォールバックする(部分採用しない)。
function normalizeHousehold(raw, fallback) {
  const v = validateHousehold(raw ?? {});
  return v.valid ? { ...v.value, updatedAt: finiteOr0(raw?.updatedAt) } : fallback;
}

function normalizeInsurance(raw, fallback) {
  const v = validateInsurance(raw ?? {});
  return v.valid ? { ...v.value, updatedAt: finiteOr0(raw?.updatedAt) } : fallback;
}

function normalizeShopping(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(x => x && typeof x.id === "string" && typeof x.name === "string")
    .flatMap(x => {
      const name = x.name.trim();
      if (!name || name.length > 40) return [];
      return [{ id: x.id, name, done: Boolean(x.done), updatedAt: finiteOr0(x.updatedAt) }];
    })
    .slice(-SHOPPING_LIMIT);
}

// PROCEDURESに実在するidだけを残し重複排除する。isValid はhazard一致など呼び出し側の追加条件。
function normalizeProcedureIds(raw, isValid) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(id => typeof id === "string" && isValid(id)))];
}

// まだ意味を持つ語彙表がない(後続タスクでリマインダー種別が定義される)ため、
// 文字列であること・重複排除・上限数のみを保証する。
function normalizeDismissedReminders(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(id => typeof id === "string"))].slice(-DISMISSED_REMINDERS_LIMIT);
}

// 検索語(ui.search)はここでは扱わない。Task 9で意図的に、検索語は端末にも保存せず
// js/ui/procedures.js内のモジュールスコープ変数だけが持つエフェメラル値にしている。
// もしここで永続化してしまうと、緊急モード中に(過去に絞り込んだままの)古い検索語が
// 手順検索の初期表示を勝手に絞り込んでしまい、必要な手順が見つからない事故につながる。
// この関門を通さないことで、その害を将来また作り込めないようにしている。
function normalizeUI(raw) {
  const ui = raw ?? {};
  return {
    view: UI_VIEWS.includes(ui.view) ? ui.view : "home",
    supplyTab: SUPPLY_TABS.includes(ui.supplyTab) ? ui.supplyTab : "goBag",
    hazardFilter: HAZARD_FILTERS.includes(ui.hazardFilter) ? ui.hazardFilter : "all",
    phaseFilter: PHASE_FILTERS.includes(ui.phaseFilter) ? ui.phaseFilter : "all",
  };
}

function normalizeSync(raw) {
  const sync = raw ?? {};
  const householdId = typeof sync.householdId === "string" && HOUSEHOLD_ID_RE.test(sync.householdId) ? sync.householdId : null;
  const passphrase = typeof sync.passphrase === "string" && sync.passphrase.length <= 80 ? sync.passphrase : null;
  // householdIdが不正なら、たとえ保存されていたenabledがtrueでも強制的にOFFにする。
  const enabled = Boolean(sync.enabled) && householdId !== null;
  return { enabled, passphrase, householdId };
}

export function safeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object" || raw.schemaVersion !== 2) return base;

  const locations = normalizeLocations(raw.locations);
  const locationIds = locations.map(x => x.id);
  const supplies = normalizeSupplies(raw.supplies, locationIds);
  const familyMembers = normalizeFamilyMembers(raw.familyMembers);
  const household = normalizeHousehold(raw.household, base.household);
  const insurance = normalizeInsurance(raw.insurance, base.insurance);
  const shopping = normalizeShopping(raw.shopping);

  const selectedHazard = HAZARDS.includes(raw.selectedHazard) ? raw.selectedHazard : null;
  const mode = raw.mode === "emergency" && selectedHazard ? "emergency" : "normal";
  const emergencyCheckedIds = normalizeProcedureIds(raw.emergencyCheckedIds, id =>
    PROCEDURES.some(p => p.id === id && p.hazard === selectedHazard)
  );
  const favoriteProcedureIds = normalizeProcedureIds(raw.favoriteProcedureIds, id => PROCEDURES.some(p => p.id === id));
  const dismissedReminders = normalizeDismissedReminders(raw.dismissedReminders);

  return {
    schemaVersion: 2,
    household,
    supplies,
    locations,
    familyMembers,
    insurance,
    shopping,
    mode,
    selectedHazard,
    emergencyCheckedIds,
    favoriteProcedureIds,
    dismissedReminders,
    ui: normalizeUI(raw.ui),
    sync: normalizeSync(raw.sync),
  };
}

// v1のprocedure id配列を現行idへ翻訳する(存在しない旧id・対応表にない値はそのまま
// 通し、最終的なPROCEDURES照合はsafeStateに任せる)。配列でなければ空配列を返す。
function translateLegacyProcedureIds(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(id => LEGACY_PROCEDURE_IDS[id] ?? id);
}

// v1(旧rules.js)の生データをv2形へ写像してからsafeStateへ通す。
// v1にはhousehold/shopping/syncが存在しないため既定値を採用する。
export function migrateV1(rawV1) {
  const base = defaultState();
  const v1 = rawV1 && typeof rawV1 === "object" ? rawV1 : {};

  const supplies = Array.isArray(v1.supplies)
    ? v1.supplies.map(x => ({
        ...x,
        recommendedKey: typeof x?.recommendedKey === "string" ? x.recommendedKey : null,
        updatedAt: finiteOr0(x?.updatedAt),
      }))
    : [];
  const locations = Array.isArray(v1.locations) ? v1.locations.map(x => ({ ...x, updatedAt: finiteOr0(x?.updatedAt) })) : [];
  const familyMembers = Array.isArray(v1.familyMembers)
    ? v1.familyMembers.map(x => ({ ...x, updatedAt: finiteOr0(x?.updatedAt) }))
    : [];

  const mapped = {
    schemaVersion: 2,
    household: base.household,
    supplies,
    locations,
    familyMembers,
    insurance: v1.insurance ?? base.insurance,
    shopping: base.shopping,
    mode: v1.mode,
    selectedHazard: v1.selectedHazard ?? null,
    emergencyCheckedIds: translateLegacyProcedureIds(v1.emergencyCheckedIds),
    favoriteProcedureIds: translateLegacyProcedureIds(v1.favoriteProcedureIds),
    dismissedReminders: base.dismissedReminders,
    ui: v1.ui ?? base.ui,
    sync: base.sync,
  };

  return safeState(mapped);
}

// キー順の違いを「差分」と誤検知しないための、キー順非依存の深い等価比較。
function deepEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    return keysA.length === keysB.length && keysA.every(k => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

export function loadState(storage = localStorage) {
  try {
    const rawV2 = storage.getItem(STORAGE_KEY);
    if (rawV2 != null) {
      const parsed = JSON.parse(rawV2);
      const state = safeState(parsed);
      const notice = deepEqual(state, parsed) ? null : "保存されていたデータの一部を修復しました。";
      return { state, notice, isError: false };
    }

    const rawV1 = storage.getItem(STORAGE_KEY_V1);
    if (rawV1 != null) {
      const parsedV1 = JSON.parse(rawV1);
      const state = migrateV1(parsedV1);
      // 移行そのものは成功しているので、保存(setItem)だけが失敗しても既定値へ
      // 巻き戻さない。v1データはSTORAGE_KEY_V1にまだ残っており失われていないが、
      // 今回のセッションでは保存できなかったことをisError/noticeで伝える。
      try {
        saveState(state, storage);
        return { state, notice: "以前のデータを新しい形式に引き継ぎました。", isError: false };
      } catch {
        return {
          state,
          notice: "以前のデータを新しい形式に引き継ぎましたが、保存に失敗しました。もう一度お試しください。",
          isError: true,
        };
      }
    }

    return { state: defaultState(), notice: null, isError: false };
  } catch {
    return { state: defaultState(), notice: "保存されていたデータを読み込めなかったため、初期状態から始めます。", isError: true };
  }
}

export function saveState(state, storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
