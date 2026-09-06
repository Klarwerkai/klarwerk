// @vitest-environment jsdom
// ================================================================================================
// JOB 3104 · UX-02 — DIE ADRESSE TRÄGT, WAS DER MENSCH GEWÄHLT HAT.
// ================================================================================================
//
// DER BEFUND, gemessen von Codex an der Live-Fassung (`register/planung/UIUX-AUFTRAEGE-1.md`
// §UX-02, Meldungen N-0006 und N-0016):
//
//   N-0006, 05.09.2026 19:08–19:09 CEST, v1.0.0-beta.1.101, Administrator: „vor Reload eigener
//   Bericht gewählt; danach Suche leer und erster anderer Bericht NUTZERPRUEFUNG Bibliothek
//   Langtext 20260905-175543 angezeigt. Erneute Suche findet eigenen Bericht vollständig. Direkter
//   /wissen/<id>-Link bleibt beim Reload korrekt." Gegenurteil: bestaetigt (20:34:47).
//   N-0016, 05.09.2026 21:45–21:46 CEST, v1.0.0-beta.1.107: derselbe Verlauf, unabhängig
//   nachgestellt.
//
// WAS DIESE DATEI MISST — UND WAS SIE AUSDRÜCKLICH NICHT MISST. Ein „Neuladen" wird hier als
// `abbauen()` + `montiere(<zuletzt gelesene Adresse>)` nachgestellt. Das prüft die
// WIEDERHERSTELLUNG AUS DER ADRESSE, nicht den Browser: kein neues Dokument, kein frischer
// JS-Zustand, kein echtes `F5`. Genau das ist die Grenze dieser Datei, und sie ist bewusst gezogen
// — das ECHTE Neuladen steht in `neuladen-in-chromium.test.ts` daneben (`seite.goto` auf dieselbe
// Adresse, echte gebaute App). Wäre nur diese Datei grün, wäre der Nachbau repariert und der
// Befund nicht.
//
// WIE HIER GEMESSEN WIRD (Bauform aus `tests/bibliothek-offline-suche/leerzustand-ohne-netz.test.tsx`):
//
// (A) ECHTER QueryClient, TEILMOCK der Hooks. Die tragenden Abfragen sind echte `useQuery` gegen
//     den echten Zwischenspeicher; überschrieben ist nur, WAS der „Server" antwortet. Ein
//     Standbild-Mock („isError: true") könnte den Fall aus A5 nicht tragen: dort geht es darum,
//     dass eine tote Kennung wirklich in den Fehlerzweig läuft.
//
// (B) DER „SERVER" FILTERT, NICHT DIE FLÄCHE. `lib/librarySearch.ts:188` ist ausdrücklich ein
//     RE-RANKER — „verwirft nichts". Wer eine Trefferliste gefiltert sehen will, muss den
//     Suchbegriff also wirklich bis zum Abfrageschlüssel durchreichen. Der Mock unten filtert
//     deshalb selbst nach `q`, genau wie `GET /api/library/search`.
//
// (C) DIE ENTPRELLUNG WIRD ECHT ABGEWARTET (`LIBRARY_SEARCH_DEBOUNCE_MS`, 300 ms). Die Adresse
//     bekommt den ENTPRELLTEN Begriff — ein Test, der die Zeit nicht ablaufen lässt, misst den
//     Zustand vor dem Schreiben und wäre wertlos.
//
// (D) UNABHÄNGIGE SOLLWERTE. Parameternamen und Pflichttexte stehen hier als Literale und werden
//     gegen `i18n.ts` gepinnt (Korrekturpflicht aus JOB 3034 R2): eine Wortlaut- oder
//     Namensmutation darf nicht deshalb grün bleiben, weil Test und Fläche dieselbe Quelle lesen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

/** (D) Die Parameternamen, unabhängig von der Produktquelle hingeschrieben. */
const SUCH_PARAM = "q";
const EINTRAG_PARAM = "eintrag";

