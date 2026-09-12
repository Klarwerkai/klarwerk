// @vitest-environment jsdom
// ================================================================================================
// JOB 3742 — SECHS STILLE FLÄCHEN ERKLÄREN SICH IM ZAHNRAD.
// ================================================================================================
//
// Pedi will einen Demo-Zugang aushändigen, mit dem sich jemand „relativ schnell einarbeitet":
// „unsere Hilfe muss auch sauber ausgearbeitet werden." Auf dem Wissensnetz, im eigenen Profil und
// auf den vier Stufe-2-Flächen (Wissenskapital, Wissensgraph, Import, Output) stand im Zahnrad
// unter „Seitenhilfe" bis hierher die Leermeldung — die Mechanik von JOB 3060 war fertig, sie war
// auf diesen Seiten nur nie benutzt worden.
//
// GEMESSEN WIRD AM SICHTBAREN ENDE, nicht am Kontext: jede der sechs Seiten wird in der ECHTEN
// Hülle (`AppShell` mit `SeitenhilfeProvider` und Zahnrad) montiert, das Zahnrad geöffnet, die
// Seitenhilfe aufgeklappt und die gezeichnete Liste gelesen. Ein Tipp außerhalb des Anbieters
// meldete sich beim stummen Sammler (`SeitenhilfeContext.tsx:37`) — ein Test gegen den Kontext
// allein wäre falsches Grün.
//
// OHNE GELADENE DATEN. Die gemockte Schnittstelle antwortet nie; alle Abfragen bleiben in „lädt".
// Das ist Absicht (Auftrag §9): die Seitenhilfe beschreibt die SEITE, nicht ihren Inhalt, und muss
// deshalb auch dann dastehen, wenn noch keine Zahl da ist.
//
// FÜNF FÄLLE: S1 der Tipp steht in der Liste (und die Leermeldung nicht) · S2 dasselbe in DE, EN
// und NL, gemessen gegen die EIGENE Ressource der Sprache statt gegen `t()` mit seinem deutschen
// Rückfall (Korrektur aus Runde 1) · S2b der Sprachwechsel an der schon montierten Seite · S3
// derselbe Text steht NICHT im Sichtfeld (der Wächter gegen die naheliegende Fehllieferung
// „sichtbarer Erklärabsatz") · S4 die Seite verlassen nimmt ihren Tipp mit.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Jede Endpunktfunktion gibt ein Versprechen, das NIE erfüllt wird: die Seiten montieren ohne
// Daten. `new Proxy` über einer Funktion, damit auch tief verschachtelte Namensketten
// (`endpoints.library.importCandidates.create`) auflösen, ohne dass sie hier aufgezählt werden.
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
import { Profile } from "../../apps/web/src/pages/Profile";
import { Capital, GraphView, ImportReview, Output } from "../../apps/web/src/pages/Stufe2";
import { Wissensnetz } from "../../apps/web/src/pages/Wissensnetz";
import { AppShell } from "../../apps/web/src/shell/AppShell";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
// Die Seiten messen ihre Fläche (ResizeObserver) und fragen die Fensterbreite (matchMedia) —
// jsdom kennt beides nicht. Beide Attrappen sind ruhig: sie melden nie.
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

/** Die sechs Flächen: Seite, ihre Route und die beiden Schlüssel ihrer eigenen Seitenhilfe. */
interface Flaeche {
  key: string;
  route: string;
  seite: () => ReactElement;
  titelKey: string;
  textKey: string;
}

