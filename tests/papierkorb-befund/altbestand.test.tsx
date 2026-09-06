// @vitest-environment jsdom
// ================================================================================================
// JOB 3116 · R6 — SCHWEIGEN IST DIE EHRLICHE ANTWORT, WO ES KEINE AUSKUNFT GIBT.
// ================================================================================================
//
// Zwei Formen, die kein neues Abzeichen bekommen duerfen — und zwei, die genau so bleiben muessen,
// wie sie sind:
//
//   (a) ECHTER ALTBESTAND: ein Kandidat OHNE `dublettenbefund` (eingereiht vor JOB 3050). Das
//       FEHLEN des Feldes ist eine Aussage — „darueber liegt keine Auskunft vor" — und wird nie zu
//       einem Vorgabewert geglaettet.
//   (b) `pruefung_nicht_moeglich`: der Befund heisst „es gab GAR KEINE Entscheidung"
//       (`types.ts`). Daraus darf weder „im Papierkorb" noch „nicht im Papierkorb" werden.
//       (Dieselbe Unterscheidung, die JOB 3091 R3 rot machte: Fehler ist nicht festgestellte Leere.)
//   (c) ein Altbestand-Kandidat mit `duplicate: true` traegt WEITERHIN „Dublette" …
//   (d) … und ein angenommener Altbestand-Kandidat mit `koId` weiterhin „KO erzeugt". Die Abloesung
//       gilt fuer die zwei benannten Faelle, nicht fuer die Abzeichen ueberhaupt.
//
// WARUM DIE LISTE HIER VORGEGEBEN WIRD (und nur hier): beide Formen sind ueber die echte Route
// nicht herstellbar — (a) kann der heutige Server gar nicht mehr erzeugen, (b) entsteht nur, wenn
// die Papierkorb-Lesung wirft. Die Antwortform ist woertlich die des DTOs
// (`services/app/src/routes/library-routes.ts`), das R4 an der ECHTEN Route gemessen hat.
//
// GEGENPROBE (Pflicht, gefahren und in der RUECKGABE belegt): in `apps/web/src/lib/extConcept.ts`
// `imPapierkorb` mit einem Vorgabewert versehen (z. B. `?? { koId: "unbekannt" }`) → R6 wird rot.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  type FlaechenBruecke,
  type Gemountet,
  flaechenBruecke,
  mounteImportReview,
} from "./flaeche-bruecke";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function kandidat(over: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "k",
    item: {
      title: "Wartungsplan Anlage 3",
      statement: "Den Filter der Anlage 3 jaehrlich wechseln",
      type: "best_practice",
      category: "Wartung",
      textCodec: "decoded",
    },
    status: "neu",
    duplicate: false,
    note: null,
    koId: null,
    createdAt: "2026-09-06T00:00:00.000Z",
    ...over,
  };
}

const LISTE = [
  kandidat({ id: "alt-ohne-befund" }),
  kandidat({ id: "nicht-pruefbar", dublettenbefund: { ergebnis: "pruefung_nicht_moeglich" } }),
  kandidat({ id: "alt-dublette", duplicate: true }),
  kandidat({ id: "alt-angenommen", status: "angenommen", koId: "ko-alt-4711" }),
];

let b: FlaechenBruecke;
let m: Gemountet | null = null;

beforeEach(async () => {
  await i18n.changeLanguage("de");
  b = await flaechenBruecke();
  b.setzeQueueErsatz(LISTE);
});

afterEach(() => {
  m?.abbauen();
  m = null;
  b.abbauen();
});

describe("JOB 3116 · R6 — kein Abzeichen ohne Auskunft, keine erfundene Kennung", () => {
  it("R6a · Altbestand und `pruefung_nicht_moeglich` zeigen KEINES der neuen Abzeichen", async () => {
    m = await mounteImportReview();

    expect(m.text, "Vorbedingung: die vier Kandidaten stehen wirklich auf der Seite.").toContain(
      "Wartungsplan Anlage 3",
    );
    for (const abzeichen of m.abzeichen) {
      expect(abzeichen, "Kein Papierkorb-Satz ohne Papierkorb-Befund.").not.toContain(
        "liegt im Papierkorb",
      );
      expect(abzeichen, "Keine Wiederverwendung ohne Wiederverwendungs-Befund.").not.toContain(
        "wiederverwendet",
      );
    }
  });

  it("R6b · und erst recht keine negative Aussage ueber den Bestand", async () => {
    m = await mounteImportReview();

    expect(
      m.text,
      'Ein Lesefehler ist keine festgestellte Leere: "nicht im Papierkorb" waere eine Behauptung ueber den Bestand.',
    ).not.toContain("nicht im Papierkorb");
    expect(m.text, "Und keine erfundene Kennung.").not.toContain("Kennung");
  });

  it("R6c · die vorhandenen Abzeichen bleiben, wo sie hingehoeren", async () => {
    m = await mounteImportReview();

    expect(
      m.abzeichen,
      "Ein Altbestand-Kandidat mit `duplicate: true` traegt weiterhin das Dubletten-Abzeichen — die Abloesung gilt nur fuer den Papierkorb-Fall.",
    ).toContain("Dublette");
    expect(
      m.abzeichen,
      "Und ein angenommener Kandidat OHNE Wiederverwendungs-Befund weiterhin das Erzeugt-Abzeichen.",
    ).toContain("KO erzeugt");
  });
});
