// Firebase Webアプリ設定。null のあいだ、家族共有はOFFのまま
// (アプリは端末内データだけで全機能が動く。外部通信は一切発生しない)。
//
// 有効にする手順は docs/firebase-setup.md に記載する(無料のSparkプラン固定・
// クレジットカード登録なし)。設定するときは、この null を
// { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId }
// のオブジェクトへ差し替える。ここの値は公開識別子でありシークレットではない
// (アクセス制御はFirestoreセキュリティルールが担う)。
export const firebaseConfig = null;
