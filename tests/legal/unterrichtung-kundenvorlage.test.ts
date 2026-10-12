// ================================================================================================
// AUFTRAG gesamt-ki-unterrichtung · R-0636 — DIE KUNDENFASSUNG ALS ANPASSBARE VORLAGE.
// ================================================================================================
//
// Originalpunkt: „Kunden sind fuer ihre eigene Installation selbst Betreiber und muessen ihre Leute
// nach Artikel 4 unterrichten. Sie sollen die Unterrichtung als anpassbare Vorlage mitgeliefert
// bekommen." Die Unterrichtung selbst sagte in Teil 6: „es gibt noch keine anpassbare Vorlage".
//
// Die Vorlage `docs/compliance/unterrichtung-artikel-4-kundenvorlage.md` ist aus Teil 2 und 3 der
// Unterrichtung abgeleitet. Dieser Sammler hält drei Zusagen fest:
//   · sie trägt alle Pflichtthemen aus R-0626 samt Nachweisblatt — eine Vorlage, der ein Thema
//     fehlt, gibt der Kunde unverändert weiter und erfüllt Artikel 4 dann nur zum Schein;
//   · ihre Bezugsfassung IST die Fassung des Produkthinweises — sonst unterrichtet der Kunde über
//     einen Hinweis, den seine Leute so nie gesehen haben;
//   · sie enthält NICHTS von uns: keine unserer Platzhalter, keine internen Namen, keine erfundenen
//     Angaben. Was der Kunde eintragen muss, ist als `[[ANPASSEN: …]]` markiert und bleibt leer.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HINWEIS_TEXT_VERSION } from "../../services/auth/src/notice";

const WURZEL = join(__dirname, "..", "..");
const COMPLIANCE = join(WURZEL, "docs", "compliance");
const VORLAGE = readFileSync(join(COMPLIANCE, "unterrichtung-artikel-4-kundenvorlage.md"), "utf8");
const UNTERRICHTUNG = readFileSync(join(COMPLIANCE, "unterrichtung-artikel-4.md"), "utf8");

/** Interne Spuren, die in einer an Kunden ausgelieferten Vorlage nichts verloren haben. */
const INTERN =
  /\[\[PLATZHALTER:|\bPedi\b|\bNatascha\b|\bVortest|_relay\/|Kopf-Empfehlung|Register T/;

/** Angaben, ohne die der Nachweis des Kunden nichts belegt — je eine `[[ANPASSEN: …]]`-Stelle. */
const PFLICHTSTELLEN = ["Firmenbezeichnung", "verantwortlichen Person", "Aufbewahrung", "gemeldet"];

describe("R-0636 · die Unterrichtung liegt als anpassbare Kundenvorlage im Produkt", () => {
  it("die Vorlage ist da und nicht leer", () => {
    expect(VORLAGE.length, "die Vorlage ist verdächtig kurz").toBeGreaterThan(4000);
    expect(VORLAGE).toContain("Artikel 4");
    expect(VORLAGE).toContain("Betreiber");
  });

  it("sie trägt jedes Pflichtthema der Unterrichtung und ein Nachweisblatt", () => {
    for (const ueberschrift of [
      "### Was das System tut",
      "### Wo seine Grenzen liegen",
      "### Woran Sie eine schwache Antwort erkennen",
      "### Was nicht in eine Frage gehört — verboten",
      "### Wenn Sie einen Fehler finden — melden",
      "## Nachweis",
    ]) {
      expect(VORLAGE, `es fehlt: ${ueberschrift}`).toContain(ueberschrift);
    }
    expect(VORLAGE).toMatch(/\| Name \| Rolle \| Datum \| Unterschrift \|/);
    expect(VORLAGE).toContain("Bestätigung der unterrichteten Person");
  });

  it("DIE KOPPLUNG: die Bezugsfassung IST die Version des Produkthinweises", () => {
    // Zeilengebunden wie im mega63-Sammler: nur die Kennung, die auf derselben Zeile folgt.
    const muster = /Bezugsfassung des Produkthinweises[^\n`]*`([^`\n]+)`/g;
    const genannt = [...VORLAGE.matchAll(muster)].map((t) => t[1]);
    expect(genannt.length, "die Vorlage nennt keine Bezugsfassung").toBeGreaterThan(0);
    for (const fassung of genannt) {
      const meldung = `Vorlage nennt ${fassung}, Produkt führt ${HINWEIS_TEXT_VERSION}`;
      expect(fassung, meldung).toBe(HINWEIS_TEXT_VERSION);
    }
  });

  it("die Produktaussagen sind dieselben wie in der belegten Unterrichtung", () => {
    // Die Belege stehen in Teil 5 der Unterrichtung. Die Vorlage darf sie nicht umformulieren,
    // sonst gilt der Beleg für sie nicht mehr. Verglichen wird ohne Zeilenumbrüche — beide Dateien
    // brechen Fließtext an verschiedenen Stellen um.
    const flach = (text: string) => text.replace(/\s+/g, " ");
    for (const satz of [
      "Vertrauen und Nutzbarkeit sind **kein Wahrheitsversprechen**",
      "intern, vertraulich und streng vertraulich",
      "**Gesundheitsdaten, Personaldaten Dritter, Zugangsdaten, Passwörter, Schlüssel.**",
      "**Die KI beschafft Ihnen die Stelle. Ob die Stelle stimmt, entscheiden Sie.**",
    ]) {
      expect(flach(VORLAGE), `Vorlage weicht ab: ${satz}`).toContain(satz);
      expect(flach(UNTERRICHTUNG), `Unterrichtung trägt nicht mehr: ${satz}`).toContain(satz);
    }
  });

  it("anpassbar: die Stellen des Kunden sind markiert und NICHT ausgefüllt", () => {
    const stellen = [...VORLAGE.matchAll(/\[\[ANPASSEN:[^\]]*\]\]/g)].map((t) => t[0]);
    expect(stellen.length, "die Anpassungsstellen fehlen").toBeGreaterThanOrEqual(8);
    for (const pflicht of PFLICHTSTELLEN) {
      const vorhanden = stellen.some((s) => s.includes(pflicht));
      expect(vorhanden, `keine Anpassungsstelle für ${pflicht}`).toBe(true);
    }
  });

  it("nichts von uns in der Vorlage — und der Wächter dafür greift", () => {
    expect(VORLAGE).not.toMatch(INTERN);
    // KALIBRIERUNG: das Muster findet die Spuren, die es ausschließen soll, tatsächlich.
    expect(UNTERRICHTUNG).toMatch(INTERN);
    expect("Natascha liest vorher").toMatch(INTERN);
  });

  it("die Unterrichtung verweist auf die Vorlage", () => {
    expect(UNTERRICHTUNG).toContain("docs/compliance/unterrichtung-artikel-4-kundenvorlage.md");
  });
});