const FLAECHEN: readonly Flaeche[] = [
  {
    key: "wissensnetz",
    route: "/wissensnetz",
    seite: () => createElement(Wissensnetz),
    titelKey: "seitenhilfe.wissensnetz.titel",
    textKey: "seitenhilfe.wissensnetz.text",
  },
  {
    key: "profil",
    route: "/profil",
    seite: () => createElement(Profile),
    titelKey: "seitenhilfe.profil.titel",
    textKey: "seitenhilfe.profil.text",
  },
  // Diese vier Seiten wohnen in EINER Datei (`pages/Stufe2.tsx`) und werden deshalb einzeln
  // montiert: eine Anmeldung an der falschen Stelle (etwa im gemeinsamen `Stufe2Header`) stünde
  // auf allen vieren gleich und erklärte keine. Vier eigene Texte, vier eigene Fälle.
  {
    key: "kapital",
    route: "/kapital",
    seite: () => createElement(Capital),
    titelKey: "seitenhilfe.kapital.titel",
    textKey: "seitenhilfe.kapital.text",
  },
  {
    key: "graph",
    route: "/graph",
    seite: () => createElement(GraphView),
    titelKey: "seitenhilfe.graph.titel",
    textKey: "seitenhilfe.graph.text",
  },
  {
    key: "import",
    route: "/import",
    seite: () => createElement(ImportReview),
    titelKey: "seitenhilfe.import.titel",
    textKey: "seitenhilfe.import.text",
  },
  {
    key: "output",
    route: "/output",
    seite: () => createElement(Output),
    titelKey: "seitenhilfe.output.titel",
    textKey: "seitenhilfe.output.text",
  },
];

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

