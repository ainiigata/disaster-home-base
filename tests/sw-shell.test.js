// レビュー指摘(Important 5)の回帰テスト。
//
// sw.js の SHELL 配列は「オフラインでもアプリが起動する」というこのアプリの中心的な
// 約束を支えている。しかし SHELL は手書きの静的リストなので、新しいJSモジュールを
// 追加してもSHELLへ足し忘れれば、そのモジュールはオフライン時に読み込めなくなる
// (=最初のオフライン起動で気づかれずアプリが壊れる)。
//
// このテストは index.html の <link href>/<script src> のローカル参照を起点に、
// js/ 以下の相対 import/from 指定子を再帰的にたどって「実際に読み込まれるファイル」の
// 集合を求め、sw.js から取り出した SHELL と集合として一致するかを検証する。
// 依存追加・バンドラー不可の制約に沿って node:fs/node:path と正規表現だけで組む。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = rel => readFileSync(path.join(ROOT, rel), "utf8");

// sw.js の "const SHELL = [ ... ];" ブロックだけを取り出し、中の文字列リテラルを集める。
function parseShell() {
  const sw = read("sw.js");
  const block = sw.match(/const SHELL = \[([\s\S]*?)\];/);
  assert.ok(block, "sw.jsにSHELL配列が見つからない");
  const items = [...block[1].matchAll(/["']([^"']+)["']/g)].map(m => m[1]);
  assert.ok(items.length > 0, "SHELLが空になっている");
  return items;
}

// <link href="..."> / <script src="..."> のうち、http(s)を含まないローカル参照だけを拾う。
function localRefsFromHtml() {
  const html = read("index.html");
  const refs = [];
  for (const m of html.matchAll(/<(?:link|script)\b[^>]*?(?:href|src)="([^"]+)"[^>]*>/g)) {
    const ref = m[1];
    if (!/^https?:\/\//.test(ref)) refs.push(ref);
  }
  return refs;
}

// manifest.webmanifest自身もindex.htmlからリンクされているローカル資産の一部なので、
// そこに列挙されたアイコンも「index.htmlから辿れる参照」に含める。
function iconsFromManifest() {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  return (manifest.icons ?? []).map(icon => icon.src);
}

// 相対パス(./x や ../x)を、appルートから見た "./a/b.js" 形式に正規化する。
function toShellPath(fromDir, ref) {
  const abs = path.posix.normalize(path.posix.join(fromDir, ref));
  return `./${abs.replace(/^\.?\/*/, "")}`;
}

// jsファイル1つから、相対specifierのimport/fromを正規表現で拾う(動的import含む)。
// 動的importでも "https://..." のような絶対URL(sync.jsのFirebase SDK読み込み等)は
// 対象外(相対でないため自然に除外される)。
function importsOf(shellPath) {
  const abs = path.join(ROOT, shellPath.slice(2));
  const src = readFileSync(abs, "utf8");
  const specs = new Set();
  for (const m of src.matchAll(/\bfrom\s+["']([^"']+)["']/g)) specs.add(m[1]);
  for (const m of src.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) specs.add(m[1]);
  return [...specs].filter(s => s.startsWith("./") || s.startsWith("../"));
}

function transitiveJsClosure(entryShellPath) {
  const seen = new Set([entryShellPath]);
  const queue = [entryShellPath];
  while (queue.length) {
    const current = queue.pop();
    const dir = path.posix.dirname(current);
    for (const spec of importsOf(current)) {
      const resolved = toShellPath(dir, spec);
      if (!seen.has(resolved)) {
        seen.add(resolved);
        queue.push(resolved);
      }
    }
  }
  return seen;
}

test("sw.jsのSHELLは、index.htmlの参照+jsのimportグラフと過不足なく一致する", () => {
  const shell = new Set(parseShell());

  const htmlRefs = localRefsFromHtml().map(ref => toShellPath(".", ref));
  const expected = new Set(htmlRefs);
  // SW自身のスタートURL(manifestのstart_url/scopeと同じ"./")と、それが実際に配信する
  // 実体である"./index.html"は、index.htmlの<link>/<script>としては現れない
  // (ナビゲーションのエントリーポイントそのものかその別名のため)が、どちらも
  // オフラインで成立する必要があるSHELLの必須要素。
  expected.add("./");
  expected.add("./index.html");
  for (const iconRef of iconsFromManifest()) expected.add(toShellPath(".", iconRef));

  // <script type="module" src="...">を起点にjsの依存グラフをたどる。
  for (const ref of htmlRefs) {
    if (ref.endsWith(".js")) {
      for (const resolved of transitiveJsClosure(ref)) expected.add(resolved);
    }
  }

  const missingFromShell = [...expected].filter(x => !shell.has(x)).sort();
  const extraInShell = [...shell].filter(x => !expected.has(x)).sort();

  assert.deepEqual(missingFromShell, [], `SHELLに足りない: ${missingFromShell.join(", ")}`);
  assert.deepEqual(extraInShell, [], `SHELLに不要: ${extraInShell.join(", ")}`);
});
