// 家族と共有画面: 家族カード画面内の #share-section と、世帯作成・参加ダイアログ
// (share-create-dialog / share-join-dialog)の中身・送信のみを担当する。
//
// Firestoreへは一切直接触れず、送信はすべて js/sync.js の pushAll/stopSync/isConfigured
// を呼ぶだけにとどめる。リアルタイム購読の開始(startSync)だけは main.js の
// ctx.startSync(householdId) を経由する(main.js がリモート受信ハンドラーと状態表示の
// 唯一の持ち主であるため、この画面から直接 sync.startSync を呼ぶと購読の登録が二重の
// 主体に分かれてしまう)。
//
// 合言葉(passphrase)はこのモジュール内でも「表示するかどうか」以外の目的では扱わない。
// console.log しない・URLに載せない・state.sync 以外に保存しない。

import { generatePassphrase, normalizePassphrase, householdIdFromPassphrase } from "../sync-logic.js";
import { isConfigured, pushAll, stopSync } from "../sync.js";
import { defaultState, SHARED_KEYS } from "../state.js";
import { $, $$, esc } from "./render.js";

// 「さくら・つばめ・ひかり・やま・4172」の形(単語4つ+区切り+4桁数字)かどうかの
// ゆるい形式チェック。normalizePassphrase() で表記ゆれを吸収した後にこれへ通す。
// 実際にWORDSに載っている単語かどうかまでは見ない(合言葉の単語リストは非公開情報
// ではなく、形式さえ合っていればhouseholdIdFromPassphraseで一意なIDを導出できるため)。
const PASSPHRASE_SHAPE_RE = /^[^\s・]+・[^\s・]+・[^\s・]+・[^\s・]+・\d{4}$/;

const STATUS_LABELS = {
  live: "同期中 ✓",
  connecting: "接続中…",
  error: "同期エラー(この端末の中では引き続き使えます)",
};

// 合言葉を隠すか表示するか(この端末のこの画面を開いている間だけのエフェメラルな値。
// state には持たない。procedures.js の検索語と同じ扱い)。
let passphraseRevealed = false;

// ── 表示 ─────────────────────────────────────────────────────────────────

function statusStyle(phase) {
  if (phase === "error") return ' style="border-color:#e2a9a2;background:var(--danger-wash);color:var(--danger)"';
  if (phase === "connecting" || phase === "off") return ' style="border-color:#dcb37a;background:var(--amber-wash);color:var(--amber)"';
  return ' style="background:var(--pine-wash);color:var(--pine-deep)"'; // live
}

function renderNotConfigured() {
  return `
    <div class="empty-state">
      <p class="empty-icon" aria-hidden="true">共</p>
      <h2>共有機能は未設定です</h2>
      <p><code>docs/firebase-setup.md</code> の手順で設定すると、家族との共有を無料で使えるようになります(クレジットカードの登録は不要です)。設定するまでは、この端末の中だけにデータが保存されます。</p>
    </div>`;
}

function renderOff() {
  return `
    <div class="card" style="padding:18px 17px;">
      <p>合言葉を使うと、家族カード・持ち出し品・保険メモなどを、家族のほかの端末とも同じ内容で見られるようになります。実名の登録やアカウント作成は必要ありません。</p>
      <div class="card-actions">
        <button type="button" class="primary compact" data-share-create>家族グループを作る</button>
        <button type="button" class="secondary compact" data-share-join>合言葉で参加</button>
      </div>
    </div>`;
}

function renderOn(ctx, state) {
  const status = ctx.getSyncStatus();
  const label = STATUS_LABELS[status.phase] ?? "接続中…";
  const offlineNote = navigator.onLine
    ? ""
    : `<p class="section-note">オフラインです。電波が届くと自動的に同期します。</p>`;
  const passphrase = state.sync.passphrase ?? "";
  const shown = passphraseRevealed
    ? esc(passphrase)
    : "隠しています(下のボタンで表示できます)";

  return `
    <div class="card" style="padding:18px 17px;">
      <p><span class="share-status"${statusStyle(status.phase)}>${esc(label)}</span></p>
      ${offlineNote}
      <p class="section-note" style="margin-top:14px;">合言葉</p>
      <p class="passphrase-display">${shown}</p>
      <button type="button" class="secondary compact" data-toggle-passphrase>${passphraseRevealed ? "隠す" : "合言葉を表示する"}</button>
      <p class="form-note">合言葉を知っている人は誰でもこの家族グループの内容を見られます。家族以外には伝えないでください。</p>
      <div class="card-actions">
        <button type="button" class="danger" data-share-stop>共有をやめる</button>
      </div>
    </div>`;
}

function renderShareSection(ctx) {
  const box = $("#share-section");
  if (!box) return;
  const state = ctx.getState();
  if (!isConfigured()) {
    box.innerHTML = renderNotConfigured();
    return;
  }
  if (!state.sync.enabled) {
    box.innerHTML = renderOff();
    return;
  }
  box.innerHTML = renderOn(ctx, state);
}

export function render(ctx) {
  renderShareSection(ctx);
}

// ── フォームのエラー表示リセット(他UIモジュールと同じ形) ──────────────

function clearFormErrors(form) {
  for (const slot of $$("[data-error]", form)) slot.textContent = "";
  for (const input of $$("input,select,textarea", form)) input.removeAttribute("aria-invalid");
  $(".form-error", form)?.classList.add("hidden");
}

