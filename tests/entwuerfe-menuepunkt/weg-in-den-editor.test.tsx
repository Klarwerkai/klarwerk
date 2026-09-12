// @vitest-environment jsdom
// ================================================================================================
// JOB 3503 · ENTWUERFE-MENUEPUNKT — VON DER ÜBERSICHT IN DEN EDITOR UND ZURÜCK ZU DEMSELBEN STAND.
// ================================================================================================
//
// Die Zusage des Auftrags (§3, Pedis Bedingung) ist nicht „es gibt eine zweite Liste“, sondern: es
// ist DIESELBE. Diese Datei misst genau das, und zwar an der Naht, an der zwei Flächen sonst
// auseinanderlaufen:
//
// A  „Fortsetzen“ auf der Übersicht führt in den Editor — über die vorhandene Adresse `?draft=…`,
//    und das Blatt trägt danach den Titel GENAU dieses Entwurfs (nicht irgendeines).
// B  der Aufklapper im Editor zeigt danach DENSELBEN Stand: dieselben Entwürfe, in derselben
//    Ordnung, und der auf der Übersicht gesetzte Suchfilter steht dort SICHTBAR im Feld.
// C  was auf der Übersicht gelöscht wurde, ist auch im Aufklapper des Editors fort — ein Bestand,
//    kein zweiter Speicher.
//
// D  Pedis Befund: der Weg zurück AUS dem geöffneten Entwurf (Hinweisdatei 10.09. 09:1x) — hier
//    steht, was gemessen wurde, und zwar für BEIDE Wege.
//
// Gemessen wird am echten Router (`AppRoutes`) mit dem echten Entwurfsdienst hinter den Endpunkten.
// Gegriffen wird an den neutralen Ankern der Liste (`entwurfsliste-…`) und über die Kennung am
// Löschknopf (`[data-loeschen="<id>"]`).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  zeit: 0,
  seed: async (_p: Record<string, unknown>): Promise<string> => "",
  bestand: async (): Promise<unknown[]> => [],
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "experte" })),
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
  };
  box.seed = async (p: P) => {
    box.zeit += 60_000;
    return (await svc.createDraft(p, "u1")).id;
  };
  // JOB 3668 (Nachführung): DAS NACHGEBAUTE `GET /api/drafts` TRIMMT DEN PAPIERKORB, wie die echte
  // Route (`visibleDraftsFor`, `services/app/src/routes/capture-routes.ts`). `listDrafts()` liefert
  // seit dem Entwurfs-Papierkorb AUCH die gelöschten Entwürfe, damit die Referenzprüfung ihre Anker
  // weiter zählt; wer einem Menschen eine Liste zeigt, trimmt selbst.
  const lebende = async () => (await svc.listDrafts()).filter((d) => !("deletedAt" in d));
  box.bestand = lebende;
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      drafts: {
        list: vi.fn(lebende),
        get: vi.fn(async (id: string) => svc.getDraft(id)),
        create: vi.fn(async (p: P) => svc.createDraft(p, "u1")),
        update: vi.fn(async (id: string, p: P) => svc.continueDraft(id, p, "u1")),
        remove: vi.fn(async (id: string) => svc.deleteDraft(id)),
        promote: ok({ id: "ko-1", title: "egal" }),
      },
      directory: { list: ok([{ id: "u1", name: "Pia", email: "p@x.de", role: "editor" }]) },
      ko: { list: ok([]) },
      knowledge: { check: ok({ status: "pending" }) },
      validation: { board: ok([]), settings: ok({ defaultNeededValidations: 3 }) },
      conflicts: { list: ok([]) },
      duplicates: { list: ok([]) },
      lifecycle: { pending: ok([]) },
      gaps: {
        list: ok([]),
        summary: ok({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } }),
      },
      features: { get: ok({ features: {} }) },
      external: { policy: ok({ stage: "search_on_click" }) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      notifications: { list: ok([]), markSeen: ok({ unseenCount: 0 }) },
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
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { AppRoutes } from "../../apps/web/src/routes";
import { KopfbandPunkte } from "../../apps/web/src/shell/KopfbandPunkte";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";

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
 * Aufbauen und WARTEN, bis die Seite wirklich da ist.
 *
 * `erwarte` ist der Anker, an dem die gewünschte Seite erkennbar ist. Ohne ihn stünde nach dem
 * Aufbau die Ladefläche (`Splash`) im Baum — jede Seite wird nachgeladen (`routes.tsx`) —, und der
 * erste `querySelector` meldete „fehlt“, obwohl nur der Import noch lief.
 */
async function montiere(pfad: string, erwarte: string): Promise<void> {
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
                  ImageDescribeProvider,
                  null,
                  createElement(
                    NavGuardProvider,
                    null,
                    // Das Kopfband gehört zur Messung: Fall D geht den Weg AUS dem geöffneten
                    // Entwurf zurück zur Übersicht, und der läuft über den neuen Punkt.
                    createElement(KopfbandPunkte),
                    createElement(AppRoutes),
                  ),
                  createElement(Adresse),
                ),
              ),
              createElement(ToastViewport),
            ),
          ),
        ),
      ),
    );
  });
  await flush();
  await warteAuf(erwarte);
  await flush();
}

