// 緊急モード画面: 「暗い部屋でスマホを持ちながら読む」ことを前提にした、このアプリで
// もっとも重要な画面。now手順(チェック可能)→after手順→持ち出し品→集合場所・配慮事項→
// 緊急連絡メモ、の順に事前保存した情報だけを表示する。171ブロックと災害選択・終了の
// 確認ダイアログはシェル/index.htmlの担当。ネットワークには一切触れない。
//
// #emergency-hazard-label #emergency-title #emergency-procedures #emergency-go-bag
// #emergency-family #emergency-contacts のみを担当する。

import { PROCEDURES } from "../data/procedures.js";
import { HAZARD_LABELS } from "../data/hazards.js";
import { $, esc } from "./render.js";

// ── 手順(now→after) ─────────────────────────────────────────────────────

// 見出し(h2)+本文をチェックボックスの<label>の中に置くと、アクセシブルネームが
// 見出しと本文を切れ目なく連結した長い一文になってしまい、見出しレベルも
// section(h2)と同列のh2が10個近く並ぶ状態になる(レビュー指摘)。
// そこで見出し(h3・sectionのh2より1段下げる)と本文はチェックボックスの外に出し、
// aria-labelledby(見出しのみ)・aria-describedby(本文)で結び付ける。
// カード全体の44px以上のタップ領域は<label>の暗黙の関連付けに頼らず、
// bind()側で.emergency-step全体のクリックをチェックボックスへ委譲して復元する。
function emergencyStep(state, procedure) {
  const checked = state.emergencyCheckedIds.includes(procedure.id);
  const titleId = `step-${procedure.id}-title`;
  const bodyId = `step-${procedure.id}-body`;
  return `
    <div class="emergency-step${checked ? " checked" : ""}">
      <input type="checkbox" data-emergency-check="${esc(procedure.id)}" aria-labelledby="${titleId}" aria-describedby="${bodyId}" ${checked ? "checked" : ""}>
      <span>
        <h3 id="${titleId}" style="margin:0">${esc(procedure.title)}</h3>
        <p id="${bodyId}">${esc(procedure.body)}</p>
      </span>
    </div>`;
}

// phaseごとの手順が0件のときは見出しごと出さない(全11災害のうちいくつかは
// alert/recoverが無いが、emergency画面が使うnow/afterは常に1件以上ある。念のため防御)。
function proceduresSection(headingId, heading, note, procedures, state, extraClass = "") {
  if (procedures.length === 0) return "";
  const classAttr = extraClass ? ` class="${extraClass}"` : "";
  return `
    <section aria-labelledby="${headingId}"${classAttr}>
      <h2 id="${headingId}">${esc(heading)}</h2>
      ${note ? `<p>${esc(note)}</p>` : ""}
      ${procedures.map(p => emergencyStep(state, p)).join("")}
    </section>`;
}

function renderProcedures(state) {
  const hazard = state.selectedHazard;
  const forHazard = PROCEDURES.filter(p => p.hazard === hazard);
  const now = forHazard.filter(p => p.phase === "now");
  const after = forHazard.filter(p => p.phase === "after");

  const sections = [
    proceduresSection("urgent-steps-title", "今すぐ", null, now, state),
    proceduresSection("later-steps-title", "身の安全を確保したら", "落ち着いてから、順番に確認してください。", after, state, "later-steps"),
  ].join("");

  const allLink = `
    <p class="section-note">
      <button type="button" class="text-button" data-view="procedures" data-hazard="${esc(hazard)}">${esc(HAZARD_LABELS[hazard])}のすべての手順を見る(平時の備え・生活再建を含む)</button>
    </p>`;

  $("#emergency-procedures").innerHTML = sections + allLink;
}

// ── 持ち出し品 ───────────────────────────────────────────────────────────

function goBagRow(state, supply) {
  const location = supply.locationId ? state.locations.find(l => l.id === supply.locationId)?.name ?? null : null;
  const meta = [`${supply.quantity}${esc(supply.unit)}`, location ? esc(location) : "場所未登録", supply.isReady ? "準備済み" : "未準備"];
  return `
    <div class="check-row">
      <span aria-hidden="true">${supply.isReady ? "済" : "未"}</span>
      <div>
        <strong>${esc(supply.name)}</strong>
        <small>${meta.join(" ・ ")}</small>
      </div>
    </div>`;
}

