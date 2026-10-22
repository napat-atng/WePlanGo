import assert from "node:assert/strict";
import test from "node:test";
import { safeNextPath } from "./safe-next-path.ts";

test("keeps a local invitation path and query", () => {
  assert.equal(safeNextPath("/invite/abc_123?from=chat"), "/invite/abc_123?from=chat");
});

test("rejects external and ambiguous OAuth return URLs", () => {
  for (const value of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/%2f%2fevil.example",
    "javascript:alert(1)",
    "\n/groups",
  ]) {
    assert.equal(safeNextPath(value), "/trips");
  }
});