/** (D) Die Pflichttexte, unabhängig von der Produktquelle hingeschrieben. */
const KLARTEXT = {
  lesenFehler: "Der Eintrag ließ sich nicht laden.",
  erneut: "Erneut versuchen",
  loeschen: "Wissensobjekt löschen",
  loeschenJa: "Ja, löschen",
} as const;

function ko(overrides: Record<string, unknown>): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Titel",
    statement: "Ohne Belang fuer die Suche.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "validiert",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 2,
    assignments: [],
    asset: null,
    confidentiality: "intern",
    createdAt: "2026-08-12T00:00:00.000Z",
    history: [{ version: 1, at: "2026-08-12T00:00:00.000Z", author: "u9", note: "erstellt" }],
    comments: [],
    attachments: [],
    sources: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

// Drei Einträge, damit „der Gewählte" und „der Erste" auseinanderfallen können — ohne diesen
// Unterschied wäre der Befund gar nicht messbar (der stille Ersatz trifft immer den ERSTEN).
const ERSTER = ko({ id: "a", title: "Abluft A1 messen" });
const ZWEITER = ko({ id: "b", title: "Ventil V2 pruefen" });
const DRITTER = ko({ id: "c", title: "Ventil V3 pruefen" });
const BESTAND = [ERSTER, ZWEITER, DRITTER];

/** Der Suchbegriff trifft ZWEI der drei Einträge — die Liste bleibt also eine Liste. */
const BEGRIFF = "Ventil";
/** Eine Kennung, die es im Bestand nicht gibt (gelöscht, gesperrt, Tippfehler im Link). */
const TOTE_KENNUNG = "gibt-es-nicht";

// Jeder wirklich hinausgegangene Ruf, mit seinem Gegenstand. Daran hängt Lieferung 8.
const netz = vi.hoisted(() => ({
  suche: [] as string[],
  kos: 0,
  eintrag: [] as string[],
}));

/** Der Löschweg, so weit er den Server berührt — hier gezählt statt wirklich gerufen. */
const geloescht = vi.hoisted(() => ({ ids: [] as string[] }));

