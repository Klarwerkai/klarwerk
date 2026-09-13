// @vitest-environment jsdom
// ================================================================================================
// JOB 3786 — DIE HANDYFLÄCHE ERKLÄRT SICH UNTER „SEITENHILFE".
// ================================================================================================
//
// `/mobile` war die letzte grosse Fläche ohne Erklärung: 725 Zeilen echte Seite (`pages/Mobile.tsx`,
// Route `routes.tsx:218`) und NULL Anmeldungen. Die Mechanik von JOB 3060 war fertig, sie war hier
// nur nie benutzt worden.
//
// GEMESSEN WIRD AM SICHTBAREN ENDE, nicht am Kontext: die Seite wird zusammen mit dem ECHTEN
// Sammler (`SeitenhilfeProvider`) und dem ECHTEN Leser (`ZahnradEintraege` → `SeitenhilfeListe`)
// montiert, „Seitenhilfe" aufgeklappt und die gezeichnete Liste gelesen. Ein Tipp ohne Anbieter
// meldet sich beim stummen Sammler (`SeitenhilfeContext.tsx:37`) — ein Test gegen den Kontext
// allein wäre falsches Grün.
//
// ------------------------------------------------------------------------------------------------
// DIE EINE GRENZE DIESES WÄCHTERS, AUSGESCHRIEBEN STATT VERSCHWIEGEN (Fall M4).
// ------------------------------------------------------------------------------------------------
// M1 bis M3 liefern den Anbieter und den Leser SELBST. Das ist auf dieser einen Route nötig und
// nicht Bequemlichkeit: `shell/AppShell.tsx:65-79` kehrt für `/mobile` vor dem
// `SeitenhilfeProvider` und vor dem Kopfband zurück. Auf `/mobile` gibt es heute also weder einen
// Sammler noch ein Zahnrad. M4 MISST genau das und hält es fest, damit die Lücke nicht unbemerkt
// als „erledigt" durchgeht. M4 ist KEIN Wunsch und keine Zustimmung: er ist ein Nachführ-Pin. Wird
// das Endglied in `shell/AppShell.tsx` ergänzt, wird M4 ROT — dann gehören M1 bis M3 in die echte
// Hülle (`AppShell`, wie in tests/seitenhilfe-flaechen) und dieser Pin gelöscht.
//
// SECHS FÄLLE: M1 Titel und Text stehen in der Liste (und die Leermeldung nicht) · M2 dasselbe in
// DE, EN und NL, gemessen gegen die EIGENE Ressource der Sprache statt gegen `t()` mit seinem
// deutschen Rückfall (Korrekturpflicht aus JOB 3742 R1) · M3 derselbe Text steht NICHT im
// Sichtfeld · M4 der Nachführ-Pin auf die fehlende Kette · M5 die Fläche verlassen nimmt ihren
// Tipp mit · M6 wer den Erfassen-Reiter beschreibt, MUSS die Berechtigung nennen
// (Korrekturpflicht aus JOB 3669 R1).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Jede Endpunktfunktion gibt ein Versprechen, das NIE erfüllt wird: die Seite montiert ohne Daten.
// Das ist Absicht — die Seitenhilfe beschreibt die FLÄCHE, nicht ihren Inhalt, und muss deshalb
// auch dastehen, wenn keine Entwürfe und keine Treffer geladen sind.
vi.mock("../../apps/web/src/api/endpoints", () => {
  const make = (): unknown =>
    new Proxy(
      vi.fn(() => new Promise(() => {})),
      {
        get(target, prop, recv) {
          if (prop in target || typeof prop === "symbol") {
            return Reflect.get(target, prop, recv);
          }
          return make();
        },
      },
    );
  return { endpoints: make() };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { type ReactElement, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Mobile } from "../../apps/web/src/pages/Mobile";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import { SeitenhilfeProvider } from "../../apps/web/src/shell/SeitenhilfeContext";
import { ZahnradEintraege } from "../../apps/web/src/shell/ZahnradMenue";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
// Die Seite misst ihre Fläche (ResizeObserver) und fragt die Fensterbreite (matchMedia) — jsdom
// kennt beides nicht. Beide Attrappen sind ruhig: sie melden nie.
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};
(globalThis as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q) =>
  ({
    matches: false,
    media: q,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;

const TITEL_KEY = "seitenhilfe.mobil.titel";
const TEXT_KEY = "seitenhilfe.mobil.text";
const ROUTE = "/mobile";

// Die drei Sprachen des Produkts (`i18n.ts`: `de`, `en`, `nl`) als EIN Typ und EINE Liste — beide
// Sprachschleifen (M2, M6) laufen darüber.
//
// KORREKTUR AUS RUNDE 1 (Tor ROT, `tools/check` Exit 1, sechs TS-Fehler in M6): die Wortlisten
// standen als `Record<string, readonly string[]>` da. Unter `noUncheckedIndexedAccess`
// (`tsconfig.json:8`) ist das eine Indexsignatur, jeder Zugriff also `readonly string[] | undefined`
// — `TS2345` beim Übergeben und `TS2532` beim `.join()` in der Fehlermeldung. Mit den LITERALEN
// Schlüsseln ist es ein Objekttyp mit drei bekannten Feldern, und `WORT.de` ist ohne Prüfkrücke
// vorhanden. Kein `!`, kein `?? []`: eine fehlende Sprache soll der Compiler melden, nicht der
// Testlauf schlucken.
type Sprache = "de" | "en" | "nl";
const SPRACHEN = ["de", "en", "nl"] as const satisfies readonly Sprache[];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(url: string, kind: ReactElement): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(MemoryRouter, { initialEntries: [url] }, kind),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  await act(flush);
}

/**
 * Die Fläche samt dem ECHTEN Sammler und dem ECHTEN Leser des Zahnrad-Menüs.
 *
 * `ZahnradEintraege` ist dieselbe Komponente, die das Kopfband-Zahnrad und der Off-Canvas-Drawer
 * zeigen (`ZahnradMenue.tsx:75`) — sie bringt `SeitenhilfeListe` mit. Es entsteht hier also kein
 * zweiter Leser und keine zweite Hilfemechanik; die Hülle, die diese Route nicht hat, wird für die
 * Messung gestellt (s. Kopf, Fall M4).
 */
function flaecheMitLeser(): ReactElement {
  return createElement(
    SeitenhilfeProvider,
    null,
    createElement(ZahnradEintraege),
    createElement(Mobile),
  );
}

async function click(el: Element | null | undefined, was: string): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Element zum Klicken fehlt: ${was}`);
  }
  await act(async () => {
    el.click();
    await flush();
  });
}

const gestrafft = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();

/** „Seitenhilfe" aufklappen — der Weg, den ein Mensch im Zahnrad geht. */
async function seitenhilfeOeffnen(): Promise<void> {
  await click(container.querySelector('[data-testid="zahnrad-seitenhilfe"]'), "Seitenhilfe");
}

/** Der gezeichnete Text der Seitenhilfe-Liste (nicht des ganzen Menüs). */
function listentext(): string {
  return gestrafft(container.querySelector('[data-testid="seitenhilfe-liste"]')?.textContent);
}

/** Der Wert EINER Sprache aus ihrer eigenen Ressource — ohne Rückfall auf „de". */
function sprachressource(sprache: string, key: string): unknown {
  const bundle = i18n.getResourceBundle(sprache, "translation") as
    | Record<string, unknown>
    | undefined;
  return bundle?.[key];
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

// ------------------------------------------------------------------------------------------------
// M1 — DER HAUPTFALL: die Handyfläche erklärt sich unter „Seitenhilfe".
// ------------------------------------------------------------------------------------------------
describe("JOB 3786 · M1 · /mobile erklärt sich unter „Seitenhilfe“", () => {
  it("Titel und Text stehen in der Liste, die Leermeldung nicht", async () => {
    const titel = i18n.t(TITEL_KEY);
    const text = i18n.t(TEXT_KEY);
    expect(titel, `${TITEL_KEY} löst nicht auf`).not.toBe(TITEL_KEY);
    expect(text, `${TEXT_KEY} löst nicht auf`).not.toBe(TEXT_KEY);

    await mount(ROUTE, flaecheMitLeser());
    await seitenhilfeOeffnen();

    const liste = container.querySelector('[data-testid="seitenhilfe-liste"]');
    expect(liste, "es gibt gar keine Seitenhilfe-Liste").not.toBeNull();
    const inhalt = listentext();
    expect(inhalt, "der Titel der Seitenhilfe fehlt in der Liste").toContain(titel);
    expect(inhalt, "der Text der Seitenhilfe fehlt in der Liste").toContain(text);
    // Die Leermeldung ist der Zustand VOR diesem Auftrag — sie darf danach nirgends mehr stehen.
    expect(inhalt, "die Leermeldung steht immer noch da").not.toContain(
      i18n.t("menue.seitenhilfe.leer"),
    );
  });

  it("die Anmeldung kommt aus der Fläche selbst, nicht aus dem Leser", async () => {
    // Ohne `Mobile` steht dieselbe Liste leer — sonst käme der Text aus `ZahnradEintraege` und
    // dieser Wächter bewiese nichts über `pages/Mobile.tsx`.
    await mount(ROUTE, createElement(SeitenhilfeProvider, null, createElement(ZahnradEintraege)));
    await seitenhilfeOeffnen();
    const menue = gestrafft(container.ownerDocument.body.textContent);
    expect(menue, "der Text steht auch ohne die Fläche da — er kommt nicht von ihr").not.toContain(
      i18n.t(TEXT_KEY),
    );
  });
});

// ------------------------------------------------------------------------------------------------
// M2 — DREI SPRACHEN: jede hat einen EIGENEN Text, nicht den deutschen aus dem Rückfall.
// ------------------------------------------------------------------------------------------------
// KORREKTURPFLICHT AUS JOB 3742 R1 (Prüfer BEN, 12.09.): ein Sprachfall, der seinen Erwartungswert
// mit demselben `i18n.t()` gewinnt, das auch die Oberfläche benutzt, ist blind — `i18n.ts` setzt
// `fallbackLng: "de"`, und dann liefern Erwartung UND Oberfläche denselben deutschen Satz. Gemessen
// wird deshalb gegen die EIGENE Ressource der Sprache (`getResourceBundle`, ohne Rückfallkette) und
// zusätzlich dagegen, dass der deutsche Satz in EN/NL gar nicht erst in der Liste auftaucht.
describe("JOB 3786 · M2 · die Seitenhilfe spricht Deutsch, Englisch und Niederländisch", () => {
  for (const sprache of SPRACHEN) {
    it(`${sprache}: der Text DIESER Sprache steht in der Liste`, async () => {
      // 1. Die Sprache hat einen eigenen Eintrag — direkt aus ihrer Ressource gelesen.
      const roherTitel = sprachressource(sprache, TITEL_KEY);
      const roherText = sprachressource(sprache, TEXT_KEY);
      expect(
        typeof roherTitel === "string" && roherTitel.trim().length > 0,
        `mobil/${sprache}: ${TITEL_KEY} fehlt in der Ressource „${sprache}" (gelesen: ${JSON.stringify(roherTitel)}) — der deutsche Rückfall zählt hier nicht`,
      ).toBe(true);
      expect(
        typeof roherText === "string" && roherText.trim().length > 0,
        `mobil/${sprache}: ${TEXT_KEY} fehlt in der Ressource „${sprache}" (gelesen: ${JSON.stringify(roherText)}) — der deutsche Rückfall zählt hier nicht`,
      ).toBe(true);
      const titel = roherTitel as string;
      const text = roherText as string;
      expect(
        text.length,
        `mobil/${sprache}: der Text ist zu kurz, um drei Fragen zu beantworten`,
      ).toBeGreaterThan(40);

      // 2. Es ist wirklich übersetzt und nicht der deutsche Satz zweimal abgelegt.
      const deTitel = sprachressource("de", TITEL_KEY) as string;
      const deText = sprachressource("de", TEXT_KEY) as string;
      if (sprache !== "de") {
        expect(titel, `mobil/${sprache}: der Titel ist wörtlich der deutsche`).not.toBe(deTitel);
        expect(text, `mobil/${sprache}: der Text ist wörtlich der deutsche`).not.toBe(deText);
      }

      // 3. Genau dieser Satz steht auch in der gezeichneten Liste.
      await i18n.changeLanguage(sprache);
      await mount(ROUTE, flaecheMitLeser());
      await seitenhilfeOeffnen();
      const inhalt = listentext();
      expect(inhalt, `mobil/${sprache}: der Titel fehlt in der Liste`).toContain(titel);
      expect(inhalt, `mobil/${sprache}: der Text fehlt in der Liste`).toContain(text);
      // 4. Und der deutsche Satz steht dort NICHT — das ist der Rückfall, sichtbar gemacht.
      if (sprache !== "de") {
        expect(
          inhalt,
          `mobil/${sprache}: in der Liste steht der DEUTSCHE Text — die Fläche ist auf den Rückfall „de" gefallen`,
        ).not.toContain(deText);
      }
    });
  }
});