function renderGoBag(state) {
  const items = state.supplies.filter(s => s.isGoBag);
  $("#emergency-go-bag").innerHTML = items.length
    ? `<div class="checklist">${items.map(s => goBagRow(state, s)).join("")}</div>`
    : `<p>持ち出し品が登録されていません。安全を確保したら、通常モードの「準備台帳」から登録してください。</p>`;
}

// ── 集合場所・家族(配慮事項) ────────────────────────────────────────────

const orNote = value => (value ? esc(value) : "未登録");

function familyRow(member) {
  return `
    <article class="family-card">
      <h2>${esc(member.label)}</h2>
      <dl>
        <dt>集合場所</dt><dd>${orNote(member.meetingPlace)}</dd>
        <dt>配慮事項</dt><dd>${orNote(member.considerations)}</dd>
      </dl>
    </article>`;
}

function renderFamily(state) {
  const members = state.familyMembers;
  $("#emergency-family").innerHTML = members.length
    ? members.map(familyRow).join("")
    : `<p>家族カードが登録されていません。公的な指示を優先してください。</p>`;
}

// ── 緊急連絡メモ ─────────────────────────────────────────────────────────

function renderContacts(state) {
  const text = state.household.emergencyContacts.trim();
  // 改行を含むメモが多いため、暗所での可読性を優先しwhite-space:pre-wrapで改行を保つ
  // (このためだけに新規CSSクラスを足さず、styles.cssの対象外方針に沿ってインラインで済ませる)。
  $("#emergency-contacts").innerHTML = text
    ? `<p style="white-space:pre-wrap">${esc(text)}</p>`
    : `<p>緊急連絡メモが登録されていません。安全を確保したら、通常モードの「家族カード」から登録してください。</p>`;
}

// ── render(ctx) ──────────────────────────────────────────────────────────

export function render(ctx) {
  const state = ctx.getState();
  // 緊急モードでないとき(または災害未選択)は #view-emergency 自体が非表示なので描画しない。
  if (state.mode !== "emergency" || !state.selectedHazard) return;

  $("#emergency-hazard-label").textContent = HAZARD_LABELS[state.selectedHazard];
  $("#emergency-title").textContent = `${HAZARD_LABELS[state.selectedHazard]}：今すぐ行うこと`;

  renderProcedures(state);
  renderGoBag(state);
  renderFamily(state);
  renderContacts(state);
}

// ── 手順idは英数字とハイフンのみ(procedures.js参照)。CSS.escapeで念のため防御する。 ──

function refocusCheck(id) {
  $(`[data-emergency-check="${CSS.escape(id)}"]`)?.focus();
}

function toggleEmergencyCheck(ctx, id) {
  const state = ctx.getState();
  const has = state.emergencyCheckedIds.includes(id);
  const emergencyCheckedIds = has
    ? state.emergencyCheckedIds.filter(x => x !== id)
    : [...state.emergencyCheckedIds, id];
  const ok = ctx.commit({ ...state, emergencyCheckedIds }, { success: null });
  // チェックボックスはブラウザが先にチェック状態を変えている。失敗時はrender()で
  // 実際のstateへ描画し直し、見た目を巻き戻す。成功時は再描画後の同じidの要素へ戻す。
  if (ok) refocusCheck(id);
  else ctx.render();
}

// ── bind(ctx) ────────────────────────────────────────────────────────────

export function bind(ctx) {
  const container = $("#emergency-procedures");

  container.addEventListener("change", event => {
    const check = event.target.closest("[data-emergency-check]");
    if (check) toggleEmergencyCheck(ctx, check.dataset.emergencyCheck);
  });

  // カードは<label>ではなくただの<div>なので、チェックボックス以外の場所(見出し・
  // 本文・余白)をタップしてもブラウザは何もしてくれない。ここでカード全体を44px以上の
  // タップ領域として復元する: チェックボックス自身へのクリックはブラウザの標準動作
  // (トグル→change)にそのまま任せ、二重トグルを避けるため何もしない。それ以外の
  // クリックだけ、チェックボックスへ.click()を委譲する(ネイティブのトグル+change発火を
  // 再利用するので、状態更新のロジックはtoggleEmergencyCheckの1箇所のままでよい)。
  container.addEventListener("click", event => {
    const card = event.target.closest(".emergency-step");
    if (!card) return;
    const checkbox = card.querySelector("[data-emergency-check]");
    if (!checkbox || event.target === checkbox) return;
    checkbox.click();
  });
}
