// 準備台帳画面: 持ち出し品・備蓄・入れ替え(ローリングストック)・保管場所・保険確認の
// 5タブを描画する。#supply-panel の中身と supply-dialog / location-dialog の中身・
// 送信のみを担当する(タブ切替・ダイアログの閉じ方はシェルの担当)。
//
// 「備蓄の目安」パネルがこの画面の中心: stockStatus() が計算した必要量と現在量の差を
// 数字だけでなく色・バッジ・「あと◯◯」の一文で即座に伝え、「台帳に追加」までを1タップで
// つなげる。

import { stockStatus, expiringSupplies, insuranceSuggestions, dateKey } from "../derive.js";
import { STOCK_GUIDE, requiredQuantity } from "../data/stock-guide.js";
import { validateSupply, validateLocation, validateInsurance, uid } from "../validate.js";
import { $, $$, esc } from "./render.js";

const CATEGORY_LABELS = {
  water: "水",
  food: "食料",
  medical: "医療",
  light: "照明・電源",
  hygiene: "衛生",
  documents: "書類",
  other: "その他",
};

const SUPPLIES_LIMIT = 200; // state.js の SUPPLIES_LIMIT と同じ値。超過を黙って切り捨てないための事前チェックに使う。
const LOCATIONS_LIMIT = 30; // state.js の LOCATIONS_LIMIT と同じ値。超過すると次回読み込み時に古い保管場所が
                             // 黙って切り捨てられ、それを参照する備蓄のlocationIdまで無効化されてしまうため事前に防ぐ。

// ── 表示ヘルパー ─────────────────────────────────────────────────────────

// "YYYY-MM-DD" -> "YYYY年M月D日"。ローリングストックは過去日(期限切れ)も年をまたぐ
// ことがあるため、ホーム画面のformatMonthDayと違い年も明示する。
function formatDate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

function locationName(state, locationId) {
  return locationId ? state.locations.find(l => l.id === locationId)?.name ?? null : null;
}

// 描画後に消えた要素へフォーカスしようとしたときの受け皿。#supply-panel は
// tabindex="-1" が最初から付いているので、対象が見つからなければそこへ戻す。
function refocus(selector) {
  const target = $(selector);
  if (target) target.focus();
  else $("#supply-panel")?.focus();
}

// ── 品目(goBag/stock共通)の一覧 ────────────────────────────────────────

function supplyRow(state, supply) {
  const meta = [`${supply.quantity}${esc(supply.unit)}`, CATEGORY_LABELS[supply.category] ?? "その他"];
  const location = locationName(state, supply.locationId);
  if (location) meta.push(esc(location));
  if (supply.expiresOn) meta.push(`期限 ${formatDate(supply.expiresOn)}`);
  return `
    <div class="check-row">
      <input type="checkbox" data-ready="${esc(supply.id)}" ${supply.isReady ? "checked" : ""} aria-label="${esc(supply.name)}を準備済みにする">
      <div>
        <strong>${esc(supply.name)}</strong>
        <small>${meta.join(" ・ ")}</small>
      </div>
      <button type="button" class="edit-button" data-edit-supply="${esc(supply.id)}">編集</button>
    </div>`;
}

function renderItemsList(state, isGoBag) {
  const items = state.supplies.filter(s => s.isGoBag === isGoBag);
  if (items.length === 0) {
    return `
      <div class="empty-state">
        <p class="empty-icon" aria-hidden="true">${isGoBag ? "持" : "備"}</p>
        <h2>まだ登録がありません</h2>
        <p>「品目を追加」から最初の1件を登録しましょう。</p>
      </div>`;
  }
  return `<div class="checklist">${items.map(s => supplyRow(state, s)).join("")}</div>`;
}

function renderGoBagTab(state) {
  return `
    <div class="panel-head">
      <h2>持ち出し品</h2>
      <button type="button" class="primary compact" data-add-supply>品目を追加</button>
    </div>
    ${renderItemsList(state, true)}`;
}

