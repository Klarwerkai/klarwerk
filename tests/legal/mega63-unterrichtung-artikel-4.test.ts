// ================================================================================================
// AUFTRAG-mega63 BLOCK E — DIE UNTERRICHTUNG FÄHRT MIT DEM PRODUKT, UND IHRE VERSION HÖRT MIT.
// ================================================================================================
//
// `docs/compliance/unterrichtung-artikel-4.md` ist die Unterrichtung nach Artikel 4 der
// KI-Verordnung. Nach dem Umsetzungsplan wird sie MIT DEM PRODUKT ausgeliefert; solange sie nur
// unter `_relay/` lag, fand sie niemand ausser uns, und `_relay/` ist von der Evidenz
// ausgeschlossen.
//
// DER ZWECK DIESES SAMMLERS IST DIE KOPPLUNG, NICHT DIE KOPIE: Die im Dokument genannte Textfassung
// und `HINWEIS_TEXT_VERSION` aus `services/auth/src/notice.ts` sind DIESELBE Kennung. Sie sind es
// aber nur, solange jemand daran denkt — und genau das ist die Sorte Zusage, die still zerfällt.
// Wer künftig die eine Zahl anfasst, wird hier rot und erfährt, dass die andere mithört.
//
// WARUM DAS MEHR IST ALS BUCHHALTUNG: Ein Nachweisdokument, dessen Version still von der des
// Produkts abweicht, belegt im Prüfungsfall nichts — es behauptet dann eine Unterrichtung über
// einen Hinweistext, den die Belegschaft so nie gesehen hat. Ein falscher Nachweis ist schlechter
// als ein fehlender, weil er die Prüfung beendet, statt sie auszulösen.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HINWEIS_TEXT_VERSION } from "../../services/auth/src/notice";

const WURZEL = join(__dirname, "..", "..");
const DOKUMENT = readFileSync(join(WURZEL, "docs/compliance/unterrichtung-artikel-4.md"), "utf8");

describe("mega63 E · die Unterrichtung nach Artikel 4 liegt im Produkt", () => {
  it("das Dokument ist da und ist nicht leer", () => {
    // Selbstschutz: eine leere oder abgeschnittene Datei liesse jede Suche unten grün wirken.
    expect(DOKUMENT.length, "das Dokument ist verdächtig kurz").toBeGreaterThan(5000);
    expect(DOKUMENT).toContain("Artikel 4");
  });

  it("DIE KOPPLUNG: die genannte Textfassung IST die Version des Produkts", () => {
    // Gelesen wird die Kennung aus dem Dokument, verglichen wird mit der Konstante aus dem Code.
    // Keine der beiden Zahlen steht in diesem Test — sonst hinge die Kopplung an einer dritten
    // Stelle, die genauso veralten kann.
    // Bewusst ZEILENGEBUNDEN (`[^\n\`]*`): Das Dokument benutzt das Wort „Textfassung" auch in
    // Fliesstext, in dem erst Zeilen später wieder ein Backtick steht — eine zeilenübergreifende
    // Suche griff dort auf den nächstbesten Codepfad zu und verglich Dateinamen mit Versionen.
    const genannt = [...DOKUMENT.matchAll(/Textfassung[^\n`]*`([^`\n]+)`/g)].map((t) => t[1]);
    expect(genannt.length, "das Dokument nennt keine Textfassung").toBeGreaterThan(0);
    for (const fassung of genannt) {
      expect(
        fassung,
        `das Dokument nennt die Textfassung ${fassung}, das Produkt führt ${HINWEIS_TEXT_VERSION}`,
      ).toBe(HINWEIS_TEXT_VERSION);
    }
  });

  it("die Platzhalter sind NICHT gefüllt — sie sind gewollt", () => {
    // Das Dokument ist eine Vorlage für einen realen Unterrichtungsvorgang. Ein ausgefüllter
    // Platzhalter wäre eine erfundene Tatsache: ein Name, der nie unterrichtet hat, ein Datum, an
    // dem nichts geschah. Leer ist hier die wahrheitsgemässe Fassung.
    const platzhalter = [...DOKUMENT.matchAll(/\[\[PLATZHALTER:[^\]]*\]\]/g)];
    expect(platzhalter.length, "die Platzhaltermarkierungen fehlen").toBeGreaterThanOrEqual(5);
  });

  it("die Kopie ist wörtlich — sie verweist auf dieselbe Stelle im Code wie die Vorlage", () => {
    // Die Vorlage selbst liegt unter `_relay/` und ist von der Evidenz ausgeschlossen; ein
    // Byte-Vergleich hier hinge also an einer Datei, die in einem Prüflauf fehlen darf. Belegt wird
    // deshalb der tragende Inhalt: die Fundstelle, auf die sich die Kopplung oben beruft.
    expect(DOKUMENT).toContain("services/auth/src/notice.ts");
    expect(DOKUMENT).toContain("HINWEIS_TEXT_VERSION");
  });
});