function abbauen(): void {
  act(() => root.unmount());
  container.remove();
}

/** Denselben Baum an einer anderen Adresse neu aufbauen (frischer Abfragespeicher, echter Abruf). */
async function montiereNeu(pfad: string, erwarte: string): Promise<void> {
  abbauen();
  await montiere(pfad, erwarte);
}

function adresse(): string {
  return container.querySelector('[data-testid="adresse"]')?.textContent ?? "";
}

function anker<T extends Element>(name: string): T {
  const el = container.querySelector<T>(`[data-testid="${name}"]`);
  if (!el) {
    throw new Error(`Anker „${name}“ fehlt`);
  }
  return el;
}

/**
 * Auf einen Anker WARTEN statt ihn sofort zu verlangen.
 *
 * Der Router lädt jede Seite nach (`routes.tsx`, `lazy(() => import(…))`). Beim Wechsel von der
 * Übersicht in den Editor ist dessen Stück noch gar nicht da — die Adresse steht schon, die Fläche
 * folgt erst, wenn der Import durch ist. Ein sofortiges `querySelector` misst dann die Ladefläche
 * und nennt es „fehlt“. Gewartet wird auf ein ECHTES Ereignis (der Anker erscheint), nicht auf eine
 * feste Zahl von Runden; nach der Frist ist der Fall rot, nicht grün.
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

/**
 * Ein Klick, wie ein Zeiger ihn erzeugt: `mousedown`, `mouseup`, `click` — in dieser Ordnung.
 *
 * BEN, Runde 2 (Prüflücke 6): der bisherige Helfer erzeugte NUR `click`. Für Fall D ist das der
 * Unterschied zwischen Messung und Behauptung: die Menüs des Editors schliessen auf `mousedown`
 * (`components/erfassen/Menue.tsx`, Hörer am Dokument), nicht auf `click`. Genau dort liegt der
 * plausibelste Verdacht für Pedis Befund — mit einem Helfer ohne `mousedown` wäre er ungeprüft
 * geblieben.
 */
async function klick(el: Element): Promise<void> {
  await act(async () => {
    for (const art of ["mousedown", "mouseup", "click"]) {
      el.dispatchEvent(new MouseEvent(art, { bubbles: true, cancelable: true }));
    }
  });
  await flush();
}

async function tippe(feld: HTMLInputElement, text: string): Promise<void> {
  const setzer = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await flush();
}

/** Die Fläche der Übersicht. */
function seite(): HTMLElement {
  return anker<HTMLElement>("page-entwuerfe");
}

/** Die Titel der Zeilen auf der ÜBERSICHT. */
function seitenTitel(): string[] {
  return [...seite().querySelectorAll('[data-testid="entwurfsliste-eintrag-titel"]')].map((el) =>
    (el.textContent ?? "").trim(),
  );
}

/** Die Titel der Zeilen im AUFKLAPPER des Editors. */
function blattTitel(): string[] {
  return [...container.querySelectorAll('[data-testid="blatt-entwurf-eintrag-titel"]')].map((el) =>
    (el.textContent ?? "").trim(),
  );
}

/** Der „Fortsetzen“-Knopf der Zeile GENAU dieses Entwurfs. */
function fortsetzenKnopf(id: string): HTMLButtonElement {
  const li = seite().querySelector(`[data-loeschen="${id}"]`)?.closest("li");
  if (!li) {
    throw new Error(`Zeile für „${id}“ fehlt`);
  }
  const wort = i18n.t("capture.resume");
  const el = [...li.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes(wort));
  if (!el) {
    throw new Error(`„${wort}“ fehlt in der Zeile`);
  }
  return el;
}