// ── 備蓄タブ: 「備蓄の目安」パネル + 登録済み備蓄一覧 ─────────────────────

function stockGuideRow(row) {
  const gap = Math.max(0, row.required - row.have);
  const tagClass = !row.registered ? "danger" : row.fulfilled ? "" : "warning";
  const tagLabel = !row.registered ? "未登録" : row.fulfilled ? "充足" : "不足";
  // 「現在」の数字そのものを不足時は太字の危険色にし、さらに「あと◯◯」を一言添える。
  // 数字を読み比べなくても、赤い数字と「あと」の一言だけで不足が伝わるようにする。
  const haveStyle = gap > 0 ? ' style="color:var(--danger);font-weight:700"' : "";
  const gapText = gap > 0 ? ` ・ あと${gap}${esc(row.unit)}` : "";
  const action = !row.registered
    ? `<button type="button" class="edit-button" data-add-recommended="${esc(row.key)}">台帳に追加</button>`
    : "";
  return `
    <div class="stock-row">
      <div>
        <strong>${esc(row.name)}</strong>
        <small>必要 ${row.required}${esc(row.unit)} ・ 現在 <strong${haveStyle}>${row.have}${esc(row.unit)}</strong>${gapText}</small>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="status-tag ${tagClass}">${tagLabel}</span>
        ${action}
      </div>
    </div>`;
}

function renderStockTab(state) {
  const status = stockStatus(state);
  const unregisteredCount = status.filter(r => !r.registered).length;
  return `
    <section class="card" style="padding:16px 17px;margin-bottom:22px;">
      <div class="panel-head">
        <h2>備蓄の目安</h2>
        ${unregisteredCount > 0 ? `<button type="button" class="secondary compact" data-add-recommended-all>おすすめセットをまとめて追加</button>` : ""}
      </div>
      <p class="panel-note">世帯の人数・備蓄日数から計算した目安です。「台帳に追加」で登録できます。</p>
      <div class="checklist">${status.map(stockGuideRow).join("")}</div>
    </section>
    <div class="panel-head">
      <h2>登録済みの備蓄</h2>
      <button type="button" class="primary compact" data-add-supply>品目を追加</button>
    </div>
    ${renderItemsList(state, false)}`;
}

// ── 入れ替え(ローリングストック)タブ ────────────────────────────────────

function expiringRow(todayKey, supply) {
  const expired = supply.expiresOn < todayKey;
  const tone = expired ? "danger" : "warning";
  const style = expired
    ? "border-color:#e2a9a2;background:var(--danger-wash)"
    : "border-color:#dcb37a;background:var(--amber-wash)";
  return `
    <div class="check-row" style="${style}">
      <span class="status-tag ${tone}">${expired ? "期限切れ" : "期限間近"}</span>
      <div>
        <strong>${esc(supply.name)}</strong>
        <small>${supply.quantity}${esc(supply.unit)} ・ 期限 ${formatDate(supply.expiresOn)}</small>
      </div>
      <button type="button" class="edit-button" data-consume="${esc(supply.id)}">消費した</button>
    </div>`;
}

function shoppingRow(item) {
  const doneStyle = item.done ? ' style="text-decoration:line-through;color:var(--ink-faint)"' : "";
  return `
    <li class="check-row">
      <input type="checkbox" data-shopping-done="${esc(item.id)}" ${item.done ? "checked" : ""} aria-label="${esc(item.name)}を購入済みにする">
      <div><strong${doneStyle}>${esc(item.name)}</strong></div>
      <button type="button" class="text-button" data-shopping-remove="${esc(item.id)}">削除</button>
    </li>`;
}