// ── 世帯データのうち共有対象(SHARED_KEYS)だけを既定値へ戻す ────────────
// 「世帯のデータで置き換える」で参加するとき、ローカルの古い内容がmergeEntitiesで
// 生き残らないよう、リモートからの反映を受け取る前にいったん空にしておく。
// shopping・mode・ui などの端末専用データはそのまま残す。
function resetSharedData(state) {
  const base = defaultState();
  const reset = {};
  for (const key of SHARED_KEYS) reset[key] = base[key];
  return { ...state, ...reset };
}

// ── 世帯を作る ───────────────────────────────────────────────────────────

async function handleCreate(ctx) {
  try {
    const state = ctx.getState();
    const passphrase = generatePassphrase();
    const householdId = await householdIdFromPassphrase(passphrase);

    // 今の端末の内容を先にアップロードしてから購読を始める(brief記載の順序)。
    // pushAllはfire-and-forgetなのでawaitしない。
    pushAll(householdId, state);
    ctx.startSync(householdId).catch(() => {});

    const next = { ...state, sync: { enabled: true, passphrase, householdId } };
    if (!ctx.commit(next, { success: null })) return;

    passphraseRevealed = false;
    $("#share-passphrase").textContent = passphrase;
    ctx.openDialog("share-create-dialog");
  } catch {
    ctx.notice("家族グループの作成に失敗しました。もう一度お試しください。", true);
  }
}

// ── 合言葉で参加する ─────────────────────────────────────────────────────

function openJoinDialog(ctx) {
  const form = $("#share-join-form");
  form.reset();
  clearFormErrors(form);
  ctx.openDialog("share-join-dialog");
}

async function submitJoinForm(ctx, event) {
  event.preventDefault();
  const form = event.target;
  const normalized = normalizePassphrase(form.elements.passphrase.value);

  if (!PASSPHRASE_SHAPE_RE.test(normalized)) {
    ctx.fillErrors(form, {
      valid: false,
      errors: { passphrase: "合言葉の形式が正しくありません。例: さくら・つばめ・ひかり・やま・4172" },
    });
    return;
  }

  let householdId;
  try {
    householdId = await householdIdFromPassphrase(normalized);
  } catch {
    ctx.fillErrors(form, { valid: false, errors: { passphrase: "合言葉を確認できませんでした。もう一度お試しください。" } });
    return;
  }

  const mergeMode = form.elements.mergeMode.value === "replace" ? "replace" : "merge";
  const state = ctx.getState();
  const base = mergeMode === "replace" ? resetSharedData(state) : state;
  const next = { ...base, sync: { enabled: true, passphrase: normalized, householdId } };

  const ok = ctx.commitForm(form, next, {
    success: "家族グループに参加しました。少し待っても家族の内容が表示されない場合は、合言葉を確認してください。",
  });
  if (!ok) return;

  // 合流する場合だけ、この端末にあったデータを世帯へ送る(置き換える場合は
  // ローカルをすでに空にしているので送るものがなく、リモートからの反映を待つだけでよい)。
  if (mergeMode === "merge") pushAll(householdId, next);
  ctx.startSync(householdId).catch(() => {});
  passphraseRevealed = false;
}

// ── 共有をやめる ─────────────────────────────────────────────────────────

function handleStop(ctx) {
  ctx.confirmAction(
    "共有をやめますか？",
    "この端末に保存されているデータはそのまま残ります。あとでもう一度、合言葉を使って参加できます。",
    "共有をやめる",
    () => {
      stopSync();
      const state = ctx.getState();
      const next = { ...state, sync: { enabled: false, passphrase: null, householdId: null } };
      ctx.commit(next, { success: "共有をやめました。データは端末に残っています。" });
      passphraseRevealed = false;
    }
  );
}

// ── 合言葉の表示・非表示 ─────────────────────────────────────────────────

function toggleReveal(ctx) {
  passphraseRevealed = !passphraseRevealed;
  renderShareSection(ctx);
  $("[data-toggle-passphrase]")?.focus();
}

// ── bind(ctx) ────────────────────────────────────────────────────────────

export function bind(ctx) {
  const box = $("#share-section");

  box.addEventListener("click", event => {
    if (event.target.closest("[data-share-create]")) return handleCreate(ctx);
    if (event.target.closest("[data-share-join]")) return openJoinDialog(ctx);
    if (event.target.closest("[data-toggle-passphrase]")) return toggleReveal(ctx);
    if (event.target.closest("[data-share-stop]")) return handleStop(ctx);
  });

  $("#share-join-form").addEventListener("submit", event => submitJoinForm(ctx, event));

  $("#copy-passphrase").addEventListener("click", async () => {
    const text = $("#share-passphrase").textContent;
    try {
      await navigator.clipboard.writeText(text);
      ctx.notice("合言葉をコピーしました。");
    } catch {
      ctx.notice("コピーできませんでした。合言葉をドラッグして選択し、コピーしてください。", true);
    }
  });

  // 状態インジケーターの「オフラインです」注記はネットワークの復帰・切断でも
  // 即座に更新する(commitやリモート受信を待たない)。#share-section だけを
  // 差し替えるローカル再描画で十分なので ctx.render() は使わない。
  window.addEventListener("online", () => renderShareSection(ctx));
  window.addEventListener("offline", () => renderShareSection(ctx));
}