// ------------------------------------------------------------------------------------------------
// M3 — NICHT IM SICHTFELD. Der Wächter gegen die naheliegende Fehllieferung.
// ------------------------------------------------------------------------------------------------
// Pedi (04.09.): „Erklärung gehört hinter Zahnrad/Profil, nicht ins Sichtfeld." JOB 3060 hat die
// Sprechblasen ausgebaut; ein sichtbarer Erklärabsatz im Telefonrahmen wäre der Rückschritt.
describe("JOB 3786 · M3 · der Erklärtext steht nicht im Sichtfeld", () => {
  it("der Telefonrahmen zeigt weder Titel noch Text der Seitenhilfe", async () => {
    await mount(ROUTE, flaecheMitLeser());
    // Das geschlossene Menü zuerst: ohne Aufklappen darf der Text nirgends stehen.
    const rahmen = container.querySelector(".rounded-\\[34px\\]");
    expect(rahmen, "der Telefonrahmen wurde nicht gefunden").not.toBeNull();
    const sichtfeld = gestrafft(rahmen?.textContent);
    expect(sichtfeld, "der Titel der Seitenhilfe steht im Telefonrahmen").not.toContain(
      i18n.t(TITEL_KEY),
    );
    expect(sichtfeld, "der Text der Seitenhilfe steht im Telefonrahmen").not.toContain(
      i18n.t(TEXT_KEY),
    );
  });
});

