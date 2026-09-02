// キャッシュバージョン: デプロイのたびに必ず番号を上げること。
// 上げ忘れると古いservice workerが古いモジュールをオフラインで配信し続け、
// ユーザーが更新後のコードを一切受け取れなくなる(このプロジェクトを一度苦しめた種類のバグ)。
const CACHE = "dhb-v2";

const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./js/main.js",
  "./js/state.js",
  "./js/validate.js",
  "./js/derive.js",
  "./js/sync.js",
  "./js/sync-logic.js",
  "./js/firebase-config.js",
  "./js/data/hazards.js",
  "./js/data/procedures.js",
  "./js/data/stock-guide.js",
  "./js/ui/render.js",
  "./js/ui/home.js",
  "./js/ui/procedures.js",
  "./js/ui/supplies.js",
  "./js/ui/family.js",
  "./js/ui/emergency.js",
  "./js/ui/share.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      // { cache: "reload" } でHTTPキャッシュを迂回する。これがないと、バージョンを
      // 上げてもブラウザのHTTPキャッシュに残った古い応答をそのままservice worker
      // キャッシュへ焼き直してしまい、バージョン更新自体が無効化されうる(レビュー指摘)。
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);

  // Firestore通信はservice workerを一切通さない。Firestoreは自前でオフライン永続化を
  // 管理しており、途中でservice workerが応答をキャッシュ・改変すると壊れる。
  // endsWith("googleapis.com")だけだと"evilgoogleapis.com"のような偽ホストも素通りして
  // しまう(レビュー指摘)。firestore.googleapis.com自身か、"."を挟んだサブドメインだけを通す。
  if (url.hostname === "firestore.googleapis.com" || url.hostname.endsWith(".googleapis.com")) return;

  // Firebase SDK本体(gstatic)は事前キャッシュしない(未設定アプリは外部リクエストゼロを保つ)が、
  // 一度使われたら共有機能をオフラインでも動かせるよう、cache-first + 取得結果を保存する。
  if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        // 失敗レスポンス(4xx/5xx)をキャッシュに残すと、次回以降オフラインでも
        // ずっとそのエラーを配り続けてしまう(レビュー指摘)。okのときだけ保存する。
        if (res.ok) c.put(e.request, res.clone());
        return res;
      })
    );
    return;
  }

  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(
        (hit) =>
          hit ||
          fetch(e.request)
            .then((res) => {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(e.request, copy));
              return res;
            })
            .catch(() => caches.match("./index.html"))
      )
    );
  }
});
