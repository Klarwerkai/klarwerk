// @vitest-environment jsdom
// ================================================================================================
// JOB 3829 — DER LÖSCHWEG BEI ECHTEM NETZABBRUCH, UND WOHIN DER FOKUS NACH DEM 404 GEHT.
// ================================================================================================
//
// ZWEIMAL WÖRTLICH BESTELLT, VON ZWEI STELLEN:
//   · BEN zu JOB 3777, Prüfpunkt 6 (`archiv/3777/runde-1/ben.md:27`, GRÜN-Urteil, archiviert und
//     LIVE): „Folgeprüfungen: echten Verbindungsabbruch während DELETE herstellen; Meldung und
//     Fokus nach 404 mit Bildschirmleser prüfen." Und `:30`: „Kein echter Netzabbruch oder
//     Bildschirmlesertest."
//   · Die Zeile `ENTWUERFE-VERWALTEN` in `PRIORITAETEN.md` führt denselben Rest seit JOB 3426:
//     „Löschweg bei echtem Netzabbruch, Menüfläche unter einem Bildschirmleser".
//
// WAS BIS HIERHER UNGEDECKT WAR — nachgezählt, nicht übernommen. Die Attrappe des Bestands wirft an
// beiden Fehlerstellen ausschliesslich `ApiError` (`tests/wissensobjekt-loeschen/
// rueckfrage-im-blick-mounted.test.tsx:81` und `:91`), ihre Antwortform `{ art: "fehler"; status;
// text }` (`:37`) KANN einen Nicht-`ApiError` gar nicht ausdrücken. Damit blieb genau der Zweig
// ungemessen, den ein Verbindungsabbruch trifft: `apps/web/src/api/client.ts:28` ruft `await
// fetch(...)` ohne `try`/`catch`, und `api.del` reicht durch — bricht die Verbindung, verlässt ein
// roher `TypeError: Failed to fetch` den Aufruf, KEIN `ApiError`. Auf der Fläche landet er in
// `BibliothekLesen.tsx:347` `: t("state.error")`, dem einzigen Zweig der Löschfläche, den bis heute
// kein Dauertest betreten hat.
//
// DIE ZWEITE UNGEDECKTE ZUSAGE WAR DER FOKUS: `grep -rn "activeElement|toHaveFocus|focus()"` über
// `tests/wissensobjekt-loeschen/` ergab null Treffer. Beim 404 schliesst sich die Rückfrage von
// SELBST (`BibliothekLesen.tsx:322`, programmatisch aus `onError`) — wer mit der Tastatur oder
// einem Bildschirmleser arbeitet, steht danach irgendwo. Wo, hat niemand gemessen. Diese Datei
// misst es und schreibt den Befund fest (s. F1).
//
// WARUM DER PRÜFSTAND HIER EIN ZWEITES MAL STEHT (Bühne, Hülle, Helfer sind aus
// `rueckfrage-im-blick-mounted.test.tsx` übernommen): die Bestandsdatei liegt in
// `tests/wissensobjekt-loeschen/`, und dort hält JOB 3818 gerade `loeschen-in-chromium.test.ts`.
// Eine gemeinsame Bühne dort anzulegen wäre ein Eingriff in fremdes Gebiet, auch „nur ein
// Kommentar". Die Doppelung ist damit bewusst und benannt; die Zusammenführung ist als REST
// bestellt — derselbe Weg, den JOB 3811 gegangen ist (`jobs/3811/runde-1/RUECKGABE.md:32`).
//
// BENANNTE PRÜFLÜCKEN DIESER DATEI, vollständig:
//   · Es läuft KEIN echter Bildschirmleser. F2 belegt die ANSAGEFORM (die Meldung steht in einem
//     `<output>`, das implizit `role="status"` trägt — `ToastViewport.tsx:22-35`, dieselbe Wahl wie
//     `LoadState.tsx:33`), nicht die Ansage selbst.
//   · jsdom rechnet kein Layout. Sichtbarkeit, Grösse, Überdeckung misst diese Datei nicht.
//   · Die HTTP-Grenze ist ersetzt: `apps/web/src/api/client.ts` LÄUFT hier nicht. Aus ihr kommt
//     ausschliesslich der Konstruktor `ApiError` — genau wie im Bestand
//     (`rueckfrage-im-blick-mounted.test.tsx:57`). Der Netzabbruch wird an derselben Stelle
//     nachgestellt, an der `client.ts` ihn durchlässt, nicht in ihr.
//   · Englisch, Niederländisch, das echte Chromium und die echte Datenbank bleiben draussen.
//   · Ob eine abgebrochene DELETE serverseitig doch durchlief, ist hier nicht entscheidbar. Die
//     Fläche sagt deshalb nur, was sie weiss: „Etwas ist schiefgelaufen." — nicht „nicht gelöscht".
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  /**
   * Antwort des Löschaufrufs. GEGENÜBER DEM BESTAND ERWEITERT, und das ist der Kern dieser Datei:
   * `{ art: "wurf"; fehler: unknown }` kann ein von der Sache gestelltes BELIEBIGES Fehlerobjekt
   * ablehnen — einen `TypeError` des abgerissenen `fetch`, ein gewöhnliches `Error` mit einem Feld
   * `status`, einen `ApiError`. Die Bestandsform `{ art: "fehler"; status; text }` konnte das
   * nicht: sie baute den `ApiError` selbst und liess nichts anderes zu.
   */
  loeschAntwort: { art: "ok" } as { art: "ok" } | { art: "wurf"; fehler: unknown },
  entfernt: [] as string[],
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => globalThis.__job3829Ko),
        // Der Bestand der Liste richtet sich nach dem, was WIRKLICH entfernt wurde. Nur so ist in
        // N3 unterscheidbar, ob die Fläche frisch gelesen oder aus dem Zwischenspeicher
        // weitergereicht hat (s. dort).
        list: vi.fn(async () => (box.entfernt.includes("ko-1") ? [] : [globalThis.__job3829Ko])),
        versions: leer,
        evidence: leer,
        neighbors: vi.fn(async () => ({
          center: "ko-1",
          neighbors: [],
          excludedTags: [],
          limit: 8,
        })),
        act: vi.fn(async () => globalThis.__job3829Ko),
        remove: vi.fn(async (id: string) => {
          if (box.loeschAntwort.art === "wurf") {
            // GENAU HIER liegt im Betrieb `client.ts:28`: ein `await fetch(...)` ohne `try`/`catch`.
            // Was diese Zeile verlässt, verlässt dort die HTTP-Schicht — unverändert und ungefiltert.
            throw box.loeschAntwort.fehler;
          }
          box.entfernt.push(id);
          return undefined;
        }),
      },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      audit: { list: leer },
      directory: { list: vi.fn(async () => [{ id: "u1", name: "Eva" }]) },
      lifecycle: { pending: leer, linked: leer },
      external: { policy: vi.fn(async () => ({ stage: "blocked", enabled: false })) },
      uploadLimits: {
        get: vi.fn(async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 })),
      },
      reasoner: {
        status: vi.fn(async () => ({ active: false, mode: "off" })),
        config: vi.fn(async () => null),
        assist: vi.fn(async () => ({ text: "" })),
        assistPresets: leer,
        extract: vi.fn(async () => ({ points: [], note: null })),
        describeImage: vi.fn(async () => ({})),
      },
      aiCheck: { coverageSummary: vi.fn(async () => ({ total: 0 })) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useRef } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "../../apps/web/node_modules/react-router-dom";
