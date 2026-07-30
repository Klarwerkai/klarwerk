// ================================================================================================
// AUFTRAG-mega63 BLOCK D — DIE AUFZÄHLUNG DER BROWSER-SPEICHERINHALTE DRIFTET NICHT.
// ================================================================================================
//
// Abschnitt 4 der Datenschutzerklärung („Speicherung in Ihrem Endgerät") zählt auf, was die
// Anwendung im Browser ablegt. Das ist keine Beschreibung, sondern eine TATSACHENAUSSAGE über
// unser Produkt — und Block A hat dem Produkt heute einen neuen Browser-Token hinzugefügt
// (kw_signout_pending, s. apps/web/src/app/signOutLock.ts).
//
// EINE UNVOLLSTÄNDIGE AUFZÄHLUNG IN EINER RECHTSFLÄCHE IST DIE SORTE FEHLER, DIE NIEMAND BEMERKT,
// BIS SIE JEMAND PRÜFT. Und sie entsteht nicht durch Nachlässigkeit, sondern durch Arbeitsteilung:
// Wer einen Token einführt, denkt an den Code; wer die Rechtstexte pflegt, sieht den Token nicht.
// Deshalb dieser Sammler — er koppelt die beiden Seiten, damit die Kopplung nicht vom Gedächtnis
// abhängt.
//
// WAS ER BELEGT: die drei Sprachen nennen DIESELBE ANZAHL Einträge, jeder Eintrag wird auch
// gerendert, und der neue Merker kommt namentlich vor.
//
// WAS ER AUSDRÜCKLICH NICHT BELEGT: dass JEDER tatsächlich benutzte Speicherschlüssel des Produkts
// in der Aufzählung steht. Das wäre die wertvollere Prüfung und ist eigene Arbeit — sie steht als
// offener Punkt im Bericht zu mega63.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
/**
 * Kommentarzeilen raus. Beide Dateien BEGRÜNDEN ihre Entscheidungen ausführlich und nennen dabei
 * genau die Wörter, nach denen hier gesucht wird — `kw_signout_pending` steht in einem Kommentar
 * in i18n.ts, `localStorage` in der Abgrenzung in signOutLock.ts. Eine in Prosa erwähnte
 * Zeichenkette ist keine benutzte Zeichenkette; ohne diesen Schnitt zählte der Sammler die
 * Begründung als Befund.
 */
function ohneKommentare(inhalt: string): string {
  return inhalt.replace(/^\s*\/\/.*$/gm, "");
}

const I18N = ohneKommentare(readFileSync(join(WURZEL, "apps/web/src/i18n.ts"), "utf8"));
const LEGAL_PAGES = readFileSync(join(WURZEL, "apps/web/src/legal/LegalPages.tsx"), "utf8");
// AUFTRAG-mega64 Block B: die Datei heißt jetzt `abmeldeschuld.ts` — der Zustand ist keine
// Tab-Sperre, sondern eine dem Server geschuldete Abmeldung, und der Dateiname sagt das.
const SIGNOUT_LOCK = ohneKommentare(
  readFileSync(join(WURZEL, "apps/web/src/app/abmeldeschuld.ts"), "utf8"),
);

/** Alle Absatz-Schlüssel der Aufzählung, in Reihenfolge ihres Auftretens (also je Sprache einmal). */
function absatzSchluessel(): string[] {
  return [...I18N.matchAll(/"legal\.privacy\.s4\.(p\d+)"/g)].map((treffer) => treffer[1] ?? "");
}

/** Alle Fassungen EINES Schlüssels in Dateireihenfolge — die drei Sprachblöcke von i18n.ts. */
function fassungen(schluessel: string): string[] {
  const muster = new RegExp(`"${schluessel.replace(/\./g, "\\.")}":\\s*\\n?\\s*"([^"]+)"`, "g");
  return [...I18N.matchAll(muster)].map((treffer) => treffer[1] ?? "");
}

const SPRACHEN = ["DE", "EN", "NL"] as const;

/**
 * AUFTRAG-mega65 Block B: die Wendungen, mit denen eine FRIST behauptet würde — je Sprache. Es sind
 * die wörtlichen mega64-Fassungen plus die allgemeine Form „<Zahl> Stunden/hours/uur", damit auch
 * eine geänderte Zahl aufschlägt und nicht nur die alte.
 */
const FRIST_BEHAUPTET: Record<(typeof SPRACHEN)[number], RegExp> = {
  DE: /vierundzwanzig|\d+\s*Stunden|verfällt (er|sie) (spätestens|nach)/,
  EN: /twenty-four|\d+\s*hours|expires on its own after/,
  NL: /vierentwintig|\d+\s*uur|vervalt zij uiterlijk/,
};