function loeschKnopf(id: string): HTMLButtonElement {
  const el = seite().querySelector<HTMLButtonElement>(`[data-loeschen="${id}"]`);
  if (!el) {
    throw new Error(`Löschknopf für „${id}“ fehlt`);
  }
  return el;
}

/** Den Aufklapper des Editors öffnen — über das echte Werkzeug „Meine Entwürfe“ der Werkzeugzeile. */
async function aufklapperOeffnen(): Promise<void> {
  await klick(await warteAuf("blatt-werkzeug-entwuerfe"));
}

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

describe("JOB 3503 · A · von der Übersicht in den Editor", () => {
  it("„Fortsetzen“ öffnet GENAU diesen Entwurf: die Adresse trägt seine Kennung, das Blatt seinen Titel", async () => {
    const [a] = await dreiEntwuerfe();
    const id = a ?? "";
    await montiere("/entwuerfe", "page-entwuerfe");
    expect(seitenTitel().length).toBe(3);

    await klick(fortsetzenKnopf(id));

    expect(adresse()).toBe(`/erfassen?draft=${id}`);
    // Der Editor steht da — und er trägt den Titel des gewählten Entwurfs, nicht den eines anderen.
    // Die Übersicht ist fort: es ist ein Ortswechsel, keine zweite Fläche daneben.
    const titel = await warteAuf<HTMLInputElement>("blatt-titel");
    await flush();
    expect(titel.value).toBe("Ventil V2 Nord");
    expect(container.querySelector('[data-testid="page-entwuerfe"]')).toBeNull();
  });
});

describe("JOB 3503 · B · der Aufklapper des Editors zeigt denselben Stand", () => {
  it("dieselben Entwürfe in derselben Ordnung — und der auf der Übersicht gesetzte Filter steht sichtbar im Feld", async () => {
    await dreiEntwuerfe();
    await montiere("/entwuerfe", "page-entwuerfe");

    // Auf der Übersicht suchen: es bleibt genau ein Entwurf übrig.
    await tippe(anker<HTMLInputElement>("entwurfsliste-suche"), "Ventil");
    expect(seitenTitel()).toEqual(["Ventil V2 Nord"]);

    // In den Editor — und zwar mit FRISCHEM Abfragespeicher: der Filter darf nicht aus einem
    // gemeinsamen React-Zustand stammen, sondern muss die gemerkte Einstellung des Browsers sein.
    await montiereNeu("/erfassen", "blatt-huelle");
    await aufklapperOeffnen();

    // DERSELBE Filter — sichtbar im Feld, nicht heimlich: die Merkschlüssel sind dieselben
    // (`lib/draftListView.ts`, DRAFT_QUERY_STORAGE_KEY).
    expect(anker<HTMLInputElement>("entwurfsliste-suche").value).toBe("Ventil");
    expect(blattTitel()).toEqual(["Ventil V2 Nord"]);

    // Filter zurücknehmen: derselbe Bestand, dieselbe Ordnung wie auf der Übersicht.
    await tippe(anker<HTMLInputElement>("entwurfsliste-suche"), "");
    expect(blattTitel()).toEqual(["Zaehlerstand", "Anlage Süd", "Ventil V2 Nord"]);
  });
});

describe("JOB 3503 · C · ein Bestand, kein zweiter Speicher", () => {
  it("was auf der Übersicht gelöscht wird, ist auch im Aufklapper des Editors fort", async () => {
    const [a] = await dreiEntwuerfe();
    const id = a ?? "";
    await montiere("/entwuerfe", "page-entwuerfe");

    await klick(loeschKnopf(id));
    await klick(anker("entwurfsliste-loeschen-ja"));
    expect(seitenTitel()).toEqual(["Zaehlerstand", "Anlage Süd"]);
    expect((await box.bestand()).length).toBe(2);

    await montiereNeu("/erfassen", "blatt-huelle");
    await aufklapperOeffnen();
    expect(blattTitel()).toEqual(["Zaehlerstand", "Anlage Süd"]);
  });
});

