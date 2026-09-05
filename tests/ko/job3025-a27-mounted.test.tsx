// @vitest-environment jsdom
// ================================================================================================
// JOB 3025 (A27, OFFEN.md:81) — DIE DETAILSEITE, AN EINEM ECHTEN QueryClient GEMESSEN.
// ================================================================================================
//
// WARUM MIT ECHTEM QueryClient UND NICHT MIT GEMOCKTEN HOOKS: JOB 3002 ist fünfmal an der Frage
// gescheitert, was TanStack Query in einer bestimmten Situation WIRKLICH meldet — zuletzt an
// `fetchStatus: "paused"`, den Codex erst mit einem echten QueryObserver sichtbar machen konnte
// (LEHREN.md, JOB 3002 R5). Ein Hook-Mock kann diese Lagen nur behaupten. Hier werden sie erzeugt:
// echter Client, echte Query-Keys, `setQueryData` als Zwischenspeicher, `refetchQueries` als
// Auffrischung, `onlineManager.setOnline(false)` als Netztrennung.
//
// GEMESSEN WIRD IMMER DASSELBE FELD: der Bereich `job3025-kollision`. Er darf eine Verneinung
// („keine offene Kollision") NUR in der Lage `frisch` tragen — in den fünf anderen steht dort ein
// Satz über die Datenlage.
//
// Alle drei Quellen (`conflicts`, `duplicate-signal`, `kos`) werden EINZELN verstellt. Genau das
// war die Halbheit, an der die Runden 4 und 5 fielen: das Zustandsmodell nur für eine Quelle.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  rolle: "experte" as "experte" | "controller",
  /**
   * Wem das geöffnete Objekt gehört. Die Sitzung ist immer `u1`; steht hier `u2`, sieht `u1` ein
   * FREMDES Objekt — der Fall, den Runde 2 offen ließ (Ben, Korrekturpflicht 1).
   */
  autor: "u1",
  /** Je Quelle ein steuerbarer Ausgang — auflösen, ablehnen oder hängen lassen. */
  kanal: {} as Record<"kos" | "conflicts" | "signal", () => Promise<unknown>>,
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: box.rolle })),
    logout: vi.fn(async () => ({})),
  },
}));

const KO = {
  id: "ko-1",
  title: "Pumpe entlüften",
  statement: "Nach dem Anfahren 10 Sekunden warten.",
  conditions: [],
  measures: [],
  type: "best_practice",
  category: "Wartung",
  tags: [],
  confidence: 0,
  trust: 0,
  status: "validiert",
  version: 1,
  author: "u1",
  originalAuthor: "u1",
  neededValidations: 2,
  assignments: [],
  asset: null,
  history: [],
  createdAt: "2026-08-01T00:00:00.000Z",
};

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => ({ ...KO, author: box.autor, originalAuthor: box.autor })),
        list: vi.fn(() => box.kanal.kos()),
        versions: leer,
        evidence: leer,
        neighbors: vi.fn(async () => ({
          center: "ko-1",
          neighbors: [],
          excludedTags: [],
          limit: 8,
        })),
        act: vi.fn(async () => KO),
      },
      conflicts: { list: vi.fn(() => box.kanal.conflicts()) },
      duplicateSignal: { list: vi.fn(() => box.kanal.signal()) },
      audit: { list: leer },
      directory: { list: vi.fn(async () => [{ id: "u1", name: "Eva" }]) },
      lifecycle: { pending: leer, linked: leer },
      external: { policy: vi.fn(async () => ({ stage: "blocked", enabled: false })) },
      uploadLimits: {
        get: vi.fn(async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 })),
      },
      reasoner: {
        status: vi.fn(async () => ({ active: false, mode: "off" })),
        config: vi.fn(async () => ({})),
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
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import type { Conflict, EigenerBefund } from "../../apps/web/src/api/types";
import { AuthProvider, useSession } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider, useRole } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

// ------------------------------------------------------------------------------------------------
// Aufbau
// ------------------------------------------------------------------------------------------------

type QuellenName = "kos" | "conflicts" | "signal";
const QUELLEN: readonly QuellenName[] = ["kos", "conflicts", "signal"];

