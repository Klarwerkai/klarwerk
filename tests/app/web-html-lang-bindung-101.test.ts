// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  ERLAUBTE_SPRACHEN,
  HTML_LANG_ATTRIBUTE,
  I18N_LANGUAGE_CHANGED_EVENT,
  applyHtmlLang,
  bindHtmlLang,
} from "../../apps/web/src/lib/htmlLang";

// ================================================================================================
// AUFTRAG-101 — <html lang> FOLGT DER AKTIVEN i18n-SPRACHE.
// ================================================================================================
//
// Preflight 98 hat den Defekt gemessen und dabei eine Falle benannt, die dieser Test ausdrücklich
// vermeiden muss: `apps/web/index.html` deklariert statisch `lang="de"`. Im BROWSER ist der
// Startzustand damit auch OHNE jede Bindung korrekt. Ein Test, der nur „de" prüft — oder nur den
// Rückwechsel `de → en → de` — wäre deshalb auch ohne Bindung grün.
//
// DIE TRAGENDE ZUSICHERUNG IST DER ZUSTAND NACH EINEM WECHSEL WEG VON „de". Der Rückwechsel steht
// hier zusätzlich, nie allein (Fall 5 prüft deshalb den Zwischenstand „en" mit).
//
// Zwei Eigenschaften der Umgebung, die man kennen muss, um die Fälle zu lesen:
//  · jsdom lädt index.html NICHT. Das Dokument startet OHNE `lang` (Fall 1 hält das fest). Deshalb
//    ist hier auch die Startsetzung kausal prüfbar — im Browser wäre sie es nicht.
//  · `i18n` ist ein MODUL-SINGLETON. Alle Fälle teilen dieselbe Instanz; ohne Abmeldung häufen sich
//    Zuhörer über Fälle hinweg an. Genau dafür gibt `bindHtmlLang` seine Abmeldung zurück (Fall 7).
//
// AUSDRÜCKLICH NICHT GEPRÜFT: die Wirkung auf Vorlesewerkzeuge. Dass eine falsche
// Sprachdeklaration die Aussprache stört, ist die dokumentierte Erwartung von WCAG 3.1.1 — hier
// läuft kein Vorlesewerkzeug, also wird dazu nichts behauptet.
// ================================================================================================

// Der Wurzel-Typecheck ist BEWUSST Node-rein (`lib: ["ES2022"]`, tsconfig.json:20-25) — die
// DOM-Typen hat nur der `.tsx`-Topf, und der ist laut derselben Notiz für GEMOUNTETE React-Tests
// gedacht. Diese Datei mountet nichts. Also wird das Dokument hier strukturell erreicht, genau wie
// in htmlLang.ts und designTheme.ts. Zur Laufzeit ist es unter jsdom das echte Dokument.
type WurzelElement = {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};

function dokument(): { documentElement: WurzelElement } {
  const doc = (globalThis as unknown as { document?: { documentElement: WurzelElement } }).document;
  if (doc === undefined) {
    throw new Error("Kein `document` — der jsdom-Schalter im Dateikopf greift nicht.");
  }
  return doc;
}

function langAttribut(): string | null {
  return dokument().documentElement.getAttribute(HTML_LANG_ATTRIBUTE);
}

// Die Zuhörer-Landkarte von i18next: `observers[ereignis]` ist eine Map(zuhoerer → Anzahl).
// Zur Laufzeit gegen i18next 23.16.8 nachgemessen, nicht angenommen.
type Beobachterkarte = Record<string, Map<unknown, number> | undefined>;

function beobachter(): Beobachterkarte {
  const roh = (i18n as unknown as { observers?: Beobachterkarte }).observers;
  if (roh === undefined) {
    throw new Error(
      "i18next legt keine `observers` offen — die Zuhörer-Zählung in Fall 7 wäre wirkungslos.",
    );
  }
  return roh;
}

