// @vitest-environment jsdom
// ================================================================================================
// JOB 3526 — EIN GEÖFFNETER ENTWURF LÄSST SICH VERLASSEN, OHNE IHN ZU LÖSCHEN.
// ================================================================================================
//
// DER BEFUND (Pedi, 10.09., 09:08). Er hatte einen gespeicherten Entwurf offen. Angeboten waren
// „sichern" und „einreichen". Er wollte weder das eine noch das andere: er wollte seine Änderungen
// wegwerfen und gehen — und den gespeicherten Entwurf behalten. Diesen Weg gab es nicht.
//
// DER WICHTIGSTE WÄCHTER IST NICHT „DER KNOPF IST DA", SONDERN FALL 3: nach dem Verlassen muss der
// gespeicherte Entwurf UNVERÄNDERT auf dem Server stehen. Ein Bau, der beim Verlassen `remove`
// ruft, sieht auf dem Bildschirm richtig aus (die Fläche ist leer, der Mensch ist weg) und hat dem
// Nutzer trotzdem genau das genommen, was er behalten wollte. Der Server dieses Tests ist deshalb
// ein echter, schreibbarer Speicher: `update` schriebe hinein, `remove` löschte daraus, und der
// Vergleich ist der vollständige Bestand vorher/nachher — nicht ein einzelnes Feld.
//
// UND FALL 5 IST DER ZWEITE PRÜFSTEIN: es wird GENAU EINMAL gefragt. Der Weg läuft durch dieselbe
// Navigationswache wie jeder andere Weg von dieser Seite (`NavGuardContext`); sähe der Mensch nach
// seiner Antwort noch den Wache-Dialog, wären zwei Rückfragen für eine Entscheidung gebaut worden.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Der SERVER dieses Tests: ein schreibbarer Bestand, kein festes Objekt. Nur so kann ein falscher
// Bau überhaupt auffallen — ein `remove` oder ein `update` beim Verlassen verändert ihn sichtbar.
// RUNDE 2 (bens Korrekturpflicht 1): der Server kann jetzt LANGSAM antworten. `bremse.halte()`
// hängt den nächsten `update`/`promote` an einem Riegel auf — genau das Fenster, in dem Ben die
// Seite verlassen konnte, während der Schreibvorgang noch lief. Ohne diese Bremse ist die Lücke
// nicht messbar: die sofort antwortenden Mocks der Runde 1 haben sie verdeckt.
const {
  server,
  bremse,
  draftsGet,
  draftsCreate,
  draftsUpdate,
  draftsRemove,
  draftsPromote,
  draftsList,
} = vi.hoisted(() => {
  const stand = {
    bestand: {} as Record<string, unknown>,
  };
  let riegel: (() => void) | null = null;
  let warte: Promise<void> | null = null;
  const tor = {
    /** Ab jetzt hängt der nächste Schreibvorgang, bis `loslassen()` kommt. */
    halte(): void {
      warte = new Promise<void>((r) => {
        riegel = r;
      });
    },
    async loslassen(): Promise<void> {
      riegel?.();
      riegel = null;
      warte = null;
    },
    async passiere(): Promise<void> {
      if (warte) {
        await warte;
      }
    },
  };
  return {
    server: stand,
    bremse: tor,
    draftsGet: vi.fn(async (id: string) => {
      const d = stand.bestand[id];
      if (!d) {
        throw new Error(`kein Entwurf ${id}`);
      }
      return JSON.parse(JSON.stringify(d)) as unknown;
    }),
    draftsList: vi.fn(
      async () => JSON.parse(JSON.stringify(Object.values(stand.bestand))) as unknown[],
    ),
    draftsCreate: vi.fn(async (payload: unknown) => {
      stand.bestand["neu-1"] = { id: "neu-1", updatedAt: "2026-09-10T12:00:00.000Z", payload };
      return { id: "neu-1" };
    }),
    draftsUpdate: vi.fn(async (id: string, payload: unknown) => {
      await tor.passiere();
      stand.bestand[id] = { id, updatedAt: "2026-09-10T12:00:00.000Z", payload };
      return { id };
    }),
    draftsRemove: vi.fn(async (id: string) => {
      await tor.passiere();
      delete stand.bestand[id];
      return {};
    }),
    draftsPromote: vi.fn(async (id: string) => {
      await tor.passiere();
      delete stand.bestand[id];
      return { id: "ko-1", title: "egal" };
    }),
  };
});

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  const arrFn = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    validation: { settings: ok({ defaultNeededValidations: 3 }) },
    external: { policy: vi.fn(async () => ({ stage: "off" })), search: vi.fn(async () => []) },
    uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
    directory: { list: arrFn() },
    gaps: { list: arrFn() },
    drafts: {
      list: draftsList,
      get: draftsGet,
      create: draftsCreate,
      update: draftsUpdate,
      remove: draftsRemove,
      promote: draftsPromote,
    },
    reasoner: {
      status: ok({ active: true, mode: "cloud", reachable: "active" }),
      config: ok(null),
      structure: vi.fn(async () => ({})),
      interview: vi.fn(async () => ({ question: "", done: true, demo: false })),
      assist: vi.fn(async () => ({ text: "" })),
      describeImage: vi.fn(async () => ({ text: "", demo: false })),
    },
    notifications: { list: arrFn(), markSeen: vi.fn(async () => ({})) },
  };
  const endpoints = new Proxy(base, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string];
      }
      return new Proxy({}, { get: () => arrFn() });
    },
  });
  return { endpoints };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { Fragment, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import type { CaptureMode } from "../../apps/web/src/lib/captureEntry";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";
// RUNDE 5: der ECHTE Toast-Viewport der App-Shell — derselbe, den der Mensch sieht. `ToastProvider`
// hält die Meldungen nur; gerendert werden sie hier. Ohne ihn im Baum stand die Meldung nirgends im
// DOM, und ein Test über den sichtbaren Satz wäre eine Messung an einem Stand-in gewesen.
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const ENTWURF_ID = "d-3526";
/** Der gespeicherte Entwurf, wie ihn der Server hält. `origin` steuert, wo das Fortsetzen landet. */
function entwurf(origin: "expert" | "studio"): Record<string, unknown> {
  return {
    id: ENTWURF_ID,
    updatedAt: "2026-09-10T09:00:00.000Z",
    payload: {
      title: "Zahlungsziel",
      statement: "Bei Neukunden gilt Vorkasse, bis die erste Rechnung beglichen ist.",
      conditions: ["Neukunde ohne Bonitätsauskunft"],
      measures: ["Vorkasse im Angebot vermerken"],
      category: "Vertrieb",
      type: "best_practice",
      confidentiality: "intern",
      origin,
    },
  };
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let startUrl = "/erfassen";
/** Wo die Fläche gerade steht — daran hängt „sie ist wirklich verlassen worden". */
let letzteAdresse = "";

function Pfadsonde(): null {
  const loc = useLocation();
  letzteAdresse = `${loc.pathname}${loc.search}`;
  return null;
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function baum(modus: CaptureMode | undefined): ReturnType<typeof createElement> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(
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
          createElement(ToastViewport),
          createElement(
            MemoryRouter,
            { initialEntries: [startUrl] },
            createElement(
              ImageDescribeProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  Fragment,
                  null,
                  createElement(Pfadsonde),
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: startUrl.split("?")[0] as string,
                      element: createElement(CaptureArbeitsraum, { modus }),
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
}

async function mount(url: string, modus: CaptureMode | undefined): Promise<void> {
  startUrl = url;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(baum(modus));
    await flush();
  });
  await act(flush);
}

/** Der Verlassen-Knopf. `null`, wenn er (richtigerweise) nicht angeboten wird. */
function verlassenKnopf(): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>("[data-testid=capture-entwurf-verlassen]");
}

function knopf(teil: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(teil),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${teil}" nicht gefunden`);
  }
  return btn;
}

async function klick(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

/** Ein Feld des Experten-Formulars, an seiner sichtbaren Beschriftung gefunden. */
function feld(label: string): HTMLInputElement | HTMLTextAreaElement {
  const l = [...container.querySelectorAll("label")].find(
    (x) => (x.querySelector("span")?.textContent ?? "").trim() === label,
  );
  const el = l?.querySelector("input, textarea");
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
    throw new Error(`Feld „${label}" nicht gefunden`);
  }
  return el;
}

/** Tippen wie ein Mensch: React hört auf das native `input`-Ereignis, nicht auf `.value =`. */
async function tippe(el: HTMLInputElement | HTMLTextAreaElement, wert: string): Promise<void> {
  const proto = Object.getPrototypeOf(el) as object;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (!setter) {
    throw new Error("kein value-Setter");
  }
  await act(async () => {
    setter.call(el, wert);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

/** Eine Auswahl treffen — wie ein Mensch, über das native `change`-Ereignis. */
async function waehle(el: HTMLSelectElement, wert: string): Promise<void> {
  const proto = Object.getPrototypeOf(el) as object;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (!setter) {
    throw new Error("kein value-Setter");
  }
  await act(async () => {
    setter.call(el, wert);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

/** Der vollständige Serverbestand als Zeichenkette — der Vergleichsgegenstand für „unverändert". */
function bestand(): string {
  return JSON.stringify(server.bestand);
}

/** Der Text der GEMEINSAMEN Wache — sie und nur sie stellt seit Runde 2 die Rückfrage. */
function wacheOffen(): boolean {
  return (document.body.textContent ?? "").includes(i18n.t("nav.guard.title"));
}

/** Wie viele Dialogflächen der Wache gerade im Baum stehen. Mehr als eine wäre der Fehler. */
function wacheDialoge(): number {
  return document.querySelectorAll("[data-navguard-dialog]").length;
}

/**
 * Der SICHTBARE Text auf dem Bildschirm — die Meldung eingeschlossen. RUNDE 5: der Fehler, den Ben
 * fand, war allein hier zu sehen. Bestand, Aufrufe und Adresse waren auf dem Speicherweg richtig;
 * falsch war der Satz, den der Mensch danach las. Ein Test, der nur Mocks zählt, findet das nie.
 */
function sichtbar(): string {
  return (document.body.textContent ?? "").replace(/\s+/g, " ");
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
  letzteAdresse = "";
  // Ein in einem Fall gehaltener Riegel darf nicht in den nächsten hineinreichen.
  await bremse.loslassen();
  server.bestand = { [ENTWURF_ID]: entwurf("expert") };
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("JOB 3526 · der dritte Weg aus einem geöffneten Entwurf", () => {
  it("1 · der geöffnete Entwurf bietet den Weg an — das leere Formular nicht", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    expect(feld(i18n.t("capture.fTitle")).value).toBe("Zahlungsziel");
    const knopfImEntwurf = verlassenKnopf();
    expect(knopfImEntwurf).not.toBeNull();
    expect((knopfImEntwurf?.textContent ?? "").trim()).toBe(i18n.t("capture.leaveDraft.action"));

    // Gegenstück: ohne geöffneten Entwurf gibt es nichts zu verlassen und nichts, was bliebe.
    act(() => root.unmount());
    container.remove();
    await mount("/erfassen", "formular");
    expect(verlassenKnopf()).toBeNull();
  });

  it("2 · mit Änderungen fragt die GEMEINSAME Wache — genau ein Dialog, kein eigener daneben", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel (neu gedacht)");

    expect(wacheOffen()).toBe(false);
    await klick(verlassenKnopf() as HTMLButtonElement);

    // RUNDE 2, bens Korrekturpflicht 2: die Rückfrage ist DIE DER WACHE, und es gibt genau eine.
    expect(wacheOffen()).toBe(true);
    expect(wacheDialoge()).toBe(1);
    // Sie bietet die drei gemeinsamen Antworten an — dieselben wie auf jedem anderen Weg von hier.
    const beschriftungen = [...document.querySelectorAll("[data-navguard-dialog] button")].map(
      (b) => (b.textContent ?? "").replace(/\s+/g, " ").trim(),
    );
    expect(beschriftungen).toContain(i18n.t("nav.guard.stay"));
    expect(beschriftungen).toContain(i18n.t("nav.guard.discard"));
    expect(beschriftungen).toContain(i18n.t("nav.guard.save"));

    // Solange nicht geantwortet ist, ist nichts passiert: Fläche steht, Bestand unberührt.
    expect(letzteAdresse).toBe(`/erfassen?draft=${ENTWURF_ID}`);
    expect(feld(i18n.t("capture.fTitle")).value).toBe("Zahlungsziel (neu gedacht)");
  });

  it("2b · Hier bleiben nimmt nichts weg — der geänderte Text steht weiter da", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel (neu gedacht)");
    await klick(verlassenKnopf() as HTMLButtonElement);
    await klick(knopf(i18n.t("nav.guard.stay")));

    expect(wacheOffen()).toBe(false);
    expect(feld(i18n.t("capture.fTitle")).value).toBe("Zahlungsziel (neu gedacht)");
    expect(letzteAdresse).toBe(`/erfassen?draft=${ENTWURF_ID}`);
  });

  it("2c · der Knopf sagt die Zusage, die Pedis Sorge beantwortet: der Entwurf bleibt", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    const zusage = verlassenKnopf()?.getAttribute("title") ?? "";
    expect(zusage).toBe(i18n.t("capture.leaveDraft.keepsDraftHint"));
    expect(zusage).toContain("bleibt unverändert erhalten");
  });

  it("3 · DER WÄCHTER: nach dem Verwerfen ist der gespeicherte Entwurf unverändert vorhanden", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    const vorher = bestand();
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel (neu gedacht)");

    await klick(verlassenKnopf() as HTMLButtonElement);
    await klick(knopf(i18n.t("nav.guard.discard")));

    // (a) Der Entwurf steht noch — Zeichen für Zeichen derselbe Bestand.
    expect(bestand()).toBe(vorher);
    expect(server.bestand[ENTWURF_ID]).toBeTruthy();
    // (b) Und zwar nicht zufällig, sondern weil dieser Weg den Entwurf gar nicht anfasst.
    expect(draftsRemove).not.toHaveBeenCalled();
    expect(draftsUpdate).not.toHaveBeenCalled();
    expect(draftsCreate).not.toHaveBeenCalled();
    // (c) Die Fläche ist wirklich verlassen.
    expect(letzteAdresse).toBe("/start");
    // (d) RUNDE 5: und der Satz, den der Mensch danach liest, ist DER des Verwerfens — nicht der
    //     des Speicherns. Auf diesem Weg ist er wahr: nichts wurde geschrieben (siehe b).
    expect(sichtbar()).toContain(i18n.t("capture.leaveDraft.done"));
    expect(sichtbar()).not.toContain(i18n.t("capture.leaveDraft.doneSaved"));
  });

  it("4 · ohne Änderungen wird nicht gefragt — es ist ja nichts zu verwerfen", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    const vorher = bestand();
    expect(feld(i18n.t("capture.fTitle")).value).toBe("Zahlungsziel");

    await klick(verlassenKnopf() as HTMLButtonElement);

    expect(wacheOffen()).toBe(false);
    expect(letzteAdresse).toBe("/start");
    expect(bestand()).toBe(vorher);
    expect(draftsRemove).not.toHaveBeenCalled();
  });

  it("4b · eine zurückgenommene Änderung ist keine Änderung — der Ausgangsstand zählt", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    const feldTitel = feld(i18n.t("capture.fTitle"));
    await tippe(feldTitel, "Zahlungsziel (neu gedacht)");
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel");

    await klick(verlassenKnopf() as HTMLButtonElement);

    expect(wacheOffen()).toBe(false);
    expect(letzteAdresse).toBe("/start");
  });

  it("5 · GENAU EINMAL gefragt: nach der Antwort steht kein zweiter Dialog mehr", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel (neu gedacht)");

    await klick(verlassenKnopf() as HTMLButtonElement);
    expect(wacheDialoge()).toBe(1);
    await klick(knopf(i18n.t("nav.guard.discard")));

    // Nach der Antwort ist der Wechsel vollzogen und KEIN Dialog mehr offen — weder ein zweiter
    // der Wache noch ein eigener der Seite.
    expect(wacheDialoge()).toBe(0);
    expect(wacheOffen()).toBe(false);
    expect(letzteAdresse).toBe("/start");
  });

  it("5b · ABLÖSUNG: die vier eigenen Dialogtexte der Runde 1 gibt es nicht mehr", async () => {
    // Der harte Beleg für „kein zweiter Schutzweg": die Schlüssel des abgelösten Dialogs sind aus
    // allen drei Sprachen verschwunden. i18next gibt einen unbekannten Schlüssel unverändert
    // zurück — genau daran ist das messbar, ohne die Datei zu lesen.
    for (const sprache of ["de", "en", "nl"]) {
      await i18n.changeLanguage(sprache);
      for (const weg of ["title", "body", "keep", "confirm"]) {
        const schluessel = `capture.leaveDraft.${weg}`;
        expect(i18n.t(schluessel), `${schluessel} (${sprache}) lebt noch`).toBe(schluessel);
      }
      // Die verbliebenen Schlüssel sind dagegen echte Texte.
      expect(i18n.t("capture.leaveDraft.action")).not.toBe("capture.leaveDraft.action");
      expect(i18n.t("capture.leaveDraft.keepsDraftHint")).not.toBe(
        "capture.leaveDraft.keepsDraftHint",
      );
    }
    await i18n.changeLanguage("de");
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
  });

  it("6 · Sichern bleibt unverändert: es aktualisiert denselben Entwurf, es entsteht keine Dublette", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel (neu gedacht)");

    await klick(knopf(i18n.t("capture.saveDraft")));

    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    expect(draftsCreate).not.toHaveBeenCalled();
    const [id, payload] = draftsUpdate.mock.calls[0] as unknown as [string, { title: string }];
    expect(id).toBe(ENTWURF_ID);
    expect(payload.title).toBe("Zahlungsziel (neu gedacht)");
    expect(Object.keys(server.bestand)).toEqual([ENTWURF_ID]);
  });

  it("7 · Einreichen bleibt unverändert: derselbe Entwurf wird promotet", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");

    await klick(knopf(i18n.t("capture.submit")));

    expect(draftsPromote).toHaveBeenCalledTimes(1);
    expect((draftsPromote.mock.calls[0] as unknown as [string])[0]).toBe(ENTWURF_ID);
    expect(draftsRemove).not.toHaveBeenCalled();
  });

  it("8 · der Weg steht auch im geführten Entscheiden-Schritt, wo Sichern und Einreichen stehen", async () => {
    server.bestand = { [ENTWURF_ID]: entwurf("studio") };
    await mount("/erfassen", undefined);

    // Entwurfsliste aufklappen und fortsetzen — der Weg, den Pedi nimmt.
    await klick(knopf(i18n.t("capture.resumeExpand", { count: 1 })));
    await klick(knopf(i18n.t("capture.resume")));

    const leiste = verlassenKnopf()?.parentElement;
    expect(leiste, "der Verlassen-Knopf steht in einer Aktionsleiste").toBeTruthy();
    const beschriftungen = [...(leiste?.querySelectorAll("button") ?? [])].map((b) =>
      (b.textContent ?? "").replace(/\s+/g, " ").trim(),
    );
    // Er steht dort, wo auch Sichern und Einreichen stehen — nicht irgendwo auf der Seite.
    expect(beschriftungen).toContain(i18n.t("capture.leaveDraft.action"));
    expect(beschriftungen.some((b) => b.includes(i18n.t("capture.saveDraft")))).toBe(true);
    expect(beschriftungen.some((b) => b.includes(i18n.t("capture.submit")))).toBe(true);

    // Eine Änderung, die genau in dieser Karte erreichbar ist: die Vertraulichkeitsstufe.
    const stufe = container.querySelector<HTMLSelectElement>(
      "[data-testid=capture-vertraulichkeit]",
    );
    expect(stufe?.value).toBe("intern");
    const andere = [...(stufe?.options ?? [])].map((o) => o.value).find((v) => v && v !== "intern");
    await waehle(stufe as HTMLSelectElement, andere as string);

    const vorher = bestand();
    await klick(verlassenKnopf() as HTMLButtonElement);
    expect(wacheOffen()).toBe(true);
    await klick(knopf(i18n.t("nav.guard.discard")));
    expect(letzteAdresse).toBe("/start");
    expect(bestand()).toBe(vorher);
    expect(draftsRemove).not.toHaveBeenCalled();
    expect(draftsUpdate).not.toHaveBeenCalled();
  });

  it("9 · EN: Knopf, Zusage und Rückfrage stehen auch auf Englisch da", async () => {
    await i18n.changeLanguage("en");
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    await tippe(feld(i18n.t("capture.fTitle")), "Payment terms (revised)");

    expect((verlassenKnopf()?.textContent ?? "").trim()).toBe("Leave draft");
    expect(verlassenKnopf()?.getAttribute("title")).toBe(
      "Discards the changes made since you opened it. The saved draft remains unchanged.",
    );
    await klick(verlassenKnopf() as HTMLButtonElement);
    expect(document.body.textContent ?? "").toContain("Unsaved entry");

    const vorher = bestand();
    await klick(knopf(i18n.t("nav.guard.discard")));
    expect(letzteAdresse).toBe("/start");
    expect(bestand()).toBe(vorher);
    expect(draftsRemove).not.toHaveBeenCalled();
  });

  // ==============================================================================================
  // RUNDE 2 · KORREKTURPFLICHT 1 (ben): KEIN AUSGANG, SOLANGE GESCHRIEBEN WIRD.
  // ==============================================================================================
  //
  // Bens Befund: mit verzögertem `update`/`promote` liess sich die Seite verlassen, WÄHREND der
  // Vorgang lief — und die Zusage „der gespeicherte Entwurf ist unverändert" war danach falsch
  // (Save schrieb, Promote löschte). Beide Fälle brauchen die Bremse, sonst sind sie unmessbar.

  it("10 · während SICHERN läuft, ist der Ausgang zu — und die Zusage wird nicht gegeben", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel (neu gedacht)");

    bremse.halte();
    await klick(knopf(i18n.t("capture.saveDraft")));
    // Der Save hängt jetzt im Riegel: genau Bens Fenster.
    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    expect(server.bestand[ENTWURF_ID]).toEqual(entwurf("expert"));

    // (a) Der Weg ist sichtbar zu und nennt den Grund.
    const aus = verlassenKnopf() as HTMLButtonElement;
    expect(aus.disabled).toBe(true);
    expect(aus.getAttribute("title")).toBe(i18n.t("capture.leaveDraft.busy"));

    // (b) Und er ist auch wirksam zu: ein Klick trotzdem bewegt nichts.
    await klick(aus);
    expect(wacheOffen()).toBe(false);
    expect(letzteAdresse).toBe(`/erfassen?draft=${ENTWURF_ID}`);

    // (c) Nach dem Ende des Vorgangs steht der Bestand so da, wie der Save ihn hinterlässt —
    //     und niemand hat behauptet, er sei unverändert.
    await act(async () => {
      await bremse.loslassen();
      await flush();
    });
    expect(letzteAdresse).toBe(`/erfassen?draft=${ENTWURF_ID}`);
    expect((server.bestand[ENTWURF_ID] as { payload: { title: string } }).payload.title).toBe(
      "Zahlungsziel (neu gedacht)",
    );
  });

  // ==============================================================================================
  // RUNDE 5 · KORREKTURPFLICHT 1 (ben): DIE DRITTE ANTWORT DARF NICHT „VERWORFEN" MELDEN.
  // ==============================================================================================
  //
  // Bens Gegenprobe: Titel ändern → „Entwurf verlassen" → „Entwurf speichern und wechseln". Gemessen
  // hat er genau ein `update`, einen GEÄNDERTEN Bestand, die Adresse `/start` — und dazu den Satz
  // „Die Änderungen seit dem Öffnen sind verworfen, der gespeicherte Entwurf ist unverändert."
  // Gespeichert UND verworfen kann nicht beides sein.
  //
  // Der Grund liegt in der gemeinsamen Wache und ist keine Nachlässigkeit dieser Seite: `runPending()`
  // — und damit der `proceed`-Rückruf — läuft nach „Verwerfen und wechseln" UND nach erfolgreichem
  // Speichern (NavGuardContext.tsx: `saveAndGo`). Wer hier eine Meldung fest an den Rückruf hängt,
  // hängt sie an ZWEI Antworten. Diese beiden Fälle halten das dauerhaft fest.

  it("12 · Speichern und wechseln: der Entwurf ist geschrieben — und die Meldung sagt genau das", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel (neu gedacht)");

    await klick(verlassenKnopf() as HTMLButtonElement);
    expect(wacheOffen()).toBe(true);
    await klick(knopf(i18n.t("nav.guard.save")));

    // (a) Es wurde wirklich gespeichert — derselbe Entwurf, keine Dublette.
    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    expect(draftsCreate).not.toHaveBeenCalled();
    expect(draftsRemove).not.toHaveBeenCalled();
    expect(Object.keys(server.bestand)).toEqual([ENTWURF_ID]);
    expect((server.bestand[ENTWURF_ID] as { payload: { title: string } }).payload.title).toBe(
      "Zahlungsziel (neu gedacht)",
    );
    // (b) Die Fläche ist verlassen.
    expect(letzteAdresse).toBe("/start");
    expect(wacheDialoge()).toBe(0);
    // (c) DER PRÜFSTEIN: der Satz auf dem Bildschirm gehört zum Speichern. Die Verwerfen-Zusage
    //     („die Änderungen sind verworfen, der gespeicherte Entwurf ist unverändert") wäre hier
    //     Zeichen für Zeichen das Gegenteil des gemessenen Bestands.
    expect(sichtbar()).toContain(i18n.t("capture.leaveDraft.doneSaved"));
    expect(sichtbar()).not.toContain(i18n.t("capture.leaveDraft.done"));
  });

  it("12b · EN: derselbe Speicherweg, derselbe wahre Satz — auf Englisch", async () => {
    await i18n.changeLanguage("en");
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    await tippe(feld(i18n.t("capture.fTitle")), "Payment terms (revised)");

    await klick(verlassenKnopf() as HTMLButtonElement);
    await klick(knopf(i18n.t("nav.guard.save")));

    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    expect((server.bestand[ENTWURF_ID] as { payload: { title: string } }).payload.title).toBe(
      "Payment terms (revised)",
    );
    expect(letzteAdresse).toBe("/start");
    // Wörtlich, nicht über den Schlüssel: ein leerer oder fehlender EN-Text fiele sonst nicht auf.
    expect(sichtbar()).toContain(
      "Draft left. The changes made since you opened it are stored in the saved draft.",
    );
    expect(sichtbar()).not.toContain("were discarded");
  });

  it("11 · während EINREICHEN läuft, ist der Ausgang zu — sonst verspräche er einen Entwurf, den Promote löscht", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");

    bremse.halte();
    await klick(knopf(i18n.t("capture.submit")));
    expect(draftsPromote).toHaveBeenCalledTimes(1);

    const aus = verlassenKnopf();
    // Der Knopf ist entweder gar nicht mehr da (die Fläche hat auf „eingereicht" umgeschaltet)
    // oder er ist gesperrt — beides ist richtig; ein BEDIENBARER Ausgang wäre der Fehler.
    if (aus) {
      expect(aus.disabled).toBe(true);
      await klick(aus);
      expect(letzteAdresse).toBe(`/erfassen?draft=${ENTWURF_ID}`);
      expect(wacheOffen()).toBe(false);
    }

    await act(async () => {
      await bremse.loslassen();
      await flush();
    });
    // Promote hat den Entwurf serverseitig entfernt — genau die Zusage, die ein Verlassen im
    // Fenster davor gebrochen hätte.
    expect(server.bestand[ENTWURF_ID]).toBeUndefined();
  });
});
