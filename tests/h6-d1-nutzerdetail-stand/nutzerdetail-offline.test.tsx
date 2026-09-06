// @vitest-environment jsdom
// ================================================================================================
// JOB 3135 · H6-D1 — DAS OFFENE NUTZERDETAIL SAGT OFFLINE UND VERALTET DIESELBE WAHRHEIT.
// ================================================================================================
//
// DER BEFUND, LIVE GEMESSEN (Codex R-1563, 06.09. 07:27, Live 1.0.0-beta.1.124, Chromium 149,
// `befunde/R-1563-20260906T072941079781.json:67-70`): „Eigenes Administrator-Kontodetail vor
// Offline öffnen, dann echten Browser offline schalten: navigator.onLine=false, aber unveränderte
// Rolle und Verwaltungsaktionen ohne Offline-/Stand-/nicht-aktualisiert-Hinweis. … Die
// Kontenübersicht markiert denselben Zustand dagegen ausdrücklich als veraltet." Urteil:
// fehlgeschlagen.
//
// DIE URSACHE stand in einer Zeile: `AdminKontenDetails.tsx` verwendete die `Abfragehuelle` NUR im
// Zweig „Nutzer nicht gefunden"; der Erfolgszweig rendert(e) Rolle, E-Mail und alle
// Verwaltungsknöpfe direkt aus `users.data` — ohne Hülle, also ohne jede Zustandsauskunft. Eine
// Rolle ohne frische Grundlage ist eine Tatsachenbehauptung ohne Voraussetzung (REGELN §7).
//
// WAS HIER GEMESSEN WIRD — an einem ECHTEN QueryClient und einem ECHTEN `onlineManager`-Wechsel,
// nicht an einem Nachbau:
//   A  Kalibrierung + Offline: frisch steht KEINE Markierung; nach `setOnline(false)` steht
//      „Stand von <Zeit> · nicht aktualisiert" — und Name, E-Mail und Rolle sind WEITER sichtbar.
//   B  Der Wiederholen-Knopf wirkt wirklich: der Klick erhöht den Zähler der `queryFn`, und nach
//      dem Erfolg ist die Markierung weg.
//   B2 Scheitert der Abruf erneut, bleiben die Daten sichtbar und die Markierung steht weiter —
//      kein Sturz in den Fehlerzustand, solange Daten da sind.
//   C  Der Fokus überlebt: das Erscheinen der Markierung stiehlt ihn nicht, und der Knopf ist mit
//      der Tastatur erreichbar.
//   D  Die Gegenrichtung: Wiederverbindung nimmt die Markierung von selbst zurück (siehe Kopf des
//      Falls — der ursprünglich beauftragte Ablauf „online schalten, DANN klicken" ist an der
//      gebauten Kette nicht messbar, weil die Markierung dann schon weg ist).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    users: {
      list: vi.fn(async () => []),
      approve: vi.fn(async () => ({})),
      setRole: vi.fn(async () => ({})),
      remove: vi.fn(async () => ({})),
      resetPassword: vi.fn(async () => ({})),
      create: vi.fn(async () => ({})),
    },
  },
}));
vi.mock("../../apps/web/src/app/ToastContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/app/ToastContext")>()),
  useToast: () => ({ push: () => {} }) as never,
}));

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { PublicUser } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { NutzerDetail } from "../../apps/web/src/pages/AdminKontenDetails";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NUTZER: PublicUser = {
  id: "u1",
  name: "Ada Admin",
  email: "ada@example.org",
  role: "admin",
  approved: true,
  createdAt: "2026-09-01T08:00:00.000Z",
};

const liste = endpoints.users.list as unknown as ReturnType<typeof vi.fn>;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** Das offene Nutzerdetail an einem echten QueryClient — der Cache trägt den Nutzer bereits. */
async function mitOffenemDetail(): Promise<void> {
  liste.mockResolvedValue([NUTZER] as never);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(NutzerDetail, { nutzerId: NUTZER.id, onZurueck: () => undefined }),
      ),
    );
  });
  for (let i = 0; i < 8 && container.querySelector("select") === null; i += 1) {
    await flush();
  }
  // Kalibrierung VOR jedem Übergang: ohne sie liesse sich „bleibt sichtbar" auch dann behaupten,
  // wenn nie etwas sichtbar war.
  expect(container.textContent).toContain(NUTZER.name);
  expect(container.textContent).toContain(NUTZER.email);
  expect(rolle()).toBe(NUTZER.role);
}

