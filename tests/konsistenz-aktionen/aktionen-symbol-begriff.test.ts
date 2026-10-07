import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";

// ================================================================================================
// K33 · package:konsistenz — „Speichern, Verwerfen, Löschen und Öffnen verwenden überall dieselben
// Begriffe, Symbole und Rückmeldungen"; Kriterium „Gleiche Aktion verwendet gleiches Symbol".
// ================================================================================================
//
// DIE GELTENDE BEGRIFFSREGEL steht seit JOB 3426 §4b.4 im Produkt (`components/CaptureDraftList.tsx`,
// Kommentar am `LoeschKnopf`): „Löschen" heisst `DELETE` — der Entwurf geht in den Papierkorb;
// „Verwerfen" heisst, die UNGESPEICHERTE Eingabe zurückzusetzen. Gemessen (Nacharbeit 7) wichen davon
// zwei Stellen ab:
//   · Mobil (`pages/Mobile.tsx`) nannte das Löschen eines Entwurfs „Verwerfen", fragte „Verwerfen?",
//     bestätigte mit einem Haken und quittierte „Entwurf verworfen." — derselbe `DELETE`, der in der
//     Entwurfsliste „Löschen" mit Papierkorb und „Entwurf gelöscht." heisst.
//   · „Fortsetzen" (= einen Entwurf ÖFFNEN) trug in Entwurfsliste und Mobil den Kreispfeil
//     `RotateCcw` — dasselbe Symbol wie „Auf Werkseinstellungen zurücksetzen" und „Demodaten
//     zurücksetzen", also das Gegenteil.
// Gelesen wird der Quelltext — dieselbe Ebene wie `tests/app/destructive-button-colour.test.ts`.

const quelle = (rel: string): string =>
  readFileSync(repoPfad(`apps/web/src/${rel}`), "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");

const MOBIL = quelle("pages/Mobile.tsx");
const LISTE = quelle("components/CaptureDraftList.tsx");

/** Der `<button …>…</button>`-Block, der einen bestimmten Text-Schlüssel trägt (erster Treffer). */
function knopfMit(src: string, schluessel: string, attribut: "title" | "inhalt"): string {
  const nadel = attribut === "title" ? `title={t("${schluessel}")}` : `{t("${schluessel}")}`;
  const at = src.indexOf(nadel);
  expect(at, `${schluessel} nicht gefunden`).toBeGreaterThan(0);
  const start = src.lastIndexOf("<button", at);
  const ende = src.indexOf("</button>", at);
  return src.slice(start, ende);
}

describe("K33 · gleiche Aktion — gleiches Wort, gleiches Symbol, gleiche Rückmeldung", () => {
  it("A1 · Öffnen/Fortsetzen trägt in Entwurfsliste und Mobil das Öffnen-Symbol, nie den Kreispfeil", () => {
    expect(knopfMit(LISTE, "capture.resume", "inhalt")).toContain("<FolderOpen");
    expect(knopfMit(MOBIL, "mob.resume", "title")).toContain("<FolderOpen");
    // Der Kreispfeil bleibt dem Zurücksetzen vorbehalten — in beiden Dateien kommt er nicht mehr vor.
    expect(LISTE).not.toContain("RotateCcw");
    expect(MOBIL).not.toContain("RotateCcw");
  });

  it("A2 · Löschen eines Entwurfs heisst auf Mobil wie in der Entwurfsliste — Wort und Papierkorb", () => {
    // Auslöser: Papierkorb, Wort „Löschen" (`capture.discardDraftYes`) — wie `LoeschKnopf`.
    const ausloeser = MOBIL.slice(
      MOBIL.lastIndexOf("<button", MOBIL.indexOf('data-testid="mobil-entwurf-loeschen"')),
    );
    expect(ausloeser.slice(0, ausloeser.indexOf("</button>"))).toContain("<Trash2");
    expect(ausloeser).toContain('title={t("capture.discardDraftYes")}');
    expect(knopfMit(LISTE, "capture.discardDraftYes", "title")).toContain("<Trash2");
    // Bestätigung: dasselbe Wort und dasselbe Symbol wie der Auslöser, „Behalten" daneben.
    const ja = MOBIL.slice(MOBIL.indexOf('data-testid="mobil-entwurf-loeschen-ja"'));
    expect(ja.slice(0, ja.indexOf("</button>"))).toContain("<Trash2");
    expect(MOBIL).toContain('title={t("capture.discardDraftKeep")}');
    // Rückfrage und Quittung wie in der Entwurfsliste.
    expect(MOBIL).toContain('{t("capture.discardDraftQ")}');
    expect(MOBIL).toContain('t("capture.draftDiscarded")');
    expect(LISTE).toContain('{t("capture.discardDraftQ")}');
  });

  it("A3 · das Wort „Verwerfen“ steht auf Mobil nicht mehr für den DELETE-Weg", () => {
    const alteWoerter = [
      "mob.discard",
      "mob.discarded",
      "mob.discardConfirmHint",
      "mob.confirmDiscard",
    ];
    for (const alt of alteWoerter) {
      expect(MOBIL, alt).not.toContain(`t("${alt}")`);
    }
    // KALIBRIERUNG: der DELETE-Weg ist wirklich `drafts.remove` — sonst wäre „Löschen" das falsche Wort.
    expect(MOBIL).toContain("endpoints.drafts.remove(id)");
  });

  it("A4 · KALIBRIERUNG: „Verwerfen“ bleibt dort, wo es Eingabe zurücksetzt (Erfassen-Assistent)", () => {
    const capture = quelle("pages/Capture.tsx");
    expect(capture).toContain("resetCaptureForm();");
    expect(capture).toContain("t(CAPTURE_WIZARD_TEXT.discardYes)");
  });
});
