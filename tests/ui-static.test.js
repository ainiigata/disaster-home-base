import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("必須要素IDがそろっている", () => {
  for (const id of ["view-home","view-emergency","view-supplies","view-procedures","view-family",
    "emergency-open","hazard-dialog","supply-dialog","location-dialog","family-dialog",
    "household-dialog","confirm-dialog","share-create-dialog","share-join-dialog","notice"])
    assert.ok(html.includes(`id="${id}"`), id);
});
test("PWA・アクセシビリティの基本", () => {
  assert.ok(html.includes('rel="manifest"'));
  assert.ok(html.includes('lang="ja"'));
  assert.ok(html.includes("skip-link"));
});
test("公的指示優先の文言・TODOなし", () => {
  assert.ok(html.includes("公的な指示を優先"));
  assert.ok(!/TODO|FIXME|placeholder/.test(html));
});