/** Die gewählte Rolle im offenen Detail — die Aussage, um die es im Befund geht. */
function rolle(): string | undefined {
  return container.querySelector<HTMLSelectElement>("select")?.value;
}

function markierung(): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-einst="stand"]');
}

function markierungsText(): string {
  return markierung()?.querySelector("span")?.textContent?.trim() ?? "";
}

function wiederholen(): HTMLButtonElement | null {
  return markierung()?.querySelector<HTMLButtonElement>("button") ?? null;
}

/** Eine Auffrischung anstossen und den Übergang abwarten (Fehler werden nicht geworfen). */
async function auffrischen(): Promise<void> {
  await act(async () => {
    await qc.refetchQueries({ queryKey: ["users"] }).catch(() => undefined);
  });
  await flush();
}

async function offline(): Promise<void> {
  await act(async () => {
    onlineManager.setOnline(false);
  });
  await flush();
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  vi.clearAllMocks();
  onlineManager.setOnline(true);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  onlineManager.setOnline(true);
});

// ================================================================================================
// A · DER GEMELDETE FALL
// ================================================================================================
describe("JOB 3135 H6-D1 · A: das offene Nutzerdetail markiert den Offline-Bestand", () => {
  it("frisch steht KEINE Markierung — sie ist kein Dauerinventar", async () => {
    await mitOffenemDetail();

    expect(markierung()).toBe(null);
    expect(container.textContent).not.toContain(i18n.t("einst.wert.nichtAktualisiert"));
  });

  it("nach dem echten Offline-Wechsel steht Stand-von-Zeit · nicht-aktualisiert", async () => {
    await mitOffenemDetail();

    await offline();

    expect(markierung(), "das offene Detail trägt keine Markierung").not.toBe(null);
    expect(markierungsText()).toContain(i18n.t("einst.wert.nichtAktualisiert"));
    // Die Zeitangabe ist wirklich da — nicht nur die Störung (der Fall darf nicht an der halben
    // Lieferung hängen bleiben).
    expect(markierungsText()).toContain(
      i18n.t("einst.wert.stand", {
        zeit: new Date(qc.getQueryState(["users"])?.dataUpdatedAt ?? 0).toLocaleTimeString(
          undefined,
          { hour: "2-digit", minute: "2-digit" },
        ),
      }),
    );
  });

  it("und Name, E-Mail und Rolle bleiben dabei sichtbar — es wird nie geleert", async () => {
    await mitOffenemDetail();

    await offline();

    expect(container.textContent).toContain(NUTZER.name);
    expect(container.textContent).toContain(NUTZER.email);
    expect(rolle()).toBe(NUTZER.role);
    // „Dieses Konto gibt es nicht mehr" darf aus einer Störung NIE entstehen.
    expect(container.textContent).not.toContain(i18n.t("einst.konten.nutzerWeg"));
    // Und der Zustand „ohne Bestand" gehört hier auch nicht hin.
    expect(container.querySelectorAll('[data-einst="abfrage-fehler"]')).toHaveLength(0);
    expect(container.textContent).not.toContain(i18n.t("state.loading"));
  });
});