// ================================================================================================
// JOB 3503 · D — PEDIS BEFUND: „DER LINK MEINE ENTWÜRFE AUS DEM GEÖFFNETEN ENTWURF FUNKTIONIERT
// NICHT" (Hinweisdatei der Steuerung, 10.09. 09:1x).
// ================================================================================================
//
// Bis zu diesem Auftrag gab es aus einem GEÖFFNETEN Entwurf genau einen Weg zurück zu den eigenen
// Entwürfen: das Werkzeug „Meine Entwürfe" der Werkzeugzeile, das die Liste im „…"-Menü aufklappt
// (`Blatt.tsx`, `entwuerfeAufklappen`). Pedi hat gemeldet, dass dieser Weg ihn nicht trägt.
//
// DIESER AUFTRAG BAUT DEN WEG, DER IHN TRÄGT, und dieser Fall misst ihn: der Kopfband-Punkt steht
// auf JEDER Seite, auch mitten im geöffneten Entwurf, und führt zur eigenen Übersicht. Er hängt an
// keinem Menüzustand des Editors — deshalb kann ihn kein Menüzustand verschlucken.
//
// GEMESSEN WIRD ZUSÄTZLICH DER ALTE WEG, im selben Zustand und im selben Lauf. Er wird hier NICHT
// reparariert: `components/erfassen/Blatt.tsx` und `components/erfassen/Menue.tsx` liegen nicht in
// den Zielpfaden dieses Auftrags. Was die Messung ergibt, steht in der Rückgabe.
describe("JOB 3503 · D · aus dem GEÖFFNETEN Entwurf zurück zu „Meine Entwürfe“", () => {
  it("der Kopfband-Punkt trägt auch mitten im geöffneten Entwurf — er hängt an keinem Menüzustand", async () => {
    const [a] = await dreiEntwuerfe();
    const id = a ?? "";
    // Die Ausgangslage ist Pedis: ein Entwurf ist WIRKLICH offen, nicht nur die Adresse gesetzt.
    await montiere(`/erfassen?draft=${id}`, "blatt-titel");
    expect(anker<HTMLInputElement>("blatt-titel").value).toBe("Ventil V2 Nord");

    const p = container.querySelector<HTMLAnchorElement>('[data-kopfband-punkt="entwuerfe"]');
    expect(p, "der Punkt fehlt im Kopfband, während ein Entwurf offen ist").not.toBeNull();
    if (p) {
      await klick(p);
    }
    expect(adresse()).toBe("/entwuerfe");
    await warteAuf("page-entwuerfe");
    await flush();
    expect(seitenTitel().sort()).toEqual(["Anlage Süd", "Ventil V2 Nord", "Zaehlerstand"]);
  });

  it("der ALTE Weg im Editor (Werkzeug „Meine Entwürfe“) klappt aus dem geöffneten Entwurf die Liste auf", async () => {
    const [a] = await dreiEntwuerfe();
    const id = a ?? "";
    await montiere(`/erfassen?draft=${id}`, "blatt-titel");
    expect(anker<HTMLInputElement>("blatt-titel").value).toBe("Ventil V2 Nord");

    // Genau die Handbewegung, die Pedi gemeldet hat: ein Klick auf das benannte Werkzeug.
    await aufklapperOeffnen();
    expect(
      blattTitel(),
      "das Werkzeug „Meine Entwürfe“ klappt aus dem geöffneten Entwurf keine Liste auf",
    ).toEqual(["Zaehlerstand", "Anlage Süd", "Ventil V2 Nord"]);
  });

  // DER VERDACHT, DEM DIESER FALL NACHGEHT: Der Schliess-Hörer des Menüs hängt am Dokument und am
  // Ereignis `mousedown` (`components/erfassen/Menue.tsx`). Das Werkzeug „Meine Entwürfe“ liegt
  // AUSSERHALB der Menü-Hülle. Ist das Menü also schon offen und man drückt das Werkzeug, dann
  // schliesst der Hörer im `mousedown` — und der `click` danach muss es wieder öffnen. Wäre die
  // Ordnung anders herum, sähe der Mensch genau das, was Pedi beschreibt: ein Klick, der nichts tut.
  // Seit dieser Runde erzeugt `klick` die volle Zeigerfolge, der Fall kann die Frage also messen.
  it("das Werkzeug ein ZWEITES Mal, bei schon offenem Menü: die Liste bleibt stehen (mousedown-Ordnung)", async () => {
    const [a] = await dreiEntwuerfe();
    const id = a ?? "";
    await montiere(`/erfassen?draft=${id}`, "blatt-titel");

    await aufklapperOeffnen();
    expect(blattTitel().length, "erster Klick öffnet nicht").toBe(3);

    // Jetzt ist der Hörer scharf: dasselbe Werkzeug noch einmal drücken.
    await aufklapperOeffnen();
    expect(
      blattTitel(),
      "der zweite Klick bei offenem Menü lässt die Liste verschwinden — genau Pedis Befund",
    ).toEqual(["Zaehlerstand", "Anlage Süd", "Ventil V2 Nord"]);
  });
});
