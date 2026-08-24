// UIモジュール共通の描画ヘルパーだけを置く。ここに画面固有の描画は書かない。

// innerHTMLへ値を差し込む前に必ず通す。undefined/nullは空文字になる。
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

export const $ = (selector, root = document) => root.querySelector(selector);

export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
