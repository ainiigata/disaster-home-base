// stateからの純粋な派生値計算のみ(準備率・今日やる1つ・期限切れ備蓄・手順検索など)。
// DOM・window・ストレージ・外部通信には一切触れない。渡されたstateは絶対にmutateしない。

import { STOCK_GUIDE, requiredQuantity } from "./data/stock-guide.js";
import { PROCEDURES } from "./data/procedures.js";

const DAY_MS = 86400000;

// ホーム画面の準備率6カテゴリ。keysはstockStatusのkeyと対応し「fulfilled割合」を測る。
// extraは備蓄以外の条件を分母・分子へ1件ずつ足す特例(insurance=保険確認、family=家族情報)。
export const READINESS_CATEGORIES = [
  { id: "water",   label: "水",         keys: ["water"] },
  { id: "food",    label: "食料",       keys: ["mainFood", "cassetteStove", "gasCanister"] },
  { id: "power",   label: "電源・照明", keys: ["mobileBattery", "flashlight", "batteries", "radio"] },
  { id: "hygiene", label: "衛生・トイレ", keys: ["simpleToilet", "wetTissue", "firstAid", "medicine"] },
  { id: "info",    label: "情報・書類", keys: ["importantCopies", "cash"], extra: "insurance" },
  { id: "family",  label: "家族・連絡", keys: [], extra: "family" },
];

// "YYYY-MM-DD"(常にローカル時刻)。永続化キーや期限文字列と直接比較できる形式にする。
export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// "YYYY-MM-DD"同士の日数差(to - from)。UTC真夜中同士のミリ秒差にすることで、
// ホスト側のタイムゾーンやDSTに影響されない整数日数を返す。
function daysBetween(fromKey, toKey) {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS);
}

// 保険確認が必要か: 未確認、または前回確認から365日超。todaysActionとinsuranceSuggestions
// (旧rules.jsの移植)の両方が同じ基準を使うよう、ここへ一本化する。
function needsInsuranceCheck(insurance, today) {
  if (!insurance.lastCheckedOn) return true;
  const checkedOn = new Date(`${insurance.lastCheckedOn}T00:00:00`);
  return today - checkedOn > 365 * DAY_MS;
}

// STOCK_GUIDE全14件について、必要量(requiredQuantity)・保有量・充足状況を1行ずつ返す。
// have=recommendedKeyが一致する備蓄の数量合計(複数件に分けて登録されていても合算する)。
// registered=一致する備蓄が1件でも登録されていればtrue(合計が0でも入力途中と区別する)。
export function stockStatus(state) {
  return STOCK_GUIDE.map(item => {
    const matched = state.supplies.filter(s => s.recommendedKey === item.key);
    const have = matched.reduce((sum, s) => sum + s.quantity, 0);
    const required = requiredQuantity(item, state.household);
    return {
      key: item.key,
      name: item.name,
      unit: item.unit,
      category: item.category,
      required,
      have,
      fulfilled: have >= required,
      registered: matched.length > 0,
    };
  });
}

function levelFor(fraction) {
  if (fraction >= 1) return "done";
  if (fraction >= 0.5) return "almost";
  return "todo";
}

// 1カテゴリのfraction(0〜1)。keysはstockStatusの充足件数/件数。extraは備蓄以外の条件を
// 分子・分母へ追加する(insurance: lastCheckedOnあり=1条件、family: 下記3条件)。
function categoryFraction(category, state, statusList) {
  const keyRows = category.keys.map(key => statusList.find(s => s.key === key));
  let met = keyRows.filter(row => row.fulfilled).length;
  let total = keyRows.length;

  if (category.extra === "insurance") {
    total += 1;
    if (state.insurance.lastCheckedOn) met += 1;
  } else if (category.extra === "family") {
    const hasCard = state.familyMembers.length >= 1;
    const hasMeetingPlace = state.familyMembers.some(m => m.meetingPlace);
    const hasContacts = Boolean(state.household.emergencyContacts.trim());
    total += 3;
    met += [hasCard, hasMeetingPlace, hasContacts].filter(Boolean).length;
  }

  return total ? met / total : 0;
}

// 6カテゴリのfraction/levelと、その平均をパーセントにした全体準備率。
export function readiness(state) {
  const statusList = stockStatus(state);
  const categories = READINESS_CATEGORIES.map(cat => {
    const fraction = categoryFraction(cat, state, statusList);
    return { id: cat.id, label: cat.label, fraction, level: levelFor(fraction) };
  });
  const average = categories.reduce((sum, c) => sum + c.fraction, 0) / categories.length;
  return { categories, percent: Math.round(average * 100) };
}

// 期限が今日から30日以内、またはすでに過ぎている備蓄。期限昇順。stateは書き換えない。
export function expiringSupplies(state, today = new Date()) {
  const todayKey = dateKey(today);
  return state.supplies
    .filter(s => s.expiresOn && daysBetween(todayKey, s.expiresOn) <= 30)
    .sort((a, b) => (a.expiresOn < b.expiresOn ? -1 : a.expiresOn > b.expiresOn ? 1 : 0));
}

// 不足している備え。guide=STOCK_GUIDEに対応するもの(stockStatusの未充足行)、
// manual=recommendedKeyを持たない自由入力の備蓄でquantity<minimumQuantityのもの。
export function shortSupplies(state) {
  return {
    guide: stockStatus(state).filter(s => !s.fulfilled),
    manual: state.supplies.filter(s => !s.recommendedKey && s.quantity < s.minimumQuantity),
  };
}

