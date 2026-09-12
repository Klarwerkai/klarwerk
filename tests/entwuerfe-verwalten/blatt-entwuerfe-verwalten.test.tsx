// @vitest-environment jsdom
// ================================================================================================
// JOB 3426 · ENTWUERFE-VERWALTEN — SUCHEN, SORTIEREN, LÖSCHEN IM EDITOR.
// ================================================================================================
//
// AUSGANGSLAGE (Auftrag §2): Die Entwurfsliste des Editors (`Blatt.tsx`) bildete die Rohliste
// `drafts.data` unmittelbar auf Öffnen-Knöpfe ab — kein Suchfeld, keine Sortierung, kein Löschweg.
// Die fertige Bedienung lag seit AUFTRAG-sortfilter in `CaptureDraftList` und hing nur am alten
// Arbeitsraum (`Capture.tsx`). Dieser Auftrag baut nichts Neues: er schließt das Vorhandene an.
//
// GEMESSEN WIRD AN DER ECHTEN FLÄCHE, mit dem echten Entwurfsdienst (CaptureService +
// InMemoryDraftRepo) hinter den Endpunkten — dieselbe Bauform wie
// `tests/d1-meine-entwuerfe/blatt-zugang-und-liste.test.tsx`. KEINE Attrappe der Komponente: was
// hier gedrückt wird, ist der Weg, den auch Pedi drückt. Der Dienst führt seine eigene Uhr
// (`deps.now`), damit „neueste zuerst" eine gemessene Ordnung ist und keine Zufallsreihenfolge
// gleicher Millisekunden.
//
// A  Suche: findet über TITEL und über INHALT (Auftrag §4b.2)
// B  Sortierung: Vorgabe neueste zuerst, umschaltbar auf älteste und Titel A→Z (§4b.3)
// C  Löschen fragt zurück; „Behalten" löscht nichts, „Löschen" entfernt wirklich (§4.2, §4b.5)
// D  ein FEHLGESCHLAGENER Löschlauf lässt den Eintrag stehen (§4b.5)
// E  der offene Entwurf bleibt hervorgehoben, und sein Hinweis steht (§4.3)
// F  wird der OFFENE Entwurf gelöscht, verliert die Adresse ihn — das Blatt behält seinen Text
// G  „Eingabe verwerfen" und „Löschen": zwei Wörter UND zwei Wirkungen, als Bedienfolge (§4b.4)
// H  der ganze Weg ist mit der Tastatur bedienbar (§4b.6)
// I  DE und EN: Suche, Sortierung und Rückfrage sind übersetzt (§4b.6)
// J  der Weg von der Startseite (`?entwuerfe=1`) führt zu genau dieser Liste (§4b.1)
// K  gelöscht MITTEN IM LADEN: die Adresse verliert den Entwurf (R2, bens Korrekturpflicht 1)
// L  die Ladeantwort im SELBEN Zug wie die Löschbestätigung bringt ihn nicht zurück (dieselbe)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  /** Die Uhr des Dienstes — jeder Entwurf bekommt seinen eigenen, gemessenen Zeitpunkt. */
  zeit: 0,
  zaehler: { get: 0, list: 0, remove: 0 },
  /** Kennungen, deren Löschung der Server verweigert (Fall D). */
  loeschFehler: new Set<string>(),
  seed: async (_p: Record<string, unknown>): Promise<string> => "",
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", async () => {
  const { InMemoryDraftRepo } = await import("../../services/capture/src/repo");
  const { CaptureService } = await import("../../services/capture/src/service");
  type P = Record<string, unknown>;
  const bauen = (): InstanceType<typeof CaptureService> =>
    new CaptureService({ repo: new InMemoryDraftRepo(), now: () => box.zeit });
  let svc = bauen();
  box.reset = () => {
    box.zeit = Date.parse("2026-09-01T08:00:00.000Z");
    svc = bauen();
    box.zaehler.get = 0;
    box.zaehler.list = 0;
    box.zaehler.remove = 0;
    box.loeschFehler.clear();
  };
  box.seed = async (p: P) => {
    // Jeder Entwurf eine Minute später als der vorige: die Ordnung „neueste zuerst" ist damit
    // eine Tatsache des Bestands, nicht eine Folge der Einfügereihenfolge.
    box.zeit += 60_000;
    return (await svc.createDraft(p, "u1")).id;
  };
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      drafts: {
        // JOB 3668 (Nachführung): DAS NACHGEBAUTE `GET /api/drafts` TRIMMT DEN PAPIERKORB, wie die
        // echte Route es tut (`visibleDraftsFor`, `services/app/src/routes/capture-routes.ts`).
        // `listDrafts()` liefert seit dem Entwurfs-Papierkorb AUCH die gelöschten Entwürfe — die
        // Referenzprüfung zählt über diese Liste die Anker, und ein getrashter Entwurf muss seinen
        // behalten. Wer einem Menschen eine Liste zeigt, trimmt selbst. Ein Prüfstand, der das
        // nicht täte, zeigte eine Liste, die es in der Anwendung nicht gibt.
        list: vi.fn(async () => {
          box.zaehler.list += 1;
          return (await svc.listDrafts()).filter((d) => !("deletedAt" in d));
        }),
        get: vi.fn(async (id: string) => {
          box.zaehler.get += 1;
          return svc.getDraft(id);
        }),
        create: vi.fn(async (p: P) => {
          box.zeit += 60_000;
          return svc.createDraft(p, "u1");
        }),
        update: vi.fn(async (id: string, p: P) => {
          box.zeit += 60_000;
          return svc.continueDraft(id, p, "u1");
        }),
        remove: vi.fn(async (id: string) => {
          box.zaehler.remove += 1;
          if (box.loeschFehler.has(id)) {
            throw new Error("Entwurf konnte nicht gelöscht werden.");
          }
          return svc.deleteDraft(id);
        }),
        promote: vi.fn(async () => ({ id: "ko-1", title: "egal" })),
      },
      ko: { list: ok([]) },
      knowledge: { check: ok({ status: "pending" }) },
      directory: { list: ok([{ id: "u1", name: "Pia", email: "p@x.de", role: "editor" }]) },
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ stage: "search_on_click" }) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      gaps: { list: ok([]) },
      reasoner: {
        status: ok({ active: false, mode: "off", reachable: "unknown" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        assist: vi.fn(async () => ({})),
      },
    },
  };
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
// Der (oben ersetzte) Endpunktsatz — die Fälle K und L brauchen den Ladeweg als Griff, um eine
// Antwort ZURÜCKZUHALTEN und im gewählten Augenblick auszuliefern.
import { endpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
// Der ECHTE Toast-Viewport der App-Shell — er ist die Fläche, auf der eine gescheiterte Löschung
// erscheint (Fall D). Ohne ihn hielte der Bus die Meldung, und niemand läse sie; eine Attrappe
// hätte nur sich selbst geprüft.
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function Adresse(): JSX.Element {
  const ort = useLocation();
  return createElement("span", { "data-testid": "adresse" }, `${ort.pathname}${ort.search}`);
}

/**
 * Baut die Seite auf und gibt den Abfragespeicher zurück. Fall L braucht ihn: er hängt sich an das
 * Ungültigerklären des Bestands, um die zurückgehaltene Ladeantwort GENAU im Erfolgszweig des
 * Löschens freizugeben.
 */
async function mount(url = "/erfassen"): Promise<QueryClient> {
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
                MemoryRouter,
                { initialEntries: [url] },
                createElement(
                  ImageDescribeProvider,
                  null,
                  createElement(
                    NavGuardProvider,
                    null,
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: "/erfassen",
                        element: createElement(CaptureFrontDoor),
                      }),
                    ),
                    createElement(Adresse),
                  ),
                ),
              ),
              createElement(ToastViewport),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  return qc;
}

