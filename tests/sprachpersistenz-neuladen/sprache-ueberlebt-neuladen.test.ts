// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { ERLAUBTE_SPRACHEN, I18N_LANGUAGE_CHANGED_EVENT } from "../../apps/web/src/lib/htmlLang";
import {
  SPRACHE_STORAGE_KEY,
  STANDARD_SPRACHE,
  bindSpracheSpeichern,
  gespeicherteSprache,
} from "../../apps/web/src/lib/sprachwahl";

// ================================================================================================
// JOB 3086 — DIE GEWÄHLTE SPRACHE ÜBERLEBT DAS NEULADEN.
// ================================================================================================
//
// Ausgangslage (am Basisstand selbst gelesen): `apps/web/src/i18n.ts` startete mit fest
// verdrahtetem `lng: "de"`. Wer unter `/profil` auf EN stellte, sah nach F5 wieder Deutsch — die
// Wahl lebte nur bis zum Neuladen.
//
// DIE FALLE, DIE DIESER TEST VERMEIDEN MUSS: Ein Test, der nur `gespeicherteSprache()` prüft, wäre
// auch dann grün, wenn `i18n.ts` den gelesenen Wert nie benutzt. Erst Fall 8 schließt die
// Nutzenkette: eine ZWEITE Auswertung des i18n-Moduls (= das Neuladen der Seite) mit „en" im
// Speicher muss `i18n.language === "en"` ergeben, ohne dass irgendwer `changeLanguage` ruft.
//
// Zwei nachgemessene Eigenschaften der Umgebung, ohne die man Fall 8 falsch liest:
//  · `vi.resetModules()` setzt NUR die Projektquellen zurück, nicht die externalisierten Pakete
//    aus `node_modules`. Der Standard-Export von `i18next` ist ein Singleton und bleibt deshalb
//    über die zweite Auswertung hinweg DASSELBE Objekt (gemessen 05.09.: `neu === i18n`). Eine
//    Identitätsprüfung wäre hier also kein Beleg für die zweite Auswertung — sie wäre immer rot.
//    Belegt wird die zweite Auswertung stattdessen am `init`-Aufruf des Modulrumpfs: nach
//    `resetModules` zählt der Spion GENAU EINEN weiteren Aufruf, und dessen `lng` ist der Wert,
//    den `gespeicherteSprache()` gelesen hat. Ohne zweite Auswertung wäre der Zähler 0.
//  · Ein zweites `init({ lng })` auf derselben i18next-Instanz stellt die Sprache wirklich um
//    (gemessen 05.09.: nach `init({lng:"en"})` steht `i18n.language === "en"`). Der Fall misst
//    also den Start, nicht einen Cache.
//
// `i18n` ist ein MODUL-SINGLETON, das alle Fälle teilen. Zuhörer würden sich sonst über Fälle
// hinweg anhäufen — genau dafür gibt `bindSpracheSpeichern` seine Abmeldung zurück (Fall 7).
//
// AUSDRÜCKLICH NICHT GEPRÜFT: `apps/web/src/pages/Profile.tsx`. Der Umschalter wird von diesem
// Auftrag nicht angefasst; sein Klick ruft `changeLanguage`, i18next feuert `languageChanged`, und
// geschrieben wird an der Wurzel (Fall 5 prüft genau diese Stelle der Kette).
// ================================================================================================

// Der Wurzel-Typecheck ist BEWUSST Node-rein (`lib: ["ES2022"]`, tsconfig.json:6) — DOM-Typen hat
// nur der `.tsx`-Topf. Diese Datei mountet nichts, also wird der Speicher strukturell erreicht,
// genau wie das Dokument in tests/app/web-html-lang-bindung-101.test.ts:39-51. Zur Laufzeit ist es
// unter jsdom der echte `localStorage`.
type SpeicherLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function speicher(): SpeicherLike {
  const s = (globalThis as unknown as { localStorage?: SpeicherLike }).localStorage;
  if (s === undefined) {
    throw new Error("Kein `localStorage` — der jsdom-Schalter im Dateikopf greift nicht.");
  }
  return s;
}

function gespeichert(): string | null {
  return speicher().getItem(SPRACHE_STORAGE_KEY);
}

// Die Zuhörer-Landkarte von i18next: `observers[ereignis]` ist eine Map(zuhoerer → Anzahl).
// Übernommen aus tests/app/web-html-lang-bindung-101.test.ts:57-69 (dort gegen i18next 23.16.8
// nachgemessen); der Zugriff wird hier erneut geprüft, statt ihn vorauszusetzen.
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