import { ApiError } from "../../apps/web/src/api/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ModalBoundaryProvider } from "../../apps/web/src/app/ModalBoundaryContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";

declare global {
  // eslint-disable-next-line no-var
  var __job3829Ko: KnowledgeObject;
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

const LANGER_TEXT = Array.from(
  { length: 60 },
  (_, i) => `<h2>Abschnitt ${i + 1}</h2><p>Zahlungsziel im Abschnitt ${i + 1}.</p>`,
).join("");

function ko(): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Standard-Zahlungsziel",
    statement: "Rechnungen sind binnen 30 Tagen fällig.",
    bodyHtml: LANGER_TEXT,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Kaufmännisch",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "offen",
    version: 1,
    author: "u1",
    originalAuthor: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    history: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    comments: [],
    sources: [],
    attachments: [],
  } as KnowledgeObject;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;
let ort: string;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function Ortsschreiber(): null {
  ort = useLocation().pathname;
  return null;
}

/**
 * Die Shell-Hülle, verkürzt auf das, was hier zählt (Bauform aus `shell/AppShell.tsx:92/102`):
 * ein scrollendes `<main>` als Anker der Modalgrenze und die ECHTE Toast-Fläche. Beide sind hier
 * nicht Beiwerk: ohne die Grenze fiele `Modal` auf seinen Ersatzweg „an Ort und Stelle rendern"
 * zurück und gäbe gar keinen Fokus zurück (F0/F1 misse dann eine Lage, die es nicht gibt), und
 * ohne `ToastViewport` gäbe es kein `<output>`, in dem F2 die Meldung suchen könnte.
 */