function unmount(): void {
  act(() => root.unmount());
  container.remove();
}

function adresse(): string {
  return container.querySelector('[data-testid="adresse"]')?.textContent ?? "";
}

function knopf(name: string): HTMLButtonElement {
  const el = container.querySelector(`[data-testid="${name}"]`);
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${name}" fehlt`);
  }
  return el;
}

function eintraege(): HTMLButtonElement[] {
  return [...container.querySelectorAll('[data-testid="blatt-entwurf-eintrag"]')].filter(
    (e): e is HTMLButtonElement => e instanceof HTMLButtonElement,
  );
}

function titelListe(): string[] {
  return eintraege().map((e) =>
    (e.querySelector('[data-testid="blatt-entwurf-eintrag-titel"]')?.textContent ?? "").trim(),
  );
}

function suchfeld(): HTMLInputElement {
  const el = container.querySelector('[data-testid="entwurfsliste-suche"]');
  if (!(el instanceof HTMLInputElement)) {
    throw new Error("Suchfeld der Entwurfsliste fehlt");
  }
  return el;
}

function sortierwahl(): HTMLSelectElement {
  const el = container.querySelector('[data-testid="entwurfsliste-sortierung"]');
  if (!(el instanceof HTMLSelectElement)) {
    throw new Error("Sortier-Auswahl der Entwurfsliste fehlt");
  }
  return el;
}

