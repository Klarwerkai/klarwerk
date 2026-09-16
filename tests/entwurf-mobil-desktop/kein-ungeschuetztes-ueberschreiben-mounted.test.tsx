// @vitest-environment jsdom
// ================================================================================================
// JOB 4193 R5 · BENs ZWEI REPRODUKTIONEN — UND DIE DREI VARIANTEN DESSELBEN LOCHS.
// ================================================================================================
//
// BEN hat in Runde 4 an UNVERÄNDERTEM Code nachgewiesenen Datenverlust gemessen. Beide Wege stehen
// hier dauerhaft, in seiner Reihenfolge und mit seiner Messgrösse — dem NACHGELESENEN Serverstand:
//
//   BEN 1 (`Mobile.tsx:438`) · offline speichern → Desktop ändert → WEITERHIN OFFLINE wieder
//         öffnen und erneut speichern → online gehen. Gemessen wurde „Versionsstand FEHLT" und
//         danach `Handy zweiter Wurf` statt `Fassung Desktop`. Ursache: `resume` übernahm nur
//         `op.payload`; die Nutzlast trägt keinen Stand, und das zweite Speichern strich den Stand
//         am selben Warteschlangeneintrag mit weg.
//   BEN 2 (`Mobile.tsx:630`) · abgewiesenen Sync wieder öffnen → Kasten steht → den NORMALEN
//         Speicherknopf drücken. Gemessen: `Fassung Handy` statt `Fassung Desktop`, ohne dass ein
//         Konfliktweg gewählt wurde.
//
// Dazu BENs Prüflücke 6, drei Varianten derselben Klasse: Speichern WÄHREND der Vergleich läuft,
// Speichern nachdem er GESCHEITERT ist, und der Weggeh-Wächter nach dem Wiederöffnen. In allen
// fünf Fällen gilt dieselbe eine Frage: steht hinterher noch die fremde Fassung auf dem Server?
//
// GEFAHREN WIRD DIE ECHTE KETTE: echter `CaptureService` (echter Merge, echter Sanitizer, echter
// `DraftStaleError`), echte Offline-Warteschlange mit echtem `localStorage` und echten
// `online`/`offline`-Ereignissen, echter NavGuard.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  seed: async (_payload: Record<string, unknown>): Promise<string> => "",
  lies: async (_id: string): Promise<Record<string, unknown>> => ({}),
  fremdSchreiben: async (_id: string, _payload: Record<string, unknown>): Promise<void> => {},
  /** Wie sich der frische Abruf verhält — für BENs Varianten „läuft noch" und „gescheitert". */
  getModus: "normal" as "normal" | "haengt" | "kaputt",
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
  const { CaptureService, DraftStaleError } = await import("../../services/capture/src/service");
  const { ApiError } = await import("../../apps/web/src/api/client");
  type P = Record<string, unknown>;
  let svc = new CaptureService({ repo: new InMemoryDraftRepo() });
  box.reset = () => {
    svc = new CaptureService({ repo: new InMemoryDraftRepo() });
    box.getModus = "normal";
  };
  box.seed = async (payload: P) => (await svc.createDraft(payload, "u1")).id;
  box.lies = async (id: string) => {
    const alle = await svc.listDrafts();
    const treffer = alle.find((d) => d.id === id);
    if (!treffer) {
      throw new Error(`Entwurf ${id} nicht gefunden`);
    }
    return treffer.payload as unknown as P;
  };
  box.fremdSchreiben = async (id: string, payload: P) => {
    await svc.continueDraft(id, payload, "u2");
  };
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ stage: "search_on_click" }), search: ok([]) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      ko: { list: ok([]) },
      conflicts: { list: ok([]) },
      library: { search: ok([]) },
      ask: { ask: ok({ answered: false }) },
      drafts: {
        list: vi.fn(async () => svc.listDrafts()),
        get: vi.fn(async (id: string) => {
          if (box.getModus === "haengt") {
            // Der Abruf kommt NIE zurück — die Fläche bleibt in „lädt".
            return new Promise(() => {});
          }
          if (box.getModus === "kaputt") {
            throw new ApiError(500, "INTERNAL", "Abruf gescheitert.");
          }
          return (await svc.resumeDraft(id))?.draft;
        }),
        create: vi.fn(async (p: P) => svc.createDraft(p, "u1")),
        update: vi.fn(async (id: string, p: P, opts?: { expectedUpdatedAt?: string }) => {
          try {
            return await svc.continueDraft(
              id,
              p,
              "u1",
              opts?.expectedUpdatedAt ? { expectedUpdatedAt: opts.expectedUpdatedAt } : {},
            );
          } catch (e) {
            if (e instanceof DraftStaleError) {
              throw new ApiError(409, "DRAFT_STALE", e.message);
            }
            throw e;
          }
        }),
        remove: vi.fn(async (id: string) => svc.deleteDraft(id)),
        promote: vi.fn(async () => ({})),
      },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
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
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import type { VorgangMitStand } from "../../apps/web/src/app/useOfflineQueue";
import i18n from "../../apps/web/src/i18n";
import { Mobile } from "../../apps/web/src/pages/Mobile";

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

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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
                  { initialEntries: [{ pathname: "/mobile", state: { from: "/start" } }] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, { path: "/mobile", element: createElement(Mobile) }),
                    createElement(Route, {
                      path: "/start",
                      element: createElement("div", null, "START-SEITE"),
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
}

function abbauen(): void {
  act(() => root.unmount());
  container.remove();
}

function knopf(teil: string): HTMLButtonElement {
  const b = [...container.querySelectorAll("button")].find((el) =>
    (el.textContent ?? "").replace(/\s+/g, " ").includes(teil),
  );
  if (!(b instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${teil}“ nicht gefunden`);
  }
  return b;
}

function knopfMitTitel(title: string): HTMLButtonElement {
  const b = container.querySelector(`button[title="${title}"]`);
  if (!(b instanceof HTMLButtonElement)) {
    throw new Error(`Knopf mit Titel „${title}“ nicht gefunden`);
  }
  return b;
}

async function klick(b: HTMLButtonElement): Promise<void> {
  await act(async () => {
    b.click();
    await flush();
  });
}

function textfeld(): HTMLTextAreaElement {
  const el = container.querySelector("textarea");
  if (!(el instanceof HTMLTextAreaElement)) {
    throw new Error("Mobiles Textfeld nicht gefunden");
  }
  return el;
}

async function tippe(wert: string): Promise<void> {
  const el = textfeld();
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(el, wert);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

function kasten(): HTMLElement | null {
  const el = container.querySelector('[data-testid="mob-stand-konflikt"]');
  return el instanceof HTMLElement ? el : null;
}

/** Der Speicherknopf der Fläche — der Weg, den BEN in seiner zweiten Gegenprobe gedrückt hat. */
function speicherknopf(): HTMLButtonElement {
  return knopf(i18n.t("mob.update"));
}

function warteschlange(): VorgangMitStand[] {
  return JSON.parse(localStorage.getItem("kw.offlineQueue.v1") ?? "[]") as VorgangMitStand[];
}

async function netz(an: boolean): Promise<void> {
  Object.defineProperty(navigator, "onLine", { value: an, configurable: true });
  await act(async () => {
    window.dispatchEvent(new Event(an ? "online" : "offline"));
    await flush();
  });
}

/**
 * Der gemeinsame Ausgangspunkt beider Reproduktionen: ein Entwurf ist offline bearbeitet, der
 * Desktop hat danach eine andere Fassung geschrieben. Zurück kommt die Entwurfskennung.
 */
async function offlineGespeichertUndFremdGeaendert(text: string): Promise<string> {
  const id = await box.seed({ title: "Wartung der Presse", statement: "Ursprung" });
  await mount();
  await klick(knopfMitTitel(i18n.t("mob.resume")));
  await netz(false);
  await tippe(text);
  await klick(speicherknopf());
  await box.fremdSchreiben(id, { statement: "Fassung Desktop" });
  return id;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  localStorage.clear();
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  box.reset();
});

afterEach(async () => {
  await netz(true);
  vi.clearAllMocks();
});

describe("JOB 4193 R5 · BEN 1 — der Versionsstand überlebt das zweite Offline-Speichern", () => {
  it("offline speichern, Desktop ändert, WEITERHIN OFFLINE erneut speichern → das Nachsenden wird abgewiesen, die Desktop-Fassung bleibt", async () => {
    const id = await offlineGespeichertUndFremdGeaendert("Handy erster Wurf");

    // Der liegende Vorgang trägt seinen Stand — das ist die Voraussetzung, um die es geht.
    expect(warteschlange()[0]?.seenUpdatedAt).toBeTruthy();

    // WIEDERÖFFNEN OHNE VERBINDUNG: kein Vergleich möglich, aber der Stand muss mitkommen.
    await klick(knopfMitTitel(i18n.t("mob.resume")));
    expect(textfeld().value).toBe("Handy erster Wurf");
    expect(kasten()).toBeNull(); // offline wird nichts behauptet

    // ZWEITES Speichern, immer noch offline — hier ging der Stand bisher verloren.
    await tippe("Handy zweiter Wurf");
    await klick(speicherknopf());
    const liegend = warteschlange();
    expect(liegend).toHaveLength(1);
    expect(liegend[0]?.payload.statement).toBe("Handy zweiter Wurf");
    expect(liegend[0]?.seenUpdatedAt, "BEN: „Versionsstand FEHLT“").toBeTruthy();

    // Verbindung zurück → das Nachsenden läuft an und wird ABGEWIESEN.
    await netz(true);
    const nachSync = warteschlange();
    expect(nachSync).toHaveLength(1); // nichts verloren
    expect(nachSync[0]?.status).toBe("failed");
    abbauen();

    // BENs Messgrösse: der NACHGELESENE Serverstand.
    expect((await box.lies(id)).statement).toBe("Fassung Desktop");
  });
});

describe("JOB 4193 R5 · BEN 2 — bei offener Rückfrage schreibt kein Weg an ihr vorbei", () => {
  it("abgewiesenen Sync wiederöffnen, Kasten steht, normaler Speicherknopf gedrückt → nichts überschrieben", async () => {
    const id = await offlineGespeichertUndFremdGeaendert("Fassung Handy");
    await netz(true); // Sync läuft an und wird abgewiesen
    expect((await box.lies(id)).statement).toBe("Fassung Desktop");

    await klick(knopfMitTitel(i18n.t("mob.resume")));
    expect(kasten()).not.toBeNull();

    // Der Knopf ist SICHTBAR gesperrt …
    expect(speicherknopf().disabled).toBe(true);
    // … und auch ein Klick (Tastatur, gleicher Tick) schreibt nicht.
    await klick(speicherknopf());
    abbauen();

    expect((await box.lies(id)).statement).toBe("Fassung Desktop");
  });

  it("GEGENPROBE: nach „Meine Fassung behalten“ ist der Knopf wieder frei — die Sperre hängt am Konflikt, nicht am Entwurf", async () => {
    const id = await offlineGespeichertUndFremdGeaendert("Fassung Handy");
    await netz(true);
    await klick(knopfMitTitel(i18n.t("mob.resume")));
    expect(speicherknopf().disabled).toBe(true);

    await klick(knopf(i18n.t("mob.stand.behalten")));
    expect(kasten()).toBeNull();
    expect(speicherknopf().disabled).toBe(false);

    // Und die Wahl wirkt: der Vorgang geht mit dem frischen Stand raus.
    await klick(knopf(i18n.t("mob.syncNow")));
    abbauen();
    expect((await box.lies(id)).statement).toBe("Fassung Handy");
  });
});

describe("JOB 4193 R5 · BENs Prüflücke 6 — auch die halben Vergleiche sperren", () => {
  it("WÄHREND der Vergleich läuft (`lädt`) wird nicht gespeichert", async () => {
    const id = await offlineGespeichertUndFremdGeaendert("Fassung Handy");
    await netz(true);
    box.getModus = "haengt";

    await klick(knopfMitTitel(i18n.t("mob.resume")));
    expect(kasten()?.textContent).toContain(i18n.t("mob.stand.laedt"));
    expect(speicherknopf().disabled).toBe(true);
    await klick(speicherknopf());
    abbauen();

    expect((await box.lies(id)).statement).toBe("Fassung Desktop");
  });

  it("nach einem GESCHEITERTEN Vergleich wird nicht gespeichert — der Vergleich wird nicht behauptet", async () => {
    const id = await offlineGespeichertUndFremdGeaendert("Fassung Handy");
    await netz(true);
    box.getModus = "kaputt";

    await klick(knopfMitTitel(i18n.t("mob.resume")));
    expect(kasten()?.textContent).toContain(i18n.t("mob.stand.pruefungFehlt"));
    expect(speicherknopf().disabled).toBe(true);
    await klick(speicherknopf());
    abbauen();

    expect((await box.lies(id)).statement).toBe("Fassung Desktop");
  });

  it("der WEGGEH-WÄCHTER schreibt ebenfalls nicht vorbei — der Dialog bleibt stehen und nennt den Grund", async () => {
    const id = await offlineGespeichertUndFremdGeaendert("Fassung Handy");
    await netz(true);
    await klick(knopfMitTitel(i18n.t("mob.resume")));
    expect(kasten()).not.toBeNull();

    // Erst durch eine Eingabe wird der Wächter überhaupt zuständig.
    await tippe("Fassung Handy, noch etwas");
    await klick(knopf(i18n.t("topbar.toDesktop")));
    expect(container.querySelector("[data-navguard-dialog]")).not.toBeNull();

    await klick(knopf(i18n.t("nav.guard.save")));
    // Nicht gewechselt, Grund sichtbar, nichts geschrieben.
    expect(container.querySelector("[data-navguard-dialog]")).not.toBeNull();
    expect(container.textContent).not.toContain("START-SEITE");
    expect(container.querySelector("[data-navguard-save-error]")?.textContent).toContain(
      i18n.t("mob.stand.erstAufloesen"),
    );
    abbauen();

    expect((await box.lies(id)).statement).toBe("Fassung Desktop");
  });
});

describe("JOB 4193 R5 · der letzte ungeschützte Schreibweg der Warteschlange ist zu", () => {
  it("ein Aktualisierungsvorgang OHNE gesehenen Stand (Rest aus einer früheren Sitzung) wird nicht gesendet und nicht gelöscht", async () => {
    const id = await box.seed({ title: "Wartung der Presse", statement: "Fassung Desktop" });
    // Genau die Gestalt, die eine Sitzung VOR diesem Auftrag hinterlassen hat: kein `seenUpdatedAt`.
    localStorage.setItem(
      "kw.offlineQueue.v1",
      JSON.stringify([
        {
          id: "op-alt",
          kind: "draft.update",
          draftId: id,
          payload: { statement: "Alter Rest ohne Stand" },
          status: "queued",
          error: null,
          createdAt: "2026-09-15T09:00:00.000Z",
          title: "Wartung der Presse",
        },
      ]),
    );

    await mount();
    await netz(true);

    const liegend = warteschlange();
    expect(liegend, "der Vorgang bleibt liegen — gelöscht wird er nie").toHaveLength(1);
    expect(liegend[0]?.status).toBe("failed");
    abbauen();

    // NICHTS überschrieben: der Serverstand ist unberührt.
    expect((await box.lies(id)).statement).toBe("Fassung Desktop");
  });
});

// ================================================================================================
// JOB 4193 R6 · BENs ZWEITE RUNDE FINDET DEN WEG DANEBEN — der Altvorgang, OFFLINE geöffnet.
// ================================================================================================
//
// BEN R5, wörtlich: „alten Warteschlangeneintrag ohne `seenUpdatedAt` OFFLINE öffnen, bearbeiten,
// online gehen, anschliessend normal oder über NavGuard speichern. Beide Male steht nachgelesen
// `Handy nach Wiederöffnung` statt `Fassung Desktop`."
//
// WARUM DIE SPERRE AUS R5 DAS NICHT FING: sie fragte den KONFLIKTZUSTAND ab (`konflikt !== null`).
// Offline gibt es keinen Vergleich und damit keinen Zustand — die Sperre war offen, und der Weg
// daneben schrieb ungeschützt. Seit R6 hängt die Bedingung am Engpass selbst (`sendeEntwurf`):
// ohne Voraussetzung wird nicht geschrieben, sondern verglichen.
async function altvorgangOffineGeoeffnetUndBearbeitet(): Promise<string> {
  const id = await box.seed({ title: "Wartung der Presse", statement: "Fassung Desktop" });
  localStorage.setItem(
    "kw.offlineQueue.v1",
    JSON.stringify([
      {
        id: "op-alt",
        kind: "draft.update",
        draftId: id,
        payload: { statement: "Alter Rest ohne Stand" },
        status: "queued",
        error: null,
        createdAt: "2026-09-15T09:00:00.000Z",
        title: "Wartung der Presse",
      },
    ]),
  );
  // OHNE VERBINDUNG öffnen: hier entsteht kein Konfliktzustand, den eine Sperre abfragen könnte.
  Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
  await mount();
  await klick(knopfMitTitel(i18n.t("mob.resume")));
  expect(textfeld().value).toBe("Alter Rest ohne Stand");
  expect(kasten(), "offline wird nichts behauptet").toBeNull();
  await tippe("Handy nach Wiederöffnung");
  await netz(true);
  return id;
}

describe("JOB 4193 R6 · BEN R5 — ein Altvorgang ohne Stand schreibt auch direkt nicht ungeprüft", () => {
  it("BEN R5/1 · nach Netzrückkehr den NORMALEN Speicherknopf drücken → verglichen statt geschrieben, die Desktop-Fassung bleibt", async () => {
    const id = await altvorgangOffineGeoeffnetUndBearbeitet();

    await klick(speicherknopf());

    // Statt eines Schreibvorgangs steht jetzt die Rückfrage — mit der eigenen Fassung im Feld.
    expect(kasten(), "es wird verglichen, nicht geschrieben").not.toBeNull();
    expect(textfeld().value).toBe("Handy nach Wiederöffnung");
    abbauen();

    // BENs Messgrösse: nachgelesen steht die fremde Fassung noch da.
    expect((await box.lies(id)).statement).toBe("Fassung Desktop");
  });

  it("BEN R5/2 · nach Netzrückkehr über den WEGGEH-WÄCHTER speichern → derselbe Ausgang, nichts überschrieben", async () => {
    const id = await altvorgangOffineGeoeffnetUndBearbeitet();

    await klick(knopf(i18n.t("topbar.toDesktop")));
    expect(container.querySelector("[data-navguard-dialog]")).not.toBeNull();
    await klick(knopf(i18n.t("nav.guard.save")));

    // Nicht gewechselt, Grund genannt, nichts geschrieben.
    expect(container.querySelector("[data-navguard-dialog]")).not.toBeNull();
    expect(container.textContent).not.toContain("START-SEITE");
    expect(container.querySelector("[data-navguard-save-error]")?.textContent).toContain(
      i18n.t("mob.stand.erstAufloesen"),
    );
    abbauen();

    expect((await box.lies(id)).statement).toBe("Fassung Desktop");
  });

  it("BEN R5/3 · und die ausdrücklich gewählte Auflösung kommt durch: „Meine Fassung behalten“ speichert gegen den frischen Stand", async () => {
    const id = await altvorgangOffineGeoeffnetUndBearbeitet();
    await klick(speicherknopf());
    expect(kasten()).not.toBeNull();

    await klick(knopf(i18n.t("mob.stand.behalten")));
    expect(kasten(), "aufgelöst — der Kasten ist weg").toBeNull();
    abbauen();

    // Jetzt, und erst jetzt, trägt der Entwurf die mobile Fassung.
    expect((await box.lies(id)).statement).toBe("Handy nach Wiederöffnung");
  });

  it("BEN R5/4 · KALIBRIERUNG: der gewöhnliche Weg bleibt gewöhnlich — mit Voraussetzung wird ohne Rückfrage gespeichert", async () => {
    // Ohne diesen Fall wäre auch eine Fläche „grün", die JEDES Speichern in eine Rückfrage
    // verwandelt. Hier wird der Entwurf normal fortgesetzt (der Stand reist also mit), niemand
    // schreibt dazwischen — es muss glatt durchgehen.
    const id = await box.seed({ title: "Wartung der Presse", statement: "Ursprung" });
    await mount();
    await klick(knopfMitTitel(i18n.t("mob.resume")));
    await tippe("Nur vom Handy ergänzt");
    expect(speicherknopf().disabled).toBe(false);

    await klick(speicherknopf());
    expect(kasten(), "keine Rückfrage ohne Anlass").toBeNull();
    abbauen();

    expect((await box.lies(id)).statement).toBe("Nur vom Handy ergänzt");
  });
});