function renderRollingTab(state) {
  const todayKey = dateKey();
  const expiring = expiringSupplies(state);
  const list = expiring.length === 0
    ? `
      <div class="empty-state">
        <p class="empty-icon" aria-hidden="true">替</p>
        <h2>入れ替えが必要な備えはありません</h2>
        <p>期限切れ・期限が近い品はいまのところありません。</p>
      </div>`
    : `<div class="checklist">${expiring.map(s => expiringRow(todayKey, s)).join("")}</div>`;

  const shoppingList = state.shopping.length === 0
    ? `<p class="section-note">買い足すものはありません。</p>`
    : `<ul class="shopping-list">${state.shopping.map(shoppingRow).join("")}</ul>`;

  return `
    <div class="panel-head"><h2>入れ替え</h2></div>
    ${list}
    <h2 class="section-title">買い足しリスト</h2>
    ${shoppingList}`;
}

// ── 保管場所タブ ─────────────────────────────────────────────────────────

function locationCard(location) {
  return `
    <div class="location-card">
      <strong>${esc(location.name)}</strong>
      ${location.note ? `<p>${esc(location.note)}</p>` : ""}
      <div class="card-actions">
        <button type="button" data-edit-location="${esc(location.id)}">編集</button>
      </div>
    </div>`;
}

function renderLocationsTab(state) {
  const body = state.locations.length === 0
    ? `
      <div class="empty-state">
        <p class="empty-icon" aria-hidden="true">所</p>
        <h2>保管場所がまだありません</h2>
        <p>「保管場所を追加」から登録すると、品目にひもづけられます。</p>
      </div>`
    : `<div class="location-grid">${state.locations.map(locationCard).join("")}</div>`;
  return `
    <div class="panel-head">
      <h2>保管場所</h2>
      <button type="button" class="primary compact" data-add-location>保管場所を追加</button>
    </div>
    ${body}`;
}

// ── 保険確認タブ ─────────────────────────────────────────────────────────

function renderInsuranceTab(state) {
  const ins = state.insurance;
  const suggestions = insuranceSuggestions(ins);
  return `
    <div class="panel-head"><h2>保険確認</h2></div>
    <p class="section-note">加入状況と補償の内容を、自分用のメモとして記録します。</p>
    <form id="insurance-form" class="insurance-form" novalidate>
      <p class="form-error hidden" role="alert" tabindex="-1"></p>
      <fieldset class="field-set">
        <legend>加入状況</legend>
        <div class="radio-row">
          <label class="check-label"><input type="radio" name="status" value="unknown" ${ins.status === "unknown" ? "checked" : ""}> わからない・確認中</label>
          <label class="check-label"><input type="radio" name="status" value="none" ${ins.status === "none" ? "checked" : ""}> 加入していない</label>
          <label class="check-label"><input type="radio" name="status" value="insured" ${ins.status === "insured" ? "checked" : ""}> 加入している</label>
        </div>
      </fieldset>
      <fieldset class="field-set coverage-grid">
        <legend>補償の確認(加入している場合)</legend>
        <label class="check-label"><input type="checkbox" name="earthquake" ${ins.coverages.earthquake ? "checked" : ""}> 地震</label>
        <label class="check-label"><input type="checkbox" name="stormFlood" ${ins.coverages.stormFlood ? "checked" : ""}> 風災・水災</label>
        <label class="check-label"><input type="checkbox" name="household" ${ins.coverages.household ? "checked" : ""}> 家財</label>
      </fieldset>
      <label class="field"><span>保険証券の保管場所</span><input name="policyLocation" maxlength="100" value="${esc(ins.policyLocation)}"><small data-error="policyLocation"></small></label>
      <div class="form-grid">
        <label class="field"><span>更新日</span><input name="renewalOn" type="date" value="${esc(ins.renewalOn ?? "")}"><small data-error="renewalOn"></small></label>
        <label class="field"><span>前回確認日</span><input name="lastCheckedOn" type="date" value="${esc(ins.lastCheckedOn ?? "")}"><small data-error="lastCheckedOn"></small></label>
      </div>
      <label class="field"><span>メモ</span><textarea name="note" maxlength="300">${esc(ins.note)}</textarea><small data-error="note"></small></label>
      <button type="submit" id="insurance-save" class="primary save-button">保存する</button>
    </form>
    <div class="insurance-summary" style="margin-top:20px;">
      <h3>確認のヒント</h3>
      <ul class="suggestion-list">${suggestions.map(text => `<li>${esc(text)}</li>`).join("")}</ul>
    </div>
    <p class="disclaimer">この確認項目は一般的な目安であり、補償の可否や契約を勧めるものではありません。詳しい条件や最終判断は、保険証券や保険会社への確認をもとに行ってください。</p>`;
}