/** Der Löschknopf der Zeile eines bestimmten Entwurfs. */
function loeschknopf(kennung: string): HTMLButtonElement {
  const el = container.querySelector(
    `[data-testid="entwurfsliste-loeschen"][data-loeschen="${kennung}"]`,
  );
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error(`Löschknopf für „${kennung}" fehlt`);
  }
  return el;
}

function da(name: string): boolean {
  return container.querySelector(`[data-testid="${name}"]`) !== null;
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

async function tippe(feld: HTMLInputElement, wert: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  await act(async () => {
    setter.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

async function waehle(feld: HTMLSelectElement, wert: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  await act(async () => {
    setter.call(feld, wert);
    feld.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

function titelfeld(): HTMLInputElement {
  const el = container.querySelector('[data-testid="blatt-titel"]');
  if (!(el instanceof HTMLInputElement)) {
    throw new Error("Titelfeld nicht gefunden");
  }
  return el;
}

function editor(): HTMLElement {
  const el = container.querySelector('[role="textbox"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Schreibfeld nicht gefunden");
  }
  return el;
}

/** Die Liste aufklappen — derselbe benannte Zugang, den Pedi drückt. */
async function listeOeffnen(): Promise<void> {
  await click(knopf("blatt-werkzeug-entwuerfe"));
}

/** Ein Menüeintrag des „…"-Menüs, gesucht nach seinem sichtbaren Wort. */
function menueEintrag(wort: string): HTMLButtonElement {
  const treffer = [...container.querySelectorAll('[role="menuitem"]')].find(
    (e): e is HTMLButtonElement =>
      e instanceof HTMLButtonElement && (e.textContent ?? "").trim() === wort,
  );
  if (!treffer) {
    throw new Error(`Menüeintrag „${wort}" fehlt`);
  }
  return treffer;
}

/**
 * Der ZWEITE Weg aus §4b.4: „Eingabe verwerfen" im Wurzelstand desselben „…"-Menüs. Er wird hier
 * WIRKLICH gedrückt (bens Korrekturpflicht 2) — Runde 1 hatte ihn nur beim Wort genommen.
 * Das Menü wird dafür geschlossen und neu geöffnet: das Schliessen setzt die Unterfläche zurück,
 * und im Wurzelstand steht dieser Eintrag.
 */
async function eingabeVerwerfen(): Promise<void> {
  const werkzeug = knopf("blatt-werkzeug-mehr");
  if (container.querySelector('[data-testid="blatt-menue-mehr"]') !== null) {
    await click(werkzeug);
  }
  await click(werkzeug);
  const eintrag = menueEintrag(i18n.t("fd.discardInput"));
  expect(eintrag.disabled, `„${i18n.t("fd.discardInput")}" ist gesperrt`).toBe(false);
  await click(eintrag);
}

/**
 * Der Tabulatorlauf des Dokuments in DOM-Reihenfolge (Fall H). jsdom bewegt den Fokus bei einem
 * Tabulator-Ereignis NICHT selbst — die Reihenfolge wird deshalb aus dem Dokument gelesen und
 * Schritt für Schritt angefahren. Was das misst: dass jedes Glied des Weges ein echtes, nicht
 * gesperrtes und nicht aus dem Lauf genommenes Bedienelement ist und in der erwarteten Ordnung
 * steht. Was es NICHT misst: das Verhalten eines echten Browsers — dafür stehen die
 * Tabulatur-Sonden unter `tests-smoke/`.
 */
function tabulatorlauf(): HTMLElement[] {
  const auswahl =
    'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
  return [...container.querySelectorAll(auswahl)].filter((e): e is HTMLElement => {
    if (!(e instanceof HTMLElement) || e.tabIndex < 0 || e.hidden) {
      return false;
    }
    return !(e as HTMLElement & { disabled?: boolean }).disabled;
  });
}

/** Einen Schritt weiter tabben — und der Fokus geht wirklich mit. */
function tab(von: HTMLElement): HTMLElement {
  const lauf = tabulatorlauf();
  const naechster = lauf[lauf.indexOf(von) + 1];
  if (!naechster) {
    throw new Error("der Tabulatorlauf endet vor dem erwarteten Element");
  }
  naechster.focus();
  return naechster;
}

/**
 * Die Antwort auf `GET /drafts/<id>` zurückhalten. Ihr INHALT steht schon fest, bevor gelöscht
 * wird — genau so ist eine Antwort, die schon unterwegs ist. Zurück kommt der Befehl, sie
 * auszuliefern.
 */
async function ladeantwortZurueckhalten(id: string): Promise<() => void> {
  const echt = vi.mocked(endpoints.drafts.get).getMockImplementation();
  if (!echt) {
    throw new Error("der Ladeweg der Entwürfe ist nicht ersetzt");
  }
  const unterwegs = await echt(id);
  let freigeben: (() => void) | null = null;
  vi.mocked(endpoints.drafts.get).mockImplementationOnce(
    () =>
      new Promise((aufloesen) => {
        freigeben = () => aufloesen(unterwegs);
      }),
  );
  return () => {
    if (!freigeben) {
      throw new Error("die Ladeantwort wurde gar nicht angefordert");
    }
    freigeben();
  };
}

// DREI ENTWÜRFE MIT ABSICHT: „Ventil X" steht NUR im Rumpf des zweiten (Suche über INHALT),
// „Anlaufprüfung" nur im Titel des ersten (Suche über TITEL). Die Titel-Anfangsbuchstaben (A, N, V)
// unterscheiden sich von der Speicherreihenfolge, damit „Titel A→Z" messbar umordnet.
const ERSTER = {
  title: "NIT-Anlaufprüfung Spritzzone",
  bodyHtml: "<p>Vor jedem Anlauf die Schmierstellen prüfen.</p>",
  type: "best_practice",
  category: "Anlage 1",
};
const ZWEITER = {
  title: "Überdruck an der Presse",
  bodyHtml: "<p>Bei Überdruck <em>Ventil X</em> schließen.</p>",
  type: "best_practice",
  category: "Anlage 2",
};
const DRITTER = {
  title: "Ablauf der Schichtübergabe",
  bodyHtml: "<p>Übergabe protokollieren.</p>",
  type: "best_practice",
  category: "Anlage 3",
};

/** Die drei Entwürfe, ältester zuerst gespeichert. */
async function dreiEntwuerfe(): Promise<{ erster: string; zweiter: string; dritter: string }> {
  return {
    erster: await box.seed(ERSTER),
    zweiter: await box.seed(ZWEITER),
    dritter: await box.seed(DRITTER),
  };
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  // Suche und Sortierung überleben PRO BROWSER (localStorage) — jeder Fall startet deshalb an der
  // Vorgabe, sonst filterte der vorige Fall den nächsten.
  localStorage.clear();
  box.reset();
});

afterEach(async () => {
  unmount();
  await i18n.changeLanguage("de");
  localStorage.clear();
  vi.clearAllMocks();
});

describe("JOB 3426 · die Entwurfsliste des Editors lässt sich verwalten", () => {
  it("A: die Suche findet über den TITEL und über den INHALT", async () => {
    const { zweiter } = await dreiEntwuerfe();
    await mount();
    await listeOeffnen();
    expect(titelListe()).toHaveLength(3);

    // TITEL: ein Wort, das nur in einer Überschrift steht.
    await tippe(suchfeld(), "Anlaufprüfung");
    expect(titelListe()).toEqual([ERSTER.title]);

    // INHALT: „Ventil X" steht in KEINEM Titel, nur im Rumpf des zweiten Entwurfs — und der Rumpf
    // ist ausgezeichnet (`<em>`), die Suche liest ihn also über die kanonische Klartext-Reduktion.
    await tippe(suchfeld(), "Ventil X");
    expect(titelListe()).toEqual([ZWEITER.title]);
    expect(eintraege()[0]?.getAttribute("data-entwurf")).toBe(zweiter);

    // Nichts gefunden heisst nicht „keine Entwürfe": die Fläche sagt, dass der FILTER leer läuft.
    await tippe(suchfeld(), "Zylinderkopfdichtung");
    expect(titelListe()).toEqual([]);
    expect(container.textContent).toContain(i18n.t("capture.draftEmptyFiltered"));
    expect(da("blatt-entwuerfe-leer")).toBe(false);

    // Leerer Filter = alle (der Vertrag von `draftListView`).
    await tippe(suchfeld(), "");
    expect(titelListe()).toHaveLength(3);
  });

  it("B: Vorgabe ist neueste zuerst — umschaltbar auf älteste und Titel A→Z", async () => {
    await dreiEntwuerfe();
    await mount();
    await listeOeffnen();

    // §4b.3: die Vorgabe ist gemessen, nicht behauptet — der dritte Entwurf ist der jüngste.
    expect(sortierwahl().value).toBe("recent");
    expect(titelListe()).toEqual([DRITTER.title, ZWEITER.title, ERSTER.title]);

    await waehle(sortierwahl(), "oldest");
    expect(titelListe()).toEqual([ERSTER.title, ZWEITER.title, DRITTER.title]);

    await waehle(sortierwahl(), "title");
    expect(titelListe()).toEqual([DRITTER.title, ERSTER.title, ZWEITER.title]);
  });

  it('C: Löschen fragt zurück — „Behalten" lässt alles stehen, „Löschen" entfernt wirklich', async () => {
    const { zweiter } = await dreiEntwuerfe();
    await mount();
    await listeOeffnen();

    // Der Löschknopf allein löscht NICHTS — er stellt die Frage.
    await click(loeschknopf(zweiter));
    expect(box.zaehler.remove).toBe(0);
    expect(container.textContent).toContain(i18n.t("capture.discardDraftQ"));
    expect(titelListe()).toHaveLength(3);

    // ABBRUCH: „Behalten" nimmt die Frage zurück und rührt den Bestand nicht an.
    await click(knopf("entwurfsliste-loeschen-nein"));
    expect(box.zaehler.remove).toBe(0);
    expect(da("entwurfsliste-loeschen-ja")).toBe(false);
    expect(titelListe()).toHaveLength(3);

    // BESTÄTIGUNG: erst jetzt geht der Löschbefehl heraus.
    await click(loeschknopf(zweiter));
    await click(knopf("entwurfsliste-loeschen-ja"));
    expect(box.zaehler.remove).toBe(1);
    expect(titelListe()).toEqual([DRITTER.title, ERSTER.title]);

    // UND ER BLEIBT WEG: die Liste beim Wiederöffnen ist der Serverbestand, nicht ein Anzeigerest.
    unmount();
    await mount();
    await listeOeffnen();
    expect(titelListe()).toEqual([DRITTER.title, ERSTER.title]);
  });

  it("D: ein fehlgeschlagener Löschlauf lässt den Eintrag stehen", async () => {
    const { zweiter } = await dreiEntwuerfe();
    box.loeschFehler.add(zweiter);
    await mount();
    await listeOeffnen();

    await click(loeschknopf(zweiter));
    await click(knopf("entwurfsliste-loeschen-ja"));

    // Der Versuch lief WIRKLICH (sonst prüfte dieser Fall nichts) — und er ging schief.
    expect(box.zaehler.remove).toBe(1);
    expect(titelListe()).toHaveLength(3);
    expect(titelListe()).toContain(ZWEITER.title);
    // Die Störung wird gesagt, nicht verschwiegen. Die Meldung hängt am Toast-Bereich des
    // Dokuments, nicht in der Menüfläche — gesucht wird deshalb im ganzen Dokument.
    expect(document.body.textContent).toContain("Entwurf konnte nicht gelöscht werden.");
  });

  it("E: der offene Entwurf bleibt hervorgehoben, und sein Hinweis steht", async () => {
    const { zweiter } = await dreiEntwuerfe();
    await mount(`/erfassen?draft=${zweiter}`);
    await listeOeffnen();

    // Der Hinweis aus §3 („du schreibst in einen bestehenden Entwurf") steht unverändert.
    expect(da("blatt-entwurf-offen")).toBe(true);
    expect(container.textContent).toContain(i18n.t("fd.draftOpen"));

    const zeile = eintraege().find((e) => e.getAttribute("data-entwurf") === zweiter);
    expect(zeile, "der offene Entwurf steht nicht in der Liste").toBeDefined();
    // Hervorgehoben, und zwar LESBAR: die Fettung allein sagt einem Screenreader nichts.
    expect(zeile?.className ?? "").toContain("font-semibold");
    expect(zeile?.textContent ?? "").toContain(i18n.t("capture.editingBadge"));
    // Und wirklich nur dieser eine.
    const andere = eintraege().filter((e) => e.getAttribute("data-entwurf") !== zweiter);
    for (const e of andere) {
      expect(e.textContent ?? "").not.toContain(i18n.t("capture.editingBadge"));
    }
  });

  it("F: wird der OFFENE Entwurf gelöscht, verliert die Adresse ihn — der Text bleibt am Blatt", async () => {
    const { zweiter } = await dreiEntwuerfe();
    await mount(`/erfassen?draft=${zweiter}`);
    expect(titelfeld().value).toBe(ZWEITER.title);
    await listeOeffnen();

    await click(loeschknopf(zweiter));
    await click(knopf("entwurfsliste-loeschen-ja"));

    // Der Entwurf ist weg — die Adresse darf ihn nicht weiter nennen, sonst holte der Ladeweg
    // gleich einen gelöschten Stand.
    expect(adresse()).toBe("/erfassen");
    expect(da("blatt-entwurf-offen")).toBe(false);
    // Was auf dem Blatt steht, ist Pedis Text. Das Löschen eines gespeicherten Standes räumt ihn
    // NICHT weg — das wäre ein stiller Verlust ohne Rückfrage danach.
    expect(titelfeld().value).toBe(ZWEITER.title);
    expect(editor().innerHTML).toContain("Ventil X");
  });

  it('G: „Eingabe verwerfen" und „Löschen" — zwei Wörter, zwei Wirkungen', async () => {
    const { zweiter } = await dreiEntwuerfe();
    await mount(`/erfassen?draft=${zweiter}`);
    expect(titelfeld().value).toBe(ZWEITER.title);
    await listeOeffnen();

    // §4b.4 · DIE WÖRTER: dasselbe Menü trägt beide Wege. Sie dürfen nicht dasselbe Wort tragen.
    const loeschwort = (loeschknopf(zweiter).getAttribute("aria-label") ?? "").trim();
    const verwerfenWort = i18n.t("fd.discardInput").trim();
    expect(loeschwort.length).toBeGreaterThan(0);
    expect(loeschwort.toLowerCase()).not.toBe(verwerfenWort.toLowerCase());
    expect(verwerfenWort.toLowerCase()).not.toContain(loeschwort.toLowerCase());
    // Und die Rückfrage des Löschens spricht vom Löschen, nicht vom Verwerfen.
    await click(loeschknopf(zweiter));
    expect(container.textContent).toContain(i18n.t("capture.discardDraftQ"));
    await click(knopf("entwurfsliste-loeschen-nein"));

    // ==========================================================================================
    // §4b.4 · DIE WIRKUNG — und zwar GEDRÜCKT, nicht behauptet (bens Korrekturpflicht 2).
    // ==========================================================================================
    // Ändern → „Eingabe verwerfen" bestätigen → denselben Entwurf wieder öffnen. Was dabei
    // verloren geht, ist die EINGABE; was bleibt, ist der gespeicherte Entwurf.
    const frage = vi.spyOn(window, "confirm").mockReturnValue(true);
    await tippe(titelfeld(), "Überdruck an der Presse — Fassung Pedi");
    expect(titelfeld().value).toBe("Überdruck an der Presse — Fassung Pedi");

    await eingabeVerwerfen();
    // Verworfen wird nur mit Rückfrage — genau einmal gefragt, nicht wortlos geleert.
    expect(frage).toHaveBeenCalledTimes(1);
    expect(frage).toHaveBeenCalledWith(i18n.t("fd.confirmDiscard"));
    // Das BLATT ist leer und der Ort ein neues Blatt …
    expect(titelfeld().value).toBe("");
    expect(adresse()).toBe("/erfassen");
    // … der BESTAND aber ist unangetastet: kein einziger Löschbefehl ist gelaufen.
    expect(box.zaehler.remove).toBe(0);

    // DIE ORIGINALFASSUNG STEHT WIEDER DA — nicht die verworfene Änderung.
    await listeOeffnen();
    const zeile = eintraege().find((e) => e.getAttribute("data-entwurf") === zweiter);
    expect(zeile, "der Entwurf fehlt in der Liste").toBeDefined();
    await click(zeile as HTMLButtonElement);
    expect(titelfeld().value).toBe(ZWEITER.title);
    expect(editor().innerHTML).toContain("Ventil X");
    // Das Wiederöffnen war kein zweiter Verlust: gefragt wurde nicht noch einmal (das Blatt war
    // sauber), und gelöscht wurde nach wie vor nichts.
    expect(frage).toHaveBeenCalledTimes(1);
    expect(box.zaehler.remove).toBe(0);
    // Das Öffnen schliesst das Menü (`entwurfOeffnen`) — für den Blick in den Bestand wird es
    // wieder aufgeklappt: alle drei Entwürfe stehen unverändert da.
    await listeOeffnen();
    expect(titelListe()).toHaveLength(3);
    expect(titelListe()).toContain(ZWEITER.title);
    frage.mockRestore();
  });

  it("H: der ganze Weg — Suche, Sortierung, Eintrag, Löschen, Rückfrage — liegt im Tabulatorlauf", async () => {
    const { zweiter } = await dreiEntwuerfe();
    await mount();
    await listeOeffnen();

    // §4b.6: NICHT „jedes Element lässt sich anfokussieren", sondern: sie stehen in EINER Ordnung
    // hintereinander, und man erreicht vom Suchfeld aus jedes folgende Glied mit dem Tabulator.
    const start = suchfeld();
    start.focus();
    expect(document.activeElement).toBe(start);
    const nachSuche = tab(start);
    expect(nachSuche).toBe(sortierwahl());
    const nachSortierung = tab(nachSuche);
    expect(nachSortierung).toBe(eintraege()[0]);
    const nachEintrag = tab(nachSortierung);
    // Der Löschknopf der ERSTEN Zeile folgt unmittelbar auf ihren Öffnen-Knopf — nicht am Ende
    // aller Zeilen, sonst müsste man sich durch die ganze Liste tabben, um eine Zeile zu löschen.
    expect(nachEintrag).toBe(loeschknopf(eintraege()[0]?.getAttribute("data-entwurf") ?? "fehlt"));

    // Bis zur Rückfrage — mit der Tastatur, ohne Maus. Enter auf einer echten `<button>` löst im
    // Browser den Klick aus; jsdom tut das nicht selbst, deshalb steht die Bauform hier als
    // Zusage (`type="button"`, im Lauf, nicht gesperrt) neben dem ausgelösten Klick.
    const loeschen = loeschknopf(zweiter);
    loeschen.focus();
    expect(loeschen.type).toBe("button");
    expect(document.activeElement).toBe(loeschen);
    await click(loeschen);

    // Und die Rückfrage ist ebenfalls im Lauf zu Ende zu bringen — in DIESER Ordnung: erst
    // „Behalten", dann „Löschen". Wer sich blind durchtabbt, landet nicht zuerst auf dem Weg, der
    // etwas wegnimmt.
    const nein = knopf("entwurfsliste-loeschen-nein");
    nein.focus();
    expect(document.activeElement).toBe(nein);
    expect(nein.type).toBe("button");
    const ja = tab(nein);
    expect(ja).toBe(knopf("entwurfsliste-loeschen-ja"));
    expect((ja as HTMLButtonElement).type).toBe("button");

    // Mit der Tastatur zu Ende gebracht: „Löschen" wirkt wirklich.
    await click(ja as HTMLButtonElement);
    expect(box.zaehler.remove).toBe(1);
    expect(titelListe()).toEqual([DRITTER.title, ERSTER.title]);
  });

  it("I: DE und EN — Suche, Sortierung und Rückfrage tragen übersetzte Worte", async () => {
    const { zweiter } = await dreiEntwuerfe();
    await mount();
    await listeOeffnen();
    const deSuche = suchfeld().getAttribute("aria-label");
    const deSortierung = sortierwahl().getAttribute("aria-label");
    await click(loeschknopf(zweiter));
    const deFrage = knopf("entwurfsliste-loeschen-ja").textContent ?? "";
    expect(deSuche).toBe(i18n.t("capture.draftSearch"));
    expect(deSortierung).toBe(i18n.t("capture.draftSortLabel"));
    expect(deFrage.trim()).toBe(i18n.t("capture.discardDraftYes"));

    unmount();
    await i18n.changeLanguage("en");
    await mount();
    await listeOeffnen();
    const enSuche = suchfeld().getAttribute("aria-label");
    const enSortierung = sortierwahl().getAttribute("aria-label");
    await click(loeschknopf(zweiter));
    const enFrage = knopf("entwurfsliste-loeschen-ja").textContent ?? "";
    expect(enSuche).toBe(i18n.t("capture.draftSearch"));
    expect(enSortierung).toBe(i18n.t("capture.draftSortLabel"));
    expect(enFrage.trim()).toBe(i18n.t("capture.discardDraftYes"));
    // Übersetzt heisst: wirklich ein anderer Wortlaut, nicht derselbe Schlüssel zweimal.
    expect(enSuche).not.toBe(deSuche);
    expect(enSortierung).not.toBe(deSortierung);
    expect(enFrage).not.toBe(deFrage);
    // Und die Sortier-Auswahl selbst ist übersetzt, nicht nur ihre Beschriftung.
    expect(sortierwahl().textContent ?? "").toContain(i18n.t("capture.draftSort.recent"));
  });

  it("J: der Weg von der Startseite (`?entwuerfe=1`) führt zu genau dieser Liste", async () => {
    await dreiEntwuerfe();
    await mount("/erfassen?entwuerfe=1");

    // OHNE einen einzigen Klick: die Liste steht offen — MIT Suche, Sortierung und Löschweg.
    expect(container.querySelector('[data-testid="blatt-menue-mehr"]')).not.toBeNull();
    expect(titelListe()).toHaveLength(3);
    expect(da("entwurfsliste-suche")).toBe(true);
    expect(da("entwurfsliste-sortierung")).toBe(true);
    expect(container.querySelectorAll('[data-testid="entwurfsliste-loeschen"]')).toHaveLength(3);
    // Und der Öffnungsbefehl bleibt kein Ladebefehl.
    expect(box.zaehler.get).toBe(0);
    expect(titelfeld().value).toBe("");
  });

  // ============================================================================================
  // K und L — DIE ÜBERLAPPUNG VON LADEN UND LÖSCHEN (JOB 3426 R2, bens Korrekturpflicht 1).
  // ============================================================================================
  // bens Gegenprobe an Runde 1: Ladeantwort zurückhalten, denselben Entwurf bestätigt löschen,
  // Ladeantwort freigeben → „bereits gelöschter Entwurf wird wieder als offen geführt". Zwei
  // verschiedene Löcher steckten darin, und sie werden hier EINZELN gemessen — sonst hielte jede
  // der beiden Absicherungen den anderen Fall grün und keine wäre für sich prüfbar:
  //   K  Die Aufräumung hing an `activeDraftId`, und die ist mitten im Laden noch `null`: die
  //      Adresse behielt den gelöschten Entwurf. Gemessen an der ADRESSE.
  //   L  Die Antwort trifft im selben Zug wie die Löschbestätigung ein, bevor irgendein Bildaufbau
  //      den Ladeeffekt abräumen konnte. Gemessen am TITEL, der zurückkäme.

  it("K: wird der Entwurf gelöscht, WÄHREND er lädt, verliert die Adresse ihn", async () => {
    const { zweiter } = await dreiEntwuerfe();
    const ladeantwortAusliefern = await ladeantwortZurueckhalten(zweiter);
    await mount(`/erfassen?draft=${zweiter}`);

    // Ausgangslage, gemessen: der Ladevorgang hängt. Das Blatt sagt das ausdrücklich, und die
    // Adresse nennt den Entwurf — die aktive Kennung gibt es aber noch nicht.
    expect(da("blatt-nicht-bereit")).toBe(true);
    expect(adresse()).toBe(`/erfassen?draft=${zweiter}`);
    expect(titelfeld().value).toBe("");

    await listeOeffnen();
    expect(da("blatt-entwurf-offen")).toBe(false);
    await click(loeschknopf(zweiter));
    await click(knopf("entwurfsliste-loeschen-ja"));
    expect(box.zaehler.remove).toBe(1);

    // Erst JETZT trifft die alte Ladeantwort ein.
    await act(async () => {
      ladeantwortAusliefern();
      await flush();
    });

    // Die Adresse darf einen gelöschten Entwurf nicht weiter nennen — ein Neuladen liefe sonst in
    // „Der Entwurf konnte nicht geladen werden".
    expect(adresse()).toBe("/erfassen");
    expect(titelfeld().value).toBe("");
    expect(da("blatt-entwurf-offen")).toBe(false);
    // Und die Sperre ist wieder auf: ein verworfener Ladevorgang lässt kein totes Blatt zurück.
    expect(da("blatt-nicht-bereit")).toBe(false);
    expect(titelListe()).toEqual([DRITTER.title, ERSTER.title]);

    // Er bleibt weg — auch beim Wiederöffnen der Seite.
    unmount();
    await mount();
    await listeOeffnen();
    expect(titelListe()).toEqual([DRITTER.title, ERSTER.title]);
  });

  it("L: die Ladeantwort im SELBEN Zug wie die Löschbestätigung bringt den Entwurf nicht zurück", async () => {
    const { zweiter } = await dreiEntwuerfe();
    const ladeantwortAusliefern = await ladeantwortZurueckhalten(zweiter);
    const qc = await mount(`/erfassen?draft=${zweiter}`);
    expect(da("blatt-nicht-bereit")).toBe(true);

    // DIE ENGE REIHENFOLGE, und zwar gemessen statt gehofft: die Antwort wird in dem Augenblick
    // ausgeliefert, in dem der Löschweg den Entwurfsbestand für ungültig erklärt — also MITTEN im
    // Erfolgszweig, vor jedem neuen Bildaufbau. Ein `cancelled` des Ladeeffekts gibt es dann noch
    // nicht; nur das Merkzettelchen des laufenden Ladevorgangs kann hier noch helfen.
    const echtesUngueltig = qc.invalidateQueries.bind(qc);
    let ausgeliefert = false;
    qc.invalidateQueries = ((...args: Parameters<typeof echtesUngueltig>) => {
      if (!ausgeliefert) {
        ausgeliefert = true;
        ladeantwortAusliefern();
      }
      return echtesUngueltig(...args);
    }) as typeof qc.invalidateQueries;

    await listeOeffnen();
    await click(loeschknopf(zweiter));
    await click(knopf("entwurfsliste-loeschen-ja"));
    expect(ausgeliefert, "die Ladeantwort wurde nie freigegeben").toBe(true);
    expect(box.zaehler.remove).toBe(1);

    // Der gelöschte Stand kommt NICHT zurück aufs Blatt.
    expect(titelfeld().value).toBe("");
    expect(editor().innerHTML).not.toContain("Ventil X");
    expect(da("blatt-entwurf-offen")).toBe(false);
    expect(adresse()).toBe("/erfassen");
    expect(titelListe()).toEqual([DRITTER.title, ERSTER.title]);

    // Und es steht auch keine Störung da, die es nicht gibt: quittiert wurde die Löschung.
    expect(document.body.textContent).toContain(i18n.t("capture.draftDiscarded"));
    expect(document.body.textContent).not.toContain(i18n.t("fd.errLoadFailed"));
  });
});