function Huelle({ children }: { children: React.ReactNode }): JSX.Element {
  const mainRef = useRef<HTMLElement | null>(null);
  return createElement(ModalBoundaryProvider, {
    hostRef: mainRef,
    children: [
      createElement(
        "main",
        { key: "main", ref: mainRef, className: "flex-1 overflow-y-auto px-9 py-7" },
        children,
      ),
      createElement(ToastViewport, { key: "toasts" }),
    ],
  });
}

async function mount(): Promise<void> {
  globalThis.__job3829Ko = ko();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
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
                  { initialEntries: ["/wissen/ko-1"] },
                  createElement(Ortsschreiber),
                  createElement(
                    Huelle,
                    null,
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: "/wissen/:id",
                        element: createElement(KnowledgeDetail),
                      }),
                      createElement(Route, {
                        path: "/bibliothek",
                        element: createElement("div", { "data-testid": "seite-bibliothek" }),
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
  await act(flush);
  await act(flush);
}

function knopf(testId: string): HTMLElement {
  const treffer = document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (!treffer) {
    throw new Error(`„${testId}" ist auf der Fläche nicht da`);
  }
  return treffer;
}

async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
  await act(flush);
}

/** Das Menü „…" öffnen und „Wissensobjekt löschen" wählen — genau Pedis zwei Klicks. */
async function loeschenWaehlen(): Promise<void> {
  await klick(knopf("bib-eintrag-menue"));
  await klick(knopf("bib-menue-loeschen"));
}

/** Die Rückfrage über ihren TEXT, nicht über eine Testmarke (Hausform des Bestands, `:311`). */
function rueckfrage(): HTMLElement | null {
  const frage = i18n.t("ko.deleteQ");
  const alle = [...document.body.querySelectorAll<HTMLElement>("*")].filter(
    (el) => el.textContent?.trim() === frage,
  );
  return alle.length > 0 ? (alle[alle.length - 1] as HTMLElement) : null;
}

/** Die Overlay-Ebene der App: `fixed inset-0` über dem Seiteninhalt (`components/Modal.tsx:114`). */
function overlayEbene(el: HTMLElement | null): HTMLElement | null {
  let lauf: HTMLElement | null = el;
  while (lauf) {
    const k = lauf.className;
    if (typeof k === "string" && k.includes("fixed") && k.includes("inset-0")) {
      return lauf;
    }
    lauf = lauf.parentElement;
  }
  return null;
}

function enthaelt(text: string): boolean {
  return (document.body.textContent ?? "").includes(text);
}

function jaKnopf(): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === i18n.t("ko.deleteYes"),
  );
}

/** Bedienen bis zum Ende: Menü, Löschen wählen, bestätigen. */
async function loeschenBestaetigen(): Promise<void> {
  await loeschenWaehlen();
  const ja = jaKnopf();
  expect(ja, "der Knopf „Ja, löschen“ fehlt").toBeTruthy();
  await klick(ja as HTMLButtonElement);
}

/**
 * Sucht den Textknoten mit genau diesem Satz und geht seinen ELTERNWEG hinauf, bis ein `<output>`
 * kommt. Bewusst nicht über eine Testmarke: gefragt ist die ANSAGEFORM des Elements, in dem der
 * Satz wirklich steht — ein `<output>` trägt implizit `role="status"` und wird von einem
 * Bildschirmleser ohne Fokussprung vorgelesen, ein `<div>` nicht.
 */
function ansageflaeche(text: string): HTMLElement | null {
  const traeger = [...document.body.querySelectorAll<HTMLElement>("*")].filter(
    (el) => el.children.length === 0 && el.textContent?.trim() === text,
  );
  for (const el of traeger) {
    let lauf: HTMLElement | null = el;
    while (lauf) {
      if (lauf.tagName === "OUTPUT") {
        return lauf;
      }
      lauf = lauf.parentElement;
    }
  }
  return null;
}