// TEILMOCK (Muster aus `leerzustand-ohne-netz.test.tsx:118`): überschrieben wird nur, was dieser
// Test steuert; die tragenden Abfragen laufen als ECHTE `useQuery` gegen den echten `QueryClient`.
vi.mock("../../apps/web/src/api/hooks", async (importOriginal) => {
  const echt = await importOriginal<Record<string, unknown>>();
  const rq = await import("../../apps/web/node_modules/@tanstack/react-query");
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  const leer = () => ok([]);
  // (B) Derselbe Schnitt, den `GET /api/library/search` macht: der Suchbegriff filtert am SERVER.
  const passt = (k: KnowledgeObject, q: string): boolean =>
    q.length === 0 ||
    `${k.title} ${k.statement} ${k.category}`.toLowerCase().includes(q.toLowerCase());
  return {
    ...echt,
    useKos: () =>
      rq.useQuery({
        queryKey: ["kos", undefined],
        queryFn: async () => {
          netz.kos += 1;
          return BESTAND;
        },
        retry: false,
        gcTime: Number.POSITIVE_INFINITY,
        staleTime: Number.POSITIVE_INFINITY,
      }),
    useLibrarySearch: (params: { q?: string }) =>
      rq.useQuery({
        queryKey: ["library", "search", params],
        queryFn: async () => {
          const suchtext = params.q ?? "";
          netz.suche.push(suchtext);
          return BESTAND.filter((k) => passt(k, suchtext));
        },
        retry: false,
        gcTime: Number.POSITIVE_INFINITY,
        staleTime: Number.POSITIVE_INFINITY,
      }),
    // Der Detailabruf ist ECHT: eine unbekannte Kennung scheitert wirklich, statt einen Fehler zu
    // behaupten. Genau daran hängt A5.
    useKo: (id: string) =>
      rq.useQuery({
        queryKey: (echt.koQueryKey as (id: string) => readonly unknown[])(id),
        queryFn: async () => {
          netz.eintrag.push(id);
          const k = BESTAND.find((x) => x.id === id);
          if (!k) {
            throw new Error("404");
          }
          return k;
        },
        retry: false,
        gcTime: Number.POSITIVE_INFINITY,
        staleTime: Number.POSITIVE_INFINITY,
      }),
    useAudit: leer,
    useConflicts: leer,
    useDirectory: leer,
    useEigeneBefunde: leer,
    useKoEvidence: leer,
    useKoNeighbors: leer,
    useKoVersions: leer,
    useLifecyclePending: leer,
    useExternalPolicy: () => ok({ stage: "blocked" }),
  };
});
// Der Löschweg läuft über denselben Aufruf wie im Betrieb (`endpoints.ko.remove`) — nur die eine
// Netzfahrt ist ersetzt. Alles andere an `endpoints` bleibt unangetastet.
vi.mock("../../apps/web/src/api/endpoints", async (importOriginal) => {
  const echt = await importOriginal<{ endpoints: Record<string, Record<string, unknown>> }>();
  return {
    ...echt,
    endpoints: {
      ...echt.endpoints,
      ko: {
        ...echt.endpoints.ko,
        remove: async (id: string) => {
          geloescht.ids.push(id);
        },
      },
    },
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u9", role: "admin" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "admin" }) }));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

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
  useNavigate,
} from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { LIBRARY_SEARCH_DEBOUNCE_MS } from "../../apps/web/src/lib/useDebouncedValue";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";
import { Library } from "../../apps/web/src/pages/Library";
import { gewaehlteId, leseTitel, suche, zeilenTitel } from "../library/support/bib-flaeche";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

/**
 * Die Adresse des gemounteten Baums, sichtbar gemacht. `MemoryRouter` führt seine eigene Adresse —
 * `window.location` weiß nichts davon. Ein Ableser im Baum ist der ehrliche Zugang; ein
 * Debug-Attribut im Produkt wäre Testcode in der Auslieferung.
 */
function Adresse(): JSX.Element {
  return createElement("span", { "data-adresse": useLocation().search });
}

/**
 * Das Kopfband, auf das Nötigste eingedampft: EIN Knopf, der genau die Navigation auslöst, die
 * `shell/Kopfband.tsx:51` auslöst (`navigate("/bibliothek?q=…")`). Er steht hier und nicht als
 * Import des echten Kopfbands, weil dieses seinen halben Anwendungsrahmen mitbringt (Anmeldung,
 * Benachrichtigungen, Reasoner-Zustand) — geprüft wird die WIRKUNG einer fremden Adressänderung
 * auf die Bibliothek, nicht das Kopfband.
 */
function Kopfbandsuche({ begriff }: { begriff: string }): JSX.Element {
  const navigate = useNavigate();
  return createElement(
    "button",
    {
      type: "button",
      "data-testid": "kopfband-suche",
      onClick: () => navigate(`/bibliothek?q=${encodeURIComponent(begriff)}`),
    },
    "suchen",
  );
}

/** Lässt die angestoßenen Abrufe und die daraus folgenden Renderdurchgänge auslaufen. */
async function ruhe(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

/** (C) Die Entprellung wirklich ablaufen lassen — mit echten Zeitgebern, nicht übersprungen. */
async function entprellungAbwarten(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, LIBRARY_SEARCH_DEBOUNCE_MS + 60));
  });
  await ruhe();
}

async function montiere(eingang = "/bibliothek"): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: [eingang] }, [
          createElement(Adresse, { key: "a" }),
          createElement(Kopfbandsuche, { key: "k", begriff: BEGRIFF }),
          createElement(Library, { key: "l" }),
        ]),
      ),
    );
  });
  await ruhe();
}

function abbauen(): void {
  if (root) {
    const alt = root;
    act(() => {
      alt.unmount();
    });
    root = null;
  }
  container?.remove();
}

