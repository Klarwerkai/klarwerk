// ================================================================================================
// JOB 3235 · UX-18-R2 — ZWEI GRUPPEN, ZWEI AUSSAGEN, ZWEI NAMEN.
// ================================================================================================
//
// Auf `/import` stehen die Gruppen „Systeme" und „Dateien" UNTEREINANDER auf derselben Flaeche
// (`ImportSourceGallery.tsx:75-96`). Bis JOB 3235 trug jede Gruppe eine Kachel „Word" und eine
// Kachel „PDF" — und beide sagten etwas anderes ueber dieselbe Sache: „Word-Datei · bald" direkt
// ueber „Word (.docx) · im Erfassen".
//
// WAS DIESER WAECHTER MISST, UND WARUM ER SCHAERFER IST ALS EIN GLEICHHEITSVERGLEICH.
// Die zwei Namen waren nie ZEICHENGLEICH („Word-Datei" ≠ „Word (.docx)"), und trotzdem waren sie
// verwechselbar: beide benannten dasselbe — eine WORD-DATEI. Ein Test auf Zeichengleichheit waere
// am unveraenderten Stand gruen gewesen und haette damit genau nichts gesichert. Gemessen wird
// deshalb der KERN eines Namens (`./kern.ts`, dort steht die Regel und warum sie so lautet):
// bleibt nach Abzug von Klammerzusatz und Dateiwort derselbe Rest, meinen beide Kacheln dasselbe
// Ding — egal, wie unterschiedlich sie geschrieben sind.
//
// IN JEDER GEFUEHRTEN SPRACHE. Die Sprachliste wird nicht getippt, sondern aus der echten
// i18n-Instanz gelesen (`i18n.options.resources`): kommt eine vierte Sprache dazu, ist sie ohne
// Zutun mitgeprueft. Fehlt einer Kachel in einer Sprache der Text, ist dieser Test ROT und nennt
// die Sprache — eine fehlende Uebersetzung ist hier keine Kleinigkeit, sondern die Rueckkehr der
// Verwechslung ueber die naechste Uebersetzung.
//
// VORHER (gemessen am unveraenderten Stand edbfd8f, `npx vitest run tests/quellenkachel-umfang`):
//   AssertionError: expected [ …(6) ] to deeply equal []
//   + Array [
//   +   "de: \"Word-Datei\" (System word-sys) und \"Word (.docx)\" (Datei docx) haben denselben Kern \"word\"",
//   +   "de: \"PDF-Datei\" (System pdf-sys) und \"PDF\" (Datei pdf) haben denselben Kern \"pdf\"",
//   +   "en: \"Word file\" (System word-sys) und \"Word (.docx)\" (Datei docx) haben denselben Kern \"word\"",
//   +   "en: \"PDF file\" (System pdf-sys) und \"PDF\" (Datei pdf) haben denselben Kern \"pdf\"",
//   +   "nl: \"Word-bestand\" (System word-sys) und \"Word (.docx)\" (Datei docx) haben denselben Kern \"word\"",
//   +   "nl: \"PDF-bestand\" (System pdf-sys) und \"PDF\" (Datei pdf) haben denselben Kern \"pdf\"",
//   + ]
import { describe, expect, it } from "vitest";

import i18n from "../../apps/web/src/i18n";
import { FILE_SOURCES, SYSTEM_SOURCES } from "../../apps/web/src/lib/importSourceGallery";
import { kernDesNamens } from "./kern";

// Die gefuehrten Sprachen — aus der echten Instanz, nicht getippt.
const SPRACHEN: string[] = Object.keys(
  (i18n.options.resources ?? {}) as Record<string, unknown>,
).sort();

function textVon(lng: string, labelKey: string): string {
  const wert = i18n.getResource(lng, "translation", labelKey);
  return typeof wert === "string" ? wert : "";
}

describe("JOB 3235 · Systemkachel und Dateikachel sind nicht verwechselbar", () => {
  it("die Sprachliste der echten Instanz ist nicht leer (sonst prueft alles Weitere ins Nichts)", () => {
    expect(SPRACHEN.length).toBeGreaterThan(1);
  });

  it("jede Kachel beider Gruppen hat in JEDER gefuehrten Sprache einen Text", () => {
    for (const lng of SPRACHEN) {
      for (const source of [...SYSTEM_SOURCES, ...FILE_SOURCES]) {
        expect(
          textVon(lng, source.labelKey).trim().length,
          `Sprache ${lng}: der Schluessel ${source.labelKey} (Kachel ${source.id}) fehlt oder ist leer`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("kein Anzeigename einer Systemkachel ist gleich dem einer Dateikachel (und umgekehrt)", () => {
    // GESAMMELT statt beim ersten Treffer abgebrochen: wer den Fehler wieder einbaut, soll JEDES
    // betroffene Paar in JEDER Sprache in einer Ausgabe sehen und nicht Sprache um Sprache
    // nachlaufen muessen.
    const treffer: string[] = [];
    for (const lng of SPRACHEN) {
      for (const sys of SYSTEM_SOURCES) {
        const sysName = textVon(lng, sys.labelKey).trim().toLowerCase();
        for (const datei of FILE_SOURCES) {
          if (sysName === textVon(lng, datei.labelKey).trim().toLowerCase()) {
            treffer.push(
              `${lng}: System ${sys.id} und Datei ${datei.id} heissen beide "${sysName}"`,
            );
          }
        }
      }
    }
    expect(treffer).toEqual([]);
  });

  it("keine Systemkachel meint dasselbe Ding wie eine Dateikachel (Kernvergleich)", () => {
    const ohneKern: string[] = [];
    const verwechselbar: string[] = [];
    for (const lng of SPRACHEN) {
      for (const sys of SYSTEM_SOURCES) {
        const sysName = textVon(lng, sys.labelKey).trim();
        const sysKern = kernDesNamens(sysName);
        // Ein leerer Kern liesse zwei Kacheln stillschweigend gleich werden.
        if (sysKern.length === 0) {
          ohneKern.push(`${lng}: "${sysName}" (System ${sys.id})`);
        }
        for (const datei of FILE_SOURCES) {
          const dateiName = textVon(lng, datei.labelKey).trim();
          const dateiKern = kernDesNamens(dateiName);
          if (dateiKern.length === 0) {
            ohneKern.push(`${lng}: "${dateiName}" (Datei ${datei.id})`);
          }
          if (sysKern === dateiKern) {
            verwechselbar.push(
              `${lng}: "${sysName}" (System ${sys.id}) und "${dateiName}" (Datei ${datei.id}) haben denselben Kern "${sysKern}"`,
            );
          }
        }
      }
    }
    expect([...new Set(ohneKern)]).toEqual([]);
    expect(verwechselbar).toEqual([]);
  });
});
