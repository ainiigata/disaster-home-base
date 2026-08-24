// アプリシェル: 起動・状態のコミット・ビュー切替・イベント委譲・ダイアログ配管。
// 画面ごとの描画は一切書かない(js/ui/*.js の責務)。
//
// ══ ctx契約 ══════════════════════════════════════════════════════════════
// 各UIモジュールは `bind(ctx)`(起動時1回)と `render(ctx)`(状態が変わるたび)を
// exportし、下の MODULES に登録される。両モジュールへ渡る ctx は以下:
//
//  getState() -> State
//      現在の状態。**絶対にmutateしない**。変更は必ず新しいオブジェクトを作って
//      commit() へ渡す(例: {...ctx.getState(), supplies: [...]})。
//
//  commit(next, {success, error, syncOps} = {}) -> boolean
//      next を localStorage へ保存し、成功したら状態を差し替えて render() する。
//      success: 保存成功時の通知文(既定「端末に保存しました。」/ null で通知なし)
//      error:   保存失敗時の通知文(既定「保存できませんでした。入力は残っています。…」)
//      syncOps: 家族共有への反映指示の配列。共有はTask 12で実装されるため現在は
//               受け取るだけの no-op。呼び出し側は最初から正しい形で渡してよい:
//                 {kind:"supplies"|"locations"|"familyMembers", entity}  … 追加・更新
//                 {kind:"supplies"|"locations"|"familyMembers", removedId} … 削除
//                 {shared:"insurance"|"household"|"all"}                 … 単一ドキュメント
//      戻り値 false は「保存に失敗し、状態は変わっていない(#notice への通知表示を除く)」。
//      チェックボックス等 DOM側が先に変わる操作では、false のとき呼び出し側で ctx.render() して戻すこと。
//
//  render() -> void
//      シェル(表示中ビュー・ナビ・タブ・緊急モードのクラス)を同期し、
//      登録済み全モジュールの render(ctx) を呼ぶ。
//
//  showView(name, {focus, tab, hazard, favoritesOnly} = {}) -> void
//      name: "home"|"supplies"|"procedures"|"family"|"emergency"。
//      緊急モード中は常に "emergency" へ固定される。
//      focus(既定true): 遷移後に見出しへフォーカスし先頭へスクロールする。
//      tab: 準備台帳のタブ("goBag"|"stock"|"rolling"|"locations"|"insurance")。
//      hazard: 手順検索の災害フィルター("all" またはHAZARDSの値)。
//      favoritesOnly: true で #favorites-only チェックボックスをONにしてから遷移。
//      ビュー・タブ・フィルターの保存は通知を出さない(失敗してもデータは無傷)。
//
//  notice(text, isError = false) -> void
//      画面上部の #notice に短い通知を出す(数秒で自動的に消える)。
//      isError: true で role="alert" の警告表示。
//
//  confirmAction(title, message, label, onConfirm) -> void
//      #confirm-dialog を開き、実行が選ばれたときだけ onConfirm() を呼ぶ。
//
//  openDialog(id) -> HTMLDialogElement | null
//      idのダイアログをモーダルで開く(既に開いていれば何もしない)。
//      閉じたときのフォーカス復帰は <dialog> の標準動作に任せる。
//
//  fillErrors(form, result) -> void
//      validate*() の戻り値をフォームへ反映する。[data-error="フィールド名"] に
//      メッセージを入れ、対象入力へ aria-invalid と aria-describedby を付け、
//      .form-error に件数を出して最初のエラー入力へフォーカスする。
//
//  commitForm(form, next, {success, close, syncOps, afterSave} = {}) -> boolean
//      フォームからの保存。commit() が失敗したらダイアログを閉じずに .form-error へ
//      理由を出す(入力はそのまま残る)。成功時は close(既定true)でダイアログを閉じ、
//      afterSave があれば呼ぶ。
//
// ── 画面の担当(重複してバインドしないこと) ──
//  シェル(このファイル): data-view / data-tab / data-hazard / data-favorites の遷移、
//    data-supply-tab のタブ切替(矢印キー含む)、data-close-dialog、ダイアログの背景
//    クリック、#emergency-open / #change-hazard / #exit-emergency と #hazard-dialog の
//    緊急モード開始・変更・終了、#confirm-dialog、#hazard-filter / #phase-filter の
//    選択肢生成、#notice。
//  Task 9  ui/home.js: #readiness #today-action #reminder-banner #alerts
//          ui/procedures.js: #search-form #procedure-search #hazard-filter #phase-filter
//                            #favorites-only #search-count #procedure-results
//  Task 10 ui/supplies.js: #supply-panel と supply-dialog / location-dialog の中身
//  Task 11 ui/family.js: #family-list #add-family #household-card と family-dialog / household-dialog
//          ui/emergency.js: #emergency-hazard-label #emergency-title #emergency-procedures
//                           #emergency-go-bag #emergency-family #emergency-contacts
//  Task 12 ui/share.js: #share-section と share-create-dialog / share-join-dialog
// ════════════════════════════════════════════════════════════════════════

