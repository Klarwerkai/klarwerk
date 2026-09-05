// ================================================================================================
// JOB 3074 · EINE WAHRHEIT ÜBER DEN VERBRAUCH — DREI DEKLARATIONEN, VOM COMPILER ANEINANDER GEBUNDEN.
// ================================================================================================
//
// DIE FORM DES VERBRAUCHS STEHT AN DREI ORTEN, und keiner davon kann die anderen importieren:
//
//   1. `services/model-runs/src/types.ts`      — `ModelRunVerbrauch`, das Protokollfeld (der Ursprung)
//   2. `services/reasoner/src/model-concurrency.ts` — `ModellVerbrauch`, der In-Flight-Sammler.
//      Ein Import aus `model-runs` wäre eine Abhängigkeit des reasoner-internen Chokepoints auf ein
//      fremdes Modul, nur um einen Typnamen zu teilen.
//   3. `apps/web/src/api/types.ts`             — der Client-Spiegel. Ein Import aus `services/` ist
//      hier technisch unmöglich: der webbuild-Stage im Dockerfile kopiert nur `apps/web`.
//
// DREI ABGESCHRIEBENE FORMEN SIND EIN DRIFTRISIKO — genau das, woran JOB 3069 die Aufgabenarten
// zerbrechen sah: eine handgeschriebene Fünfer-Union wanderte nicht mit, als der Server auf acht
// wuchs, und niemandem fiel es auf, weil alles grün war. Die Antwort ist dieselbe wie dort
// (`tests/ki-aufgabenarten/aufgabenarten-eine-wahrheit.test.ts`): der Test bindet die Seiten
// aneinander, statt sie ein viertes Mal abzuschreiben.
//
// GEBUNDEN WIRD HIER VOM COMPILER, NICHT ZUR LAUFZEIT. Die `Deckungsgleich`-Prüfung unten ist eine
// Typzuweisung: weicht auch nur ein Feldname oder ein Feldtyp ab, wird der Ausdruck `false` und
// `npx tsc --noEmit` bricht — der Fall muss dafür nicht einmal laufen. Der Laufzeitteil hält
// zusätzlich fest, dass der WERT unverändert durch die ganze Kette reist.
import { describe, expect, it } from "vitest";
import type { ModelRunRecord as ClientRecord } from "../../apps/web/src/api/types";
import { summarizeModelRuns } from "../../apps/web/src/lib/modelRuns";
import type { ModelRunRecord as ServerRecord } from "../../services/model-runs";
import type { ModellAufrufSpur } from "../../services/reasoner/src/model-concurrency";

/** `true` nur, wenn A und B einander in BEIDE Richtungen zuweisbar sind. */
type Deckungsgleich<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// Weicht eine der drei Formen ab, ist der zugewiesene Typ `false` — und `const … : true = false`
// ist ein Übersetzungsfehler. Das ist die eigentliche Prüfung dieser Datei.
const spurGleichProtokoll: Deckungsgleich<
  ModellAufrufSpur["verbrauch"],
  ServerRecord["verbrauch"]
> = true;
const protokollGleichClient: Deckungsgleich<ServerRecord["verbrauch"], ClientRecord["verbrauch"]> =
  true;

describe("JOB 3074: Spur, Protokoll und Client-Typ beschreiben denselben Verbrauch", () => {
  it("die drei Deklarationen sind deckungsgleich (vom Compiler geprüft)", () => {
    expect(spurGleichProtokoll).toBe(true);
    expect(protokollGleichClient).toBe(true);
  });

  it("ein Serverdatensatz wird von der Client-Auswertung unverändert gelesen", () => {
    // Bewusst als SERVER-Typ gebaut und als CLIENT-Typ ausgewertet: so reist ein echter Datensatz.
    const vomServer: ServerRecord = {
      id: "r1",
      task: "extract",
      provider: "anthropic:claude-sonnet-4-6",
      demo: false,
      fallback: false,
      startedAt: "2026-09-05T10:00:00.000Z",
      finishedAt: "2026-09-05T10:00:01.000Z",
      status: "success",
      verbrauch: { eingabeToken: 6000, ausgabeToken: 180, gemeldeteAufrufe: 3 },
    };
    const summe = summarizeModelRuns([vomServer as ClientRecord]);

    expect(summe.verbrauchEingabeToken).toBe(6000);
    expect(summe.verbrauchAusgabeToken).toBe(180);
    // Die Grundmenge zählt LÄUFE, nicht Modellaufrufe: ein Lauf mit drei meldenden Aufrufen ist
    // EIN Lauf, der zur Summe beiträgt.
    expect(summe.verbrauchGezaehlt).toBe(1);
  });

  it("ein Altdatensatz ohne Verbrauchsfeld trägt nichts zur Summe bei", () => {
    const alt: ServerRecord = {
      id: "r0",
      task: "select",
      provider: "deterministic",
      demo: true,
      fallback: false,
      startedAt: "2026-09-05T10:00:00.000Z",
      finishedAt: "2026-09-05T10:00:00.000Z",
      status: "success",
    };
    const summe = summarizeModelRuns([alt as ClientRecord]);

    expect(summe.verbrauchGezaehlt, "keine Grundmenge, also auch keine Summenzeile").toBe(0);
    expect(summe.verbrauchEingabeToken).toBe(0);
    expect(summe.total).toBe(1);
  });
});
