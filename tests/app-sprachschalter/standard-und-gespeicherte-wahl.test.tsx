// @vitest-environment jsdom
// ================================================================================================
// JOB 3323 · E — WOMIT DIE APP AUFGEHT, UND WAS DER NEUE SCHALTER MIT DER GESPEICHERTEN WAHL TUT.
// ================================================================================================
//
// Lieferpunkt 4 des Auftrags: „gespeicherte Wahl, sonst Deutsch (Pedis Vorgabe), Browsersprache nur
// als Fallback". Zwei davon sind SEIT JOB 3086 GEBAUT UND GEMESSEN und werden hier NICHT noch
// einmal gemessen — `tests/sprachpersistenz-neuladen/sprache-ueberlebt-neuladen.test.ts` hält die
// Fälle 1 (Erststart ohne Wahl → Deutsch), 2 (gespeicherte Wahl wird gelesen), 3 (Fremdwerte fallen
// zurück) und 8 (Neuladen startet in der gespeicherten Sprache). Sie hier abzuschreiben ergäbe eine
// zweite Wahrheit über dieselbe Zusicherung.
//
// WAS DIESER AUFTRAG DAZULEGT, sind genau die beiden Fragen, die vorher niemand stellen musste:
//
//   E1  DIE BROWSERSPRACHE. Der Auftrag nennt sie „nur als Fallback"; die Ownerentscheidung zu
//       JOB 536 vom 13.08.2026 (zitiert in `apps/web/src/lib/htmlLang.ts`) sagt dagegen: genau
//       `de|en|nl` zulassen, KEIN LanguageDetector, nicht normalisieren. Beides zusammen geht nur
//       in eine Richtung — die Browsersprache kommt NIE zum Zug, weil die Vorgabe „de" den
//       Fallback-Platz schon besetzt. Der Auftrag verlangt in seiner eigenen Gegenprobe genau das
//       („Standard auf Browsersprache → (e) rot"). Hier wird es zur ausführbaren Zusicherung:
//       ein englischer Browser bekommt trotzdem Deutsch, und es gibt keinen Detector, der das
//       morgen unbemerkt ändern könnte.
//
//   E2  DER RUNDLAUF DES NEUEN SCHALTERS. Er merkt sich die Wahl NICHT selbst — das täte er falsch
//       (die Lehre steht in `lib/htmlLang.ts` und `lib/sprachwahl.ts`: das Merken wohnt an der
//       Wurzel, sonst merkt sich ein Umschalter die Wahl und der nächste nicht). Zu belegen ist
//       deshalb nicht, dass er speichert, sondern dass die BESTEHENDE Wurzelbindung ihn TRÄGT:
//       ein Klick im Konto-Menü landet im Browserspeicher und am `<html lang>`, ohne dass in
//       `SprachSchalter.tsx` eine einzige Zeile dafür steht. Das ist der Beleg für „wiederverwendet,
//       nicht dupliziert".
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia Klar", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const make = (pfad: string): unknown =>
    new Proxy(
      vi.fn(async () => []),
      {
        get(target, prop, recv) {
          if (prop in target || typeof prop === "symbol") {
            return Reflect.get(target, prop, recv);
          }
          return make(pfad === "" ? String(prop) : `${pfad}.${String(prop)}`);
        },
      },
    );
  return { endpoints: make("") };
});

import { QueryClient } from "../../apps/web/node_modules/@tanstack/react-query";
import { createElement } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import {
  EINTRITT_SPRACHEN,
  ERLAUBTE_SPRACHEN,
  HTML_LANG_ATTRIBUTE,
  bindHtmlLang,
  sprachAusEintritt,
} from "../../apps/web/src/lib/htmlLang";
import {
  SPRACHE_STORAGE_KEY,
  STANDARD_SPRACHE,
  bindSpracheSpeichern,
  gespeicherteSprache,
} from "../../apps/web/src/lib/sprachwahl";
import { Library } from "../../apps/web/src/pages/Library";
import { type Montage, breite, klick, kontoMenueOeffnen, montiere, sprachKnopf } from "./huelle";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