async function click(el: Element | null | undefined, was: string): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Element zum Klicken fehlt: ${was}`);
  }
  await act(async () => {
    el.click();
    await flush();
  });
}

/** Zahnrad auf, „Seitenhilfe" aufklappen — der Weg, den ein Mensch geht. */
async function seitenhilfeOeffnen(): Promise<void> {
  await click(container.querySelector('[data-testid="kopfband-zahnrad"]'), "Zahnrad");
  await click(container.querySelector('[data-testid="zahnrad-seitenhilfe"]'), "Seitenhilfe");
}

const gestrafft = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();

/** Der gezeichnete Text der Seitenhilfe-Liste (nicht des ganzen Menüs). */
function listentext(): string {
  const liste = container.querySelector('[data-testid="seitenhilfe-liste"]');
  return gestrafft(liste?.textContent);
}

/** Der gezeichnete Seiteninhalt — `<main>` ohne das Zahnrad-Menü, das im Kopfband hängt. */
function sichtfeldtext(): string {
  return gestrafft(container.querySelector("main")?.textContent);
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
// S1 — DER HAUPTFALL: auf jeder der sechs Seiten steht ihre eigene Erklärung im Zahnrad.
// ------------------------------------------------------------------------------------------------
describe("JOB 3742 · S1 · jede der sechs Flächen erklärt sich unter „Seitenhilfe“", () => {
  for (const f of FLAECHEN) {
    it(`${f.key} · Titel und Text stehen in der Liste, die Leermeldung nicht`, async () => {
      const titel = i18n.t(f.titelKey);
      const text = i18n.t(f.textKey);
      expect(titel, `${f.key}: ${f.titelKey} löst nicht auf`).not.toBe(f.titelKey);
      expect(text, `${f.key}: ${f.textKey} löst nicht auf`).not.toBe(f.textKey);

      await mount(f.route, createElement(AppShell, null, f.seite()));
      await seitenhilfeOeffnen();

      const liste = container.querySelector('[data-testid="seitenhilfe-liste"]');
      expect(liste, `${f.key}: es gibt gar keine Seitenhilfe-Liste`).not.toBeNull();
      const inhalt = listentext();
      expect(inhalt, `${f.key}: der Titel der Seitenhilfe fehlt in der Liste`).toContain(titel);
      expect(inhalt, `${f.key}: der Text der Seitenhilfe fehlt in der Liste`).toContain(text);
      // Die Leermeldung ist der heutige Zustand — sie darf danach nirgends im Menü mehr stehen.
      const menue = gestrafft(
        container.querySelector('[data-testid="zahnrad-menue"]')?.textContent,
      );
      expect(menue, `${f.key}: die Leermeldung steht immer noch da`).not.toContain(
        i18n.t("menue.seitenhilfe.leer"),
      );
    });
  }
});

// ------------------------------------------------------------------------------------------------
// S2 — DREI SPRACHEN: jede Sprache hat einen EIGENEN Text, nicht den deutschen aus dem Rückfall.
// ------------------------------------------------------------------------------------------------
// KORREKTURPFLICHT AUS RUNDE 1 (Prüfer BEN, 12.09.): die erste Fassung gewann ihren Erwartungswert
// mit demselben `i18n.t()`, das auch die Oberfläche benutzt. `i18n.ts:15939` setzt aber
// `fallbackLng: "de"` — fehlt ein NL-Schlüssel, liefern Erwartung UND Oberfläche denselben deutschen
// Satz, und der Fall bliebe grün. Gemessen wird deshalb ab jetzt gegen die EIGENE Ressource der
// Sprache (`getResourceBundle`, ohne Rückfallkette) und zusätzlich dagegen, dass der deutsche Satz
// in EN/NL gar nicht erst in der Liste auftaucht.

/** Der Wert EINER Sprache aus ihrer eigenen Ressource — ohne Rückfall auf „de". */
function sprachressource(sprache: string, key: string): unknown {
  const bundle = i18n.getResourceBundle(sprache, "translation") as
    | Record<string, unknown>
    | undefined;
  return bundle?.[key];
}

describe("JOB 3742 · S2 · die Seitenhilfe spricht Deutsch, Englisch und Niederländisch", () => {
  for (const sprache of ["de", "en", "nl"] as const) {
    for (const f of FLAECHEN) {
      it(`${f.key} · ${sprache}: der Text DIESER Sprache steht in der Liste`, async () => {
        // 1. Die Sprache hat einen eigenen Eintrag — direkt aus ihrer Ressource gelesen.
        const roherTitel = sprachressource(sprache, f.titelKey);
        const roherText = sprachressource(sprache, f.textKey);
        expect(
          typeof roherTitel === "string" && roherTitel.trim().length > 0,
          `${f.key}/${sprache}: ${f.titelKey} fehlt in der Ressource „${sprache}" (gelesen: ${JSON.stringify(roherTitel)}) — der deutsche Rückfall zählt hier nicht`,
        ).toBe(true);
        expect(
          typeof roherText === "string" && roherText.trim().length > 0,
          `${f.key}/${sprache}: ${f.textKey} fehlt in der Ressource „${sprache}" (gelesen: ${JSON.stringify(roherText)}) — der deutsche Rückfall zählt hier nicht`,
        ).toBe(true);
        const titel = roherTitel as string;
        const text = roherText as string;
        expect(
          text.length,
          `${f.key}/${sprache}: der Text ist zu kurz, um zwei Fragen zu beantworten`,
        ).toBeGreaterThan(40);

        // 2. Es ist wirklich übersetzt und nicht der deutsche Satz zweimal abgelegt.
        const deTitel = sprachressource("de", f.titelKey) as string;
        const deText = sprachressource("de", f.textKey) as string;
        if (sprache !== "de") {
          expect(titel, `${f.key}/${sprache}: der Titel ist wörtlich der deutsche`).not.toBe(
            deTitel,
          );
          expect(text, `${f.key}/${sprache}: der Text ist wörtlich der deutsche`).not.toBe(deText);
        }

        // 3. Genau dieser Satz steht auch in der gezeichneten Liste.
        await i18n.changeLanguage(sprache);
        await mount(f.route, createElement(AppShell, null, f.seite()));
        await seitenhilfeOeffnen();
        const inhalt = listentext();
        expect(inhalt, `${f.key}/${sprache}: der Titel fehlt in der Liste`).toContain(titel);
        expect(inhalt, `${f.key}/${sprache}: der Text fehlt in der Liste`).toContain(text);
        // 4. Und der deutsche Satz steht dort NICHT — das ist der Rückfall, sichtbar gemacht.
        if (sprache !== "de") {
          expect(
            inhalt,
            `${f.key}/${sprache}: in der Liste steht der DEUTSCHE Text — die Seite ist auf den Rückfall „de" gefallen`,
          ).not.toContain(deText);
        }
      });
    }
  }
});

