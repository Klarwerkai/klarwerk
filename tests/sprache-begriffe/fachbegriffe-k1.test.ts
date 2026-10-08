// ================================================================================================
// AUFNAHME gesamt-sprache-begriffe · K1 (R-0908) — FACHBEGRIFFE KEHREN NICHT IN DIE OBERFLÄCHE ZURÜCK.
// ================================================================================================
//
// R-0908 verlangt: „Control Room, Query Console, Expert Studio, Dokument-Canvas, Knowledge Object,
// Trust, Ask, Reasoner, Output Factory, Quorum, Bus-Faktor — alles, was ein Fachmann liebt und eine
// Erstnutzerin bremst, wird übersetzt oder beim ersten Auftreten in einem Halbsatz erklärt."
//
// Der größte Teil ist seit AUFTRAG-mega38 BLOCK I / mega51 BLOCK G1 geliefert (Navigation, Fragen,
// Erfassen, Kopfzeile). Diese Datei hält zweierlei fest:
//
//   A  Der letzte für JEDE Rolle sichtbare „Reasoner" — der Hinweis der Pille „Web-Suche: …" in der
//      Kopfzeile — ist ersetzt (`texte/websuche.ts`), und zwar am ECHTEN Pfad: Ableitung der Pille
//      (`lib/externalStagePill.ts`) und initialisiertes i18next, nicht eine Kopie des Wortlauts.
//   B  Die Produktnamen aus R-0908, die als ganzer Name nie eine deutsche Bedeutung haben, stehen in
//      keinem ausgelieferten Text. Der EINE heute gemessene Rest ist namentlich eingetragen
//      (`BEKANNTER_REST`) — verschwindet er, wird B-1 rot und der Eintrag gehört gestrichen;
//      kommt ein neuer Fund dazu, wird B-1 rot und nennt Sprache, Schlüssel und Begriff.
//
// AUSDRÜCKLICH NICHT HIER: „Trust" und „Ask" sind in EN gewöhnliche Wörter und stecken in
// Platzhaltern (`{{trust}}`); „Trust" bewacht `tests/app/mega52-vertrauenswert-sammler.test.ts`.
// „Bus-Faktor" wird beim Auftreten erklärt („Einzelquellen-Risiko (Bus-Faktor)") und ist in der
// Hilfe ein Suchwort (`tests/help/klara-registry.test.ts`). „Reasoner" steht weiterhin auf den
// Verwalterflächen (Läufe, Konfiguration, Systemhinweise) — das ist ein benannter Rest der Rückgabe,
// kein Gegenstand dieses Wächters.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { externalStagePill } from "../../apps/web/src/lib/externalStagePill";
import websuche from "../../apps/web/src/texte/websuche";

const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];

const HINWEIS = "websuche.hinweis";

/** Die echten Laufzeitressourcen — dieselben Strings, die die Oberfläche ausliefert. */
function bundle(lng: Sprache): Record<string, unknown> {
  const b = i18n.getResourceBundle(lng, "translation") as Record<string, unknown> | undefined;
  if (!b || Object.keys(b).length === 0) {
    throw new Error(`Sprachbestand fehlt oder ist leer: ${lng}`);
  }
  return b;
}

const MODUL: Record<Sprache, Record<string, string>> = {
  de: websuche.de,
  en: websuche.en,
  nl: websuche.nl,
};

/** Was das KI-Modell in der jeweiligen Sprache heißt — so wie die übrige Kopfzeile es nennt. */
const KI_MODELL: Record<Sprache, string> = { de: "KI-Modell", en: "AI model", nl: "AI-model" };

describe("K1 · A — der Hinweis der Web-Suche-Pille sagt nicht mehr „Reasoner“", () => {
  it("A-1: jede Stufe der Pille verweist auf den neuen Hinweis", () => {
    const stufen = ["blocked", "open", "search_on_click", "search_attach", undefined] as const;
    for (const stufe of stufen) {
      expect(externalStagePill(stufe).hintKey, String(stufe)).toBe(HINWEIS);
    }
  });

  it.each(SPRACHEN)("A-2 (%s): der ausgelieferte Hinweis ist Text ohne das Fachwort", (lng) => {
    const text = i18n.getFixedT(lng)(HINWEIS);
    expect(text, `${lng}: roher Schlüssel statt Text`).not.toBe(HINWEIS);
    expect(text.length).toBeGreaterThan(40);
    expect(text).not.toMatch(/reasoner/i);
    // Positiv statt nur „nicht": der Satz nennt das KI-Modell mit dem Wort der übrigen Kopfzeile.
    expect(text).toContain(KI_MODELL[lng]);
  });

  it.each(SPRACHEN)("A-3 (%s): die Laufzeit liefert den Wortlaut des Textmoduls", (lng) => {
    // Sonst wäre A-2 auch grün, wenn ein anderer Bestand denselben Schlüssel überdeckte.
    expect(bundle(lng)[HINWEIS]).toBe(MODUL[lng][HINWEIS]);
  });

  it("A-4: die drei Sprachen sind wirklich drei Sätze — keiner fiel auf Deutsch zurück", () => {
    const werte = SPRACHEN.map((lng) => i18n.getFixedT(lng)(HINWEIS));
    expect(new Set(werte).size).toBe(3);
  });
});

