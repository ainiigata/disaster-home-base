// ホーム画面: 準備率・今日やる1つ・点検リマインダー・注意カードを描画する。
// このアプリの約束(このアプリの通り行動すれば災害も怖くなくなる)を1画面に凝縮する。
// #readiness #today-action #reminder-banner #alerts の4領域だけを担当する。

import { readiness, todaysAction, reminderBanner, expiringSupplies, shortSupplies } from "../derive.js";
import { $, esc } from "./render.js";

// 達成度は色だけに頼らない(色覚・直射日光対策)。styles.css の .level-* と対で使う。
const LEVEL_LABELS = { done: "できている", almost: "あと少し", todo: "未着手" };

// "YYYY-MM-DD" -> "M月D日"。高齢の家族にも読みやすい表示にする簡易整形。
const formatMonthDay = isoDate => {
  const [, m, d] = isoDate.split("-");
  return `${Number(m)}月${Number(d)}日`;
};

function renderReadiness(state) {
  const { categories, percent } = readiness(state);

  const ring = `
    <div class="readiness-ring" style="--pct:${percent}">
      <strong>${percent}%</strong>
      <small>準備率</small>
    </div>`;

  const legend = `
    <ul class="readiness-legend">
      ${categories
        .map(
          c => `
        <li>
          <span>${esc(c.label)}</span>
          <span class="level level-${c.level}">${LEVEL_LABELS[c.level]}</span>
        </li>`
        )
        .join("")}
    </ul>`;

  $("#readiness").innerHTML = ring + legend;
}

function renderTodayAction(state) {
  const action = todaysAction(state);
  const box = $("#today-action");

  if (!action) {
    box.innerHTML = `
      <div class="today-action">
        <span class="eyebrow">今日やること</span>
        <strong>今日の備えはバッチリです</strong>
        <small>追加で必要な準備は、今のところありません。落ち着いて過ごしてください。</small>
      </div>`;
    return;
  }

  const tabAttr = action.tab ? ` data-tab="${esc(action.tab)}"` : "";
  box.innerHTML = `
    <button type="button" class="today-action" data-view="${esc(action.view)}"${tabAttr}>
      <span class="eyebrow">今日やること</span>
      <strong>${esc(action.label)}</strong>
      <small>タップして進めましょう。</small>
    </button>`;
}

function renderReminder(state) {
  const banner = reminderBanner(state);
  const box = $("#reminder-banner");

  if (!banner) {
    box.innerHTML = "";
    return;
  }

  box.innerHTML = `
    <div class="reminder-banner">
      <div>
        <strong>${esc(banner.title)}</strong>
        <p>${esc(banner.text)}</p>
      </div>
      <button type="button" class="secondary compact" data-dismiss-reminder="${esc(banner.periodKey)}">点検した</button>
    </div>`;
}

function renderAlerts(state) {
  const expiring = expiringSupplies(state);
  const short = shortSupplies(state);
  const shortCount = short.guide.length + short.manual.length;
  const box = $("#alerts");

  if (expiring.length === 0 && shortCount === 0) {
    box.innerHTML = `
      <div class="alert-card">
        <span aria-hidden="true">良</span>
        <div>
          <strong>備蓄に不足はありません</strong>
          <p>期限切れ・不足はいまのところありません。</p>
        </div>
      </div>`;
    return;
  }

  const cards = [];
  if (expiring.length > 0) {
    const nearest = expiring[0];
    cards.push(`
      <button type="button" class="alert-card warning" data-view="supplies" data-tab="rolling">
        <span aria-hidden="true">期</span>
        <div>
          <strong>期限が近い備えが${expiring.length}件あります</strong>
          <p>最短は${esc(nearest.name)}(${formatMonthDay(nearest.expiresOn)})です。入れ替えましょう。</p>
        </div>
      </button>`);
  }
  if (shortCount > 0) {
    cards.push(`
      <button type="button" class="alert-card warning" data-view="supplies" data-tab="stock">
        <span aria-hidden="true">箱</span>
        <div>
          <strong>不足している備えが${shortCount}件あります</strong>
          <p>目安量に届いていない品があります。確認しましょう。</p>
        </div>
      </button>`);
  }
  box.innerHTML = cards.join("");
}

export function bind(ctx) {
  // #reminder-banner はここで丸ごと差し替わるが、要素自体は常駐するので委譲でよい。
  $("#reminder-banner").addEventListener("click", event => {
    const button = event.target.closest("[data-dismiss-reminder]");
    if (!button) return;
    const state = ctx.getState();
    const dismissed = ctx.commit(
      { ...state, dismissedReminders: [...state.dismissedReminders, button.dataset.dismissReminder] },
      { success: null }
    );
    // ボタン(非フォーム要素)を経由するDOM先行変更はないため、失敗時も表示は
    // すでに正しい(コミット前の状態のまま)。ロールバックのrender()呼び出しは不要。
    // 成功時はバナーごと消え(空になった[data-region]はCSSで非表示)ボタンのDOMノードも
    // 失われてフォーカスがbodyへ落ちるため、見出しへ明示的に戻す。
    if (dismissed) {
      const heading = $("#home-title");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus();
      }
    }
  });
}

export function render(ctx) {
  const state = ctx.getState();
  renderReadiness(state);
  renderTodayAction(state);
  renderReminder(state);
  renderAlerts(state);
}