/** Der Browser tut so, als stünde er auf Englisch — samt Sprachliste. */
function browserSprache(wert: string): void {
  Object.defineProperty(globalThis.navigator, "language", {
    value: wert,
    configurable: true,
  });
  Object.defineProperty(globalThis.navigator, "languages", {
    value: [wert, wert.split("-")[0]],
    configurable: true,
  });
}

let montage: Montage | null = null;

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
  document.documentElement.setAttribute(HTML_LANG_ATTRIBUTE, "de");
  breite(1280);
});

afterEach(() => {
  montage?.abbauen();
  montage = null;
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("JOB 3323 E1 · Vorgabe ist Deutsch — die Browsersprache entscheidet nichts", () => {
  it("ohne gespeicherte Wahl gilt Deutsch, auch wenn der Browser Englisch spricht", () => {
    browserSprache("en-US");
    expect(globalThis.navigator.language).toBe("en-US");
    // Die Vorgabe ist eine Konstante des Produkts, kein hier abgeschriebener Wert.
    expect(STANDARD_SPRACHE).toBe("de");
    expect(gespeicherteSprache()).toBe(STANDARD_SPRACHE);
  });

  it("die gespeicherte Wahl schlägt die Browsersprache — in beide Richtungen", () => {
    browserSprache("en-US");
    window.localStorage.setItem(SPRACHE_STORAGE_KEY, "nl");
    expect(gespeicherteSprache()).toBe("nl");
    browserSprache("de-DE");
    window.localStorage.setItem(SPRACHE_STORAGE_KEY, "en");
    expect(gespeicherteSprache()).toBe("en");
  });

  it("es gibt keinen LanguageDetector — die Browsersprache hat gar keinen Weg hinein", () => {
    // Ownerentscheidung zu JOB 536 (13.08.2026), zitiert in `lib/htmlLang.ts`. Ein später
    // eingehängter Detector würde diese Zusicherung rot machen, statt still zu wirken.
    const dienste = (i18n as unknown as { services?: { languageDetector?: unknown } }).services;
    expect(dienste?.languageDetector ?? null).toBeNull();
    expect(
      (i18n as unknown as { options?: { detection?: unknown } }).options?.detection ?? null,
    ).toBeNull();
  });
});

// ==================================================================================================
// JOB 3323 R2 · E3 — DER EINTRITT MIT SPRACHE (`?lang=…`), Nachführung 2026-09-09T00:21 aus JOB 3280.
// ==================================================================================================
//
// Klara verlinkt einen gesicherten Entwurf als `/capture/frontdoor?draft=<id>&lang=en|de`. Hier
// steht die ENTSCHEIDUNG dieses Eintritts als reine Funktion: welche Sprache nennt die Adresse, und
// was gilt, wenn sie keine oder eine unbekannte nennt. Dass diese Entscheidung in `i18n.ts` auch
// WIRKLICH als Startsprache ankommt und der Entwurf dabei geladen wird, misst die Nachbardatei
// `eintritt-mit-sprache.test.tsx` am echten Modul — dort wird `i18n` erst NACH dem Setzen der
// Adresse geholt. Beides zusammen ist die Zusicherung; diese Fälle hier allein wären nur eine
// Aussage über eine Funktion, die niemand ruft.
//
// ================================================================================================
// RUNDE 3 — DIE KORREKTUR: DER LINKVERTRAG IST `de|en`, UND NUR DAS.
// ================================================================================================
// Runde 2 hat hier `nl` durchgelassen, mit dem Argument, die erlaubte Menge der Anwendung stehe
// genau einmal und eine zweite Liste wäre eine zweite Wahrheit. Das war die falsche Abwägung, und
// ben hat sie zu Recht rot gemacht: die Nachführung 00:21 sagt „nur zulässige Werte de|en", und
// eine verbindliche Vorgabe wird nicht durch eine Bauüberlegung überstimmt.
//
// SACHLICH IST ES AUCH DIE RICHTIGERE TRENNUNG. Es sind ZWEI VERSCHIEDENE TATSACHEN:
//   · `ERLAUBTE_SPRACHEN` — welche Sprachen die ANWENDUNG kann (heute de|en|nl).
//   · `EINTRITT_SPRACHEN` — was ein FREMDER LINK von aussen sagen darf (de|en, JOB 3280).
// Die zweite ist ein Vertrag mit Klara, keine Eigenschaft der Anwendung; sie ist enger, weil ein
// Link aus Word nur diese beiden schickt. Dass sie keine Sprache nennen kann, die es gar nicht
// gibt, hält der Teilmengenfall unten fest — damit sind die beiden Listen gekoppelt, statt
// unabhängig auseinanderzulaufen. Die Wahl von Niederländisch unter /profil und im Konto-Menü
// bleibt davon unberührt: dort entscheidet der Mensch, nicht ein Link.
describe("JOB 3323 E3 · der Eintritt mit `?lang=` — die Adresse darf die Sprache setzen", () => {
  it("nennt die Adresse `de` oder `en`, gilt sie — auch neben `?draft=`", () => {
    expect(sprachAusEintritt("?lang=en")).toBe("en");
    expect(sprachAusEintritt("?lang=de")).toBe("de");
    // Der Weg, den Klara wirklich schickt (JOB 3280) — die Reihenfolge der Parameter zählt nicht.
    expect(sprachAusEintritt("?draft=D-7&lang=en")).toBe("en");
    expect(sprachAusEintritt("?lang=en&draft=D-7")).toBe("en");
  });

  it("der Vertrag ist GENAU `de|en` — und er kann nur Sprachen nennen, die es wirklich gibt", () => {
    expect([...EINTRITT_SPRACHEN]).toEqual(["de", "en"]);
    // Die Kopplung an die Anwendung: der Linkvertrag darf enger sein, aber nie etwas erlauben, was
    // die Anwendung gar nicht kann. Ohne diesen Fall könnten die beiden Listen auseinanderlaufen,
    // und `?lang=fr` liesse sich hier eintragen, ohne dass irgendwo etwas rot würde.
    for (const l of EINTRITT_SPRACHEN) {
      expect(ERLAUBTE_SPRACHEN, `„${l}“ steht im Linkvertrag, kann die App aber nicht`).toContain(
        l,
      );
    }
  });

  it("ein unbekannter, leerer oder fehlender Wert sagt NICHTS — und stürzt nicht ab", () => {
    for (const suche of [
      // `nl` KANN die Anwendung, der Linkvertrag nennt es aber nicht (Nachführung 00:21). Es wird
      // still ignoriert wie jeder andere nicht vereinbarte Wert — kein Absturz, keine Meldung.
      "?lang=nl",
      "?lang=xx",
      "?lang=fr",
      "?lang=de-DE", // NICHT normalisiert (Ownerentscheidung JOB 536) — also nicht gesagt.
      "?lang=",
      "?lang",
      "?draft=D-7",
      "",
      "?",
      "?&&=x",
    ]) {
      expect(sprachAusEintritt(suche), `„${suche}“ hätte keine Sprache setzen dürfen`).toBeNull();
    }
  });

  it("die Rangfolge: Adresse vor gespeicherter Wahl vor Vorgabe — genau wie in i18n.ts", () => {
    // Dieselbe Verknüpfung, die `apps/web/src/i18n.ts` als `lng` setzt.
    const startsprache = (suche: string): string =>
      sprachAusEintritt(suche) ?? gespeicherteSprache();

    // 1. Nichts gespeichert, nichts in der Adresse → die Vorgabe.
    expect(startsprache("")).toBe(STANDARD_SPRACHE);

    // 2. Gespeicherte Wahl, nichts in der Adresse → die gespeicherte Wahl.
    window.localStorage.setItem(SPRACHE_STORAGE_KEY, "nl");
    expect(startsprache("")).toBe("nl");

    // 3. Die Adresse schlägt die gespeicherte Wahl — DAS ist der Sinn des Eintritts aus Word.
    expect(startsprache("?draft=D-7&lang=en")).toBe("en");

    // 4. Ein nicht vereinbarter Wert in der Adresse ändert daran nichts: die gespeicherte Wahl
    //    bleibt. (Ohne gespeicherte Wahl wäre es die Vorgabe „de" — Fall 1.)
    expect(startsprache("?draft=D-7&lang=xx")).toBe("nl");
    window.localStorage.clear();
    expect(startsprache("?draft=D-7&lang=xx")).toBe(STANDARD_SPRACHE);

    // 5. UND DAS IST DER FALL DER RUNDE 3: `lang=nl` ist kein Teil des Linkvertrags. Es wird
    //    ignoriert wie „xx" — hier sichtbar daran, dass die gespeicherte deutsche Wahl STEHEN
    //    BLEIBT, statt vom Link auf Niederländisch gezogen zu werden.
    window.localStorage.setItem(SPRACHE_STORAGE_KEY, "de");
    expect(startsprache("?draft=D-7&lang=nl")).toBe("de");
    window.localStorage.clear();
    expect(startsprache("?draft=D-7&lang=nl")).toBe(STANDARD_SPRACHE);
  });

  it("der Eintritt SCHREIBT die Wahl nicht: ein Link aus Word überschreibt /profil nicht", () => {
    // `lng` löst kein `languageChanged` aus, `bindSpracheSpeichern` schreibt also nichts. Diese
    // Zusicherung ist die Kehrseite von Fall 3: die Adresse gilt für DIESEN Aufruf, nicht für den
    // Browser. Gemessen wird sie an der Funktion, die als einzige schreiben könnte.
    window.localStorage.setItem(SPRACHE_STORAGE_KEY, "de");
    expect(sprachAusEintritt("?lang=en")).toBe("en");
    expect(window.localStorage.getItem(SPRACHE_STORAGE_KEY)).toBe("de");
  });
});

describe("JOB 3323 E2 · der neue Schalter läuft durch die BESTEHENDE Wurzelbindung", () => {
  it("ein Klick im Konto-Menü landet im Browserspeicher und am <html lang> — ohne eigene Zeile dafür", async () => {
    // Die beiden Bindungen, die im Produktivbetrieb `main.tsx` setzt. Sie werden hier NACHGEBILDET,
    // nicht nachgebaut: es sind dieselben Funktionen, aus demselben Modul.
    const abHtml = bindHtmlLang(i18n);
    const abSpeicher = bindSpracheSpeichern(i18n);
    try {
      expect(window.localStorage.getItem(SPRACHE_STORAGE_KEY)).toBeNull();
      montage = await montiere(
        "/bibliothek",
        createElement(Library),
        new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      );
      const c = montage.container;
      await kontoMenueOeffnen(c);
      await klick(sprachKnopf(c, "en"));

      expect(i18n.language).toBe("en");
      // Das SPEICHERN kommt von `sprachwahl.ts`, das ATTRIBUT von `htmlLang.ts` — beide an der
      // Wurzel gebunden, beide vom neuen Schalter unberührt.
      expect(window.localStorage.getItem(SPRACHE_STORAGE_KEY)).toBe("en");
      expect(document.documentElement.getAttribute(HTML_LANG_ATTRIBUTE)).toBe("en");
      // Und beim nächsten Öffnen der App wäre genau das die Startsprache.
      expect(gespeicherteSprache()).toBe("en");

      // Zurück auf Deutsch, mitten in derselben Szene.
      await klick(sprachKnopf(c, "de"));
      expect(window.localStorage.getItem(SPRACHE_STORAGE_KEY)).toBe("de");
      expect(document.documentElement.getAttribute(HTML_LANG_ATTRIBUTE)).toBe("de");
    } finally {
      abSpeicher();
      abHtml();
    }
  });
});