describe("AUFTRAG-101 · <html lang> folgt der aktiven i18n-Sprache", () => {
  let abmelden: (() => void) | undefined;

  beforeAll(async () => {
    // Wartet zugleich auf den Abschluss der Initialisierung aus i18n.ts.
    await i18n.changeLanguage("de");
  });

  afterEach(async () => {
    abmelden?.();
    abmelden = undefined;
    await i18n.changeLanguage("de");
    dokument().documentElement.removeAttribute(HTML_LANG_ATTRIBUTE);
  });

  it("1 · Ausgangslage: jsdom deklariert gar nichts — die Zusicherung lebt nicht vom Startwert", () => {
    expect(langAttribut()).toBeNull();
  });

  it("2 · setzt beim Binden sofort den aktuellen Stand (DE)", () => {
    expect(i18n.language).toBe("de");
    abmelden = bindHtmlLang(i18n);
    expect(langAttribut()).toBe("de");
  });

  it("3 · folgt dem Wechsel auf EN", async () => {
    abmelden = bindHtmlLang(i18n);
    await i18n.changeLanguage("en");
    expect(i18n.language).toBe("en");
    expect(langAttribut()).toBe("en");
  });

  it("4 · folgt dem Wechsel auf NL", async () => {
    abmelden = bindHtmlLang(i18n);
    await i18n.changeLanguage("nl");
    expect(i18n.language).toBe("nl");
    expect(langAttribut()).toBe("nl");
  });

  it("5 · folgt dem Rückwechsel auf DE — mit belegtem Zwischenstand, nicht nur am Ende", async () => {
    abmelden = bindHtmlLang(i18n);
    await i18n.changeLanguage("en");
    // Ohne diese Zwischenprüfung wäre der Fall auch ohne Bindung grün: er endet ja wieder bei „de".
    expect(langAttribut()).toBe("en");
    await i18n.changeLanguage("de");
    expect(langAttribut()).toBe("de");
  });

  it("6 · nach der Abmeldung folgt das Dokument nicht mehr", async () => {
    const loesen = bindHtmlLang(i18n);
    expect(langAttribut()).toBe("de");
    loesen();
    await i18n.changeLanguage("en");
    expect(i18n.language).toBe("en");
    expect(langAttribut()).toBe("de");
  });

  it("7 · häuft über wiederholtes Binden keine Zuhörer an", () => {
    const karte = beobachter();
    const basis = karte[I18N_LANGUAGE_CHANGED_EVENT]?.size ?? 0;

    const loesen = [bindHtmlLang(i18n), bindHtmlLang(i18n), bindHtmlLang(i18n)];
    const nachBinden = karte[I18N_LANGUAGE_CHANGED_EVENT];
    if (!(nachBinden instanceof Map)) {
      throw new Error(
        `observers.${I18N_LANGUAGE_CHANGED_EVENT} ist keine Map — die Zählung wäre wirkungslos.`,
      );
    }
    expect(nachBinden.size).toBe(basis + 3);

    for (const l of loesen) {
      l();
    }
    expect(karte[I18N_LANGUAGE_CHANGED_EVENT]?.size ?? 0).toBe(basis);
  });

  it("8 · die Abmeldung ist idempotent und trifft nie eine fremde Bindung", async () => {
    const loesenA = bindHtmlLang(i18n);
    loesenA();
    loesenA(); // zweiter Aufruf: darf nichts tun und nicht werfen

    const loesenB = bindHtmlLang(i18n);
    loesenA(); // dritter Aufruf von A — darf B NICHT abmelden
    await i18n.changeLanguage("nl");
    expect(langAttribut()).toBe("nl");

    loesenB();
    await i18n.changeLanguage("en");
    expect(langAttribut()).toBe("nl");
  });

  it("9 · eine leere Sprache lässt den vorhandenen Wert stehen, statt ihn zu leeren", () => {
    dokument().documentElement.setAttribute(HTML_LANG_ATTRIBUTE, "de");
    applyHtmlLang("");
    expect(langAttribut()).toBe("de");
  });

  it("10 · ohne Dokument passiert nichts — kein Absturz im DOM-freien Pfad", () => {
    const beschreibung = Object.getOwnPropertyDescriptor(globalThis, "document");
    if (beschreibung === undefined) {
      throw new Error("Kein `document` auf globalThis — dieser Fall wäre wirkungslos.");
    }
    try {
      Object.defineProperty(globalThis, "document", { value: undefined, configurable: true });
      // Ohne diese Prüfung wäre der Fall leer, falls das Ersetzen still misslänge.
      expect((globalThis as { document?: unknown }).document).toBeUndefined();
      expect(() => {
        applyHtmlLang("en");
      }).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, "document", beschreibung);
    }
    expect((globalThis as { document?: unknown }).document).toBeDefined();
  });

  // ==============================================================================================
  // JOB 1472 · D1 — DIE ERLAUBTE MENGE IST GENAU `de|en|nl`.
  // ==============================================================================================
  //
  // HERKUNFT: Ownerentscheidung zu JOB 536, getroffen von Pedi am 13.08.2026
  // (`00_CONTROL/ENTSCHEIDUNGEN/JOB-536.md`): *„genau `de|en|nl` zulassen, alles andere als No-op
  // behandeln, ausdrücklich nicht normalisieren."* JOB 1289 hat am 20.08. am Produktstand
  // nachgemessen, dass die Prüfung fehlt und `applyHtmlLang` jeden nichtleeren Wert schreibt.
  //
  // WARUM DIE FÄLLE SO GEBAUT SIND — die Falle ist dieselbe wie im Dateikopf, eine Ebene tiefer:
  // Ein No-op ist von einer NORMALISIERUNG nur dann zu unterscheiden, wenn der vorher stehende
  // Wert ein anderer ist als der, auf den normalisiert würde. Fall 13 setzt deshalb „en" vor und
  // ruft `applyHtmlLang("de-DE")`: Stünde danach „de", wäre normalisiert worden — und der Fall
  // wäre auch mit einer Normalisierung grün, die der Auftrag ausdrücklich ausschliesst.
  //
  // Fall 11 ist die KALIBRIERUNG in die Gegenrichtung: Er ist auch ohne die Prüfung grün und hält
  // fest, dass die Prüfung nicht zu viel wegnimmt. Rot vor dem Bau sind 12, 13 und 14.

  it("11 · KALIBRIERUNG: die drei erlaubten Sprachen kommen an", () => {
    for (const sprache of ["de", "en", "nl"]) {
      // Ein Vorwert ausserhalb der Menge — sonst könnte „unverändert" wie „übernommen" aussehen.
      dokument().documentElement.setAttribute(HTML_LANG_ATTRIBUTE, "xx");
      applyHtmlLang(sprache);
      expect(langAttribut(), `„${sprache}" ist erlaubt und muss ankommen`).toBe(sprache);
    }
  });

  it("12 · ein unbekannter Wert ist No-op — der vorhandene Wert bleibt stehen", () => {
    dokument().documentElement.setAttribute(HTML_LANG_ATTRIBUTE, "de");
    applyHtmlLang("fr");
    expect(langAttribut(), "fr steht nicht in der erlaubten Menge und darf nicht ankommen").toBe(
      "de",
    );
  });

  it("13 · ein Regionalcode wird NICHT normalisiert, sondern ist No-op", () => {
    dokument().documentElement.setAttribute(HTML_LANG_ATTRIBUTE, "en");
    applyHtmlLang("de-DE");
    expect(
      langAttribut(),
      "de-DE ist weder erlaubt noch wird es zu de normalisiert — en muss stehen bleiben",
    ).toBe("en");
  });

  it("14 · die erlaubte Menge ist genau de, en, nl — und wächst nicht still mit", () => {
    // Die Fälle 11 bis 13 nennen ihre Werte wörtlich und prüfen deshalb Verhalten, nicht die
    // Liste gegen sich selbst. Dieser Fall pinnt zusätzlich die Liste: Wer eine vierte Sprache
    // aufnimmt, ohne die Zusicherung neu zu verhandeln, macht ihn rot.
    expect([...ERLAUBTE_SPRACHEN]).toEqual(["de", "en", "nl"]);
  });
});
