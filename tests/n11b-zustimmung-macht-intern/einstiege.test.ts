import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { documentProvenance, draftProvenance } from "../../apps/web/src/lib/reasonerProvenance";

afterEach(() => vi.unstubAllGlobals());
const TEXT = "Nach dem Anfahren zehn Sekunden warten, dann die Pumpe entlüften.";
describe("N11b: Messung der ausgelieferten Anfrage-Rümpfe", () => {
  it("Web: beide Helfer erreichen den Versand mit gewaschenem vertraulich", async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ text: TEXT, demo: true }));
    });
    for (const provenance of [draftProvenance(undefined), documentProvenance(undefined)]) {
      await endpoints.reasoner.assist(TEXT, "de", undefined, provenance);
    }
    expect(bodies).toHaveLength(2);
    for (const body of bodies) {
      expect(body.confidentiality).toBe("vertraulich");
      expect(body.nichtEingestuft).toBe(true);
    }
    console.info('Web: 2/2 Rümpfe confidentiality="vertraulich", 2/2 Marker (endpoints.ts).');
  });
  it("Word: der ausgeführte Dublettenweg sendet keine Einstufung und kein deep", async () => {
    const html = readFileSync("apps/web/public/word-addin/taskpane.html", "utf8");
    const start = html.indexOf("    function w6DublettenAusCheckText(");
    const end = html.indexOf("    // KW-KLARA-W6-CHECKTEXT-END", start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const run = new Function(
      `var W6_HOECHSTZEICHEN=8000; var W6_MINDESTZEICHEN=40; ${html.slice(start, end)}; return w6DublettenAusCheckText;`,
    )();
    const bodies: Record<string, unknown>[] = [];
    await run(
      "markiert",
      () => TEXT,
      async (url: string, init: RequestInit) => {
        expect(url).toBe("/api/check-text");
        expect(init.method).toBe("POST");
        expect(init.headers).toEqual({ "content-type": "application/json" });
        bodies.push(JSON.parse(String(init.body)));
        return { ok: true, json: async () => ({ duplicates: [] }) };
      },
      "de",
    );
    expect(bodies).toEqual([{ text: TEXT, locale: "de", source: "transient-document" }]);
    console.info("Word W6: 1/1 Rumpf ohne confidentiality, ohne want:deep, ohne Klara-Kopfzeilen.");
  });
  it("Word KA7: der separate Konfliktabruf sendet deep und intern, keine Klara-Kopfzeilen", async () => {
    const html = readFileSync("apps/web/public/word-addin/taskpane.html", "utf8");
    const start = html.indexOf("    function ka7Pruefen()");
    const end = html.indexOf("    /** Ein bestaetigter Logout", start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const bodies: Record<string, unknown>[] = [];
    // Nur die Voraussetzungen/Anzeige sind eingesetzt; ausgeführt wird der originale Versand.
    await new Promise<void>((resolve) => {
      new Function(
        "fetch",
        "text",
        "fertig",
        `
        var ka7Laeuft=false, ka7Generation=0, W6_HOECHSTZEICHEN=8000, W6_MINDESTZEICHEN=40, lang="de";
        function ka7MarkierungLesen(cb) { cb(text); }
        function ka7ExterneKi() { return { lage: "erlaubt" }; }
        function ka7VorherFuer() { return null; }
        function ka7Setzen(s) { if (s.lage !== "laeuft") fertig(); }
        function deriveDraftTitleFromSelection() { return "Pumpe"; }
        function askLocale(l) { return l; }
        function ka7Uebersetzen() { return { lage: "leer" }; }
        ${html.slice(start, end)}
        ka7Pruefen();
      `,
      )(
        async (url: string, init: RequestInit) => {
          expect(url).toBe("/api/check-text");
          expect(init.method).toBe("POST");
          expect(init.headers).toEqual({ "content-type": "application/json" });
          bodies.push(JSON.parse(String(init.body)));
          return { ok: true, json: async () => ({ conflicts: [] }) };
        },
        TEXT,
        resolve,
      );
    });
    expect(bodies).toEqual([
      {
        text: TEXT,
        title: "Pumpe",
        locale: "de",
        want: "deep",
        source: "transient-document",
        confidentiality: "intern",
      },
    ]);
    console.info(
      'Word KA7: 1/1 Rumpf want="deep", confidentiality="intern", ohne Klara-Kopfzeilen.',
    );
  });
});