// 「このアプリの通り行動すれば災害も怖くなくなる」を1手に凝縮する優先順位チェーン。
// 家族の土台(カード→集合場所→連絡メモ)→命に直結する備蓄(水→トイレ→電源→主食)→
// 入れ替え忘れ→残りの備蓄→保険、の順に最初に該当した1件だけを返す。全部満たせばnull。
export function todaysAction(state, today = new Date()) {
  const { familyMembers, household, insurance } = state;

  if (familyMembers.length === 0) {
    return { id: "family-card", label: "家族カードを1枚つくる", view: "family" };
  }
  if (familyMembers.every(m => !m.meetingPlace)) {
    return { id: "meeting", label: "家族の集合場所を決める", view: "family" };
  }
  if (!household.emergencyContacts.trim()) {
    return { id: "contacts", label: "緊急連絡メモを書く", view: "family" };
  }

  const status = stockStatus(state);
  const byKey = key => status.find(s => s.key === key);

  if (!byKey("water").fulfilled) {
    return { id: "water", label: "飲料水を目安量まで備える", view: "supplies", tab: "stock" };
  }
  if (!byKey("simpleToilet").fulfilled) {
    return { id: "toilet", label: "簡易トイレを備える", view: "supplies", tab: "stock" };
  }
  if (!byKey("mobileBattery").fulfilled) {
    return { id: "battery", label: "モバイルバッテリーを準備する", view: "supplies", tab: "goBag" };
  }
  if (!byKey("mainFood").fulfilled) {
    return { id: "food", label: "主食を目安量まで備える", view: "supplies", tab: "stock" };
  }
  if (expiringSupplies(state, today).length > 0) {
    return { id: "expiring", label: "期限が近い備蓄を入れ替える", view: "supplies", tab: "rolling" };
  }
  if (status.some(s => !s.fulfilled)) {
    return { id: "stock", label: "不足している備えを1つ足す", view: "supplies", tab: "stock" };
  }
  if (needsInsuranceCheck(insurance, today)) {
    return { id: "insurance", label: "保険の確認メモを更新する", view: "supplies", tab: "insurance" };
  }
  return null;
}

// 年1回の点検を促すバナー期間。8/18〜9/15=防災の日、2/25〜3/25=3.11。
// 期間内でperiodKeyがdismissedRemindersに含まれていなければ表示する。
const REMINDER_PERIODS = [
  { prefix: "bousai", title: "防災の日の点検", from: 818, to: 915 },
  { prefix: "shinsai", title: "3.11の見直し", from: 225, to: 325 },
];

export function reminderBanner(state, today = new Date()) {
  const monthDay = (today.getMonth() + 1) * 100 + today.getDate();
  const period = REMINDER_PERIODS.find(p => monthDay >= p.from && monthDay <= p.to);
  if (!period) return null;

  const periodKey = `${period.prefix}-${today.getFullYear()}`;
  if (state.dismissedReminders.includes(periodKey)) return null;

  return { periodKey, title: period.title, text: "備蓄の期限・家族の集合場所・保険を見直しましょう。" };
}

// 旧rules.js(git show ed89562:rules.js)のinsuranceSuggestionsを同一仕様で移植。
// 文言・条件・しきい値(1年・更新30日前)はすべて元のまま、読みやすく整形しただけ。
export function insuranceSuggestions(insurance, today = new Date()) {
  const out = [];

  if (insurance.status === "unknown") out.push("加入状況を確認しましょう。");
  if (insurance.status === "none") out.push("災害時に使える公的支援と、必要な備えを確認しましょう。");
  if (insurance.status === "insured") {
    if (!insurance.coverages.earthquake) out.push("地震による損害が確認対象か、契約内容を見直しましょう。");
    if (!insurance.coverages.stormFlood) out.push("風災・水災が確認対象か、契約内容を見直しましょう。");
    if (!insurance.coverages.household) out.push("家財が確認対象か、契約内容を見直しましょう。");
  }

  if (needsInsuranceCheck(insurance, today)) {
    out.push("前回確認から1年以上です。契約内容と連絡先を確認しましょう。");
  }

  if (insurance.renewalOn) {
    const diffDays = (new Date(`${insurance.renewalOn}T00:00:00`) - today) / DAY_MS;
    if (diffDays >= 0 && diffDays <= 30) out.push("更新日まで30日以内です。変更点を確認しましょう。");
  }

  return out.length ? out : ["現在、急いで確認する項目はありません。次回確認日を決めておきましょう。"];
}

// query(タイトル・本文・キーワード部分一致)・hazard・phase("all"で無効化)・
// お気に入り絞り込みで手順を検索する。phaseは必ずフィールドで判定する
// (procedures.jsには一部id接頭辞とphaseが食い違う項目があるため、id文字列は見ない)。
export function searchProcedures(query = "", hazard = "all", phase = "all", favorites = [], onlyFavorites = false) {
  const q = String(query).trim().toLowerCase();
  return PROCEDURES.filter(p =>
    (hazard === "all" || p.hazard === hazard) &&
    (phase === "all" || p.phase === phase) &&
    (!onlyFavorites || favorites.includes(p.id)) &&
    (!q || [p.title, p.body, ...p.keywords].join(" ").toLowerCase().includes(q))
  );
}