describe("JOB 3086 · die gewählte Sprache überlebt das Neuladen", () => {
  let abmelden: (() => void) | undefined;

  beforeAll(async () => {
    // Wartet zugleich auf den Abschluss der Initialisierung aus i18n.ts.
    await i18n.changeLanguage("de");
  });

  afterEach(async () => {
    // Reihenfolge zählt: erst abmelden, sonst schriebe der Rückwechsel auf „de" in den Speicher
    // und der nächste Fall fände einen Wert vor, den er nicht gesetzt hat.
    abmelden?.();
    abmelden = undefined;
    await i18n.changeLanguage("de");
    speicher().removeItem(SPRACHE_STORAGE_KEY);
  });

  it("1 · Erststart ohne gespeicherte Wahl: Deutsch", () => {
    expect(gespeichert(), "Vorbedingung: der Schlüssel darf hier nicht gesetzt sein").toBeNull();
    expect(gespeicherteSprache()).toBe("de");
    // Die Vorgabe steht wörtlich im Produkt, nicht nur im Test.
    expect(STANDARD_SPRACHE).toBe("de");
  });

  it("2 · eine gespeicherte Wahl wird gelesen", () => {
    speicher().setItem(SPRACHE_STORAGE_KEY, "en");
    expect(gespeicherteSprache()).toBe("en");
    speicher().setItem(SPRACHE_STORAGE_KEY, "nl");
    expect(gespeicherteSprache()).toBe("nl");
  });

  it("3 · Fremd- und Randwerte fallen auf Deutsch zurück und verlassen nie die erlaubte Menge", () => {
    // „de-DE" steht hier bewusst mit: es wird NICHT zu „de" normalisiert, sondern verworfen — der
    // Rückgabewert ist die Vorgabe, nicht der zurechtgebogene Wert (Ownerentscheidung JOB 536,
    // zitiert in htmlLang.ts:53-57).
    for (const roh of ["fr", "de-DE", "", "DE", "en-GB", "{kaputt}"]) {
      speicher().setItem(SPRACHE_STORAGE_KEY, roh);
      const ergebnis = gespeicherteSprache();
      expect(ergebnis, `„${roh}" ist nicht erlaubt und muss auf die Vorgabe fallen`).toBe("de");
      expect(
        ERLAUBTE_SPRACHEN.includes(ergebnis),
        `der Rückgabewert für „${roh}" muss in ERLAUBTE_SPRACHEN liegen`,
      ).toBe(true);
    }
  });

  it("4 · kein Speicher: ein werfender localStorage-Getter führt auf Deutsch, nicht in den Absturz", () => {
    const beschreibung = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    if (beschreibung === undefined) {
      throw new Error("Kein eigener `localStorage`-Deskriptor — dieser Fall wäre wirkungslos.");
    }
    try {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        get() {
          throw new Error("Speicher verweigert (Origin-Policy)");
        },
      });
      // Ohne diese Prüfung wäre der Fall leer, falls das Ersetzen still misslänge.
      let geworfen = false;
      try {
        JSON.stringify((globalThis as { localStorage?: unknown }).localStorage);
      } catch {
        geworfen = true;
      }
      expect(geworfen, "der ersetzte Getter muss wirklich werfen").toBe(true);

      expect(() => gespeicherteSprache()).not.toThrow();
      expect(gespeicherteSprache()).toBe("de");
    } finally {
      Object.defineProperty(globalThis, "localStorage", beschreibung);
    }
    expect(() => speicher()).not.toThrow();
  });

  it("5 · die Wurzelbindung schreibt jeden Wechsel — ohne Zutun des Umschalters", async () => {
    abmelden = bindSpracheSpeichern(i18n);
    expect(gespeichert(), "vor dem Wechsel steht nichts im Speicher").toBeNull();
    await i18n.changeLanguage("nl");
    expect(gespeichert()).toBe("nl");
    await i18n.changeLanguage("en");
    expect(gespeichert()).toBe("en");
  });

  it("6 · ein unbrauchbarer Wechsel überschreibt den gültigen Eintrag nicht", async () => {
    abmelden = bindSpracheSpeichern(i18n);
    await i18n.changeLanguage("nl");
    expect(gespeichert()).toBe("nl");

    await i18n.changeLanguage("fr");
    expect(i18n.language, "i18next hat den Wechsel wirklich vollzogen").toBe("fr");
    expect(gespeichert(), "fr ist nicht erlaubt: der zuletzt gültige Eintrag bleibt stehen").toBe(
      "nl",
    );
  });

  it("7 · die Abmeldung stoppt das Schreiben, häuft keine Zuhörer an und ist idempotent", async () => {
    const karte = beobachter();
    const basis = karte[I18N_LANGUAGE_CHANGED_EVENT]?.size ?? 0;

    const loesenA = bindSpracheSpeichern(i18n);
    const loesenB = bindSpracheSpeichern(i18n);
    const nachBinden = karte[I18N_LANGUAGE_CHANGED_EVENT];
    if (!(nachBinden instanceof Map)) {
      throw new Error(
        `observers.${I18N_LANGUAGE_CHANGED_EVENT} ist keine Map — die Zählung wäre wirkungslos.`,
      );
    }
    expect(nachBinden.size).toBe(basis + 2);

    loesenA();
    loesenA(); // zweiter Aufruf: darf nichts tun, nicht werfen und B NICHT abmelden
    expect(karte[I18N_LANGUAGE_CHANGED_EVENT]?.size ?? 0).toBe(basis + 1);
    await i18n.changeLanguage("nl");
    expect(gespeichert(), "B hört noch zu").toBe("nl");

    loesenB();
    expect(karte[I18N_LANGUAGE_CHANGED_EVENT]?.size ?? 0).toBe(basis);
    speicher().removeItem(SPRACHE_STORAGE_KEY);
    await i18n.changeLanguage("en");
    expect(gespeichert(), "nach der Abmeldung schreibt niemand mehr").toBeNull();
  });

  it("8 · NEULADEN: die zweite Auswertung des i18n-Moduls startet in der gespeicherten Sprache", async () => {
    speicher().setItem(SPRACHE_STORAGE_KEY, "en");

    // Der Spion ruft durch (vitest-Standard) — er misst nur, er ersetzt nichts.
    const initSpion = vi.spyOn(i18n, "init");
    try {
      vi.resetModules();
      const neu = (await import("../../apps/web/src/i18n")).default;

      // BELEG, DASS DIE ZWEITE AUSWERTUNG WIRKLICH STATTFAND (siehe Dateikopf): der Modulrumpf
      // ruft `init` genau einmal. Ohne erneute Auswertung stünde hier 0, und der Rest des Falls
      // würde nur den Zustand aus der ERSTEN Auswertung nachmessen.
      expect(initSpion.mock.calls.length, "der Modulrumpf muss erneut gelaufen sein").toBe(1);
      const argumente = initSpion.mock.calls[0]?.[0] as { lng?: unknown } | undefined;
      expect(
        argumente?.lng,
        "`lng` kommt aus der gespeicherten Wahl, nicht aus einer Konstante",
      ).toBe("en");

      // UND DAS IST DER NUTZEN: die Oberfläche startet englisch, ohne dass jemand geklickt oder
      // `changeLanguage` gerufen hat.
      expect(neu.language).toBe("en");
      expect(i18n.language).toBe("en");
    } finally {
      initSpion.mockRestore();
    }
  });

  // ==============================================================================================
  // FALL 9 · MUTATIONSPROBEN (Lehre JOB 3078 R1: ein Wächter, den man abschalten kann, ohne dass
  // etwas rot wird, ist kein Wächter). Beide am 05.09.2026 wirklich gefahren, Ergebnis wörtlich:
  //
  //  (a) `apps/web/src/i18n.ts:14366` zurück auf `lng: "de"`:
  //      → `AssertionError: `lng` kommt aus der gespeicherten Wahl, nicht aus einer Konstante:
  //         expected 'de' to be 'en' // Object.is equality`
  //      → `Tests  1 failed | 7 passed (8)` — genau Fall 8.
  //
  //  (b) den `writeStoredString`-Aufruf im Zuhörer von `bindSpracheSpeichern`
  //      (`apps/web/src/lib/sprachwahl.ts`) entfernt:
  //      → `AssertionError: expected null to be 'nl' // Object.is equality`
  //      → `Tests  3 failed | 5 passed (8)` — Fall 5 wie verlangt, zusätzlich die Fälle 6 und 7,
  //         die auf demselben Schreibweg stehen.
  //
  //  Beide Mutationen wurden danach zurückgenommen; der Lauf steht wieder bei 8 grün.
  // ==============================================================================================
});
