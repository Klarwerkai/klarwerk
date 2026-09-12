// @vitest-environment jsdom
// ================================================================================================
// JOB 3593 · DER EIGENE ROLLBEREICH DER LISTE — in welchen Lagen es ihn gibt, und in welchen nicht.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. JOB 3593 hat der Warteschlange einen eigenen Rollbereich gegeben, damit
// beim Durchgehen der Artikel rechts im Bild bleibt (gemessen in Pixeln in
// `tests/design/job2935-validierung-fussband.test.ts`, Block L). Das ist eine SICHTBARE Änderung —
// bei mehr als rund vierzehn Einträgen steht jetzt ein Rollbalken an der Liste. Der Auftrag verlangt
// für eine sichtbare Änderung, dass sie für JEDE Lage der Fläche einzeln beantwortet wird (§9).
//
// DIE ANTWORT IST IN ALLEN LAGEN DIESELBE, und sie ist strukturell: die zwei neuen Regeln hängen am
// `<ul>` der Warteschlange, und das `<ul>` gibt es ausschliesslich, wenn wirklich Einträge da sind
// (`Validation.tsx`, `visible.length > 0`). In den vier Lagen ohne Bestand steht kein `<ul>` — also
// auch kein Rollbereich, kein Balken, keine Deckelung. Das ist hier gemessen und nicht behauptet.
//
// WAS DIESE DATEI AUSDRÜCKLICH NICHT MISST: die Wirkung. jsdom rechnet kein Layout, dort rollt
// nichts und hat nichts eine Höhe. Ob die Karte im Fenster bleibt, misst der Browserblock; diese
// Datei misst, WO die Regeln hängen und in welchen Lagen sie überhaupt vorkommen. Dieselbe
// Arbeitsteilung wie zwischen `pfeiltasten.test.tsx` (Verhalten) und `sichtregel.ts` (Geometrie).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("./kulisse-mocks")).endpunktMock(),
);
vi.mock("../../apps/web/src/app/AuthContext", async (o) =>
  (await import("./kulisse-mocks")).authMock(o as never),
);
vi.mock("../../apps/web/src/app/RoleContext", async (o) =>
  (await import("./kulisse-mocks")).rolleMock(o as never),
);
vi.mock("../../apps/web/src/app/ToastContext", async (o) =>
  (await import("./kulisse-mocks")).toastMock(o as never),
);

import { act } from "../../apps/web/node_modules/react";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { type Brett, flush, mounteBrett, mounteLage } from "./kulisse";

const TITEL = ["A", "B", "C", "D", "E", "F"] as const;
const SCHLANGE = '[data-testid="pruefen-warteschlange"]';
/**
 * Die Bruchstelle, ab der `lg:`-Regeln greifen (Tailwind-Vorgabe, keine eigene Einstellung in
 * `apps/web/tailwind.config.ts`). Sie liegt über der Schmal-Grenze des Produkts
 * (`NARROW_QUERY`, `useMediaQuery.ts:35` — 899 px); der schmale Weg kann von diesen Regeln also
 * gar nicht getroffen werden, und genau das hält F2 fest.
 */
const BREITE_STUFE = "lg:";

let brett: Brett;

function liste(b: Brett): HTMLElement | null {
  return b.container.querySelector<HTMLElement>(SCHLANGE);
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});
afterEach(() => brett?.abbauen());