// ------------------------------------------------------------------------------------------------
// M4 — DER NACHFÜHR-PIN: heute erreicht die Anmeldung auf /mobile keinen Leser.
// ------------------------------------------------------------------------------------------------
// Dieser Fall behauptet NICHT, dass der Zustand gut ist. Er hält den gemessenen Stand fest, damit
// die Lücke nicht unbemerkt als erledigt gilt: `shell/AppShell.tsx:65-79` kehrt für `/mobile` vor
// dem `SeitenhilfeProvider` und vor dem Kopfband zurück. Wird das Endglied dort ergänzt, wird
// dieser Fall ROT — DANN ist die Nachführung fällig: M1 bis M3 auf die echte `AppShell` umstellen
// (wie tests/seitenhilfe-flaechen/sechs-flaechen-erklaeren-sich.test.tsx es tut) und diesen Pin
// löschen. Die Fehlermeldung unten sagt das dem, der ihn rot macht.
const NACHFUEHRUNG =
  "GUT — die Kette ist geschlossen. Jetzt M1-M3 auf die echte AppShell umstellen (Vorbild: tests/seitenhilfe-flaechen/sechs-flaechen-erklaeren-sich.test.tsx) und diesen Pin M4 löschen.";

describe("JOB 3786 · M4 · Nachführ-Pin: /mobile trägt in der echten Hülle noch kein Zahnrad", () => {
  it("die echte AppShell zeichnet auf /mobile kein Zahnrad und keine Seitenhilfe-Liste", async () => {
    await mount(ROUTE, createElement(AppShell, null, createElement(Mobile)));
    expect(container.querySelector('[data-testid="kopfband-zahnrad"]'), NACHFUEHRUNG).toBeNull();
    expect(container.querySelector('[data-testid="seitenhilfe-liste"]'), NACHFUEHRUNG).toBeNull();
    // Gegenbeleg, dass hier überhaupt die Fläche steht und nicht versehentlich nichts gerendert
    // wurde: der Ausgang „Zur Vollversion" ist da. Sonst wäre dieser Pin grün aus Leere.
    expect(
      gestrafft(container.textContent),
      "die Handyfläche wurde gar nicht gezeichnet — der Pin wäre grün aus Leere",
    ).toContain(i18n.t("topbar.toDesktop"));
  });
});