// ------------------------------------------------------------------------------------------------
// B — die Produktnamen aus R-0908
// ------------------------------------------------------------------------------------------------

interface Begriff {
  readonly id: string;
  readonly muster: RegExp;
  /** In welchen Sprachen der Name fremd ist. „knowledge object" ist im Englischen das Wort selbst. */
  readonly sprachen: readonly Sprache[];
}

const BEGRIFFE: readonly Begriff[] = [
  { id: "control room", muster: /control\s+room/i, sprachen: SPRACHEN },
  { id: "query console", muster: /query\s+console/i, sprachen: SPRACHEN },
  { id: "expert studio", muster: /expert\s+studio/i, sprachen: SPRACHEN },
  { id: "dokument-canvas", muster: /dokument-canvas|document\s+canvas/i, sprachen: SPRACHEN },
  { id: "output factory", muster: /output\s+factory/i, sprachen: SPRACHEN },
  { id: "quorum", muster: /\bquorum\b/i, sprachen: SPRACHEN },
  { id: "knowledge object", muster: /knowledge\s+object/i, sprachen: ["de"] },
];

/** Platzhalter tragen Bezeichner, keine Anzeigewörter (`{{trust}}`) — sie zählen nicht. */
const ohnePlatzhalter = (text: string): string => text.replace(/\{\{[^}]*\}\}/g, "");

function funde(lng: Sprache, quelle: Record<string, unknown>): string[] {
  const treffer: string[] = [];
  for (const [schluessel, wert] of Object.entries(quelle)) {
    if (typeof wert !== "string") continue;
    const text = ohnePlatzhalter(wert);
    for (const b of BEGRIFFE) {
      if (b.sprachen.includes(lng) && b.muster.test(text)) {
        treffer.push(`${lng}:${schluessel}:${b.id}`);
      }
    }
  }
  return treffer;
}

/**
 * Der heute gemessene Rest — die Vertraulichkeitshilfe beim Erfassen nennt in Klammern noch
 * „(Output Factory/Export)". Er bleibt hier stehen, weil derselbe Schlüssel in zwei
 * Chromium-Inventaren als Hilfekennung festgenagelt ist (`tests/design/h3-funktionsinventar.test.ts`,
 * `tests/ki-werksaktionen-hilfe/werksaktionen-erklaersatz.test.tsx`) und eine Wertänderung den
 * Umzugsnachweis samt Prüfsumme (`tests/i18n-textmodule/bestand-vorher.json`) neu verlangt.
 * Wer ihn behebt, streicht hier die drei Zeilen.
 */
const BEKANNTER_REST = [
  "de:conf.help:output factory",
  "en:conf.help:output factory",
  "nl:conf.help:output factory",
];

describe("K1 · B — die Produktnamen aus R-0908 stehen in keinem ausgelieferten Text", () => {
  it("B-1: über alle drei Laufzeitbestände — genau der benannte Rest, nichts sonst", () => {
    const alle = SPRACHEN.flatMap((lng) => funde(lng, bundle(lng))).sort();
    expect(alle).toEqual([...BEKANNTER_REST].sort());
  });

  it("B-2: Kalibrierung — der Bestand ist nicht leer, der Wächter prüft wirklich etwas", () => {
    for (const lng of SPRACHEN) {
      const texte = Object.values(bundle(lng)).filter((v) => typeof v === "string");
      expect(texte.length, `Sprache ${lng} liefert kaum Texte`).toBeGreaterThan(1000);
    }
  });

  it("B-3: Rotnachweis — jeder Begriff würde in seiner Sprache gefunden", () => {
    for (const b of BEGRIFFE) {
      for (const lng of b.sprachen) {
        const probe = { "probe.schluessel": `Weiter zur ${b.id.toUpperCase()} — jetzt.` };
        const erwartet = [`${lng}:probe.schluessel:${b.id}`];
        expect(funde(lng, probe), `${b.id} in ${lng}`).toEqual(erwartet);
      }
    }
  });

  it("B-4: Platzhalter zählen nicht — „{{quorum}}“ ist ein Bezeichner", () => {
    expect(funde("de", { "probe.platzhalter": "Stand {{quorum}} erreicht" })).toEqual([]);
  });
});
