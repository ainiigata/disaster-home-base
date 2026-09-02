// 手順検索画面: 検索語・災害・段階・お気に入り絞り込みで手順を検索し、結果とお気に入り
// トグルを描画する。#search-form #procedure-search #hazard-filter #phase-filter
// #favorites-only #search-count #procedure-results を担当する(選択肢のoption自体は
// main.jsが生成済みなので触らない)。

import { searchProcedures } from "../derive.js";
import { HAZARD_LABELS, PHASE_LABELS } from "../data/hazards.js";
import { $, esc } from "./render.js";

// 検索語は端末に保存しない(お気に入り絞り込みと同じ扱いのモジュール内エフェメラル値)。
// 災害・段階フィルターは state.ui に永続化し、他画面からの絞り込み遷移(将来のdata-hazard
// 起点)を尊重できるようにする。
let query = "";

function currentFilters() {
  return {
    hazard: $("#hazard-filter").value,
    phase: $("#phase-filter").value,
    onlyFavorites: $("#favorites-only").checked,
  };
}

function procedureCard(state, procedure) {
  const pressed = state.favoriteProcedureIds.includes(procedure.id);
  const label = pressed ? "お気に入りから外す" : "お気に入りに追加";
  return `
    <article class="procedure-card">
      <span class="hazard-label">${esc(HAZARD_LABELS[procedure.hazard])}</span>
      <span class="phase-label">${esc(PHASE_LABELS[procedure.phase])}</span>
      <h2>${esc(procedure.title)}</h2>
      <p>${esc(procedure.body)}</p>
      <button type="button" class="favorite-button" data-favorite="${esc(procedure.id)}" aria-pressed="${pressed}" aria-label="${label}">
        <span aria-hidden="true">${pressed ? "★" : "☆"}</span>
      </button>
    </article>`;
}

function renderResults(ctx) {
  const state = ctx.getState();
  const { hazard, phase, onlyFavorites } = currentFilters();
  const results = searchProcedures(query, hazard, phase, state.favoriteProcedureIds, onlyFavorites);

  $("#search-count").textContent = `${results.length}件`;

  const box = $("#procedure-results");
  if (results.length === 0) {
    box.innerHTML = `
      <div class="empty-state">
        <p class="empty-icon" aria-hidden="true">手</p>
        <h2>条件に合う手順が見つかりません</h2>
        <p>検索語句や絞り込みを見直してください。</p>
        <button type="button" class="secondary compact" data-clear-filters>条件をすべて解除</button>
      </div>`;
    return;
  }

  box.innerHTML = results.map(p => procedureCard(state, p)).join("");
}

// 手順idは英数字とハイフンのみ(js/data/procedures.js参照)。CSS.escapeで念のため防御する。
function focusFavorite(id) {
  const button = document.querySelector(`[data-favorite="${CSS.escape(id)}"]`);
  if (button) {
    button.focus();
    return;
  }
  // お気に入りだけ表示中に解除して一覧から消えた場合など、対象ボタンがもう無いとき。
  const results = $("#procedure-results");
  results.tabIndex = -1;
  results.focus();
}

function toggleFavorite(ctx, id) {
  const state = ctx.getState();
  const has = state.favoriteProcedureIds.includes(id);
  const next = {
    ...state,
    favoriteProcedureIds: has
      ? state.favoriteProcedureIds.filter(x => x !== id)
      : [...state.favoriteProcedureIds, id],
  };
  // お気に入りボタンはDOM先行変更をしない(aria-pressedは常にstateから描画する)ため、
  // commitが失敗しても表示はすでに正しい(変更前のまま)。renderResultsは再描画で
  // ボタンのDOMノードを差し替えるので、成功時のみフォーカスを復元する。
  if (ctx.commit(next, { success: null })) focusFavorite(id);
}

// 災害・段階フィルターは<select>のためDOM側がJSより先に値を変えている(ネイティブ動作)。
// commitが失敗した場合はctx.render()で強制的にselect.valueを実際のstateへ巻き戻す。
function commitFilter(ctx, key, value) {
  const state = ctx.getState();
  const next = { ...state, ui: { ...state.ui, [key]: value } };
  if (!ctx.commit(next, { success: null })) ctx.render();
}

function clearFilters(ctx) {
  query = "";
  $("#procedure-search").value = "";
  $("#favorites-only").checked = false;
  const state = ctx.getState();
  ctx.commit({ ...state, ui: { ...state.ui, hazardFilter: "all", phaseFilter: "all" } }, { success: null });
  // 上のcommitが成功していればすでに再描画済みだが、失敗時にも検索語・お気に入り
  // チェックの解除だけは反映したいため、成否に関わらずここでもう一度描画する。
  renderResults(ctx);
  $("#procedure-search").focus();
}

export function bind(ctx) {
  $("#search-form").addEventListener("submit", event => {
    event.preventDefault();
    renderResults(ctx);
  });

  $("#procedure-search").addEventListener("input", event => {
    query = event.target.value;
    renderResults(ctx);
  });

  $("#hazard-filter").addEventListener("change", event => commitFilter(ctx, "hazardFilter", event.target.value));
  $("#phase-filter").addEventListener("change", event => commitFilter(ctx, "phaseFilter", event.target.value));
  $("#favorites-only").addEventListener("change", () => renderResults(ctx));

  $("#procedure-results").addEventListener("click", event => {
    const clear = event.target.closest("[data-clear-filters]");
    if (clear) {
      clearFilters(ctx);
      return;
    }
    const favoriteButton = event.target.closest("[data-favorite]");
    if (favoriteButton) toggleFavorite(ctx, favoriteButton.dataset.favorite);
  });
}

export function render(ctx) {
  const state = ctx.getState();
  const hazardSelect = $("#hazard-filter");
  const phaseSelect = $("#phase-filter");
  if (hazardSelect.value !== state.ui.hazardFilter) hazardSelect.value = state.ui.hazardFilter;
  if (phaseSelect.value !== state.ui.phaseFilter) phaseSelect.value = state.ui.phaseFilter;
  renderResults(ctx);
}