describe("mega63 D · die Speicher-Aufzählung steht in allen drei Sprachen gleich", () => {
  it("drei Sprachen, dieselbe Menge an Einträgen — und keine leere Prüfung", () => {
    const alle = absatzSchluessel();
    // Selbstschutz: findet der Sammler nichts, wäre er grün ohne zu prüfen.
    expect(alle.length, "keine Absätze gefunden").toBeGreaterThan(6);
    expect(
      alle.length % 3,
      `${alle.length} Absätze lassen sich nicht auf drei Sprachen aufteilen`,
    ).toBe(0);

    const proSprache = alle.length / 3;
    const de = alle.slice(0, proSprache);
    const en = alle.slice(proSprache, proSprache * 2);
    const nl = alle.slice(proSprache * 2);
    // Nicht nur die Anzahl: DIESELBEN Schlüssel, in derselben Reihenfolge. Eine Sprache mit p7 und
    // eine mit einem doppelten p6 hätten sonst beide „sieben Einträge".
    expect(en, "EN weicht von DE ab").toEqual(de);
    expect(nl, "NL weicht von DE ab").toEqual(de);
  });

  it("jeder aufgezählte Absatz wird auch WIRKLICH gerendert", () => {
    // Ein Schlüssel im Wörterbuch, den keine Fläche ausgibt, ist keine Angabe — er ist ein Entwurf.
    const proSprache = absatzSchluessel().length / 3;
    const de = absatzSchluessel().slice(0, proSprache);
    for (const p of de) {
      expect(
        LEGAL_PAGES,
        `legal.privacy.s4.${p} steht im Wörterbuch, aber auf keiner Fläche`,
      ).toContain(`legal.privacy.s4.${p}`);
    }
  });
});

describe("mega63 D · der neue Merker aus Block A steht in der Aufzählung", () => {
  it("der Schlüsselname aus dem Code kommt in allen drei Sprachen namentlich vor", () => {
    // Der Name wird aus dem PRODUKTCODE gelesen, nicht hier abgeschrieben. Wer den Token umbenennt,
    // ohne die Rechtstexte nachzuziehen, wird rot — und das ist der ganze Zweck dieses Sammlers.
    const name = SIGNOUT_LOCK.match(/ABMELDESCHULD_SCHLUESSEL = "([^"]+)"/)?.[1];
    expect(name, "ABMELDESCHULD_SCHLUESSEL nicht gefunden").toBeTruthy();
    const treffer = I18N.split("\n").filter((zeile) => zeile.includes(name as string));
    expect(treffer.length, `„${name}" steht in ${treffer.length} statt in 3 Sprachfassungen`).toBe(
      3,
    );
  });

  it("Zweck, Speicherort und Lebensdauer sind benannt, und er ist als notwendig eingeordnet", () => {
    // Der Absatz muss die vier Angaben tragen, sonst ist er eine Erwähnung und keine Auskunft.
    const de = I18N.match(/"legal\.privacy\.s4\.p7":\s*\n?\s*"([^"]+)"/)?.[1] ?? "";
    expect(de, "der deutsche p7-Absatz wurde nicht gefunden").not.toBe("");
    expect(de, "Zweck fehlt").toMatch(/gesperrt|Beendigung/);
    expect(de, "Einordnung als technisch notwendig fehlt").toContain("technisch notwendig");
    // ==========================================================================================
    // AUFTRAG-mega64 BLOCK B — DIESE ZWEI ZEILEN STANDEN HIER GENAU FALSCH HERUM.
    // ==========================================================================================
    //
    // Bis mega63 verlangte dieser Fall `toContain("sessionStorage")` und
    // `not.toContain("localStorage")` — er PINNTE also die Tab-Bindung, die ben als Zusagenkante
    // gemeldet hat. Ein Sammler, der eine Lücke festhält, ist schlimmer als keiner: er macht die
    // Behebung rot und den Mangel grün.
    //
    // Er wird deshalb NICHT gelockert, sondern GEDREHT. Was er prüft, ist unverändert dasselbe:
    // beschreibt der Rechtstext denselben Speicherort, den der Code wirklich benutzt? Nur die
    // Antwort auf „welchen" hat sich geändert, und mit ihr die Lebensdauer.
    expect(SIGNOUT_LOCK, "der Code muss den dauerhaften Browserspeicher benutzen").toContain(
      "localStorage",
    );
    expect(SIGNOUT_LOCK, "der tab-lokale Speicher darf nicht zurückkommen").not.toContain(
      "sessionStorage",
    );
    // Der Text nennt den Ort nicht beim technischen Namen, sondern über seine nachvollziehbaren
    // Eigenschaften: dauerhaft und fensterübergreifend.
    expect(de, "Speicherort (dauerhaft) fehlt").toContain("dauerhaften Browserspeicher");
    expect(de, "Fensterübergreifende Wirkung fehlt").toMatch(/allen Fenstern und Tabs/);
    // Die Lebensdauer steht weiter dabei — jetzt als BEDINGUNG statt als Frist (s. mega65 unten).
    // Bewusst auf die SACHE geprüft und nicht auf einen Satzbau: beide Endbedingungen müssen
    // genannt sein, egal in welcher Fügung.
    expect(de, "Endbedingung „Server bestätigt“ fehlt").toMatch(
      /(bis|sobald) unser Server die Beendigung bestätigt hat/,
    );
    expect(de, "Endbedingung „Sitzung besteht nicht mehr“ fehlt").toMatch(
      /feststeht, dass Ihre Sitzung nicht mehr besteht/,
    );
  });
});