import { loadState, saveState } from "./state.js";
import { HAZARDS, HAZARD_LABELS, HAZARD_GLYPHS, PHASES, PHASE_LABELS } from "./data/hazards.js";
import { $, $$, esc } from "./ui/render.js";
import * as home from "./ui/home.js";
import * as procedures from "./ui/procedures.js";

// ── ビューモジュールの登録 ────────────────────────────────────────────────
// Task 9-12 はここへ import を1行、MODULES へ名前を1つ足すだけでよい。例:
//   import * as home from "./ui/home.js";
//   const MODULES = [home];
const MODULES = [home, procedures];

const VIEWS = ["home", "supplies", "procedures", "family", "emergency"];
const SUPPLY_TABS = ["goBag", "stock", "rolling", "locations", "insurance"];
const SAVE_ERROR = "保存できませんでした。入力は残っています。もう一度お試しください。";
const NOTICE_MS = 6000;

let state;
let pendingConfirm = null;
let noticeTimer = 0;

const el = (target, selector) => (target instanceof Element ? target.closest(selector) : null);

// ── 通知 ─────────────────────────────────────────────────────────────────

function notice(text, isError = false) {
  const box = $("#notice");
  box.textContent = text;
  box.setAttribute("role", isError ? "alert" : "status");
  box.setAttribute("aria-live", isError ? "assertive" : "polite");
  box.classList.toggle("is-error", isError);
  box.classList.remove("hidden");
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => box.classList.add("hidden"), NOTICE_MS);
}

// ── 保存 ─────────────────────────────────────────────────────────────────

// 共有(Task 12)が入るまでの受け皿。呼び出し側は最初からsyncOpsを渡してよい。
function runSyncOps(syncOps) {
  if (!Array.isArray(syncOps) || syncOps.length === 0) return;
  // Task 12: state.sync.enabled && isConfigured() のときだけ
  // {kind, entity}→pushEntity / {kind, removedId}→removeEntity /
  // {shared}→pushShared・pushAll を実行する(いずれもfire-and-forget)。
}

function commit(next, { success = "端末に保存しました。", error = SAVE_ERROR, syncOps = [] } = {}) {
  try {
    saveState(next);
  } catch {
    notice(error, true);
    return false;
  }
  state = next;
  runSyncOps(syncOps);
  render();
  if (success) notice(success);
  return true;
}

// ビュー・タブ・フィルターのような表示設定の保存。ここでの失敗は利用者のデータを
// 失わない(次にデータを保存するときは commit() が通知する)ため、操作を止めない。
function persistQuietly(next) {
  state = next;
  try {
    saveState(state);
  } catch {
    /* 表示設定は保存できなくても操作を続けられる */
  }
}

// ── ビュー切替 ───────────────────────────────────────────────────────────

function showView(name, { focus = true, tab = null, hazard = null, favoritesOnly = false } = {}) {
  // 緊急モード中はどこへ遷移しようとしても緊急画面に留める。
  const view = state.mode === "emergency" ? "emergency" : VIEWS.includes(name) ? name : "home";
  const ui = { ...state.ui, view };
  if (SUPPLY_TABS.includes(tab)) ui.supplyTab = tab;
  if (hazard === "all" || HAZARDS.includes(hazard)) ui.hazardFilter = hazard;
  persistQuietly({ ...state, ui });

  // お気に入り絞り込みだけは状態に持たない(端末にも残さない)。
  // チェックボックスそのものが唯一の持ち主で、ui/procedures.js がそれを読む。
  if (favoritesOnly) $("#favorites-only").checked = true;

  render();
  if (!focus) return;
  window.scrollTo(0, 0);
  const heading = $(`#view-${view} h1`);
  if (heading) {
    heading.tabIndex = -1;
    heading.focus();
  }
}

