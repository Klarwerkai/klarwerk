// @vitest-environment jsdom
// ================================================================================================
// JOB 3669 — DER WÄCHTER: DIE VIER SEITEN DES ERSTEN WEGS ERKLÄREN SICH IM ZAHNRAD-MENÜ.
// ================================================================================================
//
// Pedi (11.09., `SICHTBARES-GESPRAECH.jsonl:695`): „damit wir einen Demo-Account aushändigen können
// und eine Person, die damit noch nie gearbeitet hat, sich relativ schnell einarbeitet … unsere
// Hilfe muss auch sauber ausgearbeitet werden."
//
// Gemessen am Basisstand `ec1d872`: `/start`, `/bibliothek`, `/aufgaben` und `/wissen/:id` meldeten
// KEINEN eigenen Erklärtext an. `/bibliothek` und `/aufgaben` trugen immerhin den Nav-Erklärsatz
// ihres Hilfekapitels; `/start` und `/wissen/:id` zeigten unter „Seitenhilfe" den Leersatz „Zu
// dieser Seite gibt es keine Erklärung."
//
// WAS DIESER WÄCHTER FESTHÄLT — und warum er an der ECHTEN HÜLLE misst und nicht an der Quelle:
// die Zusage ist nicht „im Quelltext steht ein HelpTip", sondern „wer die Seite öffnet und das
// Zahnrad aufklappt, FINDET dort die Erklärung". Gemessen wird deshalb der Weg, den auch der Mensch
// geht: Seite montieren → Zahnrad → „Seitenhilfe" → der Text steht in der Liste. Fällt die
// Anmeldung an einer Seite weg, ist dieser Fall rot (Gegenprobe des Auftrags, §4.4).
//
// UND DIE ANDERE RICHTUNG (§5 des Auftrags): derselbe Text darf NICHT im Sichtfeld stehen. Pedi hat
// die Sprechblase am 04.09. abgelehnt, JOB 3060 hat sie ausgebaut. Der Wächter prüft beides an
// derselben Montage — sonst wäre ein Rückbau in Richtung Popover grün.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RUNDE 2 · die Rolle der angemeldeten Person — als GETTER in die Attrappe gereicht.
 *
 * Ben hat den Wächter von Runde 1 zu Recht als halb gemessen bezeichnet: er kannte nur `admin` und
 * nur die breite Ansicht. Eine Hilfe, die einem Betrachter einen gesperrten Knopf als Weg verkauft,
 * blieb dabei grün. Ab hier stellt jeder Fall die Rolle selbst ein.
 */
// JOB 3768: „experte" kommt dazu. `/entwuerfe` trägt `minRole: "experte"` (`app/navigation.ts:158`)
// — eine Betrachterin kommt auf diese Seite gar nicht, wohl aber eine Expertin, und GENAU bei ihr
// entscheidet sich, ob der Ersteller-Filter der Hilfe eine Bedienung verspricht, die sie nicht hat.
const sitzung = vi.hoisted(() => ({ rolle: "admin" as "admin" | "viewer" | "experte" }));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: sitzung.rolle })),
    logout: vi.fn(async () => ({})),
  },
}));

// Jede Datenquelle antwortet leer — die Seitenhilfe ist eine Aussage über die SEITE, nicht über
// ihren Bestand. Genau so sieht ein frisch ausgehändigter Demo-Zugang beim ersten Öffnen auch aus.
//
// DIE ATTRAPPE KENNT DEN VOLLEN PFAD DES AUFRUFS, weil das Produkt drei Antwortformen hat und eine
// pauschale nicht für alle drei passt: die meisten Quellen dieser vier Seiten sind LISTEN (`[]`);
// `learningPaths.byRole` (`endpoints.ts:669`) und `ko.get` liefern EIN Objekt oder nichts;
// `gaps.summary` liefert reine Zähler, aus denen die Startseite `byPriority.hoch` liest
// (`pages/Start.tsx:160`). Eine Liste an diesen drei Stellen wäre ein Fehler der ATTRAPPE — sie
// bräche das Rendern, bevor die Seitenhilfe überhaupt gemessen werden kann.
//
// RUNDE 2: EINE Quelle ist von aussen setzbar — die Konflikte. Der Aufgaben-Text sagt „klick die
// oberste Zeile an, sie führt an die Stelle, an der du sie erledigst". Ob das auch für einen
// Betrachter gilt, ist erst zu sehen, wenn wirklich eine Zeile da ist (`bestand.konflikte`).
//
// JOB 3768: eine ZWEITE setzbare Quelle — die Entwürfe. Die Seitenhilfe selbst braucht sie nicht
// (sie ist eine Aussage über die SEITE), aber die Rückfrage vor dem Löschen lässt sich ohne eine
// echte Zeile gar nicht anklicken. Vorgabe bleibt leer, damit die Hilfefälle oben unverändert an
// einem frisch ausgehändigten Demo-Zugang messen.
const bestand = vi.hoisted(() => ({ konflikte: [] as unknown[], entwuerfe: [] as unknown[] }));

/**
 * JOB 3851 · DIE ANTWORT DES ENTWURFSABRUFS — in der Form, die das Blatt wirklich liest.
 *
 * Seit diesem Auftrag führt `mount()` auch die Route `/erfassen`; dort steht dieselbe Seite wie im
 * echten Router (`routes.tsx:146`), und die holt den Entwurf über `endpoints.drafts.get(<id>)`
 * (`components/erfassen/Blatt.tsx:900-901`). Die Attrappe antwortete an dieser Stelle mit `[]` —
 * für EINEN Entwurf die falsche Form: `draft.payload` wäre `undefined`, und `frontDoorBodyFromDraft`
 * (`lib/captureFrontDoor.ts:97`) stürbe darin, bevor irgendetwas zu messen wäre. Die richtige Form
 * steht deshalb im SELBEN Register wie `ko.get` und `learningPaths.byRole`, nicht in einer zweiten
 * Attrappe daneben.
 *
 * DER RUMPFTEXT IST ABSICHTLICH SPERRIG: keines seiner vier Wörter kommt in `apps/web/src/i18n.ts`
 * vor (`grep -c` je Wort: 0). Ein Treffer im DOM kann also nur aus DIESEM Entwurf stammen — und
 * nicht aus einem Sprachstring, der zufällig danebensteht.
 *
 * RUNDE 2 · SIE BELOHNT KEINE FALSCHE KENNUNG MEHR (bens Korrekturpflicht 1 zu Runde 1).
 * Die Attrappe antwortete bis hierher auf JEDE Kennung mit diesem einen Entwurf. ben hat gemessen,
 * was das wert war: `Blatt.tsx:901` von `.get(resumeDraftId)` auf `.get("ben-falscher-entwurf")`
 * verstellt — und alle neuen Fälle blieben grün (`Tests 4 passed | 56 skipped (60)`). Gemessen war
 * damit „das Blatt zeigt IRGENDEINEN Entwurf", nicht „es zeigt DIESEN".
 * Also antwortet `fuer()` nur noch auf `e-1`, und auf alles andere so, wie der Server auf eine
 * unbekannte Kennung antwortet: mit einem Fehlschlag (`GET /api/drafts/:id` → 404, der Client wirft
 * einen `ApiError`, `api/client.ts:37-44`). Das Produkt hat dafür seinen eigenen Weg
 * (`Blatt.tsx:958-976`) — es stürzt nicht, es zeigt nur eben NICHT den Entwurf.
 */
const ABRUF = vi.hoisted(() => {
  const titel = "Ventilwartung Nord 2026";
  const rumpf = "Kesselhaus Nordstrang Pruefprotokoll 3851";
  const antwort = {
    id: "e-1",
    updatedAt: "2026-09-11T09:30:00.000Z",
    payload: { title: titel, bodyHtml: `<p>${rumpf}</p>` },
  };
  return {
    titel,
    rumpf,
    antwort,
    fuer(kennung: unknown): typeof antwort {
      if (kennung !== antwort.id) {
        throw new Error(
          `GET /drafts/${String(kennung)} → 404: diese Attrappe kennt nur „${antwort.id}"`,
        );
      }
      return antwort;
    },
  };
});

/**
 * JOB 3851 RUNDE 2 · DAS ABRUFBUCH — was wirklich gefragt wurde, nicht was geantwortet wurde.
 *
 * Die abweisende Attrappe oben deckt den Fall „falsche Kennung" nur MITTELBAR ab: sie lässt das
 * Blatt leer, und E6 fällt darüber. Eine Prüfung, die den Istwert der Kennung NENNT, braucht ihn
 * aber selbst — sonst stünde in der roten Meldung „kein Titel im Blatt" statt „gefragt wurde
 * ben-falscher-entwurf". Deshalb schreibt jeder Aufruf hier seinen Pfad und seine Argumente mit;
 * E8 liest sie. Das Buch wird in `beforeEach` geleert, sonst zählte ein Nachbarfall mit.
 */
