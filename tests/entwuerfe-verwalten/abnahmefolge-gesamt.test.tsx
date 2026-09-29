// @vitest-environment jsdom
// ================================================================================================
// P-ENTWUERFE-VERWALTEN · DIE ABNAHMEFOLGE AM STÜCK — DE und EN, mit Maus und NUR mit Tastatur.
// ================================================================================================
//
// Die Abnahme des Auftrags ist wörtlich eine FOLGE, keine Sammlung von Teilstücken:
//
//   „eigene Fixture anlegen → normal zur Liste navigieren → per Inhalt und per Titel finden →
//    öffnen → ungesicherte Änderung → Listenwechsel mit bewusstem Verwerfen → gespeicherte alte
//    Fassung wieder da → Löschen mit Bestätigung → Eintrag weg; alles in DE und EN, mit Maus und
//    durchgehend mit Tastatur."
//
// Ben (Aufnahme gesamt-entwurf-einreichen, Lauf :3 Runde 1, B3) hat belegt, dass die vorhandenen
// Fälle sie nur in Stücken prüfen: `blatt-entwuerfe-verwalten.test.tsx` G beginnt per Adresse im
// Entwurf und nutzt „Eingabe verwerfen" statt des Listenwechsels, H prüft die Tabulatorordnung ohne
// Bearbeitung, I nur übersetzte Beschriftungen, und die Chromium-Fälle enden beim Öffnen. Diese
// Datei geht den ganzen Weg in EINEM Lauf, viermal: {de, en} × {maus, tastatur}.
//
// WAS „NORMAL" HEISST: Start ist die Startseite `/start` (dorthin leitet `/` weiter). Von dort geht es über den Kopfband-Punkt
// „Meine Entwürfe" (`data-kopfband-punkt="entwuerfe"`, JOB 3503) zur Übersicht — keine Adresse
// wird von Hand gesetzt, jeder Ortswechsel danach ist eine Bedienhandlung. Der Listenwechsel aus
// dem geöffneten Entwurf ist derselbe Kopfband-Punkt, und die Rückfrage darauf ist die gemeinsame
// Navigationswache (`NavGuardContext`) mit „Verwerfen und wechseln" / „Discard and leave".
//
// WAS „DURCHGEHEND MIT TASTATUR" HEISST: Jedes Bedienelement wird über den TABULATORLAUF erreicht
// — vom Dokumentanfang aus, Schritt für Schritt, bis der Fokus auf ihm steht (`tabBis`). Ein
// Element, das nicht im Lauf liegt (tabIndex < 0, gesperrt, hinter `inert`), macht den Fall rot.
// Ausgelöst wird wie im Browser: Enter auf einer Schaltfläche oder einem Link erzeugt dort den
// `click`, ohne Zeigerereignisse (`mousedown`/`mouseup`). jsdom erzeugt diesen `click` nicht
// selbst; `taste` erzeugt `keydown Enter` und danach genau den einen `click`, den der Browser
// erzeugen würde — und KEIN `mousedown`, damit kein Zeigerpfad (Menü-Schliesshörer) mitgemessen
// wird. Getippt wird in das per Tabulator fokussierte Feld.
//
// DER SERVER ist der echte Entwurfsdienst (`CaptureService` über `InMemoryDraftRepo`) hinter den
// Endpunkten; „die alte Fassung ist wieder da" und „Eintrag weg" werden deshalb AM BESTAND
// gemessen, nicht nur an der Fläche.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  zeit: 0,
  seed: async (_p: Record<string, unknown>): Promise<string> => "",
  bestand: async (): Promise<{ id: string; payload: { title?: string } }[]> => [],
  zaehler: { update: 0, remove: 0 },
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
    box.zaehler.update = 0;
    box.zaehler.remove = 0;
    svc = bauen();
  };
  box.seed = async (p: P) => {
    box.zeit += 60_000;
    return (await svc.createDraft(p, "u1")).id;
  };
  // Wie die echte Route (`visibleDraftsFor`): die Liste für Menschen trimmt den Papierkorb.
  const lebende = async () => (await svc.listDrafts()).filter((d) => !("deletedAt" in d));
  box.bestand = lebende as typeof box.bestand;
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      drafts: {
        list: vi.fn(lebende),
        get: vi.fn(async (id: string) => svc.getDraft(id)),
        create: vi.fn(async (p: P) => svc.createDraft(p, "u1")),
        update: vi.fn(async (id: string, p: P) => {
          box.zaehler.update += 1;
          return svc.continueDraft(id, p, "u1");
        }),
        remove: vi.fn(async (id: string) => {
          box.zaehler.remove += 1;
          return svc.deleteDraft(id);
        }),
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
      // Was die Startseite zusätzlich liest (wie in tests/kollision-netztrennung/start-fuerdich-*).
      duplicateSignal: { list: ok([]) },
      learningPaths: { byRole: ok(null), progress: ok([]) },
      livewall: { get: ok({ fresh: [], helped: [] }) },
      admin: { demoStatus: ok({ present: false, count: 0 }) },
      analytics: { overview: ok({ total: 0, byStatus: {} }) },
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
let root: Root | null = null;

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

async function montiere(pfad: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root?.render(
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
}

function abbauen(): void {
  if (root) {
    const r = root;
    act(() => r.unmount());
    root = null;
    container.remove();
  }
}

function adresse(): string {
  return container.querySelector('[data-testid="adresse"]')?.textContent ?? "";
}

/** Auf ein Element WARTEN (die Seiten werden nachgeladen); nach der Frist ist der Fall rot. */
async function warteAuf<T extends Element>(selektor: string, frist = 20_000): Promise<T> {
  const ende = Date.now() + frist;
  for (;;) {
    const el = document.querySelector<T>(selektor);
    if (el) {
      return el;
    }
    if (Date.now() > ende) {
      throw new Error(`„${selektor}“ kam nicht innerhalb von ${frist} ms`);
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
}

const testid = (name: string): string => `[data-testid="${name}"]`;

// ------------------------------------------------------------------------------------------------
// BEDIENUNG — einmal mit dem Zeiger, einmal nur mit der Tastatur.
// ------------------------------------------------------------------------------------------------

/** Der Tabulatorlauf des GANZEN Dokuments (die Wache-Rückfrage liegt im Portal, nicht im Baum). */
function tabulatorlauf(): HTMLElement[] {
  const auswahl =
    'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
  return [...document.querySelectorAll(auswahl)].filter((e): e is HTMLElement => {
    if (!(e instanceof HTMLElement) || e.tabIndex < 0 || e.hidden) {
      return false;
    }
    if ((e as HTMLElement & { disabled?: boolean }).disabled) {
      return false;
    }
    // Hinter einer offenen Modalfläche ist der Rest per `inert` gesperrt — dort kommt kein
    // Tabulator hin, also auch dieser Lauf nicht.
    return e.closest("[inert]") === null;
  });
}

/**
 * Vom Dokumentanfang aus mit dem Tabulator bis zu `ziel` gehen. Liegt es nicht im Lauf, ist die
 * Folge mit der Tastatur NICHT bedienbar — dann ist der Fall rot, nicht umgangen.
 */
function tabBis(ziel: HTMLElement): void {
  const lauf = tabulatorlauf();
  const stelle = lauf.indexOf(ziel);
  if (stelle < 0) {
    throw new Error(
      `„${ziel.getAttribute("data-testid") ?? ziel.textContent?.trim() ?? ziel.tagName}“ liegt nicht im Tabulatorlauf`,
    );
  }
  for (let i = 0; i <= stelle; i++) {
    lauf[i]?.focus();
  }
  expect(document.activeElement).toBe(ziel);
}

/** Zeiger: `mousedown`, `mouseup`, `click` — in dieser Ordnung. */
async function maus(el: HTMLElement): Promise<void> {
  await act(async () => {
    for (const art of ["mousedown", "mouseup", "click"]) {
      el.dispatchEvent(new MouseEvent(art, { bubbles: true, cancelable: true }));
    }
  });
  await flush();
}

/** Tastatur: per Tabulator hin, dann Enter — und der eine `click`, den der Browser daraus macht. */
async function taste(el: HTMLElement): Promise<void> {
  tabBis(el);
  await act(async () => {
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    const weiter = el.dispatchEvent(enter);
    // Wie der Browser: Enter auf Schaltfläche/Link wird zum Klick — es sei denn, ein Hörer hat die
    // Taste schon selbst verbraucht.
    if (weiter && (el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement)) {
      el.click();
    }
  });
  await flush();
}

async function schreibe(feld: HTMLInputElement, text: string): Promise<void> {
  const setzer = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await flush();
}

type Modus = "maus" | "tastatur";

function bedienung(modus: Modus) {
  return {
    druecke: (el: HTMLElement) => (modus === "maus" ? maus(el) : taste(el)),
    tippe: async (feld: HTMLInputElement, text: string) => {
      if (modus === "maus") {
        await maus(feld);
        feld.focus();
      } else {
        tabBis(feld);
      }
      await schreibe(feld, text);
    },
  };
}

// ------------------------------------------------------------------------------------------------
// DIE FLÄCHE — gemessen an den Ankern, die sie wirklich trägt.
// ------------------------------------------------------------------------------------------------

function kopfbandEntwuerfe(): HTMLAnchorElement {
  const el = container.querySelector<HTMLAnchorElement>('[data-kopfband-punkt="entwuerfe"]');
  if (!el) {
    throw new Error("der Kopfband-Punkt „Meine Entwürfe“ fehlt");
  }
  return el;
}

// ------------------------------------------------------------------------------------------------
// LESBARKEIT DES TITELS — was jsdom davon messen kann, und was nicht (Ben Lauf :3 Runde 2, B3-R).
// ------------------------------------------------------------------------------------------------
//
// Bens Befund: ein vollständiger `textContent` beweist keine sichtbare Lesbarkeit — der Titelträger
// der Übersicht stand in einem `truncate`-Behälter, und die Folge blieb trotzdem grün. jsdom hat
// kein Layout und lädt kein Tailwind; ein Pixelmaß ist HIER nicht zu haben (das misst
// `tests/d1-meine-entwuerfe/zugang-schmal-chromium.test.ts`, Fall L2, im echten Browser). Was hier
// geprüft wird, ist der VERTRAG DER KLASSEN, mit denen eine Kürzung gemacht würde: weder der
// Titelträger noch ein Behälter bis zur Zeile trägt `truncate`, `whitespace-nowrap`,
// `text-ellipsis`, `overflow-hidden`/`-clip` oder `line-clamp-*`, und der Träger selbst bricht um
// (`break-words`, als Block). Gegenprobe: mit `truncate` am Zeilenträger (Stand Runde 2) ist dieser
// Schritt in allen vier Läufen rot.
const KUERZENDE_KLASSEN =
  /^(truncate|whitespace-nowrap|text-ellipsis|overflow-(x-)?(hidden|clip)|line-clamp-\d+)$/;

function titelSichtbarUngekuerzt(): void {
  const traeger = [
    ...container.querySelectorAll<HTMLElement>(
      `${testid("page-entwuerfe")} ${testid("entwurfsliste-eintrag-titel")}`,
    ),
  ];
  expect(traeger.length).toBeGreaterThan(0);
  for (const el of traeger) {
    const titel = (el.textContent ?? "").trim();
    expect(el.classList.contains("break-words"), `„${titel}“ bricht nicht um`).toBe(true);
    expect(el.classList.contains("block"), `„${titel}“ steht nicht als Block`).toBe(true);
    for (
      let knoten: HTMLElement | null = el;
      knoten && knoten.getAttribute("data-testid") !== "entwurfsliste-eintrag";
      knoten = knoten.parentElement
    ) {
      const kuerzend = [...knoten.classList].filter((k) => KUERZENDE_KLASSEN.test(k));
      expect(kuerzend, `„${titel}“ steht in einem kürzenden Träger (${knoten.tagName})`).toEqual(
        [],
      );
    }
  }
}

function seitenTitel(): string[] {
  return [
    ...container.querySelectorAll(
      `${testid("page-entwuerfe")} ${testid("entwurfsliste-eintrag-titel")}`,
    ),
  ].map((el) => (el.textContent ?? "").trim());
}

function zeileVon(id: string): HTMLLIElement {
  const li = container.querySelector(`[data-loeschen="${id}"]`)?.closest("li");
  if (!li) {
    throw new Error(`Zeile für „${id}“ fehlt`);
  }
  return li;
}

function fortsetzenKnopf(id: string): HTMLButtonElement {
  const el = zeileVon(id).querySelector<HTMLButtonElement>(`[data-entwurf-fortsetzen="${id}"]`);
  if (!el) {
    throw new Error(`„${i18n.t("capture.resume")}“ fehlt in der Zeile`);
  }
  return el;
}

function loeschKnopf(id: string): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>(`[data-loeschen="${id}"]`);
  if (!el) {
    throw new Error(`Löschknopf für „${id}“ fehlt`);
  }
  return el;
}

/** Der Knopf der offenen Wache-Rückfrage mit genau diesem Wort. */
function wacheKnopf(wort: string): HTMLButtonElement {
  const dialog = document.querySelector("[data-navguard-dialog]");
  const el = [...(dialog?.querySelectorAll("button") ?? [])].find(
    (b) => (b.textContent ?? "").trim() === wort,
  );
  if (!el) {
    throw new Error(`„${wort}“ fehlt in der Rückfrage`);
  }
  return el;
}

// ------------------------------------------------------------------------------------------------
// DIE FIXTURE — der eigene Testentwurf ist der JÜNGSTE und hat einen langen Titel.
// ------------------------------------------------------------------------------------------------

const ZIEL = {
  // Lang genug, dass eine Kürzung auffiele; vollständig lesbar ist Teil der Abnahme.
  title: "Kühlwasserpumpe P7 — Lagerwechsel nach 3000 Betriebsstunden und Sichtprüfung am Flansch",
  statement: "Lager rechtzeitig tauschen.",
  // „Schwingungswert" steht NUR im Inhalt, in keinem Titel: das ist die Inhaltssuche.
  bodyHtml: "<p>Ab einem <strong>Schwingungswert</strong> über 7 mm/s das Lager tauschen.</p>",
};

async function fixture(): Promise<{ ziel: string; andere: string[] }> {
  const a = await box.seed({ title: "Ventil V2 Nord", statement: "Dichtring wechseln" });
  const b = await box.seed({ title: "Anlage Süd", statement: "Druckprobe offen" });
  const ziel = await box.seed(ZIEL);
  return { ziel, andere: [a, b] };
}

beforeEach(() => {
  box.reset();
  window.localStorage.clear();
});

afterEach(async () => {
  abbauen();
  window.localStorage.clear();
  await i18n.changeLanguage("de");
  vi.clearAllMocks();
});

describe("P-ENTWUERFE-VERWALTEN · die Abnahmefolge am Stück", () => {
  for (const sprache of ["de", "en"] as const) {
    for (const modus of ["maus", "tastatur"] as const) {
      it(`${sprache} · ${modus}: Start → Meine Entwürfe → finden → öffnen → ändern → Listenwechsel mit Verwerfen → alte Fassung → löschen mit Bestätigung → weg`, async () => {
        await i18n.changeLanguage(sprache);
        const { druecke, tippe } = bedienung(modus);
        const { ziel, andere } = await fixture();

        // 1 · NORMAL ZUR LISTE: von der Startseite über den Kopfband-Punkt.
        await montiere("/start");
        expect(adresse()).toBe("/start");
        await druecke(kopfbandEntwuerfe());
        expect(adresse()).toBe("/entwuerfe");
        await warteAuf(testid("page-entwuerfe"));
        await flush();

        // 2 · NEUESTER ZUERST, VOLLSTÄNDIGER TITEL — als Text UND ohne kürzenden Träger.
        expect(seitenTitel()).toEqual([ZIEL.title, "Anlage Süd", "Ventil V2 Nord"]);
        titelSichtbarUngekuerzt();

        // 3 · FINDEN — per INHALT (ein Wort, das in keinem Titel steht) …
        const suche = await warteAuf<HTMLInputElement>(testid("entwurfsliste-suche"));
        expect(suche.getAttribute("aria-label")).toBe(i18n.t("capture.draftSearch"));
        await tippe(suche, "Schwingungswert");
        expect(seitenTitel()).toEqual([ZIEL.title]);
        // … und per TITEL.
        await tippe(suche, "Kühlwasserpumpe");
        expect(seitenTitel()).toEqual([ZIEL.title]);

        // 4 · ÖFFNEN — genau diesen Entwurf.
        await druecke(fortsetzenKnopf(ziel));
        expect(adresse()).toBe(`/erfassen?draft=${ziel}`);
        const titelfeld = await warteAuf<HTMLInputElement>(testid("blatt-titel"));
        await flush();
        expect(titelfeld.value).toBe(ZIEL.title);

        // 5 · UNGESICHERTE ÄNDERUNG.
        const geaendert = `${ZIEL.title} — GEÄNDERT`;
        await tippe(titelfeld, geaendert);
        expect(titelfeld.value).toBe(geaendert);
        expect(box.zaehler.update).toBe(0);

        // 6 · LISTENWECHSEL MIT BEWUSSTEM VERWERFEN — die gemeinsame Wache fragt, genau einmal.
        await druecke(kopfbandEntwuerfe());
        expect(document.querySelectorAll("[data-navguard-dialog]")).toHaveLength(1);
        expect(document.body.textContent).toContain(i18n.t("nav.guard.title"));
        expect(adresse(), "ohne Antwort darf der Wechsel nicht geschehen").toBe(
          `/erfassen?draft=${ziel}`,
        );
        // „Verwerfen" (ungesicherte Änderung) und „Löschen" (gespeicherter Entwurf) sind zwei
        // Wörter — sie dürfen sich nicht verwechseln lassen.
        expect(i18n.t("nav.guard.discard")).not.toBe(i18n.t("capture.discardDraftYes"));
        await druecke(wacheKnopf(i18n.t("nav.guard.discard")));
        expect(document.querySelectorAll("[data-navguard-dialog]")).toHaveLength(0);
        expect(adresse()).toBe("/entwuerfe");
        await warteAuf(testid("page-entwuerfe"));
        await flush();

        // 7 · DIE GESPEICHERTE ALTE FASSUNG IST WIEDER DA — am Bestand, in der Liste, im Blatt.
        expect(box.zaehler.update, "Verwerfen hat gespeichert").toBe(0);
        expect(box.zaehler.remove, "Verwerfen hat gelöscht").toBe(0);
        expect((await box.bestand()).find((d) => d.id === ziel)?.payload.title).toBe(ZIEL.title);
        // Der Suchfilter ist gemerkt (pro Browser, sichtbar im Feld) — der Entwurf steht darin.
        expect(seitenTitel()).toEqual([ZIEL.title]);
        await druecke(fortsetzenKnopf(ziel));
        const wieder = await warteAuf<HTMLInputElement>(testid("blatt-titel"));
        await flush();
        expect(wieder.value).toBe(ZIEL.title);
        // Zurück zur Liste: das Blatt ist sauber, also fragt die Wache NICHT.
        await druecke(kopfbandEntwuerfe());
        expect(document.querySelectorAll("[data-navguard-dialog]")).toHaveLength(0);
        expect(adresse()).toBe("/entwuerfe");
        await warteAuf(testid("page-entwuerfe"));
        await flush();

        // 8 · LÖSCHEN MIT BESTÄTIGUNG. Erst den Filter zurücknehmen, damit „weg" neben den
        // anderen gemessen wird.
        await tippe(await warteAuf<HTMLInputElement>(testid("entwurfsliste-suche")), "");
        expect(seitenTitel()).toEqual([ZIEL.title, "Anlage Süd", "Ventil V2 Nord"]);
        const loeschen = loeschKnopf(ziel);
        expect(loeschen.getAttribute("aria-label")).toBe(i18n.t("capture.discardDraftYes"));
        await druecke(loeschen);
        // Der Knopf allein löscht nichts — er fragt, und die Frage bezieht sich auf den Entwurf.
        expect(box.zaehler.remove).toBe(0);
        // Die Rückfrage ersetzt in DIESER Zeile den Löschknopf: sie steht beim Titel des Entwurfs.
        const ja = await warteAuf<HTMLButtonElement>(testid("entwurfsliste-loeschen-ja"));
        const frageZeile = ja.closest("li")?.textContent ?? "";
        expect(frageZeile).toContain(i18n.t("capture.discardDraftQ"));
        expect(frageZeile).toContain(ZIEL.title);
        expect(ja.textContent?.trim()).toBe(i18n.t("capture.discardDraftYes"));
        await druecke(ja);

        // 9 · EINTRAG WEG — auf der Fläche und am Bestand; die anderen bleiben.
        expect(box.zaehler.remove).toBe(1);
        expect(seitenTitel()).toEqual(["Anlage Süd", "Ventil V2 Nord"]);
        const rest = (await box.bestand()).map((d) => d.id).sort();
        expect(rest).toEqual([...andere].sort());
      });
    }
  }
});