// ── render(ctx) ──────────────────────────────────────────────────────────

export function render(ctx) {
  const state = ctx.getState();
  const panel = $("#supply-panel");
  switch (state.ui.supplyTab) {
    case "goBag": panel.innerHTML = renderGoBagTab(state); break;
    case "stock": panel.innerHTML = renderStockTab(state); break;
    case "rolling": panel.innerHTML = renderRollingTab(state); break;
    case "locations": panel.innerHTML = renderLocationsTab(state); break;
    case "insurance": panel.innerHTML = renderInsuranceTab(state); break;
    default: panel.innerHTML = renderGoBagTab(state);
  }
}

// ── ダイアログへの値の出し入れ ───────────────────────────────────────────

function clearFormErrors(form) {
  for (const slot of $$("[data-error]", form)) slot.textContent = "";
  for (const input of $$("input,select,textarea", form)) input.removeAttribute("aria-invalid");
  $(".form-error", form)?.classList.add("hidden");
}

function locationOptions(locations, selectedId) {
  const opts = [
    `<option value="">未設定</option>`,
    ...locations.map(l => `<option value="${esc(l.id)}"${l.id === selectedId ? " selected" : ""}>${esc(l.name)}</option>`),
  ];
  return opts.join("");
}

function openSupplyDialogFor(ctx, id) {
  const state = ctx.getState();
  const supply = id ? state.supplies.find(s => s.id === id) : null;
  const form = $("#supply-form");
  clearFormErrors(form);
  $("#supply-dialog-title").textContent = supply ? "品目を編集" : "品目を追加";
  form.elements.id.value = supply?.id ?? "";
  form.elements.recommendedKey.value = supply?.recommendedKey ?? "";
  form.elements.name.value = supply?.name ?? "";
  form.elements.category.value = supply?.category ?? "other";
  form.elements.unit.value = supply?.unit ?? "個";
  form.elements.quantity.value = String(supply?.quantity ?? 1);
  form.elements.minimumQuantity.value = String(supply?.minimumQuantity ?? 1);
  form.elements.expiresOn.value = supply?.expiresOn ?? "";
  form.elements.locationId.innerHTML = locationOptions(state.locations, supply?.locationId ?? null);
  form.elements.isGoBag.checked = supply ? supply.isGoBag : state.ui.supplyTab === "goBag";
  form.elements.isReady.checked = supply?.isReady ?? false;
  form.elements.note.value = supply?.note ?? "";
  ctx.openDialog("supply-dialog");
}

function openLocationDialogFor(ctx, id) {
  const state = ctx.getState();
  const location = id ? state.locations.find(l => l.id === id) : null;
  const form = $("#location-form");
  clearFormErrors(form);
  $("#location-dialog-title").textContent = location ? "保管場所を編集" : "保管場所を追加";
  form.elements.id.value = location?.id ?? "";
  form.elements.name.value = location?.name ?? "";
  form.elements.note.value = location?.note ?? "";
  ctx.openDialog("location-dialog");
}

// ── 品目・保管場所フォームの送信 ─────────────────────────────────────────