function selectSupplyTab(tab) {
  if (!SUPPLY_TABS.includes(tab)) return;
  persistQuietly({ ...state, ui: { ...state.ui, supplyTab: tab } });
  render();
}

// ── 描画 ─────────────────────────────────────────────────────────────────

// どのUIモジュールにも属さない、シェル自身のDOM同期。
function syncShell() {
  const { view, supplyTab } = state.ui;
  const emergency = state.mode === "emergency";

  document.body.classList.toggle("emergency-active", emergency);
  $$(".view").forEach(section => section.classList.toggle("hidden", section.id !== `view-${view}`));
  $$(".side-nav [data-view], .bottom-nav [data-view]").forEach(button => {
    if (button.dataset.view === view) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  $$("[data-supply-tab]").forEach(button => {
    const selected = button.dataset.supplyTab === supplyTab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  $("#supply-panel").setAttribute("aria-labelledby", `tab-${supplyTab}`);

  $(".emergency-trigger-label").textContent = emergency ? "災害を変更" : "緊急モード";
}

function render() {
  syncShell();
  for (const module of MODULES) module.render?.(ctx);
}

// ── ダイアログ ───────────────────────────────────────────────────────────

function openDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog && !dialog.open) dialog.showModal();
  return dialog;
}

function confirmAction(title, message, label, onConfirm) {
  $("#confirm-title").textContent = title;
  $("#confirm-message").textContent = message;
  $("#confirm-action").textContent = label;
  pendingConfirm = onConfirm;
  // 前回の結果が残っていると背景クリックで再実行されてしまうため必ず消す。
  $("#confirm-dialog").returnValue = "";
  openDialog("confirm-dialog");
}

// ── フォーム ─────────────────────────────────────────────────────────────

// 元から付いている aria-describedby(補足文への参照)を壊さずにエラーIDを足し引きする。
function describeBy(input, errorId) {
  if (input.dataset.baseDescribedby === undefined) {
    input.dataset.baseDescribedby = input.getAttribute("aria-describedby") ?? "";
  }
  const ids = [input.dataset.baseDescribedby, errorId].filter(Boolean).join(" ");
  if (ids) input.setAttribute("aria-describedby", ids);
  else input.removeAttribute("aria-describedby");
}

function fillErrors(form, result) {
  let firstInvalid = null;

  for (const slot of $$("[data-error]", form)) {
    const name = slot.dataset.error;
    const input = form.elements[name];
    const message = result.errors[name];
    slot.textContent = message ?? "";
    slot.id = `${form.id}-${name}-error`;
    if (!(input instanceof Element)) continue; // ラジオグループ等はメッセージ表示のみ
    if (message) {
      input.setAttribute("aria-invalid", "true");
      describeBy(input, slot.id);
      firstInvalid ??= input;
    } else {
      input.removeAttribute("aria-invalid");
      describeBy(input, null);
    }
  }

  const box = $(".form-error", form);
  const count = Object.keys(result.errors).length;
  if (result.valid || count === 0) {
    box?.classList.add("hidden");
    return;
  }
  if (box) {
    box.textContent = `${count}件の入力を確認してください。`;
    box.classList.remove("hidden");
    box.focus();
  }
  // 読み上げが見出しを読み終えてから入力欄へ移す。
  setTimeout(() => firstInvalid?.focus(), 0);
}

function commitForm(form, next, { success = "端末に保存しました。", close = true, syncOps = [], afterSave = null } = {}) {
  const box = $(".form-error", form);
  if (!commit(next, { success, syncOps })) {
    if (box) {
      box.textContent = SAVE_ERROR;
      box.classList.remove("hidden");
      box.focus();
    }
    return false;
  }
  box?.classList.add("hidden");
  if (close) form.closest("dialog")?.close();
  afterSave?.();
  return true;
}

// ── 緊急モード ───────────────────────────────────────────────────────────

function openHazardDialog() {
  $("#hazard-dialog").returnValue = "";
  openDialog("hazard-dialog");
}

function askHazardChange() {
  if (state.mode !== "emergency") {
    openHazardDialog();
    return;
  }
  confirmAction("災害を変更しますか？", "いまチェックした手順の確認状態はリセットされます。", "変更する", openHazardDialog);
}

function startEmergency(hazard) {
  // 同じ災害を選び直したときはチェックを残す。別の災害へ変えるときは必ず捨てる
  // (emergencyCheckedIds は選択中の災害の手順しか保持できない)。
  const keepChecks = state.mode === "emergency" && state.selectedHazard === hazard;
  const next = {
    ...state,
    mode: "emergency",
    selectedHazard: hazard,
    emergencyCheckedIds: keepChecks ? state.emergencyCheckedIds : [],
    ui: { ...state.ui, view: "emergency" },
  };
  if (commit(next, { success: `${HAZARD_LABELS[hazard]}の緊急モードを開始しました。` })) showView("emergency");
}

function exitEmergency() {
  const next = {
    ...state,
    mode: "normal",
    selectedHazard: null,
    emergencyCheckedIds: [],
    ui: { ...state.ui, view: "home" },
  };
  if (commit(next, { success: "通常モードへ戻りました。" })) showView("home");
}

// ── 起動時に作る選択肢(語彙はdata/hazards.jsが唯一の出どころ) ────────────

function buildHazardControls() {
  $("#hazard-grid").innerHTML = HAZARDS.map(
    hazard =>
      `<button value="${hazard}"><span class="hazard-glyph" aria-hidden="true">${esc(HAZARD_GLYPHS[hazard])}</span>${esc(HAZARD_LABELS[hazard])}</button>`
  ).join("");

  const options = (values, labels) =>
    ['<option value="all">すべて</option>', ...values.map(v => `<option value="${v}">${esc(labels[v])}</option>`)].join("");
  $("#hazard-filter").innerHTML = options(HAZARDS, HAZARD_LABELS);
  $("#phase-filter").innerHTML = options(PHASES, PHASE_LABELS);
}

// ── イベント委譲 ─────────────────────────────────────────────────────────

function bindShell() {
  document.addEventListener("click", event => {
    const nav = el(event.target, "[data-view]");
    if (nav) {
      showView(nav.dataset.view, {
        tab: nav.dataset.tab ?? null,
        hazard: nav.dataset.hazard ?? null,
        favoritesOnly: nav.dataset.favorites === "true",
      });
      return;
    }
    const tab = el(event.target, "[data-supply-tab]");
    if (tab) {
      selectSupplyTab(tab.dataset.supplyTab);
      return;
    }
    const closer = el(event.target, "[data-close-dialog]");
    if (closer) closer.closest("dialog")?.close();
  });

  // タブは矢印キーでも移動できるようにする(WAI-ARIA タブパターン)。
  document.addEventListener("keydown", event => {
    const tab = el(event.target, "[data-supply-tab]");
    if (!tab) return;
    const tabs = $$("[data-supply-tab]");
    const index = tabs.indexOf(tab);
    const target =
      event.key === "ArrowRight" ? tabs[(index + 1) % tabs.length]
      : event.key === "ArrowLeft" ? tabs[(index - 1 + tabs.length) % tabs.length]
      : event.key === "Home" ? tabs[0]
      : event.key === "End" ? tabs.at(-1)
      : null;
    if (!target) return;
    event.preventDefault();
    target.focus();
    selectSupplyTab(target.dataset.supplyTab);
  });

  // 背景(ダイアログ自身)のクリックで閉じる。
  $$("dialog").forEach(dialog =>
    dialog.addEventListener("click", event => {
      if (event.target === dialog) dialog.close();
    })
  );

  $("#emergency-open").addEventListener("click", askHazardChange);
  $("#change-hazard").addEventListener("click", askHazardChange);
  $("#exit-emergency").addEventListener("click", () =>
    confirmAction("通常モードへ戻りますか？", "安全を確認してから戻ってください。緊急モードはいつでも開けます。", "通常モードへ戻る", exitEmergency)
  );

  $("#hazard-dialog").addEventListener("close", event => {
    const hazard = event.currentTarget.returnValue;
    if (HAZARDS.includes(hazard)) startEmergency(hazard);
  });

  $("#confirm-dialog").addEventListener("close", event => {
    const action = event.currentTarget.returnValue === "confirm" ? pendingConfirm : null;
    pendingConfirm = null;
    action?.();
  });
}

// ── ctx ──────────────────────────────────────────────────────────────────

export const ctx = {
  getState: () => state,
  commit,
  render,
  showView,
  notice,
  confirmAction,
  openDialog,
  fillErrors,
  commitForm,
};

// ── 起動 ─────────────────────────────────────────────────────────────────

function boot() {
  const loaded = loadState();
  state = loaded.state;

  buildHazardControls();
  bindShell();
  for (const module of MODULES) module.bind?.(ctx);

  showView(state.ui.view, { focus: false });
  if (loaded.notice) notice(loaded.notice, loaded.isError);

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
}

boot();