/**
 * EIN NEULADEN, so weit jsdom es tragen kann: der Baum wird abgeräumt und an DERSELBEN Adresse neu
 * aufgebaut. Der React-Zustand ist damit weg, die Adresse ist alles, was übrig bleibt — genau die
 * Frage dieses Auftrags. Das ECHTE Neuladen (neues Dokument) steht in der Chromium-Datei daneben.
 */
async function neuLaden(): Promise<void> {
  const zuletzt = `/bibliothek${adresse()}`;
  abbauen();
  await montiere(zuletzt);
}

/** Der Suchteil der Adresse, wie ihn der Baum gerade führt. */
const adresse = (): string =>
  container.querySelector("[data-adresse]")?.getAttribute("data-adresse") ?? "";

const adressWert = (name: string): string | null => new URLSearchParams(adresse()).get(name);

/** Der Inhalt des Suchfelds — das, was der Mensch dort stehen sieht. */
function suchfeldWert(): string {
  const feld = container.querySelector('[data-testid="bib-suche"]');
  if (!(feld instanceof HTMLInputElement)) {
    throw new Error("Suchfeld fehlt");
  }
  return feld.value;
}

/** Der sichtbare Text der LESEFLÄCHE rechts — nicht der der Liste links. */
function lesetext(): string {
  const el = container.querySelector('[data-testid="bib-lesen"]');
  return (el?.textContent ?? "").replace(/\s+/g, " ");
}

function knopf(testId: string): HTMLButtonElement {
  const el = container.querySelector(`[data-testid="${testId}"]`);
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error(`Schaltfläche „${testId}" fehlt`);
  }
  return el;
}

/** Eine Zeile der Liste anklicken — über ihre Kennung, nicht über ihren Platz. */
function klickeZeile(id: string): void {
  const z = container.querySelector(`[data-testid="bib-zeile"][data-bib-id="${id}"]`);
  if (!(z instanceof HTMLButtonElement)) {
    throw new Error(`Listenzeile „${id}" fehlt. Da: ${zeilenTitel(container).join(" · ")}`);
  }
  act(() => {
    z.click();
  });
}