// ------------------------------------------------------------------------------------------------
// M5 — DIE FLÄCHE VERLASSEN NIMMT IHREN TIPP MIT.
// ------------------------------------------------------------------------------------------------
describe("JOB 3786 · M5 · der Tipp gehört der Fläche, nicht der Sitzung", () => {
  it("ohne die Fläche steht die Leermeldung wieder da", async () => {
    await mount(ROUTE, flaecheMitLeser());
    await seitenhilfeOeffnen();
    expect(listentext(), "Vorbedingung: der Tipp steht in der Liste").toContain(i18n.t(TEXT_KEY));

    // Dieselbe Montage OHNE die Fläche — der Sammler ist neu und leer.
    act(() => root.unmount());
    container.remove();
    await mount(ROUTE, createElement(SeitenhilfeProvider, null, createElement(ZahnradEintraege)));
    await seitenhilfeOeffnen();
    expect(
      gestrafft(container.textContent),
      "der Tipp der Handyfläche überlebt ihren Abbau",
    ).not.toContain(i18n.t(TEXT_KEY));
  });
});

// ------------------------------------------------------------------------------------------------
// M6 — WER DEN ERFASSEN-REITER BESCHREIBT, MUSS DIE BERECHTIGUNG NENNEN.
// ------------------------------------------------------------------------------------------------
// KORREKTURPFLICHT AUS JOB 3669 R1 (Prüfer BEN, 12.09.): „Erfassungsweg rollenabhängig einschränken
// ODER seine Berechtigung ausdrücklich nennen, in DE/EN/NL."
//
// Die Lage auf dieser Route, gemessen: `/mobile` ist NICHT rollengesichert (`routes.tsx:218` steht
// ausserhalb `GUARDED_ITEMS`) — auch ein Betrachter kommt hier an und sieht den Erfassen-Reiter.
// Alle Entwurfsrouten verlangen aber `ko.create` (`capture-routes.ts:839`, `:1139`, `:1281`),
// während Fragen und Suchen mit `ko.read` auskommen (`ask-routes.ts:307`, `library-routes.ts:541`);
// ein Betrachter hat nach `services/rbac/src/policy.ts:14` nur `ko.read`. Eine Hilfe, die
// „erfassen" unbedingt verspricht, wäre damit unwahr.
//
// Der Fall prüft deshalb eine ECHTE Bedingung und nicht den Text gegen sich selbst: NENNT der Satz
// den Erfassen-Reiter, dann MUSS er auch die Einschränkung nennen. Gegenprobe: den Nebensatz mit
// der Berechtigung aus einer Sprache streichen → rot, mit Nennung der Sprache.
const ERFASSEN_WORT: Record<Sprache, readonly string[]> = {
  de: ["Erfassen"],
  en: ["Capture"],
  nl: ["Vastleggen"],
};
// Die Einschränkung darf in Wortwahl variieren, aber sie muss die BERECHTIGUNG und die ROLLE
// benennen — beides, sonst bleibt der Satz ausweichend.
const BERECHTIGUNG_WORT: Record<Sprache, readonly string[]> = {
  de: ["Berechtigung"],
  en: ["permission"],
  nl: ["recht"],
};
const ROLLE_WORT: Record<Sprache, readonly string[]> = {
  de: ["Betrachter"],
  en: ["viewer"],
  nl: ["kijker"],
};

