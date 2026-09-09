// @vitest-environment jsdom
// ================================================================================================
// JOB 3323 R2 · DER EINTRITT AUS KLARA — `/capture/frontdoor?draft=<id>&lang=en|de`.
// ================================================================================================
//
// Nachführung 2026-09-09T00:21 (Codex 3683da57, aus JOB 3280): Der Link, den die Klara-Erweiterung
// aus Word heraus öffnet, trägt BEIDES — den gesicherten Entwurf und die Sprache, in der Word
// gerade läuft. Pflicht für diesen Auftrag: dieser Eintritt setzt die App-Sprache auf `lang`,
// erhält die Entwurfskennung und öffnet den gespeicherten Entwurf in dieser Sprache.
//
// WARUM DIESE DATEI GETRENNT STEHT UND KEINEN STATISCHEN i18n-IMPORT HAT. Die Startsprache
// entscheidet `apps/web/src/i18n.ts` GENAU EINMAL, beim Auswerten des Moduls (`lng:`). Wer `i18n`
// oben importiert, hat diese Entscheidung schon hinter sich — jede spätere Adressänderung käme zu
// spät, und der Fall prüfte nur noch `changeLanguage`. Deshalb wird die Adresse hier ZUERST
// gestellt und das Modul DANACH geholt (`await import`). Vitest gibt jeder Testdatei ihre eigene
// Modulablage; `vi.resetModules()` trennt die Fälle innerhalb dieser Datei voneinander.
//
// Die reine Entscheidungstabelle (welcher Wert gilt, welcher nicht) steht in
// `standard-und-gespeicherte-wahl.test.tsx` (E3). Hier geht es um die VERDRAHTUNG: kommt sie an.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia Klar", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Der gespeicherte Entwurf hinter der Kennung — und die Liste der Ladeaufrufe, damit „die Kennung
// bleibt erhalten" nicht behauptet, sondern am Argument des echten Aufrufs abgelesen wird.
const { LADUNGEN, SERVER_ENTWURF } = vi.hoisted(() => ({
  LADUNGEN: [] as string[],
  SERVER_ENTWURF: {
    id: "D-1",
    payload: { title: "AUS WORD GESICHERT", bodyHtml: "<p>RUMPF AUS WORD</p>" },
    originalAuthor: "u1",
    lastEditor: "u1",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
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
        apply(target, self, args) {
          if (pfad === "drafts.get") {
            LADUNGEN.push(String(args[0]));
            return Promise.resolve(SERVER_ENTWURF);
          }
          return Reflect.apply(target as never, self, args);
        },
      },
    );
  return { endpoints: make("") };
});

import { QueryClient } from "../../apps/web/node_modules/@tanstack/react-query";
import { createElement } from "../../apps/web/node_modules/react";
import { SPRACHE_STORAGE_KEY } from "../../apps/web/src/lib/sprachwahl";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
import { type Montage, breite, montiere } from "./huelle";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const DRAFT_ID = "D-1";

let montage: Montage | null = null;

/** Die Adresse stellen, wie der Browser sie beim Öffnen des Links hätte. */
function adresse(suche: string): void {
  window.history.replaceState({}, "", `/capture/frontdoor${suche}`);
}

/**
 * Die Startsprache, die `i18n.ts` WIRKLICH setzt — das Modul wird dafür frisch ausgewertet.
 * Das ist der Kern dieser Datei: nicht die Funktion wird gefragt, sondern die Anwendung.
 */
async function startspracheDerApp(): Promise<string> {
  vi.resetModules();
  const modul = (await import("../../apps/web/src/i18n")) as { default: { language: string } };
  return modul.default.language;
}

beforeEach(() => {
  window.localStorage.clear();
  breite(1280);
  LADUNGEN.length = 0;
  adresse("");
});

