import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { documentProvenance, draftProvenance } from "../../apps/web/src/lib/reasonerProvenance";

afterEach(() => vi.unstubAllGlobals());
const TEXT = "Nach dem Anfahren zehn Sekunden warten, dann die Pumpe entlüften.";

/**
 * Der AUSGELIEFERTE W6-Weg, aus `taskpane.html` geschnitten und ausgeführt — kein zweiter Quelltext.
 * `bindung` stellt `klaraS4Header` so, wie das Fenster es zur Laufzeit tut; ohne Angabe gibt es die
 * Funktion nicht (der Zustand vor `POST /api/klara/sessions`).
 */
type W6Weg = (
  grund: string,
  leseText: () => string,
  fetchFn: (url: string, init: RequestInit) => Promise<unknown>,
  sprache: string,
) => Promise<unknown>;
function w6Weg(bindung?: Record<string, string>): W6Weg {
  const html = readFileSync("apps/web/public/word-addin/taskpane.html", "utf8");
  const start = html.indexOf("    function w6DublettenAusCheckText(");
  const end = html.indexOf("    // KW-KLARA-W6-CHECKTEXT-END", start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const kopf = bindung ? "function klaraS4Header() { return kopfzeilenDerBindung; }" : "";
  return new Function(
    "kopfzeilenDerBindung",
    `var W6_HOECHSTZEICHEN=8000; var W6_MINDESTZEICHEN=40; ${kopf} ${html.slice(start, end)}; return w6DublettenAusCheckText;`,
  )(bindung) as W6Weg;
}
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
  // ================================================================================================
  // NACHGEFÜHRT (JOB 3243 R2, Pflichtlieferung 6): DER WORD-WEG IST ANGESCHLOSSEN.
  // ================================================================================================
  //
  // JOB 3244 hat diesen Fall auf den Rumpf VOR dem W6-Anschluss gepinnt und in seiner Rückgabe als
  // REST benannt: „taskpane.html ist nicht Zielpfad". JOB 3243 ist genau dieser Anschluss — der Weg
  // sendet jetzt den Marker `nichtEingestuft: true` und, NUR bei vollständiger Klara-Bindung, die
  // drei Kopfzeilen, die `klaraBindungVorhanden` (ask-routes.ts:214-220) liest.
  //
  // DIE MESSUNG IST NICHT ABGESCHWÄCHT, SONDERN VERDOPPELT: sie pinnt weiterhin den Rumpf FELD FÜR
  // FELD (`toEqual`, kein `toMatchObject`) und prüft dieselben zwei Zusagen wie zuvor — keine
  // Einstufung (`confidentiality` fehlt), kein `want: "deep"`. Neu ist der Marker im Rumpf, und neu
  // sind BEIDE Kopfzeilen-Lagen: ohne aufgelöste Klara-Sitzung reist keine Bindung mit (der Kopf
  // ist byteweise der von JOB 3093), mit ihr genau die drei benannten. Was der Server daraus macht,
  // misst `zustimmung.test.ts` am echten Router; hier steht nur, was WIRKLICH abgeht.
  it("Word: der ausgeführte Dublettenweg sendet keine Einstufung, kein deep, aber den Marker", async () => {
    const bodies: Record<string, unknown>[] = [];
    const koepfe: Record<string, unknown>[] = [];
    // OHNE Klara-Sitzung: `klaraS4Header` gibt es im geschnittenen Block nicht.
    await w6Weg()(
      "markiert",
      () => TEXT,
      async (url: string, init: RequestInit) => {
        expect(url).toBe("/api/check-text");
        expect(init.method).toBe("POST");
        koepfe.push(init.headers as Record<string, unknown>);
        bodies.push(JSON.parse(String(init.body)));
        return { ok: true, json: async () => ({ duplicates: [] }) };
      },
      "de",
    );
    expect(bodies).toEqual([
      { text: TEXT, locale: "de", source: "transient-document", nichtEingestuft: true },
    ]);
    expect(koepfe).toEqual([{ "content-type": "application/json" }]);

    // MIT vollständiger Klara-Bindung: dieselbe Funktion, dieselbe Nutzlast, drei Kopfzeilen mehr.
    const bindung = {
      "x-klara-session": "sess-3243",
      "x-klara-instance": "inst-3243",
      "x-klara-document": "doc-3243",
    };
    await w6Weg(bindung)(
      "markiert",
      () => TEXT,
      async (_url: string, init: RequestInit) => {
        koepfe.push(init.headers as Record<string, unknown>);
        bodies.push(JSON.parse(String(init.body)));
        return { ok: true, json: async () => ({ duplicates: [] }) };
      },
      "de",
    );
    expect(bodies[1]).toEqual(bodies[0]);
    expect(koepfe[1]).toEqual({ "content-type": "application/json", ...bindung });

    // GEGENPROBE ZUR VOLLSTÄNDIGKEIT: eine halbe Bindung (nur die Instanz-Id, die es seit dem Laden
    // des Fensters gibt) trägt keine Zustimmung und reist deshalb NICHT mit.
    await w6Weg({ "x-klara-session": "", "x-klara-instance": "inst-3243", "x-klara-document": "" })(
      "markiert",
      () => TEXT,
      async (_url: string, init: RequestInit) => {
        koepfe.push(init.headers as Record<string, unknown>);
        return { ok: true, json: async () => ({ duplicates: [] }) };
      },
      "de",
    );
    expect(koepfe[2]).toEqual({ "content-type": "application/json" });
    console.info(
      "Word W6: 3/3 Rümpfe ohne confidentiality und ohne want:deep, 3/3 mit Marker; Klara-Kopfzeilen 1/3 (nur vollständige Bindung).",
    );
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