describe("JOB 3593 · der eigene Rollbereich der Warteschlange", () => {
  it("F1 · Bestand: die Liste trägt einen eigenen, gedeckelten Rollbereich", async () => {
    brett = await mounteBrett(TITEL);
    const ul = liste(brett);
    expect(ul, "die Warteschlange steht").not.toBeNull();
    const klassen = (ul?.className ?? "").split(/\s+/);
    // Beide Teile sind nötig und tun Verschiedenes: die Deckelung schafft den Überlauf, erst die
    // Rollregel macht das Element zu einem Rollbereich. Ohne eines von beiden sucht
    // `scrollIntoView` weiter nach aussen und bewegt wieder die Hülle samt Karte.
    //
    // JOB 3625: Der Deckel ist keine Prozentzahl mehr (`max-h-[70vh]` rechnete den Kopf über der
    // Liste nicht mit, gemessen in `tests/design/job2935-validierung-fussband.test.ts`). Er
    // entsteht jetzt aus dem Flex-Kasten der Spalte: `min-h-0` erlaubt der Liste — und nur ihr —,
    // unter ihre Inhaltshöhe zu schrumpfen, und der Rest der Spalte behält seine natürliche Höhe.
    expect(klassen).toContain(`${BREITE_STUFE}min-h-0`);
    expect(klassen).toContain(`${BREITE_STUFE}overflow-y-auto`);
    // Ohne die Spalte darüber wäre `min-h-0` wirkungslos: Schrumpfen kann nur, was in einer
    // Flex-Spalte mit begrenzter Höhe steht. Deshalb hängt die Zusage an BEIDEN Stellen, und
    // beide stehen hier.
    const spalte = ul?.parentElement;
    const spaltenKlassen = (spalte?.className ?? "").split(/\s+/);
    for (const k of ["flex", "h-full", "min-h-0", "flex-col"]) {
      expect(spaltenKlassen, `der Spalte fehlt ${BREITE_STUFE}${k}`).toContain(
        `${BREITE_STUFE}${k}`,
      );
    }
  });

  it("F2 · und keine dieser Regeln gilt im schmalen Fenster — jede trägt die Breitenstufe", async () => {
    brett = await mounteBrett(TITEL);
    const klassen = (liste(brett)?.className ?? "").split(/\s+/).filter(Boolean);
    // Nicht die zwei Namen von F1 noch einmal, sondern die REGEL dahinter: was an dieser Liste
    // Höhe deckelt oder Überlauf regelt, gilt nur in der breiten Bauform. Käme später eine dritte
    // Rollregel ohne `lg:` dazu, fiele dieser Fall — der schmale Weg soll unberührt bleiben
    // (dort führt die bewusste Auswahl den Blick zur Karte, `Validation.tsx:1127-1137`).
    // JOB 3625: `min-h-` gehört seit der Ablösung von `70vh` in dieselbe Reihe — es ist jetzt der
    // Teil, der die Höhe der Liste überhaupt deckelbar macht.
    const rollend = klassen.filter((k) => /(^|:)(max-h-|min-h-|overflow-)/.test(k));
    expect(rollend.length, "keine einzige Rollregel gefunden — F2 prüfte nichts").toBeGreaterThan(
      0,
    );
    expect(rollend.filter((k) => !k.startsWith(BREITE_STUFE))).toEqual([]);
  });

  it("F3 · leer: es gibt keine Liste und damit keinen Rollbereich", async () => {
    brett = await mounteLage({ art: "leer" });
    expect(liste(brett)).toBeNull();
    expect(
      brett.container.querySelector('[data-testid="pruefen-satz-leer"]'),
      "der Leer-Satz der Fläche steht",
    ).not.toBeNull();
  });

  it("F4 · lädt: es gibt keine Liste und damit keinen Rollbereich", async () => {
    brett = await mounteLage({ art: "laedt" });
    expect(liste(brett)).toBeNull();
    expect(
      brett.container.querySelector('[data-testid="pruefen-platzhalter"]'),
      "der Platzhalter der Ladelage steht",
    ).not.toBeNull();
  });

  it("F5 · Erstfehler: es gibt keine Liste, aber den Wiederholweg", async () => {
    brett = await mounteLage({ art: "erstfehler" });
    expect(liste(brett)).toBeNull();
    expect(
      brett.container.querySelector('[data-testid="pruefen-erstfehler"]'),
      "die Erstfehlerlage steht",
    ).not.toBeNull();
  });

  it("F6 · Bestand mit gescheiterter Auffrischung: die Liste bleibt stehen — samt Rollbereich und Hinweis", async () => {
    brett = await mounteBrett(TITEL);
    // Die Lage entsteht nur so: eine erfolgreiche Antwort liegt im Cache, die NÄCHSTE scheitert
    // (`zaehler.ts:131,145`). Genau dann darf nichts geleert werden — weder die Liste noch ihre
    // Bedienbarkeit; sie sagt nur zusätzlich, dass sie nicht frisch ist.
    (endpoints.validation.board as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Auffrischung gescheitert"),
    );
    await act(async () => {
      await brett.qc.invalidateQueries({ queryKey: ["validation", "board"] });
    });
    await flush();

    const ul = liste(brett);
    expect(ul, "die Liste ist beim Auffrischungsfehler verschwunden").not.toBeNull();
    expect(
      brett.container.querySelectorAll('[data-testid="pruefen-warteschlange-eintrag"]'),
    ).toHaveLength(TITEL.length);
    expect((ul?.className ?? "").split(/\s+/)).toContain(`${BREITE_STUFE}overflow-y-auto`);
    expect(
      brett.container.querySelector('[data-testid="pruefen-nicht-frisch"]'),
      "der Hinweis auf den nicht frischen Stand steht",
    ).not.toBeNull();
  });
});