// ================================================================================================
// AUFTRAG-mega65 BLOCK B — DER ABGLEICH BLEIBT, SEINE RICHTUNG DREHT SICH.
// ================================================================================================
//
// Bis mega64 verlangte dieser Sammler die ausgeschriebene Zahl „vierundzwanzig Stunden" im Text UND
// `24*60*60*1000` im Code. Das war der richtige Gedanke am falschen Gegenstand: Er hielt zwei
// Stellen zusammen, von denen die eine eine Zusage machte, die der Code gar nicht einlöste — ben hat
// es belegt (sammel62, ROT-2), und damit pinnte der Sammler eine FALSCHE Tatsachenaussage in einer
// Rechtsfläche fest.
//
// mega65 nimmt die Frist weg, statt sie zu reparieren (Begründung in `app/abmeldeschuld.ts`). Der
// Sammler wird deshalb NICHT gelockert, sondern MITGEZOGEN: Er prüft weiter genau eine Kopplung —
// führt der Code eine Frist, dann muss der Text sie nennen; führt er keine, dann darf er keine
// behaupten. Geprüft wird das in ALLEN DREI Sprachen, denn die falsche Zusage stand in allen drei.
describe("mega65 B · Code ohne Frist, Text ohne Frist", () => {
  it("der Code führt keine Frist — keine Dauer-Konstante, keine Zeitrechnung", () => {
    expect(SIGNOUT_LOCK, "eine Dauer-Konstante ist zurück").not.toContain("ABMELDESCHULD_DAUER_MS");
    // `Date.now()` ist das Mittel, mit dem eine Frist überhaupt ausgewertet würde. Ohne Zeitpunkt
    // gibt es keine Frist, die auslaufen könnte — und keinen Eintrag, an dessen Format sie scheitert.
    expect(SIGNOUT_LOCK, "eine Zeitrechnung ist zurück").not.toMatch(/Date\.now\(\)/);
    // Selbstschutz: die Datei muss überhaupt gelesen worden sein.
    expect(SIGNOUT_LOCK, "abmeldeschuld.ts wurde nicht gelesen").toContain(
      "ABMELDESCHULD_SCHLUESSEL",
    );
  });

  it("keine der drei Sprachfassungen behauptet eine Frist", () => {
    const alle = fassungen("legal.privacy.s4.p7");
    expect(alle.length, `p7 steht in ${alle.length} statt 3 Sprachfassungen`).toBe(3);
    const verstoesse: string[] = [];
    for (const [i, sprache] of SPRACHEN.entries()) {
      if (FRIST_BEHAUPTET[sprache].test(alle[i] ?? "")) {
        verstoesse.push(`p7 (${sprache}) behauptet eine Frist, die der Code nicht führt`);
      }
    }
    expect(verstoesse).toEqual([]);
  });

  it("KALIBRIERUNG: gegen die wörtlichen mega64-Fassungen schlägt der Wächter an", () => {
    // Ohne diese Zeilen wäre der Fall darüber grün, auch wenn die Muster nichts träfen — genau die
    // Sorte Beruhigung, gegen die dieser Sammler steht.
    const mega64 = {
      DE: "kommt beides nicht zustande, verfällt er spätestens nach vierundzwanzig Stunden von selbst",
      EN: "if neither happens, it expires on its own after twenty-four hours at the latest",
      NL: "gebeurt geen van beide, dan vervalt zij uiterlijk na vierentwintig uur vanzelf",
    };
    for (const sprache of SPRACHEN) {
      expect(
        FRIST_BEHAUPTET[sprache].test(mega64[sprache]),
        `der ${sprache}-Wächter erkennt die alte Fristzusage nicht`,
      ).toBe(true);
    }
  });
});