/** Die Query-Keys, wie die Hooks sie wirklich bilden (api/hooks.ts:15, :94, :98). */
const KEY: Record<QuellenName, readonly unknown[]> = {
  kos: ["kos", undefined],
  conflicts: ["conflicts"],
  signal: ["duplicate-signal"],
};

// JOB 3068 (N5): der Befund trägt seit JOB 3032 die Deckung des Laufs, der DIESES Objekt angesehen
// hat. Hier steht die schwächste (`kein_lauf`, zwei `null`) — diese Datei misst das LAGEMODELL, die
// Deckung hat ihre eigene Probe (`tests/ko/job3068-deckungssatz.test.ts`).
const DUBLETTE: EigenerBefund = {
  koId: "ko-1",
  dublette: true,
  konflikt: false,
  deckung: { lage: "kein_lauf", geprueft: null, bestand: null },
};
const KONFLIKT_EINTRAG: Conflict = {
  id: "c-1",
  koA: "ko-1",
  koB: "ko-geheim-9",
  type: "truth",
  description: "Die Gegenseite behauptet 6 bar.",
  status: "offen",
  secondOpinion: null,
  decidedBy: null,
  decision: null,
  createdAt: "2026-09-01T00:00:00Z",
};

/** Der Vorgabe-Ausgang einer Quelle: sofort mit leerer Liste antworten. */
const leerAntwort = async (): Promise<unknown> => [];

/**
 * KALIBRIERUNG DER ROLLENFÄLLE. Ohne sie wäre R-h1 vakuös: „als experte kein Link" ist auch dann
 * grün, wenn die Sitzung gar nicht geladen hat und die Vorgaberolle zufällig `experte` ist — und
 * genau das war beim Bau dieser Datei der Fall (eine Auflösungsrunde fehlte im Mount). Der Probe
 * schreibt die WIRKSAME Rolle in den Baum; jeder Rollenfall prüft sie ausdrücklich.
 */
function Probe(): JSX.Element {
  const { role } = useRole();
  const { user } = useSession();
  return createElement("span", { "data-probe": "1" }, `${role}/${user?.role ?? "kein-user"}`);
}

/** Die wirksame Rolle im gemounteten Baum (nicht die gewünschte). */
function wirksameRolle(): string {
  return container.querySelector("[data-probe]")?.textContent ?? "";
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
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
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/wissen/:id",
                      element: createElement("div", null, [
                        createElement(Probe, { key: "p" }),
                        createElement(KnowledgeDetail, { key: "d" }),
                      ]),
                    }),
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
  // JOB 3068 (N5): die Kollisions-Auskunft steht wieder in der LESESPALTE, ohne einen Klick. Bis
  // dahin lag sie im Abschnitt „Konflikt" hinter der zugeklappten Zeile „Mehr" — und war damit für
  // eine Autorin, die nicht aufklappt, unsichtbar. Hier wird deshalb NICHTS mehr aufgeklappt; dass
  // die Auskunft ohne Aufklappen dasteht, ist ab jetzt die Zusage und nicht mehr die Vorarbeit.
  await act(flush);
}

/**
 * Der gemessene Bereich — genau das Feld, um das dieser Auftrag geht.
 *
 * JOB 3063 (H4) hatte ihn in den Abschnitt „Konflikt" hinter die Zeile „Mehr" verlegt; JOB 3068 (N5)
 * hat ihn in die Lesespalte zurückgeholt, weil Pedis Zeile „DAUERHAFT" verlangt
 * (`components/bibliothek/BibliothekLesen.tsx`). Die ZUSAGE von JOB 3025 ist von beidem unberührt —
 * sie handelt vom WORTLAUT der Auskunft. Dass sie OHNE Aufklappen dasteht, misst jeder Fall hier
 * jetzt mit: `mount()` klappt nichts mehr auf.
 */
function bereich(): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-testid="job3025-kollision"]');
  if (!el) {
    throw new Error("Der Kollisionsbereich fehlt auf der Detailseite");
  }
  return el;
}

const text = (): string => (bereich().textContent ?? "").replace(/\s+/g, " ");

