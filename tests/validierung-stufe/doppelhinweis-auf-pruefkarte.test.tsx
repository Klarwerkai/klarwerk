// @vitest-environment jsdom
// ================================================================================================
// JOB 3112 · V3 · TEST 8 — DER PAARHINWEIS AUF DER PRÜFKARTE, MIT SEINEN VIER ZUSTÄNDEN.
// ================================================================================================
//
// 2623 D1 §2 Punkt 3: „Wer validiert, soll sehen, dass es ein zweites Exemplar gibt, statt eines
// von beiden zu bearbeiten und sich zu wundern." Codex, R-0994 offene_punkte[2]: „Auf der Prüfkarte
// fehlt der konkrete Paarhinweis."
//
// DIE ZWEITE HÄLFTE DIESES TESTS IST DIE WICHTIGERE: der Hinweis ist eine DATENAUSSAGE und trägt
// deshalb die volle Härte des Zustandsmodells. Ohne Antwort steht nichts da; bei leerer Antwort
// steht AUCH nichts da (kein „keine Dublette" — `/api/duplicates` liefert nur die für diesen
// Betrachter sichtbaren Paare, `overlap-routes.ts:59`, und sichert keine Vollständigkeit zu); und
// ein Fehler dort nimmt die Karte nicht weg.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stand = vi.hoisted(() => ({ rolle: "controller" }));
vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("./kulisse-mocks")).endpunktMock(),
);
vi.mock("../../apps/web/src/app/AuthContext", async (o) =>
  (await import("./kulisse-mocks")).authMock(o as never),
);
vi.mock("../../apps/web/src/app/RoleContext", async (o) =>
  (await import("./kulisse-mocks")).rolleMock(o as never, stand),
);
vi.mock("../../apps/web/src/app/ToastContext", async (o) =>
  (await import("./kulisse-mocks")).toastMock(o as never),
);

import { act } from "../../apps/web/node_modules/react";
import { type Brett, de, finde, flush, mounteBrett, paar, zeile } from "./kulisse";

let brett: Brett;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  stand.rolle = "controller";
});
afterEach(() => brett?.abbauen());

const HINWEIS = '[data-testid="pruefen-doppelhinweis"]';
const VERGLEICH = '[data-testid="pruefen-doppelhinweis-vergleich"]';
const KARTE = '[data-testid="pruefen-karte"]';

