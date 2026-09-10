// @vitest-environment jsdom
// ================================================================================================
// JOB 3503 · ENTWUERFE-MENUEPUNKT — DER PUNKT IM KOPFBAND UND DIE SEITE DAHINTER.
// ================================================================================================
//
// AUSGANGSLAGE (Auftrag §1, Pedis Wortlaut über Codex vom 10.09.2026): „Meine Entwürfe“ steckte im
// Editor hinter einem Aufklapper („Mehr“ → „Entwürfe“) und im Arbeitsraum in einer zugeklappten
// Karte. Pedi findet sie nicht. Verlangt ist ein EIGENER sichtbarer Menüpunkt oben in der Topbar,
// der eine eigenständige Übersicht öffnet — aufgebaut wie die Bibliothek.
//
// GEMESSEN WIRD AM ECHTEN PRODUKTPFAD: die echten Kopfband-Bauteile (`KopfbandPunkte` für breit,
// `KopfbandPunkteListe` für den schmalen Drawer — die Hülle rendert nie beide gleichzeitig,
// `Kopfband.tsx:75` / `AppShell.tsx`), der echte Router (`AppRoutes` samt Rollen-Gate `Guarded`) und
// der echte Entwurfsdienst hinter den Endpunkten (CaptureService + InMemoryDraftRepo). KEINE
// Attrappe der Seite: was hier gedrückt wird, ist der Weg, den auch Pedi drückt.
//
// DIE LISTE IST DIESELBE WIE IM EDITOR UND IM ARBEITSRAUM. `components/CaptureDraftList.tsx` trägt
// seit diesem Auftrag eine dritte Darreichung `variant="seite"` — dieselben Zeilen und dieselbe
// Such-, Sortier- und Löschbedienung, nur ohne Karten-Rahmen und ohne Aufklapper. Gegriffen wird an
// ihren neutralen Ankern (`entwurfsliste-…`), die auf allen Flächen dasselbe messen; die Kennung je
// Zeile steht am Löschknopf (`[data-loeschen="<id>"]`, dort seit JOB 3426).
//
// A  der Punkt STEHT im Kopfband — mit seinem Namen, an seinem Platz, DE und EN
// B  der Klick öffnet `/entwuerfe`; die Hülle nennt die Seite, und die Liste steht ohne Zutun da
// C  die Suche filtert dort (Titel UND Inhalt) — dieselbe Bedienung wie im Editor
// D  die Sortierung ordnet dort um (Vorgabe „zuletzt gespeichert“, umschaltbar auf Titel A→Z)
// E  Löschen fragt zurück: „Behalten“ löscht nichts, „Löschen“ entfernt wirklich
// F  Laden, Leere und Störung sind drei unterschiedene Auskünfte — und die Störung leert nichts
// G  der ganze Weg ist mit der Tastatur bedienbar
// H  die Rechte gelten wie am Nachbarpunkt: eine Betrachterin sieht ihn nicht und kommt nicht hin
// I  der Punkt steht auch im schmalen Drawer (390 px) — dort trägt ihn `KopfbandPunkteListe`
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  /** Die Uhr des Dienstes — jeder Entwurf bekommt seinen eigenen, gemessenen Zeitpunkt. */
  zeit: 0,
  /** Rolle der angemeldeten Sitzung (Fall H schaltet sie auf „viewer“). */
  rolle: "experte",
  /** Fall F: der Bestandsabruf scheitert. */
  listeFehler: false,
  /**
   * Fall F: der Bestandsabruf wird ANGEHALTEN, bis `freigeben()` gerufen wird.
   *
   * BEN, Runde 2 (Korrekturpflicht 1): „Ein Testabschnitt mit ‚Laden‘ im Titel gilt ohne Assertion
   * während eines ausstehenden Abrufs nicht als Ladebeleg." Er hat es gemessen — mit abgeschaltetem
   * Ladehinweis blieben alle Fälle der Runde 2 grün. Der Ladezustand ist nur zu belegen, wenn der
   * Abruf im Augenblick der Messung WIRKLICH offen ist; deshalb dieser Griff.
   */
  angehalten: false,
  freigeben: (): void => {},
  loeschFehler: new Set<string>(),
  seed: async (_p: Record<string, unknown>): Promise<string> => "",
  bestand: async (): Promise<unknown[]> => [],
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: box.rolle })),
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
    box.rolle = "experte";
    box.listeFehler = false;
    box.angehalten = false;
    box.freigeben = () => {};
    box.loeschFehler.clear();
  };
  box.seed = async (p: P) => {
    // Jeder Entwurf eine Minute später als der vorige: „zuletzt gespeichert“ ist damit eine
    // Tatsache des Bestands und keine Folge der Einfügereihenfolge.
    box.zeit += 60_000;
    return (await svc.createDraft(p, "u1")).id;
  };
  box.bestand = async () => svc.listDrafts();
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      drafts: {
        list: vi.fn(async () => {
          if (box.listeFehler) {
            throw new Error("Entwürfe konnten nicht geladen werden.");
          }
          if (box.angehalten) {
            // Der Abruf bleibt hier stehen, bis der Fall ihn freigibt. Solange er steht, ist
            // `useDrafts()` wirklich `isLoading` — die Fläche kann sich nicht auf einen
            // zwischengespeicherten Bestand stützen.
            await new Promise<void>((aufloesen) => {
              box.freigeben = () => {
                box.angehalten = false;
                aufloesen();
              };
            });
          }
          return svc.listDrafts();
        }),
        get: vi.fn(async (id: string) => svc.getDraft(id)),
        create: vi.fn(async (p: P) => svc.createDraft(p, "u1")),
        update: vi.fn(async (id: string, p: P) => svc.continueDraft(id, p, "u1")),
        remove: vi.fn(async (id: string) => {
          if (box.loeschFehler.has(id)) {
            throw new Error("Entwurf konnte nicht gelöscht werden.");
          }
          return svc.deleteDraft(id);
        }),
        promote: ok({ id: "ko-1", title: "egal" }),
      },
      directory: { list: ok([{ id: "u1", name: "Pia", email: "p@x.de", role: "editor" }]) },
      // Die Zähler des Kopfbands: leer, denn dieser Fall dreht sich um einen PUNKT, nicht um Zahlen.
      validation: { board: ok([]), settings: ok({ defaultNeededValidations: 3 }) },
      conflicts: { list: ok([]) },
      duplicates: { list: ok([]) },
      lifecycle: { pending: ok([]) },
      gaps: {
        list: ok([]),
        summary: ok({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } }),
      },
      features: { get: ok({ features: {} }) },
      external: { policy: ok(null) },
      reasoner: { status: ok({ active: false, mode: "off" }), config: ok(null) },
      notifications: { list: ok([]), markSeen: ok({ unseenCount: 0 }) },
      ko: { list: ok([]) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { AppRoutes } from "../../apps/web/src/routes";
import { KopfbandPunkte, KopfbandPunkteListe } from "../../apps/web/src/shell/KopfbandPunkte";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: Root;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

function Adresse(): JSX.Element {
  const ort = useLocation();
  return createElement("span", { "data-testid": "adresse" }, `${ort.pathname}${ort.search}`);
}

/**
 * Der echte Weg: Kopfband-Punkte, Drawer-Zeilen und der echte Router unter denselben Anbietern.
 *
 * Der Einstieg ist `/hilfe` und nicht `/entwuerfe`: Fall B soll den KLICK messen, und dafür muss die
 * Seite vorher eine andere sein. `/hilfe` ist ab Betrachter offen und holt keine Daten — die
 * Messung dreht sich dadurch um den Weg und nicht um die Startseite.
 *
 * `erwarte` ist der Anker, an dem die gewünschte Seite erkennbar ist. Jede Seite wird nachgeladen
 * (`routes.tsx`, `lazy(() => import(…))`); ohne dieses Warten stünde die Ladefläche im Baum, und ein
 * sofortiges `querySelector` meldete „fehlt“, obwohl nur der Import noch lief. Fall H übergibt
 * bewusst KEINEN Anker — dort SOLL die Seite ausbleiben.
 */
async function montiere(pfad = "/hilfe", erwarte?: string): Promise<QueryClient> {
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
                { initialEntries: [pfad] },
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(KopfbandPunkte),
                  createElement(KopfbandPunkteListe),
                  createElement(AppRoutes),
                  createElement(Adresse),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await flush();
  if (erwarte !== undefined) {
    await warteAuf(erwarte);
    await flush();
  }
  return qc;
}

/**
 * Auf einen Anker WARTEN statt ihn sofort zu verlangen — gewartet wird auf ein ECHTES Ereignis (der
 * Anker erscheint), nicht auf eine feste Zahl von Runden. Nach der Frist ist der Fall rot.
 */
async function warteAuf<T extends Element>(name: string, frist = 20_000): Promise<T> {
  const ende = Date.now() + frist;
  for (;;) {
    const el = container.querySelector<T>(`[data-testid="${name}"]`);
    if (el) {
      return el;
    }
    if (Date.now() > ende) {
      throw new Error(`Anker „${name}“ kam nicht innerhalb von ${frist} ms`);
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
}

/** Dasselbe Warten, aber auf einen sichtbaren SATZ statt auf einen Anker (die Sperrkarte hat keinen). */
async function warteAufText(text: string, frist = 20_000): Promise<void> {
  const ende = Date.now() + frist;
  while (!(container.textContent ?? "").includes(text)) {
    if (Date.now() > ende) {
      throw new Error(`„${text}“ kam nicht innerhalb von ${frist} ms`);
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
}

function abbauen(): void {
  act(() => root.unmount());
  container.remove();
}

function adresse(): string {
  return container.querySelector('[data-testid="adresse"]')?.textContent ?? "";
}

function punkt(id: string): HTMLAnchorElement | null {
  return container.querySelector<HTMLAnchorElement>(`[data-kopfband-punkt="${id}"]`);
}

function punktIds(): string[] {
  return [...container.querySelectorAll("[data-kopfband-punkt]")].map(
    (a) => a.getAttribute("data-kopfband-punkt") ?? "",
  );
}

function anker<T extends Element>(name: string): T {
  const el = container.querySelector<T>(`[data-testid="${name}"]`);
  if (!el) {
    throw new Error(`Anker „${name}“ fehlt`);
  }
  return el;
}

function fehlt(name: string): boolean {
  return container.querySelector(`[data-testid="${name}"]`) === null;
}

/** Die Fläche der Seite — alles Weitere wird DARIN gesucht, nie im Kopfband daneben. */
function seite(): HTMLElement {
  return anker<HTMLElement>("page-entwuerfe");
}

/** Die Zeilen der Entwurfsliste, in Anzeigereihenfolge. */
function zeilen(): HTMLLIElement[] {
  return [...seite().querySelectorAll("ul.divide-y > li")].filter(
    (li): li is HTMLLIElement => li instanceof HTMLLIElement,
  );
}

/** Die Titel der Zeilen — jede Zeile trägt ihren Titel in einem eigenen Träger. */
function titelListe(): string[] {
  return [...seite().querySelectorAll('[data-testid="entwurfsliste-eintrag-titel"]')].map((el) =>
    (el.textContent ?? "").trim(),
  );
}

/** Die Zeile GENAU dieses Entwurfs — gefunden über den Löschknopf, der seine Kennung trägt. */
function zeileVon(id: string): HTMLLIElement | null {
  const knopf = seite().querySelector(`[data-loeschen="${id}"]`);
  const li = knopf?.closest("li");
  return li instanceof HTMLLIElement ? li : null;
}

function loeschKnopf(id: string): HTMLButtonElement {
  const el = seite().querySelector<HTMLButtonElement>(`[data-loeschen="${id}"]`);
  if (!el) {
    throw new Error(`Löschknopf für „${id}“ fehlt`);
  }
  return el;
}

/** Der „Fortsetzen“-Knopf einer Zeile — er trägt keinen Anker, aber sein Wort. */
function fortsetzenKnopf(li: HTMLLIElement): HTMLButtonElement {
  const wort = i18n.t("capture.resume");
  const el = [...li.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes(wort));
  if (!el) {
    throw new Error(`„${wort}“ fehlt in der Zeile`);
  }
  return el;
}

/**
 * Ein Klick, wie ein Zeiger ihn erzeugt: `mousedown`, `mouseup`, `click` — in dieser Ordnung.
 *
 * BEN, Runde 2 (Prüflücke 6): der bisherige Helfer erzeugte NUR `click`. Das ist keine Kleinigkeit,
 * sondern lässt eine ganze Mechanik ungeprüft: die Menüs des Editors schliessen auf `mousedown`
 * (`components/erfassen/Menue.tsx`), nicht auf `click`. Ein Helfer, der `mousedown` verschweigt,
 * kann einen Weg für tragfähig erklären, den ein echter Zeiger zuschlägt.
 */
async function klick(el: Element): Promise<void> {
  await act(async () => {
    for (const art of ["mousedown", "mouseup", "click"]) {
      el.dispatchEvent(new MouseEvent(art, { bubbles: true, cancelable: true }));
    }
  });
  await flush();
}

/** Eine Eingabe ins gesteuerte Feld — über den nativen Setter, sonst sieht React sie nicht. */
async function tippe(feld: HTMLInputElement, text: string): Promise<void> {
  const setzer = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await flush();
}

async function waehle(feld: HTMLSelectElement, wert: string): Promise<void> {
  const setzer = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(feld, wert);
    feld.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush();
}

/** Drei Entwürfe mit unterscheidbaren Titeln, Aussagen und Zeitpunkten. */
async function dreiEntwuerfe(): Promise<string[]> {
  const a = await box.seed({ title: "Ventil V2 Nord", statement: "Dichtring wechseln" });
  const b = await box.seed({ title: "Anlage Süd", statement: "Druckprobe offen" });
  const c = await box.seed({ title: "Zaehlerstand", statement: "Ablesung im Keller" });
  return [a, b, c];
}

beforeEach(async () => {
  box.reset();
  window.localStorage.clear();
  await i18n.changeLanguage("de");
});

afterEach(() => {
  abbauen();
  vi.clearAllMocks();
});

describe("JOB 3503 · A · der Punkt steht im Kopfband", () => {
  it("„Meine Entwürfe“ steht hinter „Erfassen“ und zeigt auf /entwuerfe", async () => {
    await dreiEntwuerfe();
    await montiere();
    // Die Sitzung ist ein EXPERTE — „Prüfen“ (`minRole: controller`) steht deshalb hier gar nicht,
    // und das ist richtig so: gemessen wird die Reihenfolge dessen, was diese Rolle SIEHT. Dass
    // „Meine Entwürfe“ vor „Prüfen“ steht, hält der rollenfreie Pin
    // `tests/app/h1-navigation-orte.test.ts` an der Quelle fest.
    const ids = punktIds();
    expect(ids).toEqual(["start", "fragen", "bibliothek", "erfassen", "entwuerfe"]);
    const p = punkt("entwuerfe");
    expect(p, "der Punkt fehlt im Kopfband").not.toBeNull();
    expect(p?.getAttribute("href")).toBe("/entwuerfe");
    // Der Name kommt aus der EINEN Quelle (`anzeigeNameKey`), nicht aus einer im Test
    // abgeschriebenen Zeichenkette — verglichen wird gegen die echte Übersetzung.
    expect(p?.querySelector("span")?.textContent).toBe(i18n.t("mob.drafts"));
    expect(i18n.t("mob.drafts")).toBe("Meine Entwürfe");
  });

  it("auf Englisch trägt derselbe Punkt den englischen Namen", async () => {
    await i18n.changeLanguage("en");
    await montiere();
    expect(punkt("entwuerfe")?.querySelector("span")?.textContent).toBe("My drafts");
    await i18n.changeLanguage("de");
  });
});

describe("JOB 3503 · B · der Klick öffnet die Übersicht", () => {
  it("von /hilfe aus führt der Punkt nach /entwuerfe, und dort stehen alle drei Entwürfe", async () => {
    await dreiEntwuerfe();
    await montiere();
    expect(adresse()).toBe("/hilfe");
    expect(fehlt("page-entwuerfe"), "die Übersicht stand schon vor dem Klick da").toBe(true);

    const p = punkt("entwuerfe");
    expect(p).not.toBeNull();
    if (p) {
      await klick(p);
    }
    expect(adresse()).toBe("/entwuerfe");
    await warteAuf("page-entwuerfe");
    await flush();
    expect(titelListe().sort()).toEqual(["Anlage Süd", "Ventil V2 Nord", "Zaehlerstand"]);
  });

  it("die HÜLLE nennt die Seite: der Kopfband-Punkt ist auf dieser Route die aktuelle Seite", async () => {
    await dreiEntwuerfe();
    await montiere("/entwuerfe", "page-entwuerfe");
    // Wie in der Bibliothek trägt die Seite selbst KEINE zweite Überschrift (JOB 3063 H4, „die Hülle
    // nennt die Seite“). Gemessen wird deshalb genau das: der Punkt ist ausgezeichnet, und er trägt
    // den Namen, unter dem die Seite erreichbar ist.
    const p = punkt("entwuerfe");
    expect(p?.getAttribute("aria-current")).toBe("page");
    expect(p?.querySelector("span")?.textContent).toBe(i18n.t("mob.drafts"));
    // Und kein anderer Punkt behauptet, die aktuelle Seite zu sein.
    const ausgezeichnet = [...container.querySelectorAll("[data-kopfband-punkt]")]
      .filter((a) => a.getAttribute("aria-current") === "page")
      .map((a) => a.getAttribute("data-kopfband-punkt"));
    expect(ausgezeichnet).toEqual(["entwuerfe"]);
  });

  it("die Seite trägt die Bauform der Bibliothek: Suchraum-Satz, Suche, Sortierung, Liste, Anzahl", async () => {
    await dreiEntwuerfe();
    await montiere("/entwuerfe", "page-entwuerfe");
    expect(fehlt("entwurfsliste-suche")).toBe(false);
    expect(fehlt("entwurfsliste-sortierung")).toBe(false);
    expect(fehlt("entwuerfe-liste")).toBe(false);
    expect(zeilen().length).toBe(3);
    expect(anker("entwurfsliste-anzahl").textContent).toBe("3");
    // Der Suchraum wird ehrlich benannt, BEVOR gesucht wird (AUFTRAG-BASIC-u2).
    expect(anker("entwuerfe-suchraum").textContent).toContain(i18n.t("capture.draftScope.note"));
  });

  it("die Liste steht ohne jede Handbewegung da — KEIN Aufklapper und KEINE zweite Überschrift", async () => {
    // Das ist der Kern des Auftrags: „Meine Entwürfe“ war ein Aufklapper und ist jetzt ein Ort.
    // Eine Seite, die man erst aufklappen müsste, wäre derselbe Aufklapper an neuer Adresse —
    // deshalb trägt die Darreichung `variant="seite"` weder Auf-/Zuklapp-Knopf noch Karten-Kopf.
    await dreiEntwuerfe();
    await montiere("/entwuerfe", "page-entwuerfe");
    expect(zeilen().length, "die Zeilen stehen nicht ohne Zutun da").toBe(3);
    expect(
      seite().querySelector("button[aria-expanded]"),
      "die Seite trägt einen Aufklapp-Knopf",
    ).toBeNull();
    // Und keine zweite Überschrift: die Hülle nennt die Seite bereits (wie in der Bibliothek).
    expect(seite().textContent, "„Entwürfe fortsetzen“ steht doppelt").not.toContain(
      i18n.t("capture.resumeTitle"),
    );
    expect(seite().querySelector("h1"), "die Seite trägt eine eigene Überschrift").toBeNull();
  });
});

describe("JOB 3503 · C · die Suche filtert auf der Seite", () => {
  it("findet über den TITEL und über den INHALT — und sagt bei null Treffern, was durchsucht wurde", async () => {
    await dreiEntwuerfe();
    await montiere("/entwuerfe", "page-entwuerfe");
    const feld = anker<HTMLInputElement>("entwurfsliste-suche");

    await tippe(feld, "Ventil");
    expect(titelListe()).toEqual(["Ventil V2 Nord"]);

    // „Druckprobe“ steht NUR in der Aussage von „Anlage Süd“ — Volltext, nicht nur Titel.
    await tippe(feld, "Druckprobe");
    expect(titelListe()).toEqual(["Anlage Süd"]);

    await tippe(feld, "gibtesnicht");
    expect(titelListe()).toEqual([]);
    expect(anker("entwurfsliste-filter-leer").textContent).toBe(
      i18n.t("capture.draftEmptyFiltered"),
    );
  });
});

describe("JOB 3503 · D · die Sortierung ordnet auf der Seite", () => {
  it("Vorgabe ist „zuletzt gespeichert“ (neu→alt); „Titel A→Z“ und „älteste“ ordnen um", async () => {
    await dreiEntwuerfe();
    await montiere("/entwuerfe", "page-entwuerfe");
    const wahl = anker<HTMLSelectElement>("entwurfsliste-sortierung");
    expect(wahl.value).toBe("recent");
    expect(titelListe()).toEqual(["Zaehlerstand", "Anlage Süd", "Ventil V2 Nord"]);

    await waehle(wahl, "title");
    expect(titelListe()).toEqual(["Anlage Süd", "Ventil V2 Nord", "Zaehlerstand"]);

    await waehle(wahl, "oldest");
    expect(titelListe()).toEqual(["Ventil V2 Nord", "Anlage Süd", "Zaehlerstand"]);
  });
});

describe("JOB 3503 · E · Löschen fragt zurück und wirkt wirklich", () => {
  it("„Behalten“ lässt den Entwurf stehen, „Löschen“ entfernt ihn aus dem Bestand", async () => {
    const [a] = await dreiEntwuerfe();
    const id = a ?? "";
    await montiere("/entwuerfe", "page-entwuerfe");
    expect(zeileVon(id)).not.toBeNull();

    await klick(loeschKnopf(id));
    await klick(anker("entwurfsliste-loeschen-nein"));
    expect(zeileVon(id), "„Behalten“ hat gelöscht").not.toBeNull();
    expect((await box.bestand()).length).toBe(3);

    await klick(loeschKnopf(id));
    await klick(anker("entwurfsliste-loeschen-ja"));
    expect(zeileVon(id), "„Löschen“ hat nichts entfernt").toBeNull();
    expect((await box.bestand()).length).toBe(2);
    expect(titelListe()).toEqual(["Zaehlerstand", "Anlage Süd"]);
  });

  it("scheitert der Löschlauf, BLEIBT der Eintrag stehen — gelöscht ist nur, was der Server bestätigt", async () => {
    const [a] = await dreiEntwuerfe();
    const id = a ?? "";
    box.loeschFehler.add(id);
    await montiere("/entwuerfe", "page-entwuerfe");
    await klick(loeschKnopf(id));
    await klick(anker("entwurfsliste-loeschen-ja"));
    expect(zeileVon(id)).not.toBeNull();
    expect((await box.bestand()).length).toBe(3);
  });
});

describe("JOB 3503 · F · Laden, Leere und Störung sind drei Auskünfte", () => {
  // ================================================================================================
  // F1/F2 — DER LADEZUSTAND, GEMESSEN WÄHREND DER ABRUF WIRKLICH OFFEN IST.
  // ================================================================================================
  // BEN, Runde 2, Korrekturpflicht 1: Die Rückgabe der Runde 2 behauptete, alle drei Lagen seien
  // einzeln geprüft. Das war FALSCH — der Abschnitt F prüfte Leere, Abruffehler und
  // Auffrischungsfehler, aber keinen LAUFENDEN Abruf; mit abgeschaltetem Ladehinweis blieb alles
  // grün. Diese zwei Fälle stellen den Beleg her, den BEN benennt: „offengehaltener Abruf zeigt
  // ‚Laden‘, keinen Leerzustand; nach Abschluss korrekter Folgezustand." Beide Folgezustände sind
  // dabei — der mit Bestand (F1) und der ohne (F2), denn genau zwischen „lädt noch" und „ist leer"
  // wird sonst verwechselt.
  it("F1 · solange der Abruf läuft, steht „Lädt …“ — KEIN Leerzustand, KEINE Störung, KEINE Liste; danach die Zeilen", async () => {
    await dreiEntwuerfe();
    box.angehalten = true;
    // Gewartet wird auf den LADEHINWEIS selbst: er ist der Beweis, dass die Abfrage in diesem
    // Augenblick wirklich aussteht (`useDrafts().isLoading`), und nicht bloss, dass die Seite steht.
    await montiere("/entwuerfe", "entwuerfe-laedt");

    expect(anker("entwuerfe-laedt").textContent).toBe(i18n.t("state.loading"));
    // DAS IST DER KERN: „lädt" darf nicht als „nichts vorhanden" erscheinen. Genau diese
    // Verwechslung ist die Fehlerklasse aus REGELN §7 (die schwächere Aussage statt der starken).
    expect(fehlt("entwuerfe-leer"), "der laufende Abruf wurde als Leere ausgegeben").toBe(true);
    expect(fehlt("entwuerfe-fehler"), "der laufende Abruf wurde als Störung ausgegeben").toBe(true);
    // Und keine Bedienung ohne Gegenstand: ohne Bestand rendert die Liste sich selbst nicht.
    expect(seite().querySelector('[data-testid="entwurfsliste-suche"]')).toBeNull();
    expect(fehlt("entwuerfe-suchraum")).toBe(true);

    // Jetzt kommt die Antwort — und der Folgezustand ist der richtige.
    await act(async () => {
      box.freigeben();
    });
    await flush();
    expect(fehlt("entwuerfe-laedt"), "der Ladehinweis blieb nach der Antwort stehen").toBe(true);
    expect(titelListe()).toEqual(["Zaehlerstand", "Anlage Süd", "Ventil V2 Nord"]);
    expect(fehlt("entwuerfe-leer")).toBe(true);
  });

  it("F2 · derselbe offene Abruf ohne einen einzigen Entwurf: erst „Lädt …“, danach der Leerzustand", async () => {
    box.angehalten = true;
    await montiere("/entwuerfe", "entwuerfe-laedt");
    expect(fehlt("entwuerfe-leer"), "die Leere wurde behauptet, bevor die Antwort da war").toBe(
      true,
    );

    await act(async () => {
      box.freigeben();
    });
    await flush();
    // Erst JETZT ist „nichts vorhanden" eine belegte Aussage — vorher war es eine Vermutung.
    expect(fehlt("entwuerfe-laedt")).toBe(true);
    expect(fehlt("entwuerfe-leer")).toBe(false);
    expect(anker("entwuerfe-leer").textContent).toContain(i18n.t("erfassen.entwuerfe.keine"));
  });

  it("ohne einen einzigen Entwurf steht der Leerzustand mit dem Weg zum Erfassen — und keine Liste", async () => {
    await montiere("/entwuerfe", "page-entwuerfe");
    expect(fehlt("entwuerfe-leer")).toBe(false);
    expect(anker("entwuerfe-leer").textContent).toContain(i18n.t("erfassen.entwuerfe.keine"));
    expect(anker<HTMLAnchorElement>("entwuerfe-leer-erfassen").getAttribute("href")).toBe(
      "/erfassen",
    );
    // Ohne Bestand rendert die Liste sich selbst NICHT — keine leere Bedienung ohne Gegenstand.
    expect(seite().querySelector('[data-testid="entwurfsliste-suche"]')).toBeNull();
    expect(fehlt("entwuerfe-fehler")).toBe(true);
    // Und kein Suchraum-Satz über einer Liste, die es nicht gibt.
    expect(fehlt("entwuerfe-suchraum")).toBe(true);
  });

  it("scheitert der Abruf, steht die Störung mit Weg zurück — und NICHT der Leerzustand", async () => {
    box.listeFehler = true;
    await montiere("/entwuerfe", "page-entwuerfe");
    expect(fehlt("entwuerfe-fehler")).toBe(false);
    expect(anker("entwuerfe-fehler").textContent).toContain(i18n.t("state.error"));
    expect(fehlt("entwuerfe-erneut")).toBe(false);
    // Die schwächere Aussage steht da, nicht die starke: „gestört“ ist nicht „nichts vorhanden“.
    expect(fehlt("entwuerfe-leer"), "eine Störung wurde als Leere ausgegeben").toBe(true);
  });

  it("scheitert nur die AUFFRISCHUNG, bleibt der geholte Bestand SICHTBAR (REGELN §7)", async () => {
    await dreiEntwuerfe();
    const qc = await montiere("/entwuerfe", "page-entwuerfe");
    expect(titelListe().length).toBe(3);

    // Erst holen (erfolgreich), dann den nächsten Abruf scheitern lassen — genau die Lage, in der
    // eine Fläche fälschlich leert: es liegt ein guter Bestand vor, und die Auffrischung kommt
    // nicht durch.
    box.listeFehler = true;
    await act(async () => {
      await qc.invalidateQueries({ queryKey: ["drafts"] });
    });
    await flush();

    expect(fehlt("entwuerfe-fehler"), "die gescheiterte Auffrischung blieb unerwähnt").toBe(false);
    expect(titelListe().length, "der Bestand wurde wegen eines Folgefehlers geleert").toBe(3);
    expect(fehlt("entwuerfe-leer"), "aus einem Folgefehler wurde eine Leere-Behauptung").toBe(true);
  });
});

describe("JOB 3503 · G · der Weg ist ohne Maus bedienbar", () => {
  it("der Punkt ist ein fokussierbarer Verweis, und Suche wie Sortierung tragen einen Namen", async () => {
    await dreiEntwuerfe();
    await montiere("/entwuerfe", "page-entwuerfe");
    const p = punkt("entwuerfe");
    expect(p?.tagName).toBe("A");
    expect(p?.getAttribute("href")).toBe("/entwuerfe");
    // Ein `<a href>` ist von Haus aus in der Tabulatorfolge; ein negativer Index nähme ihn heraus.
    expect(p?.getAttribute("tabindex")).toBeNull();
    if (p) {
      p.focus();
      expect(document.activeElement).toBe(p);
    }

    const suche = anker<HTMLInputElement>("entwurfsliste-suche");
    expect(suche.getAttribute("aria-label")).toBe(i18n.t("capture.draftSearch"));
    suche.focus();
    expect(document.activeElement).toBe(suche);

    const sort = anker<HTMLSelectElement>("entwurfsliste-sortierung");
    expect(sort.getAttribute("aria-label")).toBe(i18n.t("capture.draftSortLabel"));

    // Jede Zeile trägt zwei benannte Knöpfe — Fortsetzen und Löschen; beide sind `<button>`.
    for (const li of zeilen()) {
      const weiter = fortsetzenKnopf(li);
      expect(weiter.tagName).toBe("BUTTON");
      weiter.focus();
      expect(document.activeElement, "der Fortsetzen-Knopf nimmt keinen Fokus an").toBe(weiter);
    }
    const loeschen = seite().querySelector<HTMLButtonElement>("[data-loeschen]");
    expect(loeschen?.getAttribute("aria-label")).toBe(i18n.t("capture.discardDraftYes"));
  });

  // WAS DIESER FALL MISST UND WAS NICHT: jsdom leitet KEINE Enter-Taste in einen Knopfklick um (das
  // tut der Browser, nicht das DOM). Gemessen wird deshalb der Teil, der hier wirklich entscheidet:
  // jeder Schritt der Folge ist FOKUSSIERBAR und wird durch Aktivierung des FOKUSSIERTEN Elements
  // ausgelöst — keine Stufe verlangt einen Zeiger. Der Zeigefinger auf dem echten Browser bleibt
  // `tests/d1-meine-entwuerfe/zugang-schmal-chromium.test.ts`.
  it("die Löschfolge läuft über fokussierte Elemente — keine Stufe braucht einen Zeiger", async () => {
    const [a] = await dreiEntwuerfe();
    const id = a ?? "";
    await montiere("/entwuerfe", "page-entwuerfe");
    const loeschen = loeschKnopf(id);
    loeschen.focus();
    expect(document.activeElement, "der Löschknopf nimmt keinen Fokus an").toBe(loeschen);
    await klick(loeschen);

    const ja = anker<HTMLButtonElement>("entwurfsliste-loeschen-ja");
    const nein = anker<HTMLButtonElement>("entwurfsliste-loeschen-nein");
    nein.focus();
    expect(document.activeElement, "„Behalten“ nimmt keinen Fokus an").toBe(nein);
    ja.focus();
    expect(document.activeElement).toBe(ja);
    await klick(ja);
    expect(zeileVon(id)).toBeNull();
  });
});

describe("JOB 3503 · H · die Rechte gelten wie am Nachbarpunkt „Erfassen“", () => {
  it("eine Betrachterin sieht den Punkt nicht — und der Deep-Link führt nicht zur Seite", async () => {
    box.rolle = "viewer";
    await dreiEntwuerfe();
    // KEIN Warten auf `page-entwuerfe`: sie soll ja gerade AUSBLEIBEN. Nicht-vakuös wird der Fall
    // dadurch, dass stattdessen auf die Sperrkarte des Rollen-Tors gewartet wird — der Router hat
    // dann nachweislich entschieden und nicht bloss noch nicht geladen.
    await montiere("/entwuerfe");
    await warteAufText(i18n.t("role.gate.title"));
    // Dieselbe Schranke wie am Nachbarn: wer nicht erfassen darf, hat keine Entwürfe.
    expect(punkt("erfassen"), "Vergleichspunkt sichtbar — die Rolle greift gar nicht").toBeNull();
    expect(punkt("entwuerfe")).toBeNull();
    expect(fehlt("page-entwuerfe"), "die Seite stand trotz fehlender Rolle da").toBe(true);
  });
});

describe("JOB 3503 · I · schmal (390 px): der Punkt steht im Drawer", () => {
  it("die Drawer-Zeile trägt denselben Namen und dasselbe Ziel wie der Kopfband-Punkt", async () => {
    await dreiEntwuerfe();
    await montiere("/entwuerfe", "page-entwuerfe");
    const zeile = anker<HTMLAnchorElement>("drawer-punkt-entwuerfe");
    expect(zeile.getAttribute("href")).toBe("/entwuerfe");
    expect(zeile.textContent).toContain(i18n.t("mob.drafts"));
    // Zeichengleich mit dem breiten Weg — ein Bereich, ein Name (JOB 3105 UX-08).
    expect(zeile.textContent?.trim()).toBe(punkt("entwuerfe")?.textContent?.trim());
  });
});
