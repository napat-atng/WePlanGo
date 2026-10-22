import test from "node:test";
import assert from "node:assert/strict";
import { formatThaiDate } from "./thai-date.ts";

test("Thai dates use Buddhist years without shifting calendar days", () => {
  assert.equal(formatThaiDate("2026-10-22"), "22 ตุลาคม 2569");
  assert.equal(formatThaiDate("2028-02-29"), "29 กุมภาพันธ์ 2571");
  assert.equal(formatThaiDate("2026-12-31T23:59"), "31 ธันวาคม 2569");
  assert.equal(formatThaiDate("2027-01-01"), "1 มกราคม 2570");
});