// ================================================================================================
// B · DER WIEDERHOLEN-KNOPF WIRKT WIRKLICH
// ================================================================================================
describe("JOB 3135 H6-D1 · B: der Wiederholen-Knopf ruft wirklich neu ab", () => {
  it("eine gescheiterte Auffrischung markiert den Bestand, der Klick holt ihn zurück", async () => {
    await mitOffenemDetail();

    liste.mockRejectedValue(new Error("Netz weg") as never);
    await auffrischen();
    expect(markierungsText()).toContain(i18n.t("einst.wert.nichtAktualisiert"));
    expect(rolle()).toBe(NUTZER.role);

    const vorher = liste.mock.calls.length;
    liste.mockResolvedValue([NUTZER] as never);
    await act(async () => {
      wiederholen()?.click();
    });
    await flush();

    expect(liste.mock.calls.length, "der Klick hat keinen Abruf ausgelöst").toBe(vorher + 1);
    expect(markierung(), "nach dem erfolgreichen Abruf steht die Markierung noch da").toBe(null);
    expect(rolle()).toBe(NUTZER.role);
  });

  it("B2 · scheitert der Abruf erneut, bleiben Daten UND Markierung — kein Sturz in den Fehler", async () => {
    await mitOffenemDetail();

    liste.mockRejectedValue(new Error("Netz weg") as never);
    await auffrischen();
    const vorher = liste.mock.calls.length;

    await act(async () => {
      wiederholen()?.click();
    });
    await flush();

    expect(liste.mock.calls.length).toBe(vorher + 1);
    expect(markierungsText()).toContain(i18n.t("einst.wert.nichtAktualisiert"));
    expect(container.textContent).toContain(NUTZER.email);
    expect(rolle()).toBe(NUTZER.role);
    expect(container.querySelectorAll('[data-einst="abfrage-fehler"]')).toHaveLength(0);
  });
});

// ================================================================================================
// C · DER FOKUS ÜBERLEBT
// ================================================================================================
describe("JOB 3135 H6-D1 · C: die Markierung stiehlt den Fokus nicht", () => {
  it("wer im Rollen-Auswahlfeld steht, steht nach dem Offline-Wechsel immer noch dort", async () => {
    await mitOffenemDetail();
    const auswahl = container.querySelector<HTMLSelectElement>("select");
    auswahl?.focus();
    expect(document.activeElement).toBe(auswahl);

    await offline();

    expect(markierung()).not.toBe(null);
    expect(document.activeElement, "die Markierung hat den Fokus verschoben").toBe(auswahl);
  });

  it("der Wiederholen-Knopf ist mit der Tastatur erreichbar", async () => {
    await mitOffenemDetail();
    await offline();

    const knopf = wiederholen();
    expect(knopf?.tagName).toBe("BUTTON");
    expect(knopf?.getAttribute("tabindex")).toBe(null);
    expect(knopf?.hasAttribute("disabled")).toBe(false);
    expect(knopf?.textContent).toContain(i18n.t("loadstate.error.retry"));
    knopf?.focus();
    expect(document.activeElement).toBe(knopf);
  });
});

// ================================================================================================
// D · DIE GEGENRICHTUNG — UND WARUM DER BEAUFTRAGTE ABLAUF SO NICHT MESSBAR IST
// ================================================================================================
//
// Der Auftrag (§6, zweiter roter Fall) verlangte: offline schalten, dann `setOnline(true)`, dann
// auf „Erneut versuchen" klicken. An der gebauten Kette gibt es diesen Klick nicht mehr: die
// Markierung hängt an `nichtAktualisiert = fehler || pausiert` (`zeilenWert.ts:87`), und mit der
// Wiederverbindung fällt `pausiert` weg — die Markierung ist samt Knopf schon fort, BEVOR geklickt
// werden könnte. Das ist das ehrliche Verhalten (nichts ist mehr gestört), und es ist genau das,
// was dieser Fall festhält. Der Klick selbst wird deshalb dort gemessen, wo es ihn wirklich gibt:
// an der gescheiterten Auffrischung (Fall B).
describe("JOB 3135 H6-D1 · D: die Wiederverbindung nimmt die Markierung von selbst zurück", () => {
  it("nach setOnline(true) steht kein nicht-aktualisiert mehr, und es wird wirklich neu abgerufen", async () => {
    await mitOffenemDetail();
    await offline();
    expect(markierungsText()).toContain(i18n.t("einst.wert.nichtAktualisiert"));
    const vorher = liste.mock.calls.length;

    await act(async () => {
      onlineManager.setOnline(true);
    });
    await flush();
    await flush();

    expect(liste.mock.calls.length, "die Wiederverbindung hat nichts nachgeholt").toBe(vorher + 1);
    expect(markierung(), "die Markierung überlebt die Wiederverbindung").toBe(null);
    expect(rolle()).toBe(NUTZER.role);
  });
});