function submitSupplyForm(ctx, event) {
  event.preventDefault();
  const form = event.target;
  const state = ctx.getState();
  const id = form.elements.id.value || null;
  const existing = id ? state.supplies.find(s => s.id === id) : null;

  if (!existing && state.supplies.length >= SUPPLIES_LIMIT) {
    const box = $(".form-error", form);
    if (box) {
      box.textContent = "台帳が上限(200件)に達しているため追加できません。";
      box.classList.remove("hidden");
      box.focus();
    }
    return;
  }

  const raw = {
    name: form.elements.name.value,
    category: form.elements.category.value,
    unit: form.elements.unit.value,
    quantity: form.elements.quantity.value,
    minimumQuantity: form.elements.minimumQuantity.value,
    expiresOn: form.elements.expiresOn.value || null,
    locationId: form.elements.locationId.value || null,
    isGoBag: form.elements.isGoBag.checked,
    isReady: form.elements.isReady.checked,
    note: form.elements.note.value,
    recommendedKey: form.elements.recommendedKey.value || null,
  };
  const result = validateSupply(raw, state.locations.map(l => l.id));
  ctx.fillErrors(form, result);
  if (!result.valid) return;

  const entity = {
    ...result.value,
    id: existing ? existing.id : uid(),
    createdAt: existing ? existing.createdAt : Date.now(),
    updatedAt: Date.now(),
  };
  const supplies = existing
    ? state.supplies.map(s => (s.id === entity.id ? entity : s))
    : [...state.supplies, entity];

  ctx.commitForm(form, { ...state, supplies }, {
    success: existing ? "品目を更新しました。" : "品目を追加しました。",
    syncOps: [{ kind: "supplies", entity }],
  });
}

function submitLocationForm(ctx, event) {
  event.preventDefault();
  const form = event.target;
  const state = ctx.getState();
  const id = form.elements.id.value || null;
  const existing = id ? state.locations.find(l => l.id === id) : null;

  if (!existing && state.locations.length >= LOCATIONS_LIMIT) {
    const box = $(".form-error", form);
    if (box) {
      box.textContent = "保管場所が上限(30件)に達しているため追加できません。";
      box.classList.remove("hidden");
      box.focus();
    }
    return;
  }

  const raw = { name: form.elements.name.value, note: form.elements.note.value };
  const result = validateLocation(raw);
  ctx.fillErrors(form, result);
  if (!result.valid) return;

  const entity = { ...result.value, id: existing ? existing.id : uid(), updatedAt: Date.now() };
  const locations = existing
    ? state.locations.map(l => (l.id === entity.id ? entity : l))
    : [...state.locations, entity];

  ctx.commitForm(form, { ...state, locations }, {
    success: existing ? "保管場所を更新しました。" : "保管場所を追加しました。",
    syncOps: [{ kind: "locations", entity }],
  });
}

function submitInsuranceForm(ctx, event) {
  event.preventDefault();
  const form = event.target;
  const raw = {
    status: form.elements.status.value,
    coverages: {
      earthquake: form.elements.earthquake.checked,
      stormFlood: form.elements.stormFlood.checked,
      household: form.elements.household.checked,
    },
    policyLocation: form.elements.policyLocation.value,
    renewalOn: form.elements.renewalOn.value || null,
    lastCheckedOn: form.elements.lastCheckedOn.value || null,
    note: form.elements.note.value,
  };
  const result = validateInsurance(raw);
  ctx.fillErrors(form, result);
  if (!result.valid) return;

  const state = ctx.getState();
  const insurance = { ...result.value, updatedAt: Date.now() };
  // ダイアログではなくタブ内の常設フォームなので閉じる動作は不要。保存後は
  // 再描画で新しく生まれる保存ボタンへフォーカスを戻す。
  ctx.commitForm(form, { ...state, insurance }, {
    success: "保険の確認メモを保存しました。",
    close: false,
    syncOps: [{ shared: "insurance" }],
    afterSave: () => $("#insurance-save")?.focus(),
  });
}

// ── おすすめセットの追加・ローリングストック・買い足しリストの操作 ───────

