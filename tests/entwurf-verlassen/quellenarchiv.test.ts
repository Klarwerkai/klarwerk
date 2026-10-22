import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { expect, it } from "vitest";
import { gegenprobeQuellbytes } from "./gegenprobe-bf9fcf1c";

it("erhält die Originalbytes des großen Gegenbelegs außerhalb des Testkollektors", () => {
  const compressed = readFileSync(
    join(__dirname, "../../fixtures/entwurf-verlassen/gegenprobe-bf9fcf1c-quellen.patch.gz"),
  );
  const raw = gunzipSync(compressed);
  expect(raw.length).toBe(17289686);
  expect(createHash("sha256").update(raw).digest("hex")).toBe(
    "059bbdd194248f460124d887a0057c19f881dbfe390bc50c7fac6874d25853c5",
  );
  expect(gegenprobeQuellbytes().equals(raw)).toBe(true);
  expect(() => gunzipSync(compressed.subarray(0, compressed.length - 10))).toThrow();
});
