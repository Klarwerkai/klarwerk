// ================================================================================================
// JOB 4146 · D7 — DREI SPRACHEN, UND KEINE SAGT „FREIGEGEBEN"
// ================================================================================================
//
// ZWEI AUSSAGEN, und die zweite ist die eigentliche:
//
//  1. Jede neue Beschriftung liegt in de/en/nl vor, keine fällt auf den rohen Schlüsselnamen zurück
//     und keine lässt eine Variable offen (`{{…}}`).
//  2. KEINE von ihnen trägt das Freigabe- oder Prüfwort. „Erledigt heisst GEKLÄRT, nicht
//     freigegeben" (Auftrag §1) ist genau dann eine Zusage, wenn sie sprachlich nicht unterlaufen
//     wird — ein Knopf „Als geprüft markieren" im Diskussionsfaden wäre die stille Umdeutung des
//     Klärungsstands in eine fachliche Freigabe, und niemand hätte eine Zeile Code dafür gebraucht.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { sprachbestand } from "../support/i18nBestand";
import { SPRACHEN, neuladeTreffer } from "./neuladen-worte";

/** Der eigene Namensraum dieses Auftrags — additiv, ohne Eingriff in bestehende Schlüssel. */
const SCHLUESSEL = [
  "ko.diskussion.titel",
  "ko.diskussion.version",
  "ko.diskussion.versionVeraltet",
  "ko.diskussion.versionUnbekannt",
  "ko.diskussion.antworten",
  "ko.diskussion.antwortAn",
  "ko.diskussion.antwortSenden",
  "ko.diskussion.antwortAbbrechen",
  "ko.diskussion.erledigtVon",
  "ko.diskussion.wiederGeoeffnetVon",
  "ko.diskussion.alsGeklaertMarkieren",
  "ko.diskussion.wiederOeffnen",
  "ko.diskussion.sendeFehler",
  "ko.diskussion.sendeFehlerVeraltet",
  // R5 (BEN-Korrekturpflicht 3): der Satz für die abgebrochene Übertragung, bei der niemand weiss,
  // ob geschrieben wurde.
  "ko.diskussion.sendeFehlerUnklar",
  // R6 (BEN-Korrekturpflicht 2): der Weg zurück, der den Entwurf nicht kostet.
  "ko.diskussion.erneutSenden",
  "audit.action.ko_comment_resolved",
  "audit.action.ko_comment_reopened",
] as const;

/** Die drei Sätze, die ein Mensch NACH einem Fehlschlag liest — sie geben die Handlung vor. */
const FEHLERSAETZE = [
  "ko.diskussion.sendeFehler",
  "ko.diskussion.sendeFehlerVeraltet",
  "ko.diskussion.sendeFehlerUnklar",
] as const;

// R7: Die Wortliste steht jetzt in `neuladen-worte.ts` — dieser Fall prüft den KATALOG, der
// Routenwächter (`fehlermeldung-neuladen.test.ts`) die VOLLSTÄNDIGE sichtbare Meldung samt
// Servertext. Beide lesen dieselbe Liste; zwei Abschriften wären zwei Gelegenheiten, eine davon
// zu vergessen — genau daran ging R6 vorbei.

/**
 * Das Wort, an dem man in jeder Sprache erkennt, dass die Fläche den Speicherstand NICHT kennt.
 * Es steht ausgeschrieben da, weil ein Muster auch einen Satz durchliesse, der die Unsicherheit nur
 * andeutet — und eine angedeutete Unsicherheit liest sich am Bildschirm wie eine Gewissheit.
 */
const UNKLAR: Record<(typeof SPRACHEN)[number], string> = {
  de: "unklar",
  en: "unclear",
  nl: "onduidelijk",
};

/**
 * Die verbotenen Wörter je Sprache: Freigabe und Prüfung. Sie stehen hier ausgeschrieben und nicht
 * als Muster — eine Musterfreigabe entschiede über Wörter, die noch niemand gelesen hat.
 */
const VERBOTEN: Record<(typeof SPRACHEN)[number], readonly string[]> = {
  de: ["freigegeben", "freigabe", "freigeben", "geprüft", "geprueft", "validiert", "prüfung"],
  en: ["approved", "approval", "released", "validated", "verified", "reviewed"],
  nl: ["goedgekeurd", "goedkeuring", "vrijgegeven", "gevalideerd", "gecontroleerd", "geverifieerd"],
};