describe("JOB 3112 · P1 (a): ein offener Eintrag zu diesem Objekt wird gemeldet", () => {
  it("der Satz steht da und nennt die Beziehung — mit dem Wortlaut aus `dup.relation.*`", async () => {
    brett = await mounteBrett({
      zeilen: [zeile()],
      duplikate: [paar({ koA: "k1", koB: "k9", relation: "identisch" })],
    });

    const hinweis = finde(brett.container, HINWEIS);
    expect(hinweis, "der Paarhinweis fehlt").not.toBeNull();
    expect(hinweis?.textContent).toContain(de("dup.relation.identisch"));
  });

  it("er steht ÜBER dem Fußband und innerhalb der Karte", async () => {
    brett = await mounteBrett({ zeilen: [zeile()], duplikate: [paar()] });

    const karte = finde(brett.container, KARTE);
    const hinweis = finde(brett.container, HINWEIS);
    const fussband = finde(brett.container, '[data-testid="pruefen-fussband"]');
    expect(karte?.contains(hinweis as Node)).toBe(true);
    expect(fussband?.contains(hinweis as Node)).toBe(false);
    // Dokumentreihenfolge: der Hinweis kommt vor dem Fußband.
    expect(
      (hinweis as Node).compareDocumentPosition(fussband as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("für `controller` führt ein Weg zum Vergleich — auf die Kennung des EINTRAGS", async () => {
    brett = await mounteBrett({
      zeilen: [zeile()],
      duplikate: [paar({ id: "d42", koA: "k9", koB: "k1" })],
    });

    expect(finde(brett.container, VERGLEICH)?.getAttribute("href")).toBe(
      "/duplikate/d42/vergleich",
    );
  });

  it("bei mehr als einem Treffer nennt der Satz die Anzahl", async () => {
    brett = await mounteBrett({
      zeilen: [zeile()],
      duplikate: [
        paar({ id: "d1", koB: "k9", relation: "verwandt" }),
        paar({ id: "d2", koB: "k8", relation: "identisch" }),
      ],
    });

    const text = finde(brett.container, HINWEIS)?.textContent ?? "";
    expect(text).toContain("2");
    // Die stärkste Beziehung führt, auch wenn sie hinten in der Antwort steht.
    expect(text).toContain(de("dup.relation.identisch"));
  });

  it("der Hinweis nennt NIE Kennung oder Inhalt der Gegenseite", async () => {
    brett = await mounteBrett({
      zeilen: [zeile()],
      duplikate: [paar({ koB: "k9", eigenanteilB: "GEHEIMER GEGENTEXT" })],
    });

    const text = finde(brett.container, HINWEIS)?.textContent ?? "";
    expect(text).not.toContain("GEHEIMER GEGENTEXT");
    expect(text).not.toContain("k9");
  });
});

describe("JOB 3112 · P2 (b): der Einzelgegenfall sagt NICHTS", () => {
  it("ohne Eintrag steht kein Hinweis und kein Gegensatz-Satz im Baum", async () => {
    brett = await mounteBrett({ zeilen: [zeile()], duplikate: [] });

    expect(finde(brett.container, HINWEIS)).toBeNull();
    expect(finde(brett.container, VERGLEICH)).toBeNull();
    // Kein „keine Dublette": es gibt diesen Schlüssel nicht, und es darf ihn nicht geben.
    expect(brett.container.textContent).not.toContain(de("val.doppel.satz").split("{{")[0]);
  });

  it("ein Eintrag über ZWEI ANDERE Objekte lässt die Karte stumm", async () => {
    brett = await mounteBrett({
      zeilen: [zeile()],
      duplikate: [paar({ koA: "k7", koB: "k8" })],
    });

    expect(finde(brett.container, HINWEIS)).toBeNull();
  });

  it("ein GESCHLOSSENER Eintrag ist kein Hinweis mehr", async () => {
    brett = await mounteBrett({
      zeilen: [zeile()],
      duplikate: [paar({ status: "geschlossen" })],
    });

    expect(finde(brett.container, HINWEIS)).toBeNull();
  });
});

describe("JOB 3112 · P3 (c): ein Fehler an `/duplicates` nimmt die Karte nicht weg", () => {
  it("500 → kein Hinweis, kein Satz — und die Karte steht vollständig da", async () => {
    brett = await mounteBrett({
      zeilen: [zeile()],
      duplikate: async () => {
        throw new Error("500");
      },
    });

    expect(finde(brett.container, HINWEIS)).toBeNull();
    const karte = finde(brett.container, KARTE);
    expect(karte, "die Karte ist mit dem zweiten Abruf verschwunden").not.toBeNull();
    expect(karte?.textContent).toContain("PROBE-KO Ventilwartung");
    expect(finde(brett.container, '[data-testid="pruefen-fussband"]')).not.toBeNull();
    expect(finde(brett.container, '[data-testid="pruefen-entscheidung-up"]')).not.toBeNull();
  });
});

describe("JOB 3112 · P3b: eine gescheiterte AUFFRISCHUNG nimmt den Hinweis NICHT weg", () => {
  // Regelwerk §7, erster Spiegelstrich: „Scheitert eine Hintergrund-Auffrischung, bleiben die
  // zuletzt erfolgreich geholten Werte SICHTBAR." Für diesen Hinweis wiegt das doppelt: er ist eine
  // POSITIVE Aussage („es gibt eines"), die durch einen gescheiterten Abruf nicht falsch wird.
  // Verschwinden wäre die Entwarnung, die es nicht gibt.
  it("erst ein Treffer, dann scheitert der nächste Abruf → der Hinweis steht weiter", async () => {
    let rufe = 0;
    brett = await mounteBrett({
      zeilen: [zeile()],
      duplikate: async () => {
        rufe += 1;
        if (rufe === 1) {
          return [paar({ id: "d5", relation: "identisch" })];
        }
        throw new Error("500");
      },
    });
    expect(finde(brett.container, HINWEIS), "der erste Abruf trug schon nichts ein").not.toBeNull();

    await act(async () => {
      await brett.qc.invalidateQueries({ queryKey: ["duplicates"] });
    });
    await flush();

    expect(rufe, "die Auffrischung ist gar nicht gelaufen").toBeGreaterThan(1);
    expect(
      finde(brett.container, HINWEIS),
      "der Hinweis ist wegen eines Abrufs verschwunden",
    ).not.toBeNull();
    expect(finde(brett.container, VERGLEICH)?.getAttribute("href")).toBe("/duplikate/d5/vergleich");
  });
});

describe("JOB 3112 · P4 (d): der Vergleichsweg hängt an der Rolle, der Satz nicht", () => {
  it("`experte` liest den Satz, bekommt aber KEINEN toten Link", async () => {
    stand.rolle = "experte";
    brett = await mounteBrett({ zeilen: [zeile()], duplikate: [paar()] });

    expect(finde(brett.container, HINWEIS)).not.toBeNull();
    expect(finde(brett.container, VERGLEICH), "toter Link für eine Rolle ohne Zugang").toBeNull();
  });

  it("`admin` bekommt den Weg wie der Controller", async () => {
    stand.rolle = "admin";
    brett = await mounteBrett({ zeilen: [zeile()], duplikate: [paar({ id: "d7" })] });

    expect(finde(brett.container, VERGLEICH)?.getAttribute("href")).toBe("/duplikate/d7/vergleich");
  });
});
