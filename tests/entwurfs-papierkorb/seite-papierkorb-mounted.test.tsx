// @vitest-environment jsdom
// ==================================================================================================
// JOB 3668 — DER PAPIERKORB AUF „MEINE ENTWÜRFE“, AN DER ECHTEN FLÄCHE.
// ==================================================================================================
//
// Pedis Satz vom 11.09.2026: *„Ich habe eben alle Entwürfe gelöscht. Nicht einer befindet sich im
// Papierkorb."* Diese Datei misst die Antwort darauf dort, wo er sie sehen würde — auf der Seite
// „Meine Entwürfe", gemountet, mit dem ECHTEN Entwurfsdienst (`CaptureService` +
// `InMemoryDraftRepo`) hinter den Endpunkten. Keine Attrappe des Papierkorbs: gelöscht wird über
// `deleteDraft`, gelistet über `listTrashedDrafts`, zurückgeholt über `restoreDraft`, endgültig
// entfernt über `purgeTrashedDraft` — dieselben Wege, die die Routen fahren.
//
// U1 löschen → aus der Liste fort, IM Papierkorb sichtbar, mit Zeitpunkt
// U2 wiederherstellen → zurück in der Liste, und der Papierkorb ist leer
// U3 endgültig löschen ist ein ZWEITER Griff: erst die Rückfrage, dann weg
// U4 „Behalten" bricht ab — der Eintrag bleibt stehen
// U5 leerer Papierkorb sagt das, statt einer leeren Fläche
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  zeit: 0,
  seed: async (_p: Record<string, unknown>): Promise<string> => "",
  papierkorb: async (): Promise<unknown[]> => [],
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
  box.papierkorb = () => svc.listTrashedDrafts();
  // Der nachgebaute Listenendpunkt trimmt den Papierkorb — wie die echte Route
  // (`visibleDraftsFor`, `services/app/src/routes/capture-routes.ts`).
  const lebende = async () => (await svc.listDrafts()).filter((d) => !("deletedAt" in d));
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      drafts: {
        list: vi.fn(lebende),
        get: vi.fn(async (id: string) => svc.getDraft(id)),
        create: vi.fn(async (p: P) => svc.createDraft(p, "u1")),
        update: vi.fn(async (id: string, p: P) => svc.continueDraft(id, p, "u1")),
        remove: vi.fn(async (id: string) => svc.deleteDraft(id, "u1")),
        trash: vi.fn(() => svc.listTrashedDrafts("u1")),
        restore: vi.fn(async (id: string) => svc.restoreDraft(id)),
        purge: vi.fn(async (id: string) => svc.purgeTrashedDraft(id)),
        promote: ok({ id: "ko-1", title: "egal" }),
      },
      directory: { list: ok([{ id: "u1", name: "Pia", email: "p@x.de", role: "experte" }]) },
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
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
// Der Import initialisiert react-i18next. Ohne ihn rendert die Fläche die SCHLÜSSEL statt der
// Wörter — und ein Test, der `adm.trash.deletedMeta` im Text findet, hätte nichts gemessen.
import i18n from "../../apps/web/src/i18n";
import { AppRoutes } from "../../apps/web/src/routes";

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

/**
 * AUF EINEN ZUSTAND WARTEN, NICHT AUF EINE ANZAHL VON TAKTEN.
 *
 * Eine feste Zahl von Durchläufen ist eine Wette auf die Maschine: auf einem ausgelasteten Rechner
 * (der Taktgeber fährt mehrere Bahnen) braucht ein Abruf mehr Takte, und der Fall wird rot, ohne
 * dass am Produkt etwas falsch wäre. Genau das ist beim Bauen dieses Tests einmal passiert. Hier
 * wird deshalb auf die BEDINGUNG gewartet — und wenn sie nicht eintritt, sagt der Abbruch, welche.
 */