/** Ein Zwischenspeicher-Stand, wie ihn eine frühere Antwort hinterlassen hätte. */
function vorbefuellen(mitBefund: boolean): void {
  qc.setQueryData(KEY.kos, [KO]);
  qc.setQueryData(KEY.conflicts, [] as Conflict[]);
  qc.setQueryData(KEY.signal, mitBefund ? [DUBLETTE] : ([] as EigenerBefund[]));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.rolle = "experte";
  box.autor = "u1";
  box.kanal = { kos: leerAntwort, conflicts: leerAntwort, signal: leerAntwort };
  onlineManager.setOnline(true);
  // `staleTime: Infinity` macht die Auffrischung STEUERBAR: nach `setQueryData` fragt keine Abfrage
  // von selbst nach, und ein `refetchQueries` auf GENAU EINEN Key verstellt genau eine Quelle.
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  qc.clear();
  onlineManager.setOnline(true);
  vi.clearAllMocks();
});

// ------------------------------------------------------------------------------------------------
// (a) und (b) — die einzige Lage, in der die Seite über den Bestand sprechen darf
// ------------------------------------------------------------------------------------------------

describe("JOB 3025 · frisch geladen: die Auskunft steht", () => {
  it("R-a1 · Dublette am eigenen Objekt → Hinweis MIT Satz, ohne Datenlage-Vorbehalt", async () => {
    box.kanal.signal = async () => [DUBLETTE];
    await mount();
    expect(text()).toContain(i18n.t("kollision.detail.dublette"));
    expect(text()).not.toContain(i18n.t("kollision.detail.keine"));
    expect(text()).not.toContain(i18n.t("kollision.lage.laedt"));
  });

  it("R-a2 · Konflikt am eigenen Objekt → Hinweis, aber NICHTS über die Gegenseite (A28)", async () => {
    box.kanal.conflicts = async () => [KONFLIKT_EINTRAG];
    await mount();
    expect(text()).toContain(i18n.t("kollision.detail.konflikt"));
    // Kalibrierung: die Antwort trägt den fremden Inhalt wirklich.
    expect(JSON.stringify([KONFLIKT_EINTRAG])).toContain("ko-geheim-9");
    expect(bereich().innerHTML).not.toContain("ko-geheim-9");
    expect(text()).not.toContain("6 bar");
  });

  it("R-b · frisch und leer → die Verneinung, und sonst keine Beruhigung", async () => {
    await mount();
    expect(text()).toContain(i18n.t("kollision.detail.keine"));
    expect(text()).not.toContain(i18n.t("kollision.detail.dublette"));
    expect(text()).not.toContain(i18n.t("kollision.lage.erstfehler"));
  });

  it("R-b2 · die alten A28-Pillen sind fort (Ablösung, REGELN.md §7)", async () => {
    box.kanal.signal = async () => [{ ...DUBLETTE, konflikt: true }];
    await mount();
    expect(container.querySelector('[data-testid="a28-signal-dublette"]')).toBeNull();
    expect(container.querySelector('[data-testid="a28-signal-konflikt"]')).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------
// (c) bis (g) — je Quelle EINZELN. Das ist der Kern dieses Auftrags.
// ------------------------------------------------------------------------------------------------

/** Ein Versprechen, das nie einlöst — der laufende, nie beantwortete Abruf. */
const haengt = (): Promise<never> => new Promise<never>(() => {});

// JOB 3068 (N5) · WAS SICH IN (c) GEÄNDERT HAT — UND WARUM ES SCHÄRFER IST, NICHT MILDER.
//
// Bis hierher verlangte (c) den Satz „Wird geprüft — die Kollisionsprüfung lädt noch." Er stand, als
// die Auskunft hinter „Mehr" lag: wer aufklappte, wollte etwas wissen und bekam eine Antwort.
// In der LESESPALTE gilt die Regel der Fläche (`BibliothekLesen.tsx`, Kopf §5): „Laden = leere
// Fläche, kein ‚Lädt …'" — ein Ladewort an einem Eintrag, der noch gar nichts weiß, ist genau der
// Erklärtext, den JOB 3063 abgeschafft hat, und Auftrag 3068 §9 schreibt für `laedt` ausdrücklich
// „Befundzeile: leer" vor.
//
// GEMESSEN WIRD DESHALB SCHÄRFER: nicht mehr „steht der richtige Satz da", sondern „steht ÜBERHAUPT
// NICHTS da" — und zwar auf der GANZEN Seite, nicht nur im Bereich. Die Zusage von JOB 3025 (Codex
// R3: ein laufender Erstabruf darf nie als „ließ sich nicht laden" erscheinen) ist damit
// vollständig erfüllt: es erscheint gar nichts. Ein Befund aus dem Zwischenspeicher wird davon NICHT
// verschluckt — R-c-cache misst genau das.
describe("JOB 3025 · (c) laufender Erstabruf — nie „ließ sich nicht laden“ (Codex R3)", () => {
  for (const quelle of QUELLEN) {
    it(`R-c-${quelle} · ${quelle} hängt → gar keine Auskunft, erst recht keine Bestandsaussage`, async () => {
      box.kanal[quelle] = haengt;
      await mount();
      expect(bereichVorhanden()).toBe(false);
      const seite = (container.textContent ?? "").replace(/\s+/g, " ");
      expect(seite).not.toContain(i18n.t("kollision.lage.erstfehler"));
      expect(seite).not.toContain(i18n.t("kollision.detail.keine"));
      expect(seite).not.toContain(i18n.t("kollision.detail.dublette"));
    });
  }

  it("R-c-cache · ein Befund aus dem Zwischenspeicher wird vom Laden NICHT verschluckt", async () => {
    // Die Grenze der neuen Regel, gemessen statt behauptet: geschwiegen wird nur, solange NICHTS
    // bekannt ist. Ein bekannter Befund wird in JEDER Lage genannt (eigeneKollision.ts:245) — eine
    // Kollision, die der Autorin verschwiegen wird, ist genau Pedis Ausgangsbefund A27.
    qc.setQueryData(KEY.signal, [DUBLETTE]);
    box.kanal.kos = haengt;
    await mount();
    expect(bereichVorhanden()).toBe(true);
    expect(text()).toContain(i18n.t("kollision.detail.dublette"));
    expect(text()).toContain(i18n.t("kollision.lage.laedt"));
  });
});

describe("JOB 3025 · (d) Erstfehler — Fehlerlage statt Bestandsaussage (Codex R2)", () => {
  for (const quelle of QUELLEN) {
    it(`R-d-${quelle} · ${quelle} scheitert ohne je Daten → Fehlerlage`, async () => {
      box.kanal[quelle] = async () => {
        throw new Error("Netz weg");
      };
      await mount();
      expect(text()).toContain(i18n.t("kollision.lage.erstfehler"));
      expect(text()).not.toContain(i18n.t("kollision.detail.keine"));
    });
  }
});

describe("JOB 3025 · (e) Zwischenspeicher plus hängender Auffrischung (Codex R4)", () => {
  for (const quelle of QUELLEN) {
    it(`R-e-${quelle} · ${quelle} frischt auf → Stand ist markiert, keine Verneinung`, async () => {
      vorbefuellen(false);
      box.kanal[quelle] = haengt;
      await mount();
      await act(async () => {
        void qc.refetchQueries({ queryKey: KEY[quelle] });
        await flush();
      });
      expect(text()).toContain(i18n.t("kollision.lage.auffrischungLaeuft"));
      expect(text()).not.toContain(i18n.t("kollision.detail.keine"));
    });
  }
});

describe("JOB 3025 · (f) Zwischenspeicher plus ABGELEHNTER Auffrischung (Codex R4)", () => {
  for (const quelle of QUELLEN) {
    it(`R-f-${quelle} · ${quelle} lehnt ab → „nicht aufgefrischt“, leerer Cache verneint NICHT`, async () => {
      vorbefuellen(false);
      box.kanal[quelle] = async () => {
        throw new Error("Auffrischung abgelehnt");
      };
      await mount();
      await act(async () => {
        await qc.refetchQueries({ queryKey: KEY[quelle] }).catch(() => {});
        await flush();
      });
      expect(text()).toContain(i18n.t("kollision.lage.auffrischungGescheitert"));
      expect(text()).not.toContain(i18n.t("kollision.detail.keine"));
    });
  }

  it("R-f-befund · ein Cache-BEFUND verschwindet nicht, er bekommt den Vorbehalt", async () => {
    vorbefuellen(true);
    box.kanal.signal = async () => {
      throw new Error("Auffrischung abgelehnt");
    };
    await mount();
    await act(async () => {
      await qc.refetchQueries({ queryKey: KEY.signal }).catch(() => {});
      await flush();
    });
    expect(text()).toContain(i18n.t("kollision.detail.dublette"));
    expect(text()).toContain(i18n.t("kollision.lage.auffrischungGescheitert"));
  });
});

describe("JOB 3025 · (g) offline pausiert mit altem Cache — der Rotpunkt aus Runde 5", () => {
  for (const quelle of QUELLEN) {
    it(`R-g-${quelle} · ${quelle} pausiert → Offline-Grund, keine Verneinung`, async () => {
      vorbefuellen(false);
      await mount();
      await act(async () => {
        onlineManager.setOnline(false);
        void qc.refetchQueries({ queryKey: KEY[quelle] });
        await flush();
      });
      expect(text()).toContain(i18n.t("kollision.lage.pausiert"));
      expect(text()).not.toContain(i18n.t("kollision.detail.keine"));
    });
  }

  it("R-g-befund · ein pausierter Befund steht nie unmarkiert als aktueller da (Codex R5)", async () => {
    vorbefuellen(true);
    await mount();
    await act(async () => {
      onlineManager.setOnline(false);
      void qc.refetchQueries({ queryKey: KEY.signal });
      await flush();
    });
    expect(text()).toContain(i18n.t("kollision.detail.dublette"));
    expect(text()).toContain(i18n.t("kollision.lage.pausiert"));
  });
});

// ------------------------------------------------------------------------------------------------
// (h) — kein Rohlink auf eine gesperrte Fläche (Codex R1, wörtlich)
// ------------------------------------------------------------------------------------------------

describe("JOB 3025 · (h) die Rollenbindung des Weges", () => {
  it("R-h1 · als experte: erklärender Text sichtbar, aber KEIN a[href=„/konflikte“]", async () => {
    box.rolle = "experte";
    box.kanal.conflicts = async () => [KONFLIKT_EINTRAG];
    await mount();
    expect(wirksameRolle()).toBe("experte/experte");
    expect(text()).toContain(i18n.t("kollision.detail.konflikt"));
    // Ausdrücklich die GANZE Seite: der SCRUM-357-Banner darüber trug bis zu diesem Auftrag einen
    // ROHEN Link auf dieselbe gesperrte Fläche — das war Codex' Korrekturpflicht aus JOB 3002 R1.
    expect(container.querySelector('a[href="/konflikte"]')).toBeNull();
  });

  it("R-h2 · als controller: der echte Link bleibt", async () => {
    box.rolle = "controller";
    box.kanal.conflicts = async () => [KONFLIKT_EINTRAG];
    await mount();
    expect(wirksameRolle()).toBe("controller/controller");
    expect(bereich().querySelector('a[href="/konflikte"]')).not.toBeNull();
  });

  it("R-h3 · als experte auch kein Rohlink auf /duplikate", async () => {
    box.rolle = "experte";
    box.kanal.signal = async () => [DUBLETTE];
    await mount();
    expect(wirksameRolle()).toBe("experte/experte");
    expect(text()).toContain(i18n.t("kollision.detail.dublette"));
    expect(container.querySelector('a[href="/duplikate"]')).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------
// (i) — DIE FLÄCHE GEHÖRT DER VERFASSERIN (Ben, Runde 2, Korrekturpflicht 1)
// ------------------------------------------------------------------------------------------------
//
// Runde 2 zeigte den Bereich an JEDEM geöffneten Objekt. Am fremden Objekt war seine Verneinung
// unbelegt: `/api/duplicate-signal` trägt dort nie einen Eintrag (der Server filtert auf den
// Betrachter) und `/api/conflicts` ist sichtbarkeitsgefiltert. Beide leeren Antworten bedeuten dann
// „ich darf hier nichts sehen" — und genau das darf nicht als „keine offene Kollision" erscheinen.

/** Ist der A27-Bereich überhaupt im Baum? Anders als `bereich()` wirft das nicht. */
function bereichVorhanden(): boolean {
  return container.querySelector('[data-testid="job3025-kollision"]') !== null;
}

describe("JOB 3025 · (i) nur am EIGENEN Objekt", () => {
  it("R-i1 · KALIBRIERUNG: am eigenen Objekt steht der Bereich (sonst misst i2 nichts)", async () => {
    box.autor = "u1";
    await mount();
    expect(wirksameRolle()).toBe("experte/experte");
    expect(bereichVorhanden()).toBe(true);
  });

  it("R-i2 · fremdes Objekt, leeres Eigene-Signal, VERBORGENER Konflikt → gar keine Fläche", async () => {
    // Der verborgene Konflikt ist genau der gefährliche Fall: er existiert, aber die
    // sichtbarkeitsgefilterte Liste ist leer. Eine Verneinung wäre hier eine Erfindung.
    box.autor = "u2";
    box.kanal.conflicts = leerAntwort;
    box.kanal.signal = leerAntwort;
    await mount();
    expect(bereichVorhanden()).toBe(false);
    const seite = (container.textContent ?? "").replace(/\s+/g, " ");
    expect(seite).not.toContain(i18n.t("kollision.detail.keine"));
    expect(seite).not.toContain(i18n.t("kollision.detail.title"));
  });

  // JOB 3063 (H4) — DER SCRUM-357-BANNER IST EIN SATZ GEWORDEN, KEIN KASTEN MEHR.
  //
  // Der Eigentümer hat am 04.09.2026 entschieden (AUFTRAG 3063 §5, Lieferung 5): der Konflikt-Hinweis
  // erscheint nur im Fall, und dann als EIN Satz über dem Titel. Die Überschriftzeile
  // `conflict.impact.truthTitle` steht deshalb nicht mehr auf der Fläche; die AUSSAGE des Banners
  // steht weiter da — als `conflict.impact.truthHint` (`components/bibliothek/BibliothekLesen.tsx:537`).
  // Gemessen wird ab hier der Satz, der die Nutzbarkeit einschränkt. Das ist die Zusage von
  // SCRUM-357; die Überschrift war ihre Verpackung.
  it("R-i3 · fremdes Objekt mit SICHTBAREM Konflikt: SCRUM-357 bleibt, die A27-Fläche fehlt", async () => {
    // Die Abgrenzung wird hier gemessen und nicht behauptet: der Satz spricht zum LESER über die
    // Nutzbarkeit und gilt für jedes Objekt; die A27-Fläche spricht zur Verfasserin.
    box.autor = "u2";
    box.kanal.conflicts = async () => [KONFLIKT_EINTRAG];
    await mount();
    const seite = (container.textContent ?? "").replace(/\s+/g, " ");
    expect(seite, "der SCRUM-357-Satz muss am fremden Objekt stehen bleiben").toContain(
      i18n.t("conflict.impact.truthHint"),
    );
    expect(bereichVorhanden()).toBe(false);
  });

  it("R-i4 · am eigenen Objekt bleibt SCRUM-357 ebenfalls — die zwei Aussagen stehen nebeneinander", async () => {
    box.autor = "u1";
    box.kanal.conflicts = async () => [KONFLIKT_EINTRAG];
    await mount();
    const seite = (container.textContent ?? "").replace(/\s+/g, " ");
    expect(seite).toContain(i18n.t("conflict.impact.truthHint"));
    expect(text()).toContain(i18n.t("kollision.detail.konflikt"));
  });

  it("R-i5 · KALIBRIERUNG: ohne Konflikt steht der Satz NICHT da — er ist an den Fall gebunden", async () => {
    // Ohne diesen Fall wären R-i3/R-i4 auch dann grün, wenn der Satz als Dauertext dastünde — und
    // genau das ist die Sorte Beruhigung, die JOB 3025 und JOB 3063 beide verbieten.
    box.autor = "u1";
    box.kanal.conflicts = leerAntwort;
    await mount();
    const seite = (container.textContent ?? "").replace(/\s+/g, " ");
    expect(seite).not.toContain(i18n.t("conflict.impact.truthHint"));
    expect(seite).not.toContain(i18n.t("conflict.impact.hint"));
  });
});

// ------------------------------------------------------------------------------------------------
// (j) — KALTER OFFLINE-EINSTIEG OHNE JEDEN STAND (Ben, Runde 2, Korrekturpflicht 2)
// ------------------------------------------------------------------------------------------------
//
// Alle Offline-Fälle oben beginnen mit `vorbefuellen(...)`, also MIT Zwischenspeicher. Fehlt der,
// sagte die Seite trotzdem „Stand von zuletzt" — eine Behauptung über einen Stand, den es nie gab.
// Das ist dieselbe Erfindung wie die Verneinung ohne Grundlage, nur an der anderen Flanke.

describe("JOB 3025 · (j) offline OHNE Zwischenspeicher", () => {
  // DREI MESSUNGEN HABEN DEN AUFBAU DIESER FÄLLE BESTIMMT — alle beim Bau gemacht, nicht vermutet:
  //   · VOR dem Mount offline: dann pausiert auch `ko.get`, die Seite hat kein Objekt und zeigt
  //     ihren Ladezustand („Der Kollisionsbereich fehlt auf der Detailseite").
  //   · VOR dem Mount offline, Objekt aus dem Speicher: dann pausiert `authApi.me`
  //     (AuthContext.tsx:94 ist ebenfalls eine Abfrage), `user` bleibt leer, und die Fläche
  //     verschwindet zu Recht — ohne Sitzung ist die Autorschaft unbekannt.
  //   · Offline gehen, WÄHREND ein Erstabruf läuft: der laufende Abruf bleibt laufend
  //     (`fetchStatus: "fetching"`; die Fläche zeigte weiter „Wird geprüft"). TanStack hält einen
  //     bereits gestarteten Abruf nicht rückwirkend an.
  // Der echte kalte Offline-Fall ist deshalb dieser: Sitzung und Objekt sind da, die drei
  // Prüfquellen haben nie geantwortet, und der nächste Versuch fällt ins fehlende Netz.
  async function kaltOfflineStellen(quellen: readonly QuellenName[]): Promise<void> {
    await act(async () => {
      onlineManager.setOnline(false);
      for (const q of quellen) {
        await qc.cancelQueries({ queryKey: KEY[q] });
        void qc.refetchQueries({ queryKey: KEY[q] });
      }
      await flush();
    });
  }

  it("R-j1 · Prüfquellen ohne je eine Antwort, Netz weg → kein „Stand von zuletzt“", async () => {
    box.kanal.kos = haengt;
    box.kanal.conflicts = haengt;
    box.kanal.signal = haengt;
    await mount();
    await kaltOfflineStellen(QUELLEN);
    expect(text()).toContain(i18n.t("kollision.lage.pausiertOhneStand"));
    expect(text()).not.toContain(i18n.t("kollision.lage.pausiert"));
    expect(text()).not.toContain(i18n.t("kollision.detail.keine"));
    expect(text()).not.toContain(i18n.t("kollision.detail.dublette"));
  });

  it("R-j2 · MIT Zwischenspeicher bleibt es beim „Stand von zuletzt“ — die Grenze ist gemessen", async () => {
    vorbefuellen(true);
    await mount();
    await act(async () => {
      onlineManager.setOnline(false);
      void qc.refetchQueries({ queryKey: KEY.signal });
      await flush();
    });
    expect(text()).toContain(i18n.t("kollision.lage.pausiert"));
    expect(text()).not.toContain(i18n.t("kollision.lage.pausiertOhneStand"));
    // Und der Cache-Befund bleibt sichtbar, mit Vorbehalt — er wird eingeordnet, nicht kassiert.
    expect(text()).toContain(i18n.t("kollision.detail.dublette"));
  });

  it("R-j3 · Teil-Stand ist kein Stand: eine Quelle ohne Daten nimmt „Stand von zuletzt“ zurück", async () => {
    // `kos` bleibt ohne jede Antwort, die anderen zwei haben einen Zwischenspeicher. Der Befund aus
    // dem Cache bleibt stehen; behauptet wird über den Gesamtstand aber nichts mehr.
    qc.setQueryData(KEY.conflicts, [] as Conflict[]);
    qc.setQueryData(KEY.signal, [DUBLETTE]);
    box.kanal.kos = haengt;
    await mount();
    await kaltOfflineStellen(["kos"]);
    expect(text()).toContain(i18n.t("kollision.detail.dublette"));
    expect(text()).toContain(i18n.t("kollision.lage.pausiertOhneStand"));
    expect(text()).not.toContain(i18n.t("kollision.lage.pausiert"));
  });
});
