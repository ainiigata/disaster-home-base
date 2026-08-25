// sync.js — Firebase(Firestore + 匿名Auth)との送受信だけを担当するトランスポート層。
// DOM・app状態(state.js)には一切触れない。ここで扱う値はFirestoreへ出入りする
// 生データそのもの(サニタイズ前)であり、それを検証してstateへ取り込むのはmain.jsの仕事。
//
// firebase-config.js が null のあいだは isConfigured() が常にfalseを返し、以降の
// すべてのexport関数は早期returnしてFirebase SDKのdynamic importにすら到達しない
// (=ネットワークに一切触れない)。これがこのファイルの一番大事な性質。
//
// 合言葉(passphrase)そのものはこのファイルに一切渡らない。渡ってくるのは
// householdIdFromPassphrase() で導出済みの64桁16進数のhouseholdIdだけ。

import { firebaseConfig } from "./firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.5";

// kind(アプリ内の呼び名) → Firestoreのコレクション名。familyMembers だけ名前が違う。
const COLLS = { supplies: "supplies", locations: "locations", familyMembers: "members" };

let fb = null; // { db, fs } 一度確立したら使い回す
let fbPromise = null; // initializeApp/signInAnonymously の二重実行を防ぐための共有Promise
let unsubs = []; // onSnapshot の unsubscribe関数の配列
let status = { phase: "off", error: null }; // "off" | "connecting" | "live" | "error"
let statusCb = null;

export function isConfigured() {
  return Boolean(firebaseConfig?.apiKey);
}

function setStatus(patch) {
  status = { ...status, ...patch };
  statusCb?.(status);
}

async function initFirebase() {
  const [appM, authM, fsM] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  const app = appM.initializeApp(firebaseConfig);
  const db = fsM.initializeFirestore(app, {
    localCache: fsM.persistentLocalCache({ tabManager: fsM.persistentMultipleTabManager() }),
  });
  await authM.signInAnonymously(authM.getAuth(app));
  fb = { db, fs: fsM };
  return fb;
}

// SDKの読み込みと匿名認証は一度だけ行う。startSync/pushEntity等が同時に呼ばれても
// initializeApp が多重実行されないようPromiseを共有し、失敗時はfbPromiseを捨てて
// 次の呼び出しで再試行できるようにする。
function ensureFirebase() {
  if (fb) return Promise.resolve(fb);
  if (!fbPromise) {
    fbPromise = initFirebase().catch(err => {
      fbPromise = null;
      throw err;
    });
  }
  return fbPromise;
}

function stopListeners() {
  unsubs.forEach(unsub => unsub());
  unsubs = [];
}

function reportError(err) {
  setStatus({ phase: "error", error: err?.code ?? String(err) });
}

/**
 * households/{hid} 配下のsupplies/locations/members(全件)と
 * shared/insurance・shared/household(単一ドキュメント)をリアルタイム購読する。
 * 呼ぶたびに前回の購読を止めてから張り直す(多重購読を防ぐ)。
 *
 * onRemoteCollection(kind, upserts, removedIds): kindは"supplies"|"locations"|"familyMembers"。
 * onRemoteShared(kind, data): kindは"insurance"|"household"。
 * onStatus(status): { phase: "off"|"connecting"|"live"|"error", error }。
 *
 * 未設定(isConfigured()===false)のときは何もせず、SDKのdynamic importにも触れない。
 */
export async function startSync(hid, { onRemoteCollection, onRemoteShared, onStatus } = {}) {
  statusCb = onStatus ?? null;

  if (!isConfigured() || !hid) {
    setStatus({ phase: "off", error: null });
    return;
  }

  setStatus({ phase: "connecting", error: null });

  let db, fs;
  try {
    ({ db, fs } = await ensureFirebase());
  } catch (err) {
    reportError(err);
    return;
  }

  stopListeners();

  for (const [kind, coll] of Object.entries(COLLS)) {
    unsubs.push(
      fs.onSnapshot(
        fs.collection(db, "households", hid, coll),
        snap => {
          const removed = [];
          const upserts = [];
          snap.docChanges().forEach(change => {
            if (change.type === "removed") removed.push(change.doc.id);
            else upserts.push({ id: change.doc.id, ...change.doc.data() });
          });
          if (upserts.length || removed.length) onRemoteCollection?.(kind, upserts, removed);
          setStatus({ phase: "live" });
        },
        reportError
      )
    );
  }

  for (const kind of ["insurance", "household"]) {
    unsubs.push(
      fs.onSnapshot(
        fs.doc(db, "households", hid, "shared", kind),
        snap => {
          if (snap.exists()) onRemoteShared?.(kind, snap.data());
          setStatus({ phase: "live" });
        },
        reportError
      )
    );
  }
}

// ── 送信(いずれもfire-and-forget。呼び出し側はawaitしない。失敗は.catchでstatusへ) ──

export function pushEntity(hid, kind, entity) {
  const coll = COLLS[kind];
  if (!isConfigured() || !hid || !coll || !entity?.id) return;
  ensureFirebase()
    .then(({ db, fs }) => fs.setDoc(fs.doc(db, "households", hid, coll, entity.id), entity))
    .catch(reportError);
}

export function removeEntity(hid, kind, id) {
  const coll = COLLS[kind];
  if (!isConfigured() || !hid || !coll || !id) return;
  ensureFirebase()
    .then(({ db, fs }) => fs.deleteDoc(fs.doc(db, "households", hid, coll, id)))
    .catch(reportError);
}

export function pushShared(hid, kind, data) {
  if (!isConfigured() || !hid || !data) return;
  ensureFirebase()
    .then(({ db, fs }) => fs.setDoc(fs.doc(db, "households", hid, "shared", kind), data))
    .catch(reportError);
}

// state(household/supplies/locations/familyMembers/insurance)をまるごとFirestoreへ書く。
// 世帯作成時の初回アップロードと、「合流する」で参加したときのローカル分アップロードに使う。
export function pushAll(hid, state) {
  if (!isConfigured() || !hid || !state) return;
  ensureFirebase()
    .then(async ({ db, fs }) => {
      const writes = [];
      for (const [kind, coll] of Object.entries(COLLS)) {
        for (const entity of state[kind] ?? []) {
          writes.push(fs.setDoc(fs.doc(db, "households", hid, coll, entity.id), entity));
        }
      }
      writes.push(fs.setDoc(fs.doc(db, "households", hid, "shared", "insurance"), state.insurance));
      writes.push(fs.setDoc(fs.doc(db, "households", hid, "shared", "household"), state.household));
      writes.push(
        fs.setDoc(
          fs.doc(db, "households", hid, "shared", "meta"),
          { createdAt: Date.now(), schemaVersion: 2 },
          { merge: true }
        )
      );
      await Promise.all(writes);
    })
    .catch(reportError);
}

export function stopSync() {
  stopListeners();
  setStatus({ phase: "off", error: null });
  statusCb = null;
}