function buildRecommendedEntity(guide, household) {
  return {
    name: guide.name,
    category: guide.category,
    unit: guide.unit,
    quantity: 0,
    minimumQuantity: requiredQuantity(guide, household),
    isGoBag: guide.isGoBag,
    recommendedKey: guide.key,
  };
}

function addRecommended(ctx, key) {
  const state = ctx.getState();
  const guide = STOCK_GUIDE.find(g => g.key === key);
  if (!guide) return;
  if (state.supplies.length >= SUPPLIES_LIMIT) {
    ctx.notice("台帳が上限(200件)に達しているため追加できません。", true);
    return;
  }
  const result = validateSupply(buildRecommendedEntity(guide, state.household), state.locations.map(l => l.id));
  if (!result.valid) return; // ガイドデータは常に妥当なはずなので、通常は起こらない防御的な早期return。
  const entity = { ...result.value, id: uid(), createdAt: Date.now(), updatedAt: Date.now() };
  const next = { ...state, supplies: [...state.supplies, entity] };
  if (ctx.commit(next, { success: `${guide.name}を台帳に追加しました。`, syncOps: [{ kind: "supplies", entity }] })) {
    refocus(`[data-add-recommended="${CSS.escape(key)}"]`);
  }
}

function addRecommendedAll(ctx) {
  const state = ctx.getState();
  const rows = stockStatus(state).filter(r => !r.registered);
  if (rows.length === 0) return;

  // 上限(200件)を超える分は黙って切り捨てず、追加できた件数と省いた件数を通知する。
  const room = SUPPLIES_LIMIT - state.supplies.length;
  if (room <= 0) {
    ctx.notice("台帳が上限(200件)に達しているため追加できません。", true);
    return;
  }
  const guideByKey = Object.fromEntries(STOCK_GUIDE.map(g => [g.key, g]));
  const targets = rows.slice(0, room);
  const skipped = rows.length - targets.length;

  const entities = [];
  for (const row of targets) {
    const guide = guideByKey[row.key];
    const result = validateSupply(buildRecommendedEntity(guide, state.household), state.locations.map(l => l.id));
    if (result.valid) entities.push({ ...result.value, id: uid(), createdAt: Date.now(), updatedAt: Date.now() });
  }
  if (entities.length === 0) return;

  const next = { ...state, supplies: [...state.supplies, ...entities] };
  const syncOps = entities.map(entity => ({ kind: "supplies", entity }));
  const success = skipped > 0
    ? `${entities.length}件を追加しました(上限のため${skipped}件は追加できませんでした)。`
    : `おすすめセット${entities.length}件を追加しました。`;
  if (ctx.commit(next, { success, syncOps })) refocus("[data-add-recommended-all]");
}

function consumeSupply(ctx, id) {
  const state = ctx.getState();
  const supply = state.supplies.find(s => s.id === id);
  if (!supply) return;
  const updated = { ...supply, quantity: Math.max(0, supply.quantity - 1), updatedAt: Date.now() };
  const supplies = state.supplies.map(s => (s.id === id ? updated : s));
  const hasEntry = state.shopping.some(item => item.name === supply.name);
  // 買い足しリストは端末ローカル(syncOpsを付けない)。品目側の数量変更だけ共有対象。
  const shopping = hasEntry
    ? state.shopping
    : [...state.shopping, { id: uid(), name: supply.name, done: false, updatedAt: Date.now() }];
  if (ctx.commit({ ...state, supplies, shopping }, { success: null, syncOps: [{ kind: "supplies", entity: updated }] })) {
    refocus(`[data-consume="${CSS.escape(id)}"]`);
  }
}