function de(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

beforeEach(() => {
  netz.suche = [];
  netz.kos = 0;
  netz.eintrag = [];
  geloescht.ids = [];
});

afterEach(() => {
  abbauen();
});

// ------------------------------------------------------------------------------------------------
// (D) Der Wortlaut-Pin
// ------------------------------------------------------------------------------------------------
describe("JOB 3104 · Wortlaut-Pin — die Pflichttexte stehen unabhängig fest", () => {
  it.each([
    ["lib.lesen.fehler", KLARTEXT.lesenFehler],
    ["lib.liste.erneut", KLARTEXT.erneut],
    ["ko.deleteButton", KLARTEXT.loeschen],
    ["ko.deleteYes", KLARTEXT.loeschenJa],
  ])("%s lautet auf Deutsch genau so", (key, soll) => {
    expect(de(key)).toBe(soll);
  });

  it("dieser Auftrag fügt KEINEN neuen sichtbaren Text hinzu — beide Sätze gibt es schon dreisprachig", () => {
    for (const sprache of ["de", "en", "nl"]) {
      for (const key of ["lib.lesen.fehler", "lib.liste.erneut"]) {
        const wert = i18n.getResource(sprache, "translation", key);
        expect(typeof wert, `${key} fehlt in ${sprache}`).toBe("string");
        expect(String(wert).length).toBeGreaterThan(0);
      }
    }
  });
});

// ------------------------------------------------------------------------------------------------
// A1 / A4 — DER SUCHBEGRIFF GEHT IN DIE ADRESSE UND WIEDER HERAUS
// ------------------------------------------------------------------------------------------------
describe("JOB 3104 · A1/A4 — der Suchbegriff steht in der Adresse", () => {
  it("A1: getippter Begriff steht nach der Entprellung als `q` in der Adresse", async () => {
    await montiere();
    expect(adressWert(SUCH_PARAM), "vor dem Tippen steht kein Begriff da").toBeNull();

    suche(container, BEGRIFF);
    await entprellungAbwarten();

    expect(adressWert(SUCH_PARAM)).toBe(BEGRIFF);
  });

  it("A4: ein geleertes Suchfeld LÖSCHT `q` — der Standard steht nicht in der Adresse", async () => {
    await montiere(`/bibliothek?${SUCH_PARAM}=${BEGRIFF}`);
    expect(adressWert(SUCH_PARAM)).toBe(BEGRIFF);

    suche(container, "");
    await entprellungAbwarten();

    // Nicht `q=`, sondern gar kein `q`: ein leerer Parameter sähe aus wie eine getroffene Wahl.
    expect(adressWert(SUCH_PARAM)).toBeNull();
    expect(adresse()).not.toContain(`${SUCH_PARAM}=`);
  });

  it("A1b: ein FREMDER Schreiber der Adresse gewinnt — die Kopfbandsuche wirkt auf der Fläche", async () => {
    // Die Fläche bleibt bei dieser Navigation MONTIERT: der Leser bei `useState` läuft nicht noch
    // einmal. Ohne den Rückleser stünde das Feld weiter leer — und der Schreiber löschte den
    // fremden Begriff nach der Entprellung wieder aus der Adresse.
    await montiere();
    act(() => {
      knopf("kopfband-suche").click();
    });
    await ruhe();
    // Schon VOR der Entprellung: der fremde Begriff darf nicht erst 300 ms lang verschwinden.
    expect(suchfeldWert()).toBe(BEGRIFF);
    expect(adressWert(SUCH_PARAM)).toBe(BEGRIFF);
    await entprellungAbwarten();

    expect(suchfeldWert(), "das Feld ist dem fremden Begriff nicht gefolgt").toBe(BEGRIFF);
    expect(zeilenTitel(container)).toEqual([ZWEITER.title, DRITTER.title]);
    expect(adressWert(SUCH_PARAM), "der fremde Begriff wurde wieder weggeschrieben").toBe(BEGRIFF);
  });

  it("A1c: solange die Entprellung läuft, reißt der Rückleser dem Menschen nichts weg", async () => {
    await montiere();
    // Getippt, aber noch nicht entprellt: die Adresse ist LEER, das Feld ist voraus.
    suche(container, "Vent");
    await ruhe();
    expect(suchfeldWert()).toBe("Vent");
    expect(adressWert(SUCH_PARAM)).toBeNull();
    // Genau hier greift der Rückleser NICHT — sonst stünde das Feld jetzt wieder leer.
    await entprellungAbwarten();
    expect(suchfeldWert()).toBe("Vent");
    expect(adressWert(SUCH_PARAM)).toBe("Vent");
  });

  it("A2: an dieser Adresse neu montiert trägt das Suchfeld den Begriff UND die Liste ist gefiltert", async () => {
    await montiere();
    expect(zeilenTitel(container), "der volle Bestand steht wirklich da").toEqual([
      ERSTER.title,
      ZWEITER.title,
      DRITTER.title,
    ]);

    suche(container, BEGRIFF);
    await entprellungAbwarten();
    await neuLaden();

    expect(suchfeldWert(), "das Suchfeld ist nach dem Neuladen leer").toBe(BEGRIFF);
    expect(zeilenTitel(container), "die Trefferliste ist nicht die des Begriffs").toEqual([
      ZWEITER.title,
      DRITTER.title,
    ]);
  });
});

// ------------------------------------------------------------------------------------------------
// A3 — DER GELESENE EINTRAG ÜBERLEBT, UND ZWAR DER GEWÄHLTE
// ------------------------------------------------------------------------------------------------
describe("JOB 3104 · A3 — der gewählte Eintrag steht in der Adresse", () => {
  it("A3a: ein Klick auf eine Zeile, die NICHT die erste ist, schreibt `eintrag` in die Adresse", async () => {
    await montiere();
    // Ohne Wahl steht der erste sichtbare Eintrag rechts — und NICHT in der Adresse.
    expect(gewaehlteId(container)).toBe(ERSTER.id);
    expect(adressWert(EINTRAG_PARAM), "eine Vorwahl ist keine getroffene Wahl").toBeNull();

    klickeZeile(DRITTER.id);
    await ruhe();

    expect(adressWert(EINTRAG_PARAM)).toBe(DRITTER.id);
  });

  it("A3b: an dieser Adresse neu montiert steht DERSELBE Eintrag rechts — nicht der erste", async () => {
    await montiere();
    klickeZeile(DRITTER.id);
    await ruhe();
    await neuLaden();

    expect(gewaehlteId(container)).toBe(DRITTER.id);
    expect(leseTitel(container)).toBe(DRITTER.title);
    // Der Befund N-0006 in einer Zeile: rechts stand der erste ANDERE Bericht.
    expect(leseTitel(container), "der stille Ersatz durch den ersten Eintrag ist zurück").not.toBe(
      ERSTER.title,
    );
  });

  it("A3c: Suche UND Wahl überleben gemeinsam — beides steht in derselben Adresse", async () => {
    await montiere();
    suche(container, BEGRIFF);
    await entprellungAbwarten();
    klickeZeile(DRITTER.id);
    await ruhe();
    await neuLaden();

    expect(suchfeldWert()).toBe(BEGRIFF);
    expect(zeilenTitel(container)).toEqual([ZWEITER.title, DRITTER.title]);
    expect(leseTitel(container)).toBe(DRITTER.title);
  });

  it("A3d: `/wissen/:id` schreibt den Parameter NICHT — die Wahl steht dort im Pfad", async () => {
    // Die Fläche bekommt ihre Wahl über `vorgewaehlt`; ein zusätzlicher Parameter wäre dieselbe
    // Aussage ein zweites Mal in derselben Adresse.
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
    await act(async () => {
      root?.render(
        createElement(
          QueryClientProvider,
          { client: qc },
          createElement(MemoryRouter, { initialEntries: [`/wissen/${ZWEITER.id}`] }, [
            createElement(Adresse, { key: "a" }),
            createElement(
              Routes,
              { key: "r" },
              createElement(Route, {
                path: "/wissen/:id",
                element: createElement(KnowledgeDetail),
              }),
            ),
          ]),
        ),
      );
    });
    await ruhe();
    expect(leseTitel(container)).toBe(ZWEITER.title);

    klickeZeile(DRITTER.id);
    await ruhe();

    expect(adressWert(EINTRAG_PARAM), "die Wahl stünde zweimal in derselben Adresse").toBeNull();
    expect(leseTitel(container)).toBe(DRITTER.title);
  });
});

// ------------------------------------------------------------------------------------------------
// A5 — DIE TOTE KENNUNG WIRD BENANNT, NICHT ERSETZT
// ------------------------------------------------------------------------------------------------
describe("JOB 3104 · A5 — eine Kennung ohne Bestand bekommt den vorhandenen ehrlichen Satz", () => {
  it("A5: eine tote Kennung zeigt Fehlersatz und Wiederholknopf — und keinen fremden Bericht", async () => {
    await montiere(`/bibliothek?${EINTRAG_PARAM}=${TOTE_KENNUNG}`);
    await ruhe();

    // Der Abruf ist wirklich hinausgegangen und wirklich gescheitert — sonst misst dieser Fall nichts.
    expect(netz.eintrag).toContain(TOTE_KENNUNG);
    expect(lesetext()).toContain(KLARTEXT.lesenFehler);
    expect(lesetext()).toContain(KLARTEXT.erneut);

    // Der Kern des Befunds: auf der Lesefläche steht KEIN anderer Bericht.
    expect(
      leseTitel(container),
      "es steht ein Titel da, wo nichts geladen werden konnte",
    ).toBeNull();
    for (const k of BESTAND) {
      expect(lesetext(), `„${k.title}" wurde untergeschoben`).not.toContain(k.title);
    }
    // Die Liste links bleibt vollständig — die tote Wahl macht die Fläche nicht blind.
    expect(zeilenTitel(container)).toHaveLength(BESTAND.length);
  });

  it("A5b: die Ursache wird NICHT behauptet — weder gelöscht noch gesperrt steht da", async () => {
    await montiere(`/bibliothek?${EINTRAG_PARAM}=${TOTE_KENNUNG}`);
    await ruhe();

    // 404, 403 und Netzfehler sehen von der Fläche aus identisch aus. Ein Satz über die Ursache
    // wäre eine Behauptung ohne Grundlage (REGELN §7).
    for (const wort of ["gelöscht", "geloescht", "kein Zugriff", "gesperrt", "nicht berechtigt"]) {
      expect(lesetext().toLowerCase()).not.toContain(wort.toLowerCase());
    }
  });
});

// ------------------------------------------------------------------------------------------------
// A6 — LIEFERUNG 8: KEINE ZUSÄTZLICHEN ABRUFE
// ------------------------------------------------------------------------------------------------
describe("JOB 3104 · A6 — die Umstellung kostet keinen einzigen Ruf mehr", () => {
  it("A6: die Wahl eines Eintrags löst KEINEN zusätzlichen Listenabruf aus", async () => {
    await montiere();
    const sucheVorher = netz.suche.length;
    const kosVorher = netz.kos;
    expect(sucheVorher, "die Liste wurde wirklich einmal geholt").toBeGreaterThanOrEqual(1);

    klickeZeile(DRITTER.id);
    await entprellungAbwarten();

    expect(netz.suche.length, "die Adressänderung hat eine Suche nachgezogen").toBe(sucheVorher);
    expect(netz.kos, "die Adressänderung hat den Bestand nachgezogen").toBe(kosVorher);
  });

  it("A6b: auch das Tippen bleibt bei EINEM Ruf je entprelltem Begriff", async () => {
    await montiere();
    const vorher = netz.suche.length;
    suche(container, "Ven");
    suche(container, "Vent");
    suche(container, BEGRIFF);
    await entprellungAbwarten();

    expect(netz.suche.slice(vorher), "die Entprellung ist umgangen worden").toEqual([BEGRIFF]);
  });
});

// ------------------------------------------------------------------------------------------------
// A7 — LIEFERUNG 4: DIE GELÖSCHTE WAHL VERLÄSST DIE ADRESSE
// ------------------------------------------------------------------------------------------------
describe("JOB 3104 · A7 — wer selbst löscht, bekommt den Fehlersatz nicht", () => {
  it("A7: nach dem Löschen steht `eintrag` nicht mehr in der Adresse", async () => {
    await montiere(`/bibliothek?${EINTRAG_PARAM}=${DRITTER.id}`);
    expect(leseTitel(container)).toBe(DRITTER.title);
    expect(adressWert(EINTRAG_PARAM)).toBe(DRITTER.id);

    act(() => {
      knopf("bib-eintrag-menue").click();
    });
    act(() => {
      knopf("bib-menue-loeschen").click();
    });
    const ja = [...container.querySelectorAll("button")].find(
      (b) => (b.textContent ?? "").trim() === KLARTEXT.loeschenJa,
    );
    expect(ja, "der Bestätigungsknopf fehlt").toBeInstanceOf(HTMLButtonElement);
    await act(async () => {
      (ja as HTMLButtonElement).click();
    });
    await ruhe();

    expect(geloescht.ids, "gelöscht wurde wirklich").toEqual([DRITTER.id]);
    expect(adressWert(EINTRAG_PARAM), "die tote Kennung steht noch in der Adresse").toBeNull();
    // Und die Fläche fällt auf den Normalzustand zurück, statt dem Löschenden einen Fehler zu zeigen.
    expect(lesetext()).not.toContain(KLARTEXT.lesenFehler);
  });
});
