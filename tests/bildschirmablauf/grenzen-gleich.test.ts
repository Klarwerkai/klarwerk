// BILDSCHIRMABLÄUFE — Server und Oberfläche führen dieselben Grenzen des Ablaufs. Der Webbuild kennt
// `services/` nicht (Dockerfile), deshalb stehen sie zweimal; dieser Fall hält sie Schlüssel für
// Schlüssel gleich (dieselbe Bauform wie `tests/capture/draft-limits-shared.test.ts`).
import { describe, expect, it } from "vitest";
import { ABLAUF_GRENZEN as WEB } from "../../apps/web/src/lib/ablaufImport";
import { ABLAUF_GRENZEN as SERVER } from "../../services/capture";

describe("Ablaufgrenzen", () => {
  it("sind in Oberfläche und Server identisch", () => {
    expect(WEB).toEqual(SERVER);
  });
});