function toggleReady(ctx, id) {
  const state = ctx.getState();
  const supply = state.supplies.find(s => s.id === id);
  if (!supply) return;
  const updated = { ...supply, isReady: !supply.isReady, updatedAt: Date.now() };
  const supplies = state.supplies.map(s => (s.id === id ? updated : s));
  const ok = ctx.commit({ ...state, supplies }, { success: null, syncOps: [{ kind: "supplies", entity: updated }] });
  // チェックボックスはブラウザが先にチェック状態を変えている。失敗時はrender()で
  // 実際のstateへ描画し直し、見た目を巻き戻す。成功時は再描画後の同じidの要素へ戻す。
  if (ok) refocus(`[data-ready="${CSS.escape(id)}"]`);
  else ctx.render();
}

function toggleShoppingDone(ctx, id) {
  const state = ctx.getState();
  const shopping = state.shopping.map(item => (item.id === id ? { ...item, done: !item.done, updatedAt: Date.now() } : item));
  const ok = ctx.commit({ ...state, shopping }, { success: null });
  if (ok) refocus(`[data-shopping-done="${CSS.escape(id)}"]`);
  else ctx.render();
}

function removeShoppingItem(ctx, id) {
  const state = ctx.getState();
  const shopping = state.shopping.filter(item => item.id !== id);
  if (ctx.commit({ ...state, shopping }, { success: null })) refocus(`[data-shopping-remove="${CSS.escape(id)}"]`);
}

// ── bind(ctx) ────────────────────────────────────────────────────────────

export function bind(ctx) {
  const panel = $("#supply-panel");

  panel.addEventListener("click", event => {
    const addSupply = event.target.closest("[data-add-supply]");
    if (addSupply) return openSupplyDialogFor(ctx, null);

    const editSupply = event.target.closest("[data-edit-supply]");
    if (editSupply) return openSupplyDialogFor(ctx, editSupply.dataset.editSupply);

    const addLocation = event.target.closest("[data-add-location]");
    if (addLocation) return openLocationDialogFor(ctx, null);

    const editLocation = event.target.closest("[data-edit-location]");
    if (editLocation) return openLocationDialogFor(ctx, editLocation.dataset.editLocation);

    const addOne = event.target.closest("[data-add-recommended]");
    if (addOne) return addRecommended(ctx, addOne.dataset.addRecommended);

    const addAll = event.target.closest("[data-add-recommended-all]");
    if (addAll) return addRecommendedAll(ctx);

    const consume = event.target.closest("[data-consume]");
    if (consume) return consumeSupply(ctx, consume.dataset.consume);

    const removeShopping = event.target.closest("[data-shopping-remove]");
    if (removeShopping) return removeShoppingItem(ctx, removeShopping.dataset.shoppingRemove);

    // .check-row のチェックボックスは<label>で包まれていないため素のヒット領域が24×24しか
    // ない(44px未満、レビュー指摘)。emergency.js の.emergency-stepカード委譲と同じ手当てを
    // ここでも行う: 行内のどこをタップしてもチェックボックスへ委譲する。チェックボックス自身
    // (二重トグル防止)と編集・削除ボタンなど他の操作要素の上では何もしない。
    const row = event.target.closest(".check-row");
    if (row) {
      const checkbox = row.querySelector('input[type="checkbox"]');
      if (checkbox && event.target !== checkbox && !event.target.closest("button,a")) checkbox.click();
    }
  });

  panel.addEventListener("change", event => {
    const ready = event.target.closest("[data-ready]");
    if (ready) return toggleReady(ctx, ready.dataset.ready);

    const shoppingDone = event.target.closest("[data-shopping-done]");
    if (shoppingDone) return toggleShoppingDone(ctx, shoppingDone.dataset.shoppingDone);
  });

  // 保険フォームは再描画のたびにHTMLごと作り直されるため、submitはpanel側で委譲する。
  panel.addEventListener("submit", event => {
    if (event.target.id === "insurance-form") submitInsuranceForm(ctx, event);
  });

  $("#supply-form").addEventListener("submit", event => submitSupplyForm(ctx, event));
  $("#location-form").addEventListener("submit", event => submitLocationForm(ctx, event));
}