afterEach(() => {
  montage?.abbauen();
  montage = null;
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("JOB 3323 R2 · die Adresse setzt die Startsprache — gemessen am echten i18n-Modul", () => {
  it("`?draft=<id>&lang=en` startet die Anwendung auf Englisch", async () => {
    adresse(`?draft=${DRAFT_ID}&lang=en`);
    expect(await startspracheDerApp()).toBe("en");
  });

  it("`lang=xx` wird ignoriert — es bleibt bei der Vorgabe Deutsch, ohne Absturz", async () => {
    adresse(`?draft=${DRAFT_ID}&lang=xx`);
    expect(await startspracheDerApp()).toBe("de");
  });

  // ==============================================================================================
  // RUNDE 3 (bens Korrekturpflicht 1) — `lang=nl` IST NICHT TEIL DES LINKVERTRAGS.
  // ==============================================================================================
  // Die Anwendung KANN Niederländisch (unter /profil und im Konto-Menü wählbar, unverändert). Der
  // Link aus Word darf es trotzdem nicht setzen: die Nachführung 00:21 vereinbart genau `de|en`.
  // Runde 2 hatte hier `nl` durchgelassen; dieser Fall ist die Zusicherung, dass das nicht
  // wiederkommt — und er war gegen den Stand der Runde 2 rot („expected 'nl' to be 'de'").
  it("`lang=nl` wird ignoriert wie jeder nicht vereinbarte Wert — Vorgabe Deutsch", async () => {
    adresse(`?draft=${DRAFT_ID}&lang=nl`);
    expect(await startspracheDerApp()).toBe("de");
  });

  it("`lang=nl` zieht auch eine gespeicherte deutsche Wahl nicht auf Niederländisch", async () => {
    // Der schärfere der beiden Fälle: hier gäbe es einen Wert, den der Link überschreiben KÖNNTE.
    window.localStorage.setItem(SPRACHE_STORAGE_KEY, "de");
    adresse(`?draft=${DRAFT_ID}&lang=nl`);
    expect(await startspracheDerApp()).toBe("de");
    expect(window.localStorage.getItem(SPRACHE_STORAGE_KEY)).toBe("de");
  });

  it("die WAHL von Niederländisch bleibt unberührt — nur der LINK darf sie nicht setzen", async () => {
    // Gegenstück zur Begrenzung oben, damit sie nicht als „nl ist abgeschafft" missverstanden
    // wird: eine gespeicherte niederländische Wahl gilt beim Eintritt weiterhin.
    window.localStorage.setItem(SPRACHE_STORAGE_KEY, "nl");
    adresse(`?draft=${DRAFT_ID}`);
    expect(await startspracheDerApp()).toBe("nl");
  });

  it("ohne `lang` bleibt es beim bisherigen Verhalten: gespeicherte Wahl, sonst Deutsch", async () => {
    adresse(`?draft=${DRAFT_ID}`);
    expect(await startspracheDerApp()).toBe("de");

    // Und mit gespeicherter Wahl gilt genau diese — der Eintritt ohne `lang` ändert daran nichts.
    window.localStorage.setItem(SPRACHE_STORAGE_KEY, "en");
    adresse(`?draft=${DRAFT_ID}`);
    expect(await startspracheDerApp()).toBe("en");
  });

  it("die Adresse schlägt die gespeicherte Wahl — der Link aus Word gewinnt für diesen Aufruf", async () => {
    window.localStorage.setItem(SPRACHE_STORAGE_KEY, "de");
    adresse(`?draft=${DRAFT_ID}&lang=en`);
    expect(await startspracheDerApp()).toBe("en");
    // Und er hat die gespeicherte Wahl NICHT überschrieben: `lng` löst kein `languageChanged` aus.
    expect(window.localStorage.getItem(SPRACHE_STORAGE_KEY)).toBe("de");
  });
});

// ==================================================================================================
// RUNDE 3 (bens Prüflücke 4) — SPRACHE UND ENTWURF IN EINEM EINZIGEN AUFBAU.
// ==================================================================================================
// Runde 2 hat beides GETRENNT gemessen: hier die Startsprache am Modul, dort der geladene Entwurf
// im Aufbau. ben hat zu Recht angemerkt, dass damit die eigentliche Zusage des Auftrags nicht
// dasteht — „öffnet den gespeicherten Entwurf IN DIESER SPRACHE". Zwei grüne Hälften sind kein
// grünes Ganzes: die Sprache könnte stimmen und der Entwurf fehlen, oder umgekehrt.
//
// Deshalb läuft hier BEIDES in einem Fall: erst entscheidet die Adresse über die Startsprache (das
// echte Modul, frisch ausgewertet), dann wird die Vordertür damit aufgebaut — und geprüft wird die
// SICHTBARE Oberfläche der Hülle zusammen mit dem geladenen Entwurf. Der Platzhalter des Suchfelds
// ist dafür der ehrlichste Zeuge: er steht in allen drei Sprachen verschieden da
// (`kopfband.suchen`: „Suchen" / „Search" / „Zoeken").
describe("JOB 3323 R3 · der Eintritt öffnet den Entwurf IN DER SPRACHE DES LINKS", () => {
  /** Der sichtbare Platzhalter des Suchfelds im Kopfband — die Sprache, die man wirklich sieht. */
  function sichtbareSprache(c: HTMLElement): string | null {
    return (
      c
        .querySelector('[data-testid="kopfband"] input[type="search"]')
        ?.getAttribute("placeholder") ?? null
    );
  }

  /** Aufbau der Vordertür an genau dieser Adresse. */
  async function vordertuerOeffnen(suche: string): Promise<HTMLElement> {
    montage = await montiere(
      `/capture/frontdoor${suche}`,
      createElement(CaptureFrontDoor),
      new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    );
    return montage.container;
  }

  it("`lang=en`: englische Oberfläche UND derselbe Entwurf — in einem Aufbau", async () => {
    const SUCHE = `?draft=${DRAFT_ID}&lang=en`;
    adresse(SUCHE);
    // 1. Die Adresse entscheidet über die Startsprache — am echten Modul, nicht behauptet.
    expect(await startspracheDerApp()).toBe("en");

    const c = await vordertuerOeffnen(SUCHE);

    // 2. Die Oberfläche ist WIRKLICH englisch — sichtbar, nicht nur `i18n.language`.
    expect(sichtbareSprache(c), "die Hülle steht nicht auf Englisch").toBe("Search");

    // 3. Und im selben Aufbau steht der gespeicherte Entwurf: mit GENAU seiner Kennung geladen …
    expect(LADUNGEN, "der Entwurf wurde nicht mit seiner Kennung geladen").toEqual([DRAFT_ID]);
    // … und mit seinem Inhalt im Blatt. Der Inhalt bleibt dabei deutsch/unübersetzt — er ist
    // Inhalt, nicht Oberfläche.
    expect(c.querySelector<HTMLInputElement>('[data-testid="blatt-titel"]')?.value).toBe(
      SERVER_ENTWURF.payload.title,
    );
    expect(c.querySelector('[data-testid="blatt-text"]')?.textContent).toContain("RUMPF AUS WORD");
  });

  it("`lang=xx`: deutsche Oberfläche UND derselbe Entwurf — der Eintritt bricht nicht ab", async () => {
    const SUCHE = `?draft=${DRAFT_ID}&lang=xx`;
    adresse(SUCHE);
    expect(await startspracheDerApp()).toBe("de");

    const c = await vordertuerOeffnen(SUCHE);
    expect(sichtbareSprache(c)).toBe("Suchen");
    expect(LADUNGEN).toEqual([DRAFT_ID]);
    expect(c.querySelector<HTMLInputElement>('[data-testid="blatt-titel"]')?.value).toBe(
      SERVER_ENTWURF.payload.title,
    );
  });

  it("`lang=nl`: deutsche Oberfläche — NICHT niederländisch — UND derselbe Entwurf", async () => {
    // bens Korrekturpflicht 1, an der sichtbaren Fläche: der Linkvertrag ist `de|en`.
    const SUCHE = `?draft=${DRAFT_ID}&lang=nl`;
    adresse(SUCHE);
    expect(await startspracheDerApp()).toBe("de");

    const c = await vordertuerOeffnen(SUCHE);
    expect(sichtbareSprache(c)).toBe("Suchen");
    expect(sichtbareSprache(c), "der Link hat die Oberfläche auf Niederländisch gezogen").not.toBe(
      "Zoeken",
    );
    expect(LADUNGEN).toEqual([DRAFT_ID]);
    expect(c.querySelector<HTMLInputElement>('[data-testid="blatt-titel"]')?.value).toBe(
      SERVER_ENTWURF.payload.title,
    );
  });

  it("ohne `lang`: die gespeicherte niederländische Wahl gilt weiterhin, samt Entwurf", async () => {
    // Die Kehrseite: begrenzt ist der LINK, nicht die Sprache. Wer Niederländisch gewählt hat,
    // bekommt es auch beim Eintritt aus Word — nur eben aus seiner Wahl, nicht aus der Adresse.
    window.localStorage.setItem(SPRACHE_STORAGE_KEY, "nl");
    const SUCHE = `?draft=${DRAFT_ID}`;
    adresse(SUCHE);
    expect(await startspracheDerApp()).toBe("nl");

    const c = await vordertuerOeffnen(SUCHE);
    expect(sichtbareSprache(c)).toBe("Zoeken");
    expect(LADUNGEN).toEqual([DRAFT_ID]);
    expect(c.querySelector<HTMLInputElement>('[data-testid="blatt-titel"]')?.value).toBe(
      SERVER_ENTWURF.payload.title,
    );
  });
});