describe("JOB 4146 · D7 — Beschriftungen in de/en/nl", () => {
  for (const lng of SPRACHEN) {
    it(`${lng} · jede neue Beschriftung ist da, übersetzt und ohne offene Variable`, async () => {
      await i18n.changeLanguage(lng);
      const bestand = sprachbestand(lng);
      const fehlend = SCHLUESSEL.filter(
        (k) => typeof bestand[k] !== "string" || (bestand[k] ?? "").trim().length === 0,
      );
      expect(fehlend).toEqual([]);

      for (const k of SCHLUESSEL) {
        const text = i18n.t(k, { version: 3, aktuell: 5, name: "Eva", datum: "01.02.2026" });
        expect(text, `${lng}/${k} fällt auf den Rohschlüssel zurück`).not.toBe(k);
        expect(text, `${lng}/${k} lässt eine Variable offen`).not.toContain("{{");
      }
    });

    it(`${lng} · keine Beschriftung des Fadens trägt das Freigabe- oder Prüfwort`, async () => {
      await i18n.changeLanguage(lng);
      const treffer: string[] = [];
      for (const k of SCHLUESSEL) {
        const text = i18n
          .t(k, { version: 3, aktuell: 5, name: "Eva", datum: "01.02.2026" })
          .toLowerCase();
        for (const wort of VERBOTEN[lng]) {
          if (text.includes(wort)) {
            treffer.push(`${k}: „${text}" enthält „${wort}"`);
          }
        }
      }
      expect(treffer).toEqual([]);
    });

    it(`${lng} · der Versionsbezug nennt beide Zahlen, wenn das Objekt weitergegangen ist`, async () => {
      await i18n.changeLanguage(lng);
      const veraltet = i18n.t("ko.diskussion.versionVeraltet", { version: 3, aktuell: 5 });
      expect(veraltet).toContain("3");
      expect(veraltet).toContain("5");
      // Und der einfache Bezug nennt nur die eine — sonst wären es zwei Sätze für eine Lage.
      expect(i18n.t("ko.diskussion.version", { version: 3 })).toContain("3");
    });

    // R5 · BEN-Korrekturpflicht 3: „Der Beitrag wurde nicht gespeichert" ist eine Tatsachenaussage.
    // Sie braucht ihre Voraussetzung — eine Antwort des Servers. Fehlt die, steht die SCHWÄCHERE
    // Aussage da (Regel 7 des Zustandsmodells: „Jede Tatsachenaussage hängt an ihrer Voraussetzung").
    it(`${lng} · der Satz zur abgebrochenen Übertragung behauptet keine erwiesene Nicht-Speicherung`, async () => {
      await i18n.changeLanguage(lng);
      const unklar = i18n.t("ko.diskussion.sendeFehlerUnklar");
      const bestimmt = i18n.t("ko.diskussion.sendeFehler");

      expect(unklar).not.toBe(bestimmt);
      expect(unklar.toLowerCase()).toContain(UNKLAR[lng]);
      // Der bestimmte Satz bleibt bestimmt — er gilt weiter, wo der Server geantwortet hat.
      expect(bestimmt.toLowerCase()).not.toContain(UNKLAR[lng]);
      // Und auch der unklare Satz sagt, dass der Text erhalten ist: sonst wäre die Unsicherheit die
      // einzige Auskunft, die der Mensch bekommt.
      expect(unklar.length).toBeGreaterThan(30);
    });

    // R6 · BEN-Korrekturpflicht 2: eine Handlungsanweisung, die den erhaltenen Text kostet, ist
    // schlechter als keine. Kein Fehlersatz schickt den Menschen mehr ins Neuladen.
    it(`${lng} · kein Fehlersatz fordert zum Neuladen auf`, async () => {
      await i18n.changeLanguage(lng);
      const treffer: string[] = [];
      for (const k of FEHLERSAETZE) {
        const text = i18n.t(k);
        for (const wort of neuladeTreffer(text, lng)) {
          treffer.push(`${k}: „${text}" fordert „${wort}"`);
        }
      }
      expect(treffer).toEqual([]);
    });
  }

  it("der unbekannte Versionsbezug sagt „unbekannt“ und erfindet keine Zahl (Vertrag Fall 1)", async () => {
    for (const lng of SPRACHEN) {
      await i18n.changeLanguage(lng);
      const text = i18n.t("ko.diskussion.versionUnbekannt");
      expect(text).not.toMatch(/\d/);
    }
  });
});
