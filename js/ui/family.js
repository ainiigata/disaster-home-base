// 家族カード画面: 家族カード一覧(呼び名・集合場所・配慮事項・連絡メモ)と、
// アプリ全体の備蓄目安計算のもとになる世帯設定を描画する。
// #family-list #add-family #household-card と family-dialog / household-dialog の
// 中身・送信のみを担当する(ダイアログの閉じ方・背景クリックはシェルの担当)。

import { validateFamily, validateHousehold, uid } from "../validate.js";
import { $, $$, esc } from "./render.js";

const FAMILY_LIMIT = 20; // state.js の FAMILY_LIMIT と同じ値。超過すると次回読み込み時に
                          // 古いカードが黙って切り捨てられるため、追加前に事前ガードする。

// ── 表示ヘルパー ─────────────────────────────────────────────────────────

const orNote = value => (value ? esc(value) : "未登録");

function familyCard(member) {
  return `
    <article class="family-card">
      <h2>${esc(member.label)}</h2>
      <dl>
        <dt>集合場所</dt><dd>${orNote(member.meetingPlace)}</dd>
        <dt>配慮事項</dt><dd>${orNote(member.considerations)}</dd>
        <dt>連絡メモ</dt><dd>${orNote(member.contactNote)}</dd>
      </dl>
      <div class="card-actions">
        <button type="button" data-edit-family="${esc(member.id)}">編集</button>
      </div>
    </article>`;
}

function renderFamilyList(state) {
  const box = $("#family-list");
  if (state.familyMembers.length === 0) {
    box.innerHTML = `
      <div class="empty-state">
        <p class="empty-icon" aria-hidden="true">族</p>
        <h2>家族カードがまだありません</h2>
        <p>実名でなく呼び名だけでも登録できます。「カードを追加」から最初の1枚を作りましょう。</p>
        <button type="button" class="primary" data-add-family>カードを追加</button>
      </div>`;
    return;
  }
  box.innerHTML = state.familyMembers.map(familyCard).join("");
}

function renderHouseholdCard(state) {
  const h = state.household;
  $("#household-card").innerHTML = `
    <div class="family-card">
      <dl>
        <dt>大人</dt><dd>${h.adults}人</dd>
        <dt>子ども</dt><dd>${h.children}人</dd>
        <dt>備蓄日数</dt><dd>${h.stockDays}日分</dd>
        <dt>緊急連絡メモ</dt><dd>${orNote(h.emergencyContacts)}</dd>
      </dl>
      <div class="card-actions">
        <button type="button" data-edit-household>世帯設定を編集</button>
      </div>
    </div>`;
}

// ── render(ctx) ──────────────────────────────────────────────────────────

export function render(ctx) {
  const state = ctx.getState();
  renderFamilyList(state);
  renderHouseholdCard(state);
}

// ── ダイアログへの値の出し入れ ───────────────────────────────────────────

function clearFormErrors(form) {
  for (const slot of $$("[data-error]", form)) slot.textContent = "";
  for (const input of $$("input,select,textarea", form)) input.removeAttribute("aria-invalid");
  $(".form-error", form)?.classList.add("hidden");
}

function openFamilyDialogFor(ctx, id) {
  const state = ctx.getState();
  const member = id ? state.familyMembers.find(m => m.id === id) : null;
  const form = $("#family-form");
  clearFormErrors(form);
  $("#family-dialog-title").textContent = member ? "家族カードを編集" : "家族カードを追加";
  form.elements.id.value = member?.id ?? "";
  form.elements.label.value = member?.label ?? "";
  form.elements.meetingPlace.value = member?.meetingPlace ?? "";
  form.elements.contactNote.value = member?.contactNote ?? "";
  form.elements.considerations.value = member?.considerations ?? "";
  ctx.openDialog("family-dialog");
}

function openHouseholdDialogFor(ctx) {
  const h = ctx.getState().household;
  const form = $("#household-form");
  clearFormErrors(form);
  form.elements.adults.value = String(h.adults);
  form.elements.children.value = String(h.children);
  for (const input of $$('input[name="stockDays"]', form)) input.checked = Number(input.value) === h.stockDays;
  form.elements.emergencyContacts.value = h.emergencyContacts;
  ctx.openDialog("household-dialog");
}

// ── フォームの送信 ───────────────────────────────────────────────────────

function submitFamilyForm(ctx, event) {
  event.preventDefault();
  const form = event.target;
  const state = ctx.getState();
  const id = form.elements.id.value || null;
  const existing = id ? state.familyMembers.find(m => m.id === id) : null;

  if (!existing && state.familyMembers.length >= FAMILY_LIMIT) {
    const box = $(".form-error", form);
    if (box) {
      box.textContent = "家族カードが上限(20件)に達しているため追加できません。";
      box.classList.remove("hidden");
      box.focus();
    }
    return;
  }

  const raw = {
    label: form.elements.label.value,
    meetingPlace: form.elements.meetingPlace.value,
    contactNote: form.elements.contactNote.value,
    considerations: form.elements.considerations.value,
  };
  const result = validateFamily(raw);
  ctx.fillErrors(form, result);
  if (!result.valid) return;

  const entity = { ...result.value, id: existing ? existing.id : uid(), updatedAt: Date.now() };
  const familyMembers = existing
    ? state.familyMembers.map(m => (m.id === entity.id ? entity : m))
    : [...state.familyMembers, entity];

  ctx.commitForm(form, { ...state, familyMembers }, {
    success: existing ? "家族カードを更新しました。" : "家族カードを追加しました。",
    syncOps: [{ kind: "familyMembers", entity }],
  });
}

function submitHouseholdForm(ctx, event) {
  event.preventDefault();
  const form = event.target;
  const raw = {
    adults: form.elements.adults.value,
    children: form.elements.children.value,
    stockDays: form.elements.stockDays.value,
    emergencyContacts: form.elements.emergencyContacts.value,
  };
  const result = validateHousehold(raw);
  ctx.fillErrors(form, result);
  if (!result.valid) return;

  const state = ctx.getState();
  const household = { ...result.value, updatedAt: Date.now() };
  // 人数・日数が変わると準備台帳の「備蓄の目安」もすぐ変わるため、そのことを保存成功の
  // 通知にそのまま乗せる(commitForm の success がそのまま ctx.notice に渡る)。
  ctx.commitForm(form, { ...state, household }, {
    success: "世帯設定を保存しました。備蓄の目安が変わりました。",
    syncOps: [{ shared: "household" }],
  });
}

// ── bind(ctx) ────────────────────────────────────────────────────────────

export function bind(ctx) {
  $("#add-family").addEventListener("click", () => openFamilyDialogFor(ctx, null));

  $("#family-list").addEventListener("click", event => {
    const addButton = event.target.closest("[data-add-family]");
    if (addButton) return openFamilyDialogFor(ctx, null);

    const editButton = event.target.closest("[data-edit-family]");
    if (editButton) openFamilyDialogFor(ctx, editButton.dataset.editFamily);
  });

  $("#household-card").addEventListener("click", event => {
    const editButton = event.target.closest("[data-edit-household]");
    if (editButton) openHouseholdDialogFor(ctx);
  });

  $("#family-form").addEventListener("submit", event => submitFamilyForm(ctx, event));
  $("#household-form").addEventListener("submit", event => submitHouseholdForm(ctx, event));
}