beforeEach(async () => {
  box.loeschAntwort = { art: "ok" };
  box.entfernt = [];
  vi.mocked(endpoints.ko.remove).mockClear();
  vi.mocked(endpoints.ko.list).mockClear();
  ort = "";
  await i18n.changeLanguage("de");
  qc = new QueryClient({
    // `gcTime` ist hier ABSICHTLICH nicht 0 wie im Bestand: N3 liest den Bestand der Liste NACH dem
    // Löschen aus dem Zwischenspeicher, und der Weg dorthin führt über `/bibliothek` — mit
    // `gcTime: 0` wäre der Eintrag beim Abmelden der Lesefläche weggeräumt und N3 könnte gar nichts
    // mehr ablesen. `staleTime: 0` bleibt wie im Bestand.
    defaultOptions: { queries: { retry: false, gcTime: 60_000, staleTime: 0 } },
  });
  await mount();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  qc.clear();
});

describe("JOB 3829 · Netzabbruch beim Löschen, und der Fokus nach dem 404", () => {
  // ==============================================================================================
  // N1–N3 · DER ECHTE VERBINDUNGSABBRUCH.
  // ==============================================================================================

  it("N1 · reisst die Verbindung ab, sagt die Fläche es — und behauptet nichts über den Ausgang", async () => {
    // `TypeError: Failed to fetch` ist wörtlich das, was ein abgebrochenes `fetch` wirft und was
    // `client.ts:28` ohne `try`/`catch` ungefiltert weiterreicht. KEIN `ApiError` — genau deshalb
    // trifft dieser Fall den Zweig `BibliothekLesen.tsx:347` `: t("state.error")`, den bis zu
    // diesem Job kein Dauertest betreten hat.
    box.loeschAntwort = { art: "wurf", fehler: new TypeError("Failed to fetch") };
    await loeschenBestaetigen();

    // 1. DIE RÜCKFRAGE STEHT NOCH. Es gibt etwas zu sagen, also bleibt die Fläche
    //    (`loeschenOffenEffektiv`, `BibliothekLesen.tsx:379-380`).
    const frage = rueckfrage();
    expect(frage, "die Rückfrage verschwindet, obwohl nichts gelöscht wurde").not.toBeNull();

    // 2. DER GRUND STEHT AM BEDIENORT — in der Overlay-Ebene, nicht bloss irgendwo auf der Seite.
    //    Dieselbe Strenge wie im Bestand L6 (`rueckfrage-im-blick-mounted.test.tsx:443-446`).
    const ebene = overlayEbene(frage);
    expect(ebene, "die Overlay-Ebene ist weg").not.toBeNull();
    expect(ebene?.textContent ?? "", "der Satz steht nicht dort, wo bedient wurde").toContain(
      i18n.t("state.error"),
    );

    // 3. KEINE ERFOLGSMELDUNG, IN KEINER FORM. Weder „gelöscht" noch „war schon weg" — der Aufruf
    //    ist abgebrochen, über den Ausgang weiss die Fläche nichts.
    expect(enthaelt(i18n.t("ko.deleteDone")), "die Fläche behauptet, sie habe gelöscht").toBe(
      false,
    );
    expect(
      enthaelt(i18n.t("ko.deleteAlreadyGone")),
      "die Fläche behauptet, das Objekt sei schon weg gewesen",
    ).toBe(false);

    // 4. UND NICHTS IST WIRKLICH PASSIERT: Adresse unverändert, Bestand unverändert.
    expect(ort, "die Fläche führt aus dem Bericht heraus, als wäre gelöscht worden").toBe(
      "/wissen/ko-1",
    );
    expect(box.entfernt, "es wurde doch gelöscht").toEqual([]);
  });

  it("N2 · die Grenze: ein Fehlerobjekt mit blossem Feld `status: 404` ist kein „war schon weg“", async () => {
    // DIE ZUSAGE, UM DIE ES GEHT, steht in `apps/web/src/lib/validationDelete.ts:32-34`:
    //   `return error instanceof ApiError && error.status === 404;`
    // Die INSTANZPRÜFUNG ist das Einzige, was verhindert, dass irgendein Objekt mit einem Feld
    // `status: 404` als „war schon weg" durchgeht — und Pedi eine Erfolgsmeldung für etwas bekommt,
    // das nie gelöscht wurde. BEN hat diesen Gegenfall in JOB 3777 einmal gefahren
    // (`archiv/3777/runde-1/ben.md:17`), aber nur TEMPORÄR; er stand in keiner Datei. Hier steht er.
    box.loeschAntwort = { art: "wurf", fehler: Object.assign(new Error("weg"), { status: 404 }) };
    await loeschenBestaetigen();

    expect(
      enthaelt(i18n.t("ko.deleteAlreadyGone")),
      "ein fremdes Fehlerobjekt mit `status: 404` wird als schon-weg gemeldet — die Instanzprüfung ist aufgeweicht",
    ).toBe(false);
    expect(enthaelt(i18n.t("ko.deleteDone")), "die Fläche behauptet, sie habe gelöscht").toBe(
      false,
    );

    // BEWUSST OHNE ABLESUNG DES SATZES `state.error`: den misst N1, und zwar als EINZIGER.
    // Gemessen (Gegenprobe (a), Lauf `700a63842465473995849807648f5183`): stand die Ablesung auch
    // hier, fiel N2 bei der Verstellung von `BibliothekLesen.tsx:347` MIT — zwei Fälle an einer
    // Ursache, und keiner von beiden sagte mehr, woran er hängt. N2 misst die GRENZE der
    // Fehlerlesung: dass dieses Objekt als echter Fehlschlag durchgeht. Dass die Fläche dabei in
    // der Overlay-Ebene stehen bleibt, ist Struktur und hängt nicht am Text.
    const frage = rueckfrage();
    expect(frage, "die Rückfrage schliesst sich, obwohl nichts gelöscht wurde").not.toBeNull();
    expect(overlayEbene(frage), "die Rückfrage steht nicht mehr am Bedienort").not.toBeNull();
    expect(ort).toBe("/wissen/ko-1");
    expect(box.entfernt, "es wurde doch gelöscht").toEqual([]);
  });

  it("N3 · die Gegenrichtung: gelingt das Löschen, ist es weg, wird gemeldet — und die Liste ist frisch", async () => {
    // OHNE DIESEN FALL MESSEN N1 UND N2 NICHTS: drei Verneinungen („keine Erfolgsmeldung", „Adresse
    // unverändert", „nichts entfernt") sind auch dann grün, wenn die Fläche überhaupt nichts kann.
    //
    // DIE VIERTE ABLESUNG IST DIE SCHÄRFE (Lehre `LEHREN.md` 2026-09-13T01:07:12, JOB 3804 R1,
    // Korrekturpflicht 2: eine Nachher-Ablesung ist erst dann ein Beleg, wenn sie beweisbar auf
    // FRISCHE Daten reagiert). Die Lesefläche hält den Schlüssel `["kos", undefined]` selbst
    // (`BibliothekLesen.tsx:186`, `useKos`, `api/hooks.ts:16`) und `invalidate()` frischt ihn auf
    // (`BibliothekLesen.tsx:262`). Die Attrappe von `ko.list` antwortet nach dem Entfernen mit
    // einer LEEREN Liste — steht `ko-1` danach noch im Zwischenspeicher, wurde nicht neu gelesen.
    const listeVorher = vi.mocked(endpoints.ko.list).mock.calls.length;
    await loeschenBestaetigen();

    expect(box.entfernt, "das Objekt wurde nicht entfernt").toEqual(["ko-1"]);
    expect(enthaelt(i18n.t("ko.deleteDone")), "keine Meldung über den Abschluss").toBe(true);
    expect(rueckfrage(), "die Rückfrage bleibt nach dem Löschen stehen").toBeNull();
    expect(ort, "die Adresse zeigt weiter auf die tote Kennung").toBe("/bibliothek");

    expect(
      vi.mocked(endpoints.ko.list).mock.calls.length,
      "nach dem Löschen wurde die Liste gar nicht neu geholt",
    ).toBeGreaterThan(listeVorher);
    const bestand = qc.getQueryData(["kos", undefined]) as KnowledgeObject[] | undefined;
    expect(
      (bestand ?? []).map((k) => k.id),
      "der Zwischenspeicher trägt das gelöschte Objekt weiter — die Ablesung liest alte Daten",
    ).toEqual([]);
  });

  // ==============================================================================================
  // F0–F2 · MELDUNG UND FOKUS NACH DEM 404.
  // ==============================================================================================
  //
  // WARUM F0 VOR F1 STEHT UND OHNE F0 JEDER FOKUSFALL LEER WÄRE: jsdom bewegt bei `el.click()` den
  // Fokus NICHT — ein echter Browser tut es. Wer also nur klickt und danach `document.activeElement`
  // liest, misst `document.body` und nennt das ein Ergebnis. F0 setzt den Fokus deshalb AUSDRÜCKLICH
  // auf den Auslöser und belegt zuerst, dass die Fläche Fokus überhaupt bewegt (`Modal.tsx:94`,
  // `focusFirstIn`). Erst wenn das steht, sagt eine Messung an `activeElement` etwas.

  /** Den Auslöser fokussieren, wie es ein Mensch mit der Tastatur täte, und dann bedienen. */
  async function mitFokusAmMenue(): Promise<HTMLElement> {
    const menue = knopf("bib-eintrag-menue");
    menue.focus();
    expect(document.activeElement, "der Auslöser nimmt den Fokus gar nicht").toBe(menue);
    return menue;
  }

  it("F0 · Kalibrierung: die Rückfragefläche nimmt den Anfangsfokus wirklich an sich", async () => {
    await mitFokusAmMenue();
    await loeschenWaehlen();

    const frage = rueckfrage();
    expect(frage, "die Rückfrage steht gar nicht da").not.toBeNull();
    const ebene = overlayEbene(frage);
    expect(ebene, "die Overlay-Ebene fehlt").not.toBeNull();

    const aktiv = document.activeElement;
    expect(aktiv, "der Fokus liegt auf `body` — diese Bühne bewegt Fokus nicht").not.toBe(
      document.body,
    );
    expect(
      ebene?.contains(aktiv as Node),
      "der Fokus steht ausserhalb der Rückfragefläche: F1 misse damit nichts",
    ).toBe(true);
  });

  it("F1 · nach dem selbsttätigen Schliessen beim 404 — wo der Fokus wirklich landet", async () => {
    // DIE BESTELLTE ERWARTUNG (Auftrag §5.6) WAR: `document.activeElement` ist danach wieder der
    // Knopf `bib-eintrag-menue`. Die Zusage dazu steht in `ModalBoundaryContext.tsx:175`
    // (`surface.trigger()?.focus()` bei der letzten Abmeldung), der Auslöser wird in
    // `Modal.tsx:86-91` gemerkt.
    //
    // GEMESSEN WIRD ETWAS ANDERES, und das ist der BEFUND dieses Jobs (§5.6: „Misst du hier etwas
    // anderes, ist das ein BEFUND, kein Anlass zur Produktänderung"): beim 404 schliesst
    // `BibliothekLesen.tsx:322-325` die Fläche nicht nur, es ruft im selben Zug `onGeloescht()` —
    // und das führt von `/wissen/:id` nach `/bibliothek` (`pages/KnowledgeDetail.tsx:67-69`). Damit
    // verschwindet die GANZE Lesefläche samt dem „…"-Knopf aus dem Dokument. Wenn die Modalgrenze
    // beim Abmelden `trigger()?.focus()` ruft, ist ihr Ziel längst abgehängt; ein Fokus auf ein
    // Element ausserhalb des Dokuments ist wirkungslos. Der Tastaturnutzer steht danach auf `body`.
    //
    // DAS IST KEIN FEHLER DER FOKUSRÜCKGABE — sie hat schlicht kein Ziel mehr. Es ist eine echte
    // Lücke für Tastatur und Bildschirmleser, aber sie sitzt an einer anderen Stelle, als der
    // Auftrag vermutete: nicht in `Modal`/`ModalBoundaryContext`, sondern darin, dass nach einem
    // programmatischen Seitenwechsel niemand den Fokus auf der ZIELSEITE setzt. Repariert wird hier
    // nichts (§10); der Zustand wird festgehalten, damit eine spätere Reparatur ihn bricht und
    // damit sichtbar macht. F1b darunter belegt, dass die Fokusrückgabe dort, wo sie ein Ziel hat,
    // sehr wohl trägt — sonst wäre dieser Fall nur ein bequemes „ist halt so".
    const menue = await mitFokusAmMenue();
    box.loeschAntwort = { art: "wurf", fehler: new ApiError(404, "not_found", "Weg.") };
    await loeschenBestaetigen();

    // 1. Die Rückfrage schliesst sich von selbst — der Ausgangspunkt des Falls.
    expect(rueckfrage(), "die Rückfrage bleibt stehen, obwohl das Objekt weg war").toBeNull();
    expect(ort, "die Fläche bleibt auf der toten Kennung").toBe("/bibliothek");

    // 2. UND DER AUSLÖSER IST MIT DER SEITE GEGANGEN. Das ist der Grund, nicht eine Nebenbemerkung:
    //    ohne ihn kann keine Rückgabe irgendwo landen.
    expect(
      document.body.contains(menue),
      "der „…“-Knopf ist noch im Dokument — dann müsste der Fokus auf ihm liegen und dieser Fall ist überholt",
    ).toBe(false);

    // 3. DER GEMESSENE IST-ZUSTAND: der Fokus liegt auf `body`, also nirgends.
    expect(
      document.activeElement,
      "der Fokus liegt jetzt woanders als auf `body` — der Befund hat sich geändert, diesen Fall neu messen",
    ).toBe(document.body);
  });

  it("F1b · wo die Rückgabe ein Ziel hat, trägt sie: „Behalten“ bringt den Fokus auf den Auslöser zurück", async () => {
    // DIE KALIBRIERUNG ZU F1 — und zugleich der Fall, an dem eine kaputte Fokusrückgabe auffliegt.
    // Hier bleibt die Seite stehen, der Auslöser bleibt im Dokument, und die eine Mechanik aus
    // `ModalBoundaryContext.tsx:175` hat ein Ziel. Ohne diesen Fall wäre F1 („liegt auf body") eine
    // Zusicherung, die auch dann grün bliebe, wenn die Fokusrückgabe überhaupt nichts täte.
    const menue = await mitFokusAmMenue();
    await loeschenWaehlen();
    expect(document.activeElement, "der Fokus ging nicht in die Fläche").not.toBe(menue);

    const behalten = [...document.body.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === i18n.t("ko.deleteKeep"),
    );
    expect(behalten, "der Knopf „Behalten“ fehlt").toBeTruthy();
    await klick(behalten as HTMLButtonElement);

    expect(rueckfrage(), "die Rückfrage geht nicht zu").toBeNull();
    expect(
      document.activeElement,
      "nach dem Schliessen steht der Tastaturnutzer im Nichts statt wieder am „…“-Knopf",
    ).toBe(menue);
  });

  it("F2 · die Meldung nach dem 404 steht in einem `<output>` — ein Bildschirmleser liest sie von selbst vor", async () => {
    // `ToastViewport.tsx:22-35` rendert jede Meldung in ein `<output>`. Ein `<output>` trägt
    // implizit `role="status"` (dieselbe Wahl wie `LoadState.tsx:33`); ein Bildschirmleser liest
    // seinen Inhalt höflich vor, OHNE dass der Fokus dorthin springen müsste. Genau das ist der
    // Grund, warum die Meldung beim selbsttätigen Schliessen (F1: der Fokus landet auf `body`)
    // überhaupt beim Nutzer ankommt.
    //
    // GEPRÜFT WIRD DER ELTERNWEG DES TEXTKNOTENS, nicht eine Testmarke: gefragt ist, worin der Satz
    // WIRKLICH steht. Eine Marke könnte an einem stummen `<div>` hängen und trüge trotzdem grün.
    box.loeschAntwort = { art: "wurf", fehler: new ApiError(404, "not_found", "Weg.") };
    await loeschenBestaetigen();

    const satz = i18n.t("ko.deleteAlreadyGone");
    expect(enthaelt(satz), "die Meldung steht gar nicht da").toBe(true);
    const flaeche = ansageflaeche(satz);
    expect(
      flaeche,
      "die Meldung steht in keinem `<output>` — ein Bildschirmleser liest sie nicht von selbst vor",
    ).not.toBeNull();
    expect(flaeche?.tagName).toBe("OUTPUT");
    // Und der Satz ist der ehrliche: „war bereits nicht mehr vorhanden", nicht „gelöscht".
    expect(enthaelt(i18n.t("ko.deleteDone")), "die Fläche behauptet, SIE habe gelöscht").toBe(
      false,
    );
  });
});