const warteBis = async (bedingung: () => boolean, was: string): Promise<void> => {
  for (let i = 0; i < 200; i++) {
    if (bedingung()) {
      return;
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
  throw new Error(`Zustand nie erreicht: ${was}`);
};

const finde = (auswahl: string): HTMLElement | null => container.querySelector(auswahl);
const klick = async (auswahl: string): Promise<void> => {
  await warteBis(() => finde(auswahl) !== null, `Bedienelement ${auswahl}`);
  const el = finde(auswahl) as HTMLElement;
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flush();
};

/** Die Titel, die in der LEBENDEN Liste stehen (neutrale Anker der Entwurfsliste). */
const listenTitel = (): string[] =>
  [...container.querySelectorAll("[data-loeschen]")].map(
    (el) => el.closest("li")?.textContent ?? "",
  );

const papierkorbZeilen = (): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>('[data-testid^="entwuerfe-papierkorb-zeile-"]'),
];

async function montiere(): Promise<void> {
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
                { initialEntries: ["/entwuerfe"] },
                createElement(
                  ImageDescribeProvider,
                  null,
                  createElement(NavGuardProvider, null, createElement(AppRoutes)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await flush();
}

/**
 * Den Entwurf über den BESTÄTIGTEN Weg der Liste löschen (zwei Klicks, wie ein Mensch) — die
 * vorhandenen Anker von `CaptureDraftList`: `data-loeschen="<id>"` öffnet die Rückfrage,
 * `entwurfsliste-loeschen-ja` bestätigt sie.
 */
async function loeschen(id: string): Promise<void> {
  await klick(`[data-loeschen="${id}"]`);
  await klick('[data-testid="entwurfsliste-loeschen-ja"]');
  await warteBis(() => papierkorbZeilen().length > 0, "der Entwurf erscheint im Papierkorb");
}

/** Die Seite ist da UND ihre beiden Abrufe sind durch. */
async function seiteMitEinemEntwurf(titel: string): Promise<string> {
  const id = await box.seed({ title: titel });
  await montiere();
  await warteBis(() => listenTitel().length === 1, "die Entwurfsliste steht");
  return id;
}

beforeEach(async () => {
  box.reset();
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("JOB 3668 · U — der Papierkorb auf „Meine Entwürfe“", () => {
  it("U1 · gelöscht heisst: aus der Liste fort UND im Papierkorb sichtbar", async () => {
    const id = await seiteMitEinemEntwurf("Dichtungswechsel L4");
    expect(listenTitel().join(" ")).toContain("Dichtungswechsel L4");

    await loeschen(id);

    expect(listenTitel()).toEqual([]);
    const zeilen = papierkorbZeilen();
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]?.textContent).toContain("Dichtungswechsel L4");
    // „was gelöscht wurde und wann" (§4.2) — der Zeitpunkt steht als Datum da, nicht als Rohwert.
    expect(zeilen[0]?.textContent).toMatch(/\d{2}\.\d{2}\.\d{2}/);
    // Und in der Ablage liegt er wirklich, nicht nur auf der Fläche.
    expect(await box.papierkorb()).toHaveLength(1);
  });

  it("U2 · Wiederherstellen bringt ihn zurück in die Liste, der Papierkorb ist danach leer", async () => {
    const id = await seiteMitEinemEntwurf("Dichtungswechsel L4");
    await loeschen(id);

    await klick(`[data-testid="entwuerfe-papierkorb-zurueck-${id}"]`);
    await warteBis(() => listenTitel().length === 1, "der Entwurf steht wieder in der Liste");

    expect(listenTitel().join(" ")).toContain("Dichtungswechsel L4");
    expect(papierkorbZeilen()).toHaveLength(0);
    expect(finde('[data-testid="entwuerfe-papierkorb-leer"]')).not.toBeNull();
    expect(await box.papierkorb()).toEqual([]);
  });

  it("U3 · endgültig löschen ist ein ZWEITER Griff — ein Klick allein entfernt nichts", async () => {
    const id = await seiteMitEinemEntwurf("Dichtungswechsel L4");
    await loeschen(id);

    // Erster Griff: nur die Rückfrage. Der Eintrag steht noch, und in der Ablage auch.
    await klick(`[data-testid="entwuerfe-papierkorb-endgueltig-${id}"]`);
    expect(papierkorbZeilen()).toHaveLength(1);
    expect(await box.papierkorb()).toHaveLength(1);
    expect(finde(`[data-testid="entwuerfe-papierkorb-endgueltig-ja-${id}"]`)).not.toBeNull();

    // Zweiter Griff: jetzt wirklich.
    await klick(`[data-testid="entwuerfe-papierkorb-endgueltig-ja-${id}"]`);
    await warteBis(() => papierkorbZeilen().length === 0, "der Papierkorb ist danach leer");
    expect(papierkorbZeilen()).toHaveLength(0);
    expect(await box.papierkorb()).toEqual([]);
    expect(listenTitel()).toEqual([]);
  });

  it("U4 · „Behalten“ bricht den zweiten Griff ab — der Eintrag bleibt", async () => {
    const id = await seiteMitEinemEntwurf("Dichtungswechsel L4");
    await loeschen(id);
    await klick(`[data-testid="entwuerfe-papierkorb-endgueltig-${id}"]`);

    await klick(`[data-testid="entwuerfe-papierkorb-endgueltig-nein-${id}"]`);

    expect(papierkorbZeilen()).toHaveLength(1);
    expect(await box.papierkorb()).toHaveLength(1);
    // Und er ist wieder bedienbar: der Weg zurück steht da, nicht die Rückfrage.
    expect(finde(`[data-testid="entwuerfe-papierkorb-zurueck-${id}"]`)).not.toBeNull();
  });

  it("U5 · ein leerer Papierkorb sagt das, statt eine leere Fläche zu zeigen", async () => {
    await seiteMitEinemEntwurf("Bleibt stehen");

    await warteBis(
      () => finde('[data-testid="entwuerfe-papierkorb-leer"]') !== null,
      "der Leersatz des Papierkorbs",
    );
    expect(finde('[data-testid="entwuerfe-papierkorb-leer"]')?.textContent).toBeTruthy();
    expect(papierkorbZeilen()).toHaveLength(0);
  });
});