const abrufe = vi.hoisted(() => ({ liste: [] as { pfad: string; argumente: unknown[] }[] }));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ANTWORTEN: Record<string, unknown> = {
    "learningPaths.byRole": null,
    "ko.get": null,
    "gaps.summary": { open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } },
  };
  const make = (pfad: string): unknown =>
    new Proxy(
      vi.fn(async (...argumente: unknown[]) => {
        abrufe.liste.push({ pfad, argumente });
        if (pfad === "conflicts.list") {
          return bestand.konflikte;
        }
        if (pfad === "drafts.list") {
          return bestand.entwuerfe;
        }
        // JOB 3851: EIN Entwurf ist ein Objekt, keine Liste — und nur der GEFRAGTE (s. `ABRUF`).
        if (pfad === "drafts.get") {
          return ABRUF.fuer(argumente[0]);
        }
        return pfad in ANTWORTEN ? ANTWORTEN[pfad] : [];
      }),
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

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { routePathAllows } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
// JOB 3851: die Seite, die der echte Router auf `/erfassen` zeigt (`routes.tsx:146`) — nur gelesen,
// nie geändert. Begründung an der zweiten Route in `mount()`.
import { Capture } from "../../apps/web/src/pages/Capture";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";
import { Library } from "../../apps/web/src/pages/Library";
import { MeineEntwuerfe } from "../../apps/web/src/pages/MeineEntwuerfe";
import { MyTasks } from "../../apps/web/src/pages/MyTasks";
import { Start } from "../../apps/web/src/pages/Start";
import { AppShell } from "../../apps/web/src/shell/AppShell";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
// jsdom kennt `scrollTo` nicht; `MyTasks` stellt die gemerkte Listenposition wieder her.
window.scrollTo = () => {};

/**
 * Die FÜNF Seiten des ersten Wegs — ankommen, Bestand ansehen, eigene Aufgaben, ein Objekt lesen,
 * die eigenen Entwürfe fortsetzen.
 *
 * ERLEDIGT MIT JOB 3768: „Meine Entwürfe" (`pages/MeineEntwuerfe.tsx`) stand hier bis dahin NICHT,
 * und zwar aus einem Grund, der nichts mit der Sache zu tun hatte — die Datei lag während JOB 3669
 * bei JOB 3668 (Entwurfs-Papierkorb), und die Steuerung hat sie am 12.09. ausdrücklich
 * herausgenommen („Mein Schnittfehler, nicht deiner."). JOB 3668 ist seit dem 12.09. LIVE; die
 * Seite steht deshalb jetzt HIER in dieser Tabelle, wie es die Notiz von damals verlangt hat, und
 * NICHT in einem zweiten Wächter.
 */
const SEITEN = [
  { id: "start", pfad: "/start", muster: "/start", seite: Start, schluessel: "seitenhilfe.start" },
  {
    id: "bibliothek",
    pfad: "/bibliothek",
    muster: "/bibliothek",
    seite: Library,
    schluessel: "seitenhilfe.bibliothek",
  },
  {
    id: "aufgaben",
    pfad: "/aufgaben",
    muster: "/aufgaben",
    seite: MyTasks,
    schluessel: "seitenhilfe.aufgaben",
  },
  {
    id: "wissen",
    pfad: "/wissen/ko-1",
    muster: "/wissen/:id",
    seite: KnowledgeDetail,
    schluessel: "seitenhilfe.wissen",
  },
  {
    id: "entwuerfe",
    pfad: "/entwuerfe",
    muster: "/entwuerfe",
    seite: MeineEntwuerfe,
    schluessel: "seitenhilfe.entwuerfe",
  },
] as const;

const SPRACHEN = ["de", "en", "nl"] as const;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

// ================================================================================================
// JOB 3851 · WOHIN DER ROUTER WIRKLICH ZEIGT.
// ================================================================================================
//
// Der Fortsetzen-Weg endet nicht am Knopf, sondern an einer ADRESSE — und die liest dieser Fühler
// aus dem Router selbst, nicht aus einer Erwartung des Tests. Er rendert nichts; er hängt als
// Geschwister des `AppShell` IM `MemoryRouter` und läuft damit bei jeder Navigation neu. Ohne ihn
// bliebe nur der Umweg über `aria-current` am Kopfband — eine Anzeige über den Pfad, aber keine
// Auskunft über die Abfrage (`?draft=…`), und genau die ist hier der Messgegenstand.
let adresse = { pfad: "", suche: "" };

function Adressfuehler(): null {
  const ort = useLocation();
  adresse = { pfad: ort.pathname, suche: ort.search };
  return null;
}

/** Der Adresstext, so wie er gemessen wurde — für Fehlermeldungen, die den Istwert nennen. */
function adresstext(): string {
  return `${adresse.pfad}${adresse.suche}`;
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function text(sprache: string, schluessel: string): string {
  const wert = i18n.getResource(sprache, "translation", schluessel);
  if (typeof wert !== "string" || wert.trim() === "") {
    throw new Error(`Kein Text für ${schluessel} in ${sprache}`);
  }
  return wert;
}

// ================================================================================================
// RUNDE 2 · DIE BREITE IST EINE ZAHL, KEIN SCHALTER.
// ================================================================================================
//
// Runde 1 stellte `matchMedia` pauschal auf „alles trifft zu" oder „nichts trifft zu". Damit war
// die schmale Bibliothek nicht messbar: dort entscheiden ZWEI Abfragen gegeneinander — die
// Telefonschwelle `(max-width: 759px)` und das Tablet-Band `(min-width: 760px) and (max-width:
// 899px)` (`components/bibliothek/BibliothekFlaeche.tsx:196`, `shell/useMediaQuery.ts`). „Alles
// trifft zu" macht ein Gerät, das gleichzeitig Telefon und Tablet ist — das gibt es nicht.
//
// Deshalb steht hier eine echte Breite, und die Abfrage wird gegen sie ausgewertet.
const TELEFON = 390;
// Das Lese-Tablet liegt zwischen 760 und 899 px (`shell/useMediaQuery.ts`, `TABLET_LESE_QUERY`) —
// dort trägt der Bericht die Fläche, und die Liste lässt sich daneben holen. Genau diese dritte
// Lage nennt die Bibliothekshilfe; ohne eine Breite in diesem Band wäre der Satz unbelegt.
const TABLET = 768;
const BREIT = 1280;

function trifftZu(abfrage: string, breite: number): boolean {
  const teile = abfrage.split(" and ");
  return teile.every((teil) => {
    const max = /\(max-width:\s*(\d+)px\)/.exec(teil);
    if (max?.[1] !== undefined) {
      return breite <= Number(max[1]);
    }
    const min = /\(min-width:\s*(\d+)px\)/.exec(teil);
    if (min?.[1] !== undefined) {
      return breite >= Number(min[1]);
    }
    // Eine Abfrage, die dieser Prüfstand nicht versteht, wird NICHT stillschweigend zu „trifft zu":
    // sonst behauptete er eine Lage, die er gar nicht eingestellt hat.
    return false;
  });
}

function setBreite(breite: number): void {
  (globalThis as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q) =>
    ({
      matches: trifftZu(q, breite),
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

async function mount(seite: {
  pfad: string;
  muster: string;
  seite: () => JSX.Element;
}): Promise<void> {
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
                createElement(
                  MemoryRouter,
                  { initialEntries: [seite.pfad] },
                  // JOB 3851: liest den Ort aus dem Router mit (Begründung an `Adressfuehler`).
                  createElement(Adressfuehler),
                  createElement(
                    AppShell,
                    null,
                    // Mit echter Route: `/wissen/:id` liest seine Kennung aus den Routenparametern.
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: seite.muster,
                        element: createElement(seite.seite),
                      }),
                      // ========================================================================
                      // JOB 3851 — DIE ZWEITE ROUTE, DAMIT EIN KLICK ÜBERHAUPT ETWAS MISST.
                      // ========================================================================
                      // Der Fortsetzen-Knopf der Entwurfsliste verlässt seine Seite
                      // (`MeineEntwuerfe.tsx:96-98`: `/erfassen?draft=<id>`). Mit nur EINER Route
                      // landete er auf einem Pfad ohne Route: React Router meldete „No routes
                      // matched location", `<main>` blieb leer, und ein Fall, der danach etwas
                      // erwartete, wäre unbegründet rot gewesen (gemessen, s. Block E5–E8 unten).
                      //
                      // SIE STEHT HIER UND NICHT IN EINER ZWEITEN MONTAGESTELLE: eine zweite
                      // `mount`-Funktion wäre eine zweite Providerkette und damit eine zweite
                      // Wahrheit über „echte Hülle". `Capture` ist dabei nicht gewählt, sondern
                      // abgelesen — es ist die Seite, die auch der echte Router auf `/erfassen`
                      // zeigt (`routes.tsx:146`, `PAGES.erfassen`).
                      //
                      // FÜR DIE FÜNF SEITEN AUS `SEITEN` ÄNDERT SIE NICHTS: keine von ihnen hat
                      // das Muster `/erfassen`, die Route wird dort also nie gewählt.
                      createElement(Route, {
                        path: "/erfassen",
                        element: createElement(Capture),
                      }),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  // Zwei Durchläufe: `/auth/me` wird erst nach erfolgreichem `/auth/status` freigegeben.
  await act(flush);
  await act(flush);
}

async function click(el: Element | null | undefined): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error("Element zum Klicken fehlt");
  }
  await act(async () => {
    el.click();
    await flush();
  });
}

/**
 * Der Weg des Menschen: Zahnrad → „Seitenhilfe". Gibt den Text der aufgeklappten Liste zurück.
 *
 * SCHMAL LIEGT DERSELBE EINTRAG IM SCHUBFACH (`shell/AppShell.tsx`, ≤ 899 px): kein Zahnrad im
 * Kopfband, sondern der Hamburger und dahinter dieselben Zeilen. Der Helfer nimmt den Weg, den es
 * gerade gibt — sonst wäre der schmale Fall nicht messbar, obwohl er der wichtigere ist.
 */
async function seitenhilfe(): Promise<string> {
  const zahnrad = container.querySelector('[data-testid="kopfband-zahnrad"]');
  if (zahnrad) {
    await click(zahnrad);
  } else {
    await click(container.querySelector(`[aria-label="${i18n.t("topbar.openMenu")}"]`));
  }
  await click(container.querySelector('[data-testid="zahnrad-seitenhilfe"]'));
  const liste = container.querySelector('[data-testid="seitenhilfe-liste"]');
  if (!liste) {
    // Ohne Liste steht dort der Leersatz — genau der Zustand, den dieser Auftrag beseitigt hat.
    const menue = container.querySelector('[data-testid="zahnrad-menue"]')?.textContent ?? "";
    throw new Error(`Keine Seitenhilfe-Liste. Menü sagt: ${menue.replace(/\s+/g, " ").trim()}`);
  }
  return (liste.textContent ?? "").replace(/\s+/g, " ").trim();
}

function normal(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  setBreite(BREIT);
  sitzung.rolle = "admin";
  bestand.konflikte = [];
  bestand.entwuerfe = [];
  adresse = { pfad: "", suche: "" };
  // JOB 3851 R2: das Abrufbuch gehört zum EINZELNEN Fall (Begründung an `abrufe`).
  abrufe.liste = [];
  // Suche und Sortierung der Entwurfsliste liegen PRO BROWSER in `localStorage`
  // (`lib/draftListView.ts`). Ein Restfilter aus einem Nachbarfall liesse die Zeile verschwinden,
  // die der Löschfall gleich anklickt — dann prüfte er nichts und bliebe still grün.
  localStorage.clear();
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  await i18n.changeLanguage("de");
  vi.clearAllMocks();
});

describe("JOB 3669 · der erste Weg erklärt sich selbst — im Zahnrad-Menü, nicht im Sichtfeld", () => {
  for (const seite of SEITEN) {
    it(`${seite.pfad}: das Zahnrad zeigt unter „Seitenhilfe" Titel UND Text der Seite (de)`, async () => {
      await mount(seite);
      const liste = await seitenhilfe();
      expect(liste).toContain(normal(text("de", `${seite.schluessel}.title`)));
      expect(liste).toContain(normal(text("de", `${seite.schluessel}.body`)));
      // Der Leersatz ist damit weg — auf jeder der fünf Seiten.
      expect(liste).not.toContain(normal(text("de", "menue.seitenhilfe.leer")));
    });

    it(`${seite.pfad}: derselbe Text auf Englisch — und es ist wirklich der englische`, async () => {
      await i18n.changeLanguage("en");
      await mount(seite);
      const liste = await seitenhilfe();
      expect(liste).toContain(normal(text("en", `${seite.schluessel}.title`)));
      expect(liste).toContain(normal(text("en", `${seite.schluessel}.body`)));
      // Kein deutscher Rückfall: der deutsche Text steht auf der englischen Fläche NICHT.
      expect(liste).not.toContain(normal(text("de", `${seite.schluessel}.body`)));
    });

    it(`${seite.pfad}: der Erklärtext steht NICHT im Sichtfeld (§5: keine Sprechblase, keine Tour)`, async () => {
      await mount(seite);
      const main = container.querySelector("main");
      expect(main).not.toBeNull();
      const sichtbar = normal(main?.textContent ?? "");
      expect(sichtbar).not.toContain(normal(text("de", `${seite.schluessel}.body`)));
      expect(sichtbar).not.toContain(normal(text("de", `${seite.schluessel}.title`)));
    });
  }

  it("jede der fünf Seiten hat ihren Text in ALLEN drei Sprachen — und keine Sprache erbt eine andere", () => {
    for (const seite of SEITEN) {
      const koerper = SPRACHEN.map((s) => text(s, `${seite.schluessel}.body`));
      const titel = SPRACHEN.map((s) => text(s, `${seite.schluessel}.title`));
      // Ein abgeschriebener deutscher Text unter „en" wäre eine Übersetzung, die keine ist.
      expect(new Set(koerper).size).toBe(SPRACHEN.length);
      expect(new Set(titel).size).toBe(SPRACHEN.length);
      // Der Text beantwortet die dritte Frage des Auftrags ausdrücklich: „was ist der nächste
      // Schritt". Ohne sie ist es eine Beschreibung, keine Einarbeitung.
      expect(koerper[0]).toContain("Nächster Schritt:");
      expect(koerper[1]).toContain("Next step:");
      expect(koerper[2]).toContain("Volgende stap:");
    }
  });
});

// ================================================================================================
// RUNDE 2 · DIE ZUSAGE UND DIE FLÄCHE WERDEN IM SELBEN LAUF VERGLICHEN.
// ================================================================================================
//
// BENS BEFUND AN RUNDE 1 (Korrekturpflichten 1 und 2): der Wächter verglich Text mit Text. Dass der
// Text stimmt, prüfte niemand — und zweimal stimmte er nicht: als Betrachter ist der „Erfassen"-Weg
// gesperrt, und schmal gibt es das „links die Liste" nicht.
//
// Ab hier stellt jeder Fall Rolle UND Breite ein, liest die Seitenhilfe aus dem echten Menü und
// misst im SELBEN gemounteten Baum, was die Zusage behauptet. Fällt eine der beiden Seiten um —
// der Text oder die Fläche —, ist der Fall rot.
const ROLLENVORBEHALT = { de: "Kein Zugriff", en: "No access", nl: "Geen toegang" } as const;
const RUECKWEG = {
  de: "Zurück zu Bibliothek",
  en: "Back to Library",
  nl: "Terug naar Bibliotheek",
} as const;

describe("JOB 3669 R2 · was die Seitenhilfe zusagt, hält die Seite — je Rolle und je Breite", () => {
  it('B1 · /bibliothek als BETRACHTER: der „Erfassen"-Knopf ist kein Weg — und die Hilfe sagt genau das', async () => {
    sitzung.rolle = "viewer";
    await mount(SEITEN[1]);
    const knopf = container.querySelector('[data-testid="bib-leer-erfassen"]');
    expect(knopf).not.toBeNull();
    // Die FLÄCHE: kein Link, sondern die gesperrte Fassung von `RoleLink` mit ihrem Wort.
    expect(knopf?.tagName).toBe("DIV");
    expect(knopf?.getAttribute("aria-disabled")).toBe("true");
    expect(normal(knopf?.textContent ?? "")).toContain(ROLLENVORBEHALT.de);
    // Die ZUSAGE: sie nennt den Vorbehalt mit demselben Wort, das dort steht.
    const liste = await seitenhilfe();
    expect(liste).toContain(ROLLENVORBEHALT.de);
    expect(normal(text("de", "seitenhilfe.bibliothek.body"))).toContain(ROLLENVORBEHALT.de);
  });

  it("B2 · dieselbe Zusage auf Englisch und Niederländisch trägt denselben Vorbehalt", async () => {
    sitzung.rolle = "viewer";
    await i18n.changeLanguage("en");
    await mount(SEITEN[1]);
    expect(
      normal(container.querySelector('[data-testid="bib-leer-erfassen"]')?.textContent ?? ""),
    ).toContain(ROLLENVORBEHALT.en);
    expect(await seitenhilfe()).toContain(ROLLENVORBEHALT.en);
    // NL wird am Bestand gemessen, nicht an einer zweiten Montage: dieselbe Zusage, dieselbe Regel.
    expect(normal(text("nl", "seitenhilfe.bibliothek.body"))).toContain(ROLLENVORBEHALT.nl);
  });

  it("B3 · GEGENPROBE zur Rolle: als ADMIN ist derselbe Knopf ein echter Weg nach /erfassen", async () => {
    sitzung.rolle = "admin";
    await mount(SEITEN[1]);
    const knopf = container.querySelector('[data-testid="bib-leer-erfassen"]');
    expect(knopf?.tagName).toBe("A");
    expect(knopf?.getAttribute("href")).toBe("/erfassen");
    expect(normal(knopf?.textContent ?? "")).not.toContain(ROLLENVORBEHALT.de);
  });

  it('S1 · /start als BETRACHTER: „Meine Entwürfe" ist kein Weg — die Hilfe hat den Vorbehalt schon', async () => {
    sitzung.rolle = "viewer";
    await mount(SEITEN[0]);
    const verweis = container.querySelector('[data-testid="h5-start-entwuerfe"]');
    expect(verweis).not.toBeNull();
    expect(verweis?.getAttribute("data-role-no-reach")).toBe("true");
    expect(normal(text("de", "seitenhilfe.start.body"))).toContain("nur wenn du erfassen darfst");
    expect(await seitenhilfe()).toContain("nur wenn du erfassen darfst");
  });

  it('A1 · /aufgaben als BETRACHTER mit leerem Bestand: „Nichts offen." und der Knopf stehen wirklich da', async () => {
    sitzung.rolle = "viewer";
    await mount(SEITEN[2]);
    const flaeche = normal(container.querySelector("main")?.textContent ?? "");
    expect(flaeche).toContain(normal(text("de", "task.none")));
    expect(container.querySelector('[data-testid="task-wie-weiter"]')).not.toBeNull();
    // Die Zusage nennt beides wörtlich — sie ist also nachprüfbar und nicht bloss plausibel.
    const zusage = normal(text("de", "seitenhilfe.aufgaben.body"));
    expect(zusage).toContain(normal(text("de", "task.none")));
    expect(zusage).toContain(normal(text("de", "task.weiter")));
  });

  // ------------------------------------------------------------------------------------------------
  // A2 — DER EIGENE BEFUND DIESER RUNDE, gefunden mit Bens Methode an einer Seite, die er nicht nannte.
  // ------------------------------------------------------------------------------------------------
  // Ben prüfte die Bibliothek als Betrachter. Dieselbe Frage an `/aufgaben` gestellt (Rolle einstellen,
  // eine echte Zeile hineingeben, dann die Zusage mit der Fläche vergleichen) ergibt: der Betrachter
  // SIEHT die Konfliktzeile, und ihr Ziel `/konflikte` verlangt „controller" (`app/navigation.ts:228`).
  // Die Zeile ist ein `<Link>`, kein `RoleLink` — sie sagt dem Betrachter also nicht, dass der Weg zu
  // ist. Der Hilfetext von Runde 1 („führt direkt an die Stelle, an der du die Aufgabe erledigst")
  // wäre für ihn dieselbe falsche Zusage wie die Bibliothekshilfe. Deshalb trägt er jetzt den
  // Vorbehalt — die Fläche selbst zu ändern wäre `MyTasks.tsx` UND `navigation.ts`, das ist ein
  // eigener Auftrag und steht in der Rückgabe unter REST.
  it("A2 · /aufgaben MIT einer Zeile als BETRACHTER: das Ziel ist gesperrt — und die Hilfe sagt es", async () => {
    sitzung.rolle = "viewer";
    bestand.konflikte = [
      { id: "c1", description: "Zwei Aussagen widersprechen sich", status: "offen" },
    ];
    await mount(SEITEN[2]);
    const zeile = container.querySelector('[data-testid="task-zeile"] a');
    expect(zeile).not.toBeNull();
    const ziel = zeile?.getAttribute("href") ?? "";
    expect(ziel).toBe("/konflikte");
    // `routePathAllows` ist dieselbe Quelle, aus der der Router sein Tor zieht (`navigation.ts:561`).
    expect(routePathAllows(ziel, "viewer")).toBe(false);
    // Also MUSS die Zusage den Vorbehalt tragen — in der Sprache, in der sie dasteht.
    const liste = await seitenhilfe();
    expect(liste).toContain("sofern diese Fläche für deine Rolle freigegeben ist");
  });

  it("A3 · GEGENPROBE zu A2: für den Admin ist dasselbe Ziel offen — der Vorbehalt ist keine Ausrede", async () => {
    sitzung.rolle = "admin";
    bestand.konflikte = [
      { id: "c1", description: "Zwei Aussagen widersprechen sich", status: "offen" },
    ];
    await mount(SEITEN[2]);
    const ziel =
      container.querySelector('[data-testid="task-zeile"] a')?.getAttribute("href") ?? "";
    expect(ziel).toBe("/konflikte");
    expect(routePathAllows(ziel, "admin")).toBe(true);
    // Und der Erklärsatz je Zeile, den die Hilfe nennt („das i"), steht wirklich an der Zeile.
    expect(container.querySelector('[data-testid="task-erklaerung-knopf"]')).not.toBeNull();
  });

  it(`W1 · /wissen/:id bei ${TELEFON} px: die Liste ist NICHT da, der Rückweg ist da — und die Hilfe sagt es so`, async () => {
    setBreite(TELEFON);
    await mount(SEITEN[3]);
    // Die FLÄCHE: schmal trägt der Eintrag die Seite allein (BibliothekFlaeche.tsx:942).
    expect(container.querySelector('[data-testid="bib-liste"]')).toBeNull();
    const zurueck = container.querySelector('[data-testid="bib-zurueck"]');
    expect(zurueck).not.toBeNull();
    expect(normal(zurueck?.textContent ?? "")).toContain("Zurück zu");
    // Die ZUSAGE: sie verspricht schmal keine Liste links, sondern nennt diesen Rückweg.
    const zusage = normal(text("de", "seitenhilfe.wissen.body"));
    expect(zusage).toContain(RUECKWEG.de);
    expect(await seitenhilfe()).toContain(RUECKWEG.de);
  });

  it(`W2 · GEGENPROBE zur Breite: bei ${BREIT} px steht die Liste wirklich neben dem Eintrag`, async () => {
    setBreite(BREIT);
    await mount(SEITEN[3]);
    expect(container.querySelector('[data-testid="bib-liste"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="bib-zurueck"]')).toBeNull();
  });

  it(`L1 · /bibliothek mit gewähltem Eintrag bei ${TELEFON} px: auch hier keine Liste, aber der Rückweg`, async () => {
    setBreite(TELEFON);
    await mount({ pfad: "/bibliothek?eintrag=ko-1", muster: "/bibliothek", seite: Library });
    expect(container.querySelector('[data-testid="bib-liste"]')).toBeNull();
    expect(container.querySelector('[data-testid="bib-zurueck"]')).not.toBeNull();
    const zusage = normal(text("de", "seitenhilfe.bibliothek.body"));
    expect(zusage).toContain(RUECKWEG.de);
    expect(await seitenhilfe()).toContain(RUECKWEG.de);
  });

  it("L2 · und ohne Wahl trägt schmal die LISTE die Fläche — die dritte Aussage desselben Satzes", async () => {
    setBreite(TELEFON);
    await mount(SEITEN[1]);
    expect(container.querySelector('[data-testid="bib-liste"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="bib-zurueck"]')).toBeNull();
  });

  // ------------------------------------------------------------------------------------------------
  // T1 — RUNDE 3: DER SCHALTER WIRD GEDRÜCKT, NICHT GEZÄHLT.
  // ------------------------------------------------------------------------------------------------
  // Bens Prüflücke an Runde 2, wörtlich: „Tablet-Fall T1 prüft jedoch nur den geschlossenen Schalter
  // und dessen Beschriftung. Seine Wirkung wird nicht geprüft; deshalb bleibt die falsche Ortsangabe
  // grün." Genau so war es: der Text sagte „daneben", die Liste kommt aber als Schublade ÜBER den
  // Eintrag — und ein Fall, der nur das Vorhandensein des Schalters misst, merkt den Unterschied nie.
  //
  // Ab hier wird beides gedrückt: einblenden (Lage `darueber`, `absolute`, `z-20`) und ausblenden
  // (die Liste geht wieder aus dem Baum). Die GEOMETRIE — dass sich die Rechtecke wirklich
  // überlappen — kann jsdom nicht messen; das tut der Chromium-Fall nebenan
  // (`tablet-schublade-chromium.test.ts`) an der gebauten Seite, mit Eichung bei 1620 px.
  it(`T1 · im Tablet-Band (${TABLET} px): der Schalter legt die Liste ÜBER den Eintrag — und wieder weg`, async () => {
    setBreite(TABLET);
    await mount({ pfad: "/bibliothek?eintrag=ko-1", muster: "/bibliothek", seite: Library });
    const schalter = container.querySelector('[data-testid="bib-liste-schalter"]');
    expect(schalter).not.toBeNull();
    // Zugeklappt als Vorgabe — genau deshalb steht der Satz überhaupt in der Hilfe.
    expect(schalter?.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector('[data-testid="bib-liste"]')).toBeNull();
    const einblenden = normal(text("de", "lib.lesemodus.listeEinblenden"));
    const ausblenden = normal(text("de", "lib.lesemodus.listeAusblenden"));
    expect(normal(schalter?.textContent ?? "")).toContain(einblenden);

    // ---- EINBLENDEN: die Wirkung, nicht nur der Knopf -------------------------------------------
    await click(schalter);
    const liste = container.querySelector('[data-testid="bib-liste"]');
    expect(liste).not.toBeNull();
    // `darueber` ist die dritte Lage der Liste (`BibliothekListe.tsx:93`); „daneben" wäre `spalte`.
    expect(liste?.getAttribute("data-lage")).toBe("darueber");
    const klassen = liste?.getAttribute("class") ?? "";
    expect(klassen).toContain("absolute");
    expect(klassen).toContain("z-20");
    // Der Eintrag ist NICHT gewichen — er liegt unter der Schublade, also weiter im Baum.
    expect(container.querySelector('[data-testid="bib-lesen"]')).not.toBeNull();
    // Der Schalter sagt jetzt selbst, dass er offen ist, und nennt den Weg zurück.
    const offen = container.querySelector('[data-testid="bib-liste-schalter"]');
    expect(offen?.getAttribute("aria-expanded")).toBe("true");
    expect(offen?.getAttribute("aria-controls")).toBe("bib-liste");
    expect(normal(offen?.textContent ?? "")).toContain(ausblenden);

    // ---- UND WIEDER WEG: auch das sagt die Hilfe zu ---------------------------------------------
    await click(offen);
    expect(container.querySelector('[data-testid="bib-liste"]')).toBeNull();

    // ---- DIE ZUSAGE nennt beide Beschriftungen UND die richtige Lage ----------------------------
    const zusage = normal(text("de", "seitenhilfe.bibliothek.body"));
    expect(zusage).toContain(einblenden);
    expect(zusage).toContain(ausblenden);
    expect(zusage).toContain("ÜBER den Eintrag");
    expect(zusage).not.toContain("daneben");
    expect(await seitenhilfe()).toContain(einblenden);
  });

  it("T2 · in allen drei Sprachen steht die Lage als ÜBER dem Eintrag, nicht als daneben", () => {
    // Die drei Wörter für dieselbe Tatsache — und in keiner Sprache das Nebeneinander, das es dort
    // nicht gibt. Ohne diesen Fall bliebe eine Sprache beim alten Satz stehen, unbemerkt.
    const lage = { de: "ÜBER den Eintrag", en: "OVER the entry", nl: "OVER het item" } as const;
    const falsch = { de: "daneben", en: "alongside", nl: "ernaast" } as const;
    for (const sprache of SPRACHEN) {
      const zusage = String(
        i18n.getResource(sprache, "translation", "seitenhilfe.bibliothek.body"),
      );
      expect(zusage).toContain(lage[sprache]);
      expect(zusage).not.toContain(falsch[sprache]);
      // Und beide Beschriftungen des Schalters — der Weg hin UND zurück.
      for (const schluessel of ["lib.lesemodus.listeEinblenden", "lib.lesemodus.listeAusblenden"]) {
        expect(zusage).toContain(String(i18n.getResource(sprache, "translation", schluessel)));
      }
    }
  });

  it("Ü1 · der Rückweg heisst in allen drei Sprachen so, wie ihn die Hilfe nennt", () => {
    for (const [sprache, wort] of Object.entries(RUECKWEG)) {
      // `nb.back` ist die Quelle der Knopfbeschriftung; die Hilfe darf ihn nicht anders taufen.
      const knopf = String(i18n.getResource(sprache, "translation", "nb.back"));
      const bibliothek = String(i18n.getResource(sprache, "translation", "nav.library"));
      // Beschriftung ohne Anführungszeichen: „Zurück zu „Bibliothek“" → „Zurück zu Bibliothek".
      const schlicht = knopf.replace("{{title}}", bibliothek).replace(/[„“”"]/g, "");
      expect(schlicht).toBe(wort);
      for (const schluessel of ["seitenhilfe.bibliothek.body", "seitenhilfe.wissen.body"]) {
        expect(String(i18n.getResource(sprache, "translation", schluessel))).toContain(wort);
      }
    }
  });

  it("R1 · der Rollenvorbehalt der Hilfe trägt in allen drei Sprachen das Wort der gesperrten Fassung", () => {
    for (const [sprache, wort] of Object.entries(ROLLENVORBEHALT)) {
      expect(String(i18n.getResource(sprache, "translation", "roleLink.noReach"))).toBe(wort);
      expect(
        String(i18n.getResource(sprache, "translation", "seitenhilfe.bibliothek.body")),
      ).toContain(wort);
    }
  });
});

// ================================================================================================
// JOB 3768 · S2 — DER SPRACHWÄCHTER MISST DIE RESSOURCE UND DIE GEZEICHNETE LISTE, JE SPRACHE.
// ================================================================================================
//
// KORREKTURPFLICHT AUS JOB 3742 R1 (Prüfer Ben, 12.09. 09:51), wörtlich: „S2 um direkte Prüfung der
// jeweiligen Sprachressource für Titel und Text ergänzen; anschließend den DOM-Inhalt damit
// vergleichen." Die Fälle oben messen je Seite DE und EN — NIEDERLÄNDISCH stand bisher nur in einem
// reinen Textvergleich. `i18n.ts` setzt `fallbackLng: "de"`: fehlte ein NL-Schlüssel ganz, stünde in
// der aufgeklappten Liste der DEUTSCHE Satz, und kein Fall dieser Datei hätte es bemerkt.
//
// Deshalb zweistufig, und in dieser Reihenfolge: erst der Wert aus der EIGENEN Ressource der
// Sprache (`getResourceBundle`, ohne Rückfallkette), dann derselbe Wert in der Liste — und in EN/NL
// darf der deutsche Satz dort NICHT stehen.

/** Der Wert EINER Sprache aus ihrer eigenen Ressource — ohne Rückfall auf „de". */
function sprachressource(sprache: string, schluessel: string): unknown {
  const bundle = i18n.getResourceBundle(sprache, "translation") as
    | Record<string, unknown>
    | undefined;
  return bundle?.[schluessel];
}

describe("JOB 3768 · S2 · jede Seite des ersten Wegs spricht Deutsch, Englisch und Niederländisch", () => {
  for (const sprache of SPRACHEN) {
    for (const seite of SEITEN) {
      it(`${seite.id}/${sprache}: Titel UND Text dieser Sprache stehen in der Liste`, async () => {
        const roherTitel = sprachressource(sprache, `${seite.schluessel}.title`);
        const roherText = sprachressource(sprache, `${seite.schluessel}.body`);
        expect(
          typeof roherTitel === "string" && roherTitel.trim().length > 0,
          `${seite.id}/${sprache}: ${seite.schluessel}.title fehlt in der Ressource „${sprache}" (gelesen: ${JSON.stringify(roherTitel)}) — der deutsche Rückfall zählt hier nicht`,
        ).toBe(true);
        expect(
          typeof roherText === "string" && roherText.trim().length > 0,
          `${seite.id}/${sprache}: ${seite.schluessel}.body fehlt in der Ressource „${sprache}" (gelesen: ${JSON.stringify(roherText)}) — der deutsche Rückfall zählt hier nicht`,
        ).toBe(true);

        const titel = normal(roherTitel as string);
        const koerper = normal(roherText as string);
        const deKoerper = normal(sprachressource("de", `${seite.schluessel}.body`) as string);
        if (sprache !== "de") {
          expect(
            koerper,
            `${seite.id}/${sprache}: der Text ist wörtlich der deutsche — das ist keine Übersetzung`,
          ).not.toBe(deKoerper);
        }

        await i18n.changeLanguage(sprache);
        await mount(seite);
        const liste = await seitenhilfe();
        expect(liste, `${seite.id}/${sprache}: der Titel fehlt in der Liste`).toContain(titel);
        expect(liste, `${seite.id}/${sprache}: der Text fehlt in der Liste`).toContain(koerper);
        if (sprache !== "de") {
          expect(
            liste,
            `${seite.id}/${sprache}: in der Liste steht der DEUTSCHE Text — die Seite ist auf den Rückfall „de" gefallen`,
          ).not.toContain(deKoerper);
        }
      });
    }
  }
});

// ================================================================================================
// JOB 3768 · D — DIE RÜCKFRAGE VOR DEM LÖSCHEN BEHAUPTET KEINE ENDGÜLTIGE LÖSCHUNG.
// ================================================================================================
//
// `capture.discardDraftQ` hiess bis zu diesem Auftrag „Entwurf endgültig löschen?" (en „Delete
// draft permanently?", nl „Concept definitief verwijderen?"). Seit JOB 3668 legt
// `DELETE /api/drafts/:id` den Entwurf in den PAPIERKORB, und derselbe Bildschirm zeigt ihn dort
// samt „Wiederherstellen". Der Satz war damit die stärkere Aussage ohne ihre Voraussetzung — und er
// widersprach der Seitenhilfe, die zwei Zentimeter weiter oben den Papierkorb erklärt. Genau dieser
// Widerspruch (Hilfe gegen Fläche) hat JOB 3670 R1 rot gemacht.
//
// ENDGÜLTIG bleibt richtig für den ZWEITEN Griff — `adm.trash.purgeQ` im Papierkorb. Dieser Wächter
// prüft deshalb nur die erste Rückfrage und lässt die zweite ausdrücklich stehen.
const ENDGUELTIG = { de: "endgültig", en: "permanently", nl: "definitief" } as const;

/** Ein Entwurf, wie ihn `GET /api/drafts` liefert — genug Felder für Titel, Datum und Zeile. */
const EIN_ENTWURF = {
  id: "e-1",
  // JOB 3851: derselbe Titel wie in der Antwort des Entwurfsabrufs — EINE Quelle, damit Liste und
  // geladenes Blatt nicht auseinanderlaufen können.
  payload: { title: ABRUF.titel },
  originalAuthor: "u1",
  lastEditor: "u1",
  createdAt: "2026-09-10T08:00:00.000Z",
  updatedAt: "2026-09-11T09:30:00.000Z",
};

function ressource(sprache: string, schluessel: string): string {
  return String(sprachressource(sprache, schluessel));
}

describe("JOB 3768 · D · die Rückfrage vor dem Löschen sagt, was wirklich geschieht", () => {
  for (const sprache of SPRACHEN) {
    it(`D1 · ${sprache}: sie verspricht keine endgültige Löschung, sondern nennt den Papierkorb`, () => {
      const frage = ressource(sprache, "capture.discardDraftQ");
      const papierkorb = ressource(sprache, "adm.trash.title");
      expect(
        frage.toLowerCase(),
        `${sprache}: „${frage}" behauptet weiter eine endgültige Löschung — seit JOB 3668 landet der Entwurf im Papierkorb`,
      ).not.toContain(ENDGUELTIG[sprache]);
      expect(
        frage.toLowerCase(),
        `${sprache}: „${frage}" nennt den Ort nicht, an den der Entwurf wirklich geht („${papierkorb}")`,
      ).toContain(papierkorb.toLowerCase());
      // GEGENSTÜCK, und es ist kein Formfehler: der zweite Griff IM Papierkorb ist endgültig — dort
      // MUSS das Wort stehen. Ohne diese Zeile wäre der Fall auch grün, wenn jemand beide Rückfragen
      // weichspült und der Mensch vor dem wirklich zerstörenden Knopf keine Warnung mehr liest.
      expect(
        ressource(sprache, "adm.trash.purgeQ").toLowerCase(),
        `${sprache}: die Rückfrage VOR dem endgültigen Löschen hat ihr Warnwort verloren`,
      ).toContain(ENDGUELTIG[sprache]);
      // UND SIE BEHÄLT IHR VERB. Das ist keine Stilfrage, sondern die Bedingung dafür, dass eine
      // ANDERE Regel überhaupt noch greift: `tests/app/mega45-loeschbestaetigung-sammler.test.ts:83`
      // erntet zerstörende Rückfragen aus dem DE-Katalog über ihr Verb und hält an ihrer Knopfgruppe
      // fest, dass genau ein Knopf die Warnfarbe trägt. Eine verbfreie Frage („Entwurf in den
      // Papierkorb legen?") fällt lautlos aus dieser Ernte — in der ersten Fassung dieses Auftrags
      // ist genau das passiert, der Sammler wurde rot, und der Text wurde korrigiert, nicht er.
      expect(
        frage.toLowerCase(),
        `${sprache}: „${frage}" trägt kein zerstörendes Verb mehr — der mega45-Sammler erntet sie dann nicht mehr, und die Farbregel ihrer Knopfgruppe gilt stillschweigend nicht mehr`,
      ).toContain(ressource(sprache, "capture.discardDraftYes").toLowerCase());
    });

    it(`D2 · ${sprache}: an der gemounteten Seite steht genau dieser Satz an der Zeile — und der Papierkorb darunter`, async () => {
      bestand.entwuerfe = [EIN_ENTWURF];
      await i18n.changeLanguage(sprache);
      await mount(SEITEN[4]);

      await click(container.querySelector('[data-loeschen="e-1"]'));
      const zeile = container.querySelector('[data-entwurfszeile="e-1"]');
      expect(zeile, `${sprache}: die Entwurfszeile fehlt — D2 hat nichts gemessen`).not.toBeNull();
      const zeilentext = normal(zeile?.textContent ?? "");
      expect(zeilentext, `${sprache}: die Rückfrage steht nicht an der Zeile`).toContain(
        normal(ressource(sprache, "capture.discardDraftQ")),
      );
      expect(
        zeilentext.toLowerCase(),
        `${sprache}: an der Zeile steht weiterhin eine endgültige Löschung`,
      ).not.toContain(ENDGUELTIG[sprache]);

      // Und die Zusage der Rückfrage ist auf DIESER Fläche einlösbar: der Papierkorb steht darunter.
      const papierkorb = container.querySelector('[data-testid="entwuerfe-papierkorb"]');
      expect(
        papierkorb,
        `${sprache}: die Rückfrage nennt den Papierkorb, aber auf der Seite gibt es keinen`,
      ).not.toBeNull();
      expect(normal(papierkorb?.textContent ?? "")).toContain(
        normal(ressource(sprache, "adm.trash.title")),
      );
    });
  }
});

// ================================================================================================
// JOB 3768 · E — WAS DIE SEITENHILFE ZUSAGT, HÄLT DIESE FLÄCHE (Rolle und Lage eingestellt).
// ================================================================================================
//
// Die naheliegende Fehllieferung dieses Auftrags wäre ein aus dem Kopf geschriebener Hilfetext, der
// Suche, Filter oder eine Aufbewahrungsfrist verspricht, die es hier nicht gibt (JOB 3669 R1,
// 3741 R1, 3670 R1 — alle drei aus diesem Grund rot). Die Fälle unten messen deshalb jede
// Beschriftung, die der Text nennt, an der gemounteten Seite — und den Rollenvorbehalt an der
// Rolle, für die er gilt.
const ADMIN_VORBEHALT = {
  de: "Als Administrator",
  en: "As an administrator",
  nl: "Als beheerder",
} as const;

/** Die Anführungszeichen, in denen die Hilfetexte dieser Sprache eine Beschriftung zitieren. */
const ANFUEHRUNG = { de: ["„", "“"], en: ["“", "”"], nl: ["“", "”"] } as const;

/** Eine echte Beschriftung, zitiert wie im Hilfetext — kein selbst erfundenes Wort. */
function zitiert(sprache: (typeof SPRACHEN)[number], schluessel: string): string {
  const [auf, zu] = ANFUEHRUNG[sprache];
  return `${auf}${ressource(sprache, schluessel)}${zu}`;
}

describe("JOB 3768 · E · die Zusage der Entwurfs-Hilfe und die Fläche im selben Lauf", () => {
  it("E1 · MIT einer Zeile als ADMIN: Fortsetzen, Ersteller-Auswahl und Papierkorb stehen wirklich da", async () => {
    sitzung.rolle = "admin";
    bestand.entwuerfe = [EIN_ENTWURF];
    await mount(SEITEN[4]);

    // Die FLÄCHE.
    const fortsetzen = container.querySelector('[data-entwurf-fortsetzen="e-1"]');
    expect(fortsetzen).not.toBeNull();
    expect(normal(fortsetzen?.textContent ?? "")).toContain(ressource("de", "capture.resume"));
    const ersteller = container.querySelector('[data-testid="entwurfsliste-ersteller"]');
    expect(ersteller, "der Ersteller-Filter fehlt für den Admin").not.toBeNull();
    expect(normal(ersteller?.textContent ?? "")).toContain(
      ressource("de", "capture.draftAuthorAll"),
    );
    expect(container.querySelector('[data-testid="entwurfsliste-suche"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="entwuerfe-papierkorb"]')).not.toBeNull();

    // Die ZUSAGE nennt genau diese Beschriftungen — und zwar die echten, nicht eigene Wörter.
    const zusage = normal(ressource("de", "seitenhilfe.entwuerfe.body"));
    for (const schluessel of [
      "capture.resume",
      "capture.draftAuthorAll",
      "adm.trash.title",
      "adm.trash.restore",
      "adm.trash.purge",
    ]) {
      expect(zusage, `die Hilfe nennt ${schluessel} nicht mit seinem Wort`).toContain(
        zitiert("de", schluessel),
      );
    }
    // Und sie steht auch wirklich im Zahnrad dieser Seite.
    expect(await seitenhilfe()).toContain(zusage);
  });

  it("E2 · OHNE Entwürfe: „Erfassen“ ist der Weg, den die Hilfe für diese Lage nennt", async () => {
    bestand.entwuerfe = [];
    await mount(SEITEN[4]);
    const erfassen = container.querySelector('[data-testid="entwuerfe-leer-erfassen"]');
    expect(erfassen, "der Leerzustand hat keinen Weg").not.toBeNull();
    expect(erfassen?.getAttribute("href")).toBe("/erfassen");
    expect(normal(erfassen?.textContent ?? "")).toContain(ressource("de", "lib.liste.erfassen"));
    const zusage = normal(ressource("de", "seitenhilfe.entwuerfe.body"));
    expect(zusage).toContain(zitiert("de", "lib.liste.erfassen"));
    // §9: die Hilfe beschreibt die leere Lage, sie BEHAUPTET sie nicht.
    expect(zusage).not.toContain(normal(ressource("de", "erfassen.entwuerfe.keine")));
  });

  it("E3 · dieselbe Zeile als EXPERTIN: die Ersteller-Auswahl gibt es nicht — und die Hilfe sagt es vorher", async () => {
    sitzung.rolle = "experte";
    bestand.entwuerfe = [EIN_ENTWURF];
    await mount(SEITEN[4]);
    // Die FLÄCHE: kein Ersteller-Filter (`CaptureDraftList.tsx`, `isAdmin`), und der Suchraum-Satz
    // spricht von „deinen" Entwürfen statt von allen.
    expect(
      container.querySelector('[data-testid="entwurfsliste-ersteller"]'),
      "ohne Admin-Rolle darf es den Ersteller-Filter nicht geben",
    ).toBeNull();
    const suchraum = normal(
      container.querySelector('[data-testid="entwuerfe-suchraum"]')?.textContent ?? "",
    );
    expect(suchraum).toContain(normal(ressource("de", "capture.draftScope.note")));
    expect(suchraum).not.toContain(normal(ressource("de", "capture.draftScope.noteAdmin")));
    // GEGENPROBE zur Rolle steht in E1: dort ist derselbe Filter da.
    // Die ZUSAGE hängt die Auswahl ausdrücklich an die Admin-Rolle, statt sie allen zu versprechen.
    const zusage = normal(ressource("de", "seitenhilfe.entwuerfe.body"));
    expect(zusage).toContain(ADMIN_VORBEHALT.de);
    expect(zusage.indexOf(ADMIN_VORBEHALT.de)).toBeLessThan(
      zusage.indexOf(zitiert("de", "capture.draftAuthorAll")),
    );
    expect(await seitenhilfe()).toContain(ADMIN_VORBEHALT.de);
  });

  it("E4 · in allen drei Sprachen trägt die Zusage den Rollenvorbehalt und die echten Beschriftungen", () => {
    for (const sprache of SPRACHEN) {
      const zusage = normal(ressource(sprache, "seitenhilfe.entwuerfe.body"));
      expect(zusage, `${sprache}: der Rollenvorbehalt fehlt`).toContain(ADMIN_VORBEHALT[sprache]);
      for (const schluessel of [
        "capture.resume",
        "capture.draftAuthorAll",
        "lib.liste.erfassen",
        "adm.trash.title",
        "adm.trash.restore",
        "adm.trash.purge",
      ]) {
        expect(zusage, `${sprache}: die Hilfe nennt ${schluessel} nicht mit seinem Wort`).toContain(
          zitiert(sprache, schluessel),
        );
      }
      // KEINE AUFBEWAHRUNGSFRIST: es gibt keine (JOB 3668, Rückgabe R1) — also steht auch keine da.
      expect(zusage, `${sprache}: die Hilfe erfindet eine Frist`).not.toMatch(
        /\d+\s*(Tag|day|dag)/,
      );
    }
  });
});

// ================================================================================================
// JOB 3851 · E5–E8 — DER „FORTSETZEN"-KNOPF WIRD GEDRÜCKT, NICHT NUR ANGESEHEN.
// ================================================================================================
//
// CODEX' BESTELLUNG AUS JOB 3768 R1 (`archiv/3768/runde-1/ben.md:30`, Prüfpunkt 6), wörtlich:
// „Nicht blockierend — E1 prüft Beschriftungen, aber keinen vollständigen Fortsetzen-Vorgang.
// Ergänzungsvorschlag: Klick bis zum geladenen Editor samt Ungespeichert-Abfrage prüfen."
//
// WARUM EIN KLICK BIS HIERHER NICHTS MESSEN KONNTE: `mount()` registrierte GENAU EINE Route
// (`seite.muster`, für diese Seite `/entwuerfe`). Der Knopf führt über `MeineEntwuerfe.tsx:96-98`
// nach `/erfassen?draft=<id>` — auf einen Pfad, für den es hier keine Route gab.
//
// GEMESSEN AM BASISSTAND `639e514` (Wegwerffall, JOB 3851 Lieferung 1), und das Ergebnis ist
// zweigeteilt — deshalb steht es hier und nicht als Behauptung:
//   · DER ROUTER GING SEHR WOHL WEITER. Der Ort stand danach auf `/erfassen?draft=e-1`, und der
//     Kopfband-Punkt „Erfassen" trug `aria-current="page"`. E5 unten war gegen die unveränderte
//     Montagestelle also GRÜN — wer nur die Adresse prüft, misst die zweite Route gar nicht.
//   · DIE SEITE ABER FEHLTE. React Router meldete `No routes matched location
//     "/erfassen?draft=e-1"`, `<main>` trug danach 92 Zeichen leere Hülle (`<div
//     data-modal-region="" …><div class="kw-inhalt h-full w-full"></div></div>`), und die
//     Endpunkt-Attrappe bekam nach dem Klick KEINEN einzigen Aufruf — `drafts.get` lief nie.
//     E6/E7 waren deshalb rot, mit genau dieser Diagnose.
// Der Nutzen der zweiten Route hängt also an E6/E7, nicht an E5; E5 hält dafür fest, dass die
// Adresse GENAU diesen Entwurf nennt, und wird rot, sobald der Knopf woanders hinführt.
//
// DESHALB TRÄGT `mount()` JETZT DIE ZWEITE ROUTE `/erfassen` — mit derselben Seite, die auch der
// echte Router dort zeigt (`routes.tsx:146`, `PAGES.erfassen = Capture`) — und die Attrappe
// beantwortet `drafts.get` in der Form, die das Blatt wirklich liest.

/**
 * Der Weg des Menschen bis zum Klick: eine Zeile in der Liste, dann „Fortsetzen".
 *
 * §9 des Auftrags: gemessen wird erst, wenn die Liste WIRKLICH trägt — dafür dient dieselbe
 * Kalibrierung `[data-entwurfszeile="e-1"]`, die D2 schon benutzt, und keine zweite.
 * Lieferung 7: die erwartete Beschriftung kommt aus `capture.resume` über `ressource()`, nicht als
 * eigenes Wort — die Zusage der Hilfe und der gemessene Weg haben damit EINE Quelle.
 */
async function fortsetzenDruecken(): Promise<void> {
  sitzung.rolle = "admin";
  bestand.entwuerfe = [EIN_ENTWURF];
  await mount(SEITEN[4]);
  expect(
    container.querySelector('[data-entwurfszeile="e-1"]'),
    "die Entwurfszeile fehlt — ein Klick hätte hier nichts gemessen",
  ).not.toBeNull();
  const knopf = container.querySelector('[data-entwurf-fortsetzen="e-1"]');
  expect(knopf, "an der Zeile steht kein Fortsetzen-Knopf").not.toBeNull();
  expect(
    normal(knopf?.textContent ?? ""),
    "der Knopf trägt nicht die Beschriftung, die die Hilfe zusagt (`capture.resume`)",
  ).toContain(ressource("de", "capture.resume"));
  await click(knopf);
}

/**
 * Eine echte Eingabe in ein React-Feld: der native Wert-Setzer plus das `input`-Ereignis. Genau so
 * erreicht auch eine Tastatur den `onChange`-Weg des Feldes — ein `feld.value = …` allein sähe React
 * nicht, und ein selbst gesetzter Zustand wäre nicht die Eingabe, die dieser Fall messen soll.
 */
async function tippen(feld: HTMLInputElement, wert: string): Promise<void> {
  const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

/** Der Weg heraus, den ein Mensch nimmt: der Kopfband-Punkt „Meine Entwürfe" (ein `GuardedLink`). */
async function fortnavigieren(): Promise<void> {
  const punkt = container.querySelector('[data-kopfband-punkt="entwuerfe"]');
  expect(punkt, "im Kopfband steht kein Weg zurück zu den Entwürfen").not.toBeNull();
  await click(punkt);
}

describe("JOB 3851 · E5–E8 · vom Knopf bis in den geladenen Entwurf", () => {
  it("E5 · der Klick landet auf DIESEM Entwurf — am Router gemessen, nicht am Knopf", async () => {
    await fortsetzenDruecken();
    // (a) DER PFAD. Er wird einzeln und namentlich geprüft — „irgendwo steht e-1" wäre auch dann
    // grün, wenn der Knopf auf einer beliebigen anderen Seite landete.
    expect(
      adresse.pfad,
      `nach dem Klick steht der Router auf „${adresstext()}" statt auf „/erfassen"`,
    ).toBe("/erfassen");
    // (b) DER ABFRAGEWERT. Gelesen wird der benannte Parameter `draft`, nicht der Adresstext.
    const gelesen = new URLSearchParams(adresse.suche).get("draft");
    expect(
      gelesen,
      `die Abfrage „${adresse.suche === "" ? "(leer)" : adresse.suche}“ trägt unter „draft“ ${JSON.stringify(gelesen)} statt „e-1“`,
    ).toBe("e-1");
  });

  it("E6 · das Blatt trägt den Entwurf — Titel UND Rumpf, jeder einzeln im DOM", async () => {
    await fortsetzenDruecken();
    // (1) DER TITEL — im Schreibfeld des Blattes (`Blatt.tsx:2684-2686`), nicht irgendwo im Text.
    const titelfeld = container.querySelector('[data-testid="blatt-titel"]');
    expect(
      titelfeld,
      `das Blatt hat kein Titelfeld; der Router steht auf „${adresstext()}“`,
    ).not.toBeNull();
    expect(
      (titelfeld as HTMLInputElement | null)?.value,
      `das Titelfeld trägt nicht den Titel des geladenen Entwurfs; der Router steht auf „${adresstext()}“`,
    ).toBe(ABRUF.titel);
    // (2) DER RUMPF — in der Schreibfläche (`Blatt.tsx:2769-2771`). Sein Wortlaut kommt aus der
    // Antwort des Entwurfsabrufs und aus keiner Sprachressource (Begründung an `ABRUF`).
    const schreibflaeche = container.querySelector('[data-testid="blatt-text"]');
    expect(
      schreibflaeche,
      `das Blatt hat keine Schreibfläche; der Router steht auf „${adresstext()}“`,
    ).not.toBeNull();
    expect(
      normal(schreibflaeche?.textContent ?? ""),
      `der Rumpf des geladenen Entwurfs steht nicht im Blatt; gelesen: „${normal(schreibflaeche?.textContent ?? "").slice(0, 200)}“`,
    ).toContain(ABRUF.rumpf);
  });

  it("E7a · MIT Änderung: der Weg heraus stellt die Ungespeichert-Rückfrage", async () => {
    await fortsetzenDruecken();
    const titelfeld = container.querySelector('[data-testid="blatt-titel"]');
    expect(
      titelfeld,
      `ohne geladenes Blatt gibt es nichts zu ändern; Router: „${adresstext()}“`,
    ).not.toBeNull();
    // EINE ECHTE EINGABE, kein selbst gesetzter Zustand: derselbe `onChange`-Weg, den auch eine
    // Tastatur nimmt (`Blatt.tsx:2694`), und damit dasselbe Dirty-Prädikat (`istSchmutzig`, `:1424`).
    await tippen(titelfeld as HTMLInputElement, `${ABRUF.titel} und Ostrang`);
    await fortnavigieren();
    const dialog = container.querySelector("[data-navguard-dialog]");
    expect(
      dialog,
      `keine Ungespeichert-Rückfrage; der Router ist nach „${adresstext()}“ weitergegangen`,
    ).not.toBeNull();
    // DER TEXT KOMMT AUS DER RESSOURCE, nicht aus einer im Test abgeschriebenen Zeichenkette.
    const gesagt = normal(dialog?.textContent ?? "");
    expect(gesagt).toContain(normal(ressource("de", "nav.guard.title")));
    expect(gesagt).toContain(normal(ressource("de", "nav.guard.body")));
    // Und die Navigation ist wirklich angehalten — die Rückfrage ist keine Zierde neben dem Wechsel.
    expect(adresse.pfad, "trotz Rückfrage ist der Router weitergegangen").toBe("/erfassen");
  });

  it("E7b · GEGENPROBE OHNE Änderung: keine Rückfrage, der Wechsel geht durch", async () => {
    await fortsetzenDruecken();
    expect(
      container.querySelector('[data-testid="blatt-titel"]'),
      `ohne geladenes Blatt misst die Gegenprobe nichts; Router: „${adresstext()}“`,
    ).not.toBeNull();
    await fortnavigieren();
    // Ohne diese Zeile wäre E7a auch von einer Wache erfüllt, die IMMER fragt.
    expect(
      container.querySelector("[data-navguard-dialog]"),
      "eine Rückfrage ohne ungespeicherte Änderung — die Wache fragt immer",
    ).toBeNull();
    expect(adresse.pfad, `der Wechsel ging nicht durch; Router: „${adresstext()}“`).toBe(
      "/entwuerfe",
    );
  });

  // ==============================================================================================
  // RUNDE 2 · E8 — WELCHE KENNUNG WURDE WIRKLICH ABGERUFEN?
  // ==============================================================================================
  //
  // BENS KORREKTURPFLICHT 1 ZU RUNDE 1, wörtlich: „Im bestehenden Prüfaufbau die tatsächlich an
  // `drafts.get` übergebene Kennung absichern. Beleg: `.get(\"ben-falscher-entwurf\")` macht einen
  // neuen Fall mit gemessenem Istargument rot."
  //
  // Er hat die Lücke selbst aufgemacht: `Blatt.tsx:901` auf eine frei erfundene Kennung verstellt,
  // und E5–E7 blieben grün. Der Grund lag NICHT in ihren Erwartungen, sondern in der Attrappe — sie
  // gab jedem Frager denselben Entwurf. E5 misst die ADRESSE, E6 den INHALT; zwischen beiden lag der
  // ungemessene Schritt „mit welcher Kennung geht die Fläche zum Server".
  //
  // ZWEI SPERREN, ABSICHTLICH GETRENNT: `ABRUF.fuer` weist eine fremde Kennung jetzt ab (dann fällt
  // E6, weil das Blatt leer bleibt) — und DIESER Fall liest die Kennung selbst aus dem Abrufbuch.
  // Nur so nennt die rote Meldung den Istwert („abgerufen wurde ben-falscher-entwurf") statt einer
  // Folgeerscheinung („kein Titel im Blatt").
  it("E8 · der Abruf fragt nach DIESER Kennung — am Istargument gemessen, nicht an der Antwort", async () => {
    await fortsetzenDruecken();
    const gefragt = abrufe.liste.filter((a) => a.pfad === "drafts.get").map((a) => a.argumente[0]);
    // (1) ES WURDE ÜBERHAUPT ABGERUFEN. Ohne diese Zeile wäre (2) auch dann grün, wenn der Klick
    // gar keinen Abruf auslöst — eine leere Liste erfüllt jede Allaussage.
    expect(
      gefragt.length,
      `nach dem Klick hat die Fläche keinen Entwurf abgerufen; Router: „${adresstext()}“, Aufrufe dieses Laufs: ${abrufe.liste.map((a) => a.pfad).join(", ") || "(keine)"}`,
    ).toBeGreaterThan(0);
    // (2) UND AUSSCHLIESSLICH NACH `e-1`. Geprüft wird der Fremdanteil, nicht ein Einzelaufruf: das
    // Blatt darf denselben Entwurf mehrfach holen (`Blatt.tsx:900`, `Capture.tsx:3047`), aber keine
    // andere Kennung — und die rote Meldung trägt den gemessenen Wert.
    const fremd = gefragt.filter((kennung) => kennung !== EIN_ENTWURF.id);
    expect(
      fremd,
      `abgerufen wurde ${JSON.stringify(fremd)} statt „${EIN_ENTWURF.id}“ (alle Kennungen dieses Laufs: ${JSON.stringify(gefragt)})`,
    ).toEqual([]);
  });
});