describe("JOB 3786 · M6 · die Erfassen-Zusage nennt Berechtigung und Rolle", () => {
  for (const sprache of SPRACHEN) {
    it(`${sprache}: der Satz verspricht Erfassen nicht unbedingt`, async () => {
      const text = sprachressource(sprache, TEXT_KEY) as string;
      expect(typeof text, `mobil/${sprache}: der Text fehlt`).toBe("string");
      const nennt = (woerter: readonly string[]): boolean =>
        woerter.some((w) => text.toLowerCase().includes(w.toLowerCase()));

      if (!nennt(ERFASSEN_WORT[sprache])) {
        // Der Satz beschreibt den Reiter nicht — dann gibt es auch nichts einzuschränken.
        return;
      }
      expect(
        nennt(BERECHTIGUNG_WORT[sprache]),
        `mobil/${sprache}: der Satz nennt den Erfassen-Reiter (${ERFASSEN_WORT[sprache].join("/")}), aber nicht die Berechtigung (${BERECHTIGUNG_WORT[sprache].join("/")}) — Entwürfe brauchen ko.create (capture-routes.ts:839)`,
      ).toBe(true);
      expect(
        nennt(ROLLE_WORT[sprache]),
        `mobil/${sprache}: der Satz nennt die Berechtigung, aber nicht die Rolle, die sie NICHT hat (${ROLLE_WORT[sprache].join("/")}) — policy.ts:14 gibt dem Betrachter nur ko.read`,
      ).toBe(true);
    });
  }
});