// ------------------------------------------------------------------------------------------------
// S2b — SPRACHWECHSEL AN DER BEREITS MONTIERTEN SEITE, bei offenem Menü.
// ------------------------------------------------------------------------------------------------
// S2 schaltet vor der Montage um. Ein Mensch schaltet aber im Kopfband um, während er auf der Seite
// steht — der Tipp ist dann schon angemeldet. Meldete eine Seite ihren Text einmalig an (etwa in
// einem `useEffect` ohne Abhängigkeit auf `t`), bliebe die Liste danach deutsch.
describe("JOB 3742 · S2b · der Sprachwechsel erreicht die schon angemeldete Seitenhilfe", () => {
  for (const f of FLAECHEN) {
    it(`${f.key} · de → nl bei offenem Menü`, async () => {
      const deText = sprachressource("de", f.textKey) as string;
      const nlText = sprachressource("nl", f.textKey) as string;
      await mount(f.route, createElement(AppShell, null, f.seite()));
      await seitenhilfeOeffnen();
      expect(listentext(), `${f.key}: der deutsche Text stand nie in der Liste`).toContain(deText);

      await act(async () => {
        await i18n.changeLanguage("nl");
        await flush();
      });
      await act(flush);

      const inhalt = listentext();
      expect(
        inhalt,
        `${f.key}/nl: nach dem Sprachwechsel fehlt der niederländische Text`,
      ).toContain(nlText);
      expect(
        inhalt,
        `${f.key}/nl: nach dem Sprachwechsel steht immer noch der deutsche Text da`,
      ).not.toContain(deText);
    });
  }
});

// ------------------------------------------------------------------------------------------------
// S3 — NICHTS IM SICHTFELD (vorher grün, muss grün bleiben).
// ------------------------------------------------------------------------------------------------
// Pedi 04.09. 06:50, wörtlich im Quelltext (`SeitenhilfeContext.tsx:16-20`): „Text über Text über
// Text." Die naheliegende Fehllieferung dieses Auftrags wäre ein sichtbarer Erklärabsatz auf der
// Fläche. Dieser Fall ist der Wächter dagegen — und er trägt, wie die Gegenprobe (c) zeigt.
describe("JOB 3742 · S3 · der Hilfetext steht NICHT im gezeichneten Seiteninhalt", () => {
  for (const f of FLAECHEN) {
    it(`${f.key} · weder Titel noch Text erscheinen in <main>`, async () => {
      const titel = i18n.t(f.titelKey);
      const text = i18n.t(f.textKey);
      await mount(f.route, createElement(AppShell, null, f.seite()));
      const sichtfeld = sichtfeldtext();
      expect(sichtfeld, `${f.key}: der Hilfetitel steht im Sichtfeld`).not.toContain(titel);
      expect(sichtfeld, `${f.key}: der Hilfetext steht im Sichtfeld`).not.toContain(text);
      // Kalibrierung: das Sichtfeld wurde überhaupt gelesen (eine leere Messung wäre trivial grün).
      expect(
        container.querySelector("main"),
        `${f.key}: es gibt gar kein <main> — S3 hat nichts gemessen`,
      ).not.toBeNull();
    });
  }
});

// ------------------------------------------------------------------------------------------------
// S4 — ABMELDUNG: wer die Seite verlässt, nimmt ihren Tipp mit.
// ------------------------------------------------------------------------------------------------
// Ohne diesen Fall sammelten sich die Tipps aller besuchten Seiten in der Liste an — das Zahnrad
// zeigte dann die Hilfe einer Seite, auf der man gar nicht mehr steht.
describe("JOB 3742 · S4 · der Tipp verlässt die Liste mit seiner Seite", () => {
  for (const f of FLAECHEN) {
    it(`${f.key} · nach dem Abbau der Seite steht ihr Text nicht mehr da`, async () => {
      const text = i18n.t(f.textKey);
      await mount(f.route, createElement(AppShell, null, f.seite()));
      await seitenhilfeOeffnen();
      expect(listentext(), `${f.key}: der Text stand nie in der Liste`).toContain(text);

      // Dieselbe Hülle, dieselbe Route — nur die Seite ist weg. Das Menü bleibt offen (es schließt
      // nur bei einem Pfadwechsel, `ZahnradMenue.tsx:199-201`), die Liste wird also wirklich neu
      // gelesen und nicht bloß zugeklappt.
      await act(async () => {
        root.render(
          createElement(
            QueryClientProvider,
            { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
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
                    createElement(
                      MemoryRouter,
                      { initialEntries: [f.route] },
                      createElement(AppShell, null, createElement("div", null, "leer")),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
        await flush();
      });
      await act(flush);

      const menue = gestrafft(
        container.querySelector('[data-testid="zahnrad-menue"]')?.textContent,
      );
      expect(menue, `${f.key}: der Tipp blieb nach dem Abbau der Seite stehen`).not.toContain(text);
    });
  }
});
