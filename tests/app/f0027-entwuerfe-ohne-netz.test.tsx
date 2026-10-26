// @vitest-environment jsdom
// ================================================================================================
// F-0027 · JOB 2951 D2 — „Sobald wieder Verbindung besteht, wird nachsynchronisiert."
// ================================================================================================
//
// Der Registersatz verspricht den mobilen Weg: unterwegs an der Anlage offline erfassen, im Buero
// fertigmachen. Genau dieser Weg hatte zwei Loecher, beide in D1 an Zeilen gemessen:
//
//   A  Beim Aufbau der Anwendung wurde NICHT nachsynchronisiert. Sync haengt an den Ereignissen
//      `online` und `focus`; beim frischen Laden eines bereits online stehenden, bereits
//      fokussierten Fensters feuert keines von beiden. Die aus `localStorage` wiederhergestellte
//      Warteschlange lag da und ruehrte sich nicht.
//   C  Ein Lauf, der mitten im Senden abbricht (Fenster zu, Absturz), hinterlaesst Ops im Status
//      `pending`. `syncableOps` nimmt nur `queued` und `failed` — solche Entwuerfe waren damit
//      DAUERHAFT unsynchronisierbar und wurden trotzdem weiter als offen gezaehlt.
//
// Gemessen wird am ECHTEN Hook, gemountet in jsdom, ueber den ECHTEN Synchronisationsweg. Was hier
// ein Doppel ist: allein die Draft-Endpunkte (`endpoints.drafts`) — sonst nichts. Insbesondere sind
// `localStorage`, die Ereignisse und die Zustandsuebergaenge echt.
//
// Fall B ist der Waechter gegen den naheliegenden Fehler beim Schliessen von A: ein Start-Sync, der
// zusaetzlich zum `online`-Ereignis feuert, wuerde denselben Entwurf zweimal senden.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const draftsApi = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
}));

/**
 * JOB 4249: das angemeldete Konto — und zugleich der Eigentümer der abgelegten Vorgänge.
 * `vi.hoisted`, weil die Attrappe unten beim IMPORT des Moduls gebaut wird und eine gewöhnliche
 * Konstante zu diesem Zeitpunkt noch nicht existierte.
 */
const { KONTO } = vi.hoisted(() => ({ KONTO: "u1" }));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: { drafts: { create: draftsApi.create, update: draftsApi.update } },
}));

// JOB 4249: Die Warteschlange liegt am Gerät, gehört aber einem KONTO — gesendet wird nur, was dem
// angemeldeten Menschen gehört. Die Zusage von F-0027 gilt damit ausdrücklich FÜR DIE EIGENEN
// Vorgänge; der Aufbau hier stellt die Sitzung bereit, die im Betrieb ohnehin steht (`App.tsx`
// zeigt ohne Nutzer die Anmeldung statt der Fläche).
vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: KONTO, name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { useOfflineQueue } from "../../apps/web/src/app/useOfflineQueue";
import type { QueuedOp } from "../../apps/web/src/lib/offlineQueue";

const STORAGE_KEY = "kw.offlineQueue.v1";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
const sicht: { queue: QueuedOp[]; pending: number } = { queue: [], pending: 0 };

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function setzeOnline(wert: boolean): void {
  Object.defineProperty(navigator, "onLine", { value: wert, configurable: true });
}

function op(overrides: Partial<QueuedOp>): QueuedOp {
  return {
    id: "op-pumpe",
    kind: "draft.create",
    draftId: null,
    payload: { title: "Pumpe P-12", statement: "Lager laeuft heiss" },
    status: "queued",
    error: null,
    createdAt: "2026-09-02T05:00:00.000Z",
    title: "Pumpe P-12",
    // JOB 4249: der Vorgang gehört dem Menschen, der ihn unterwegs erfasst hat. Ohne diese Bindung
    // wäre er ein ungebundener Rest — der bleibt seit diesem Auftrag ausdrücklich liegen, statt dem
    // gerade Angemeldeten zugeschlagen zu werden.
    eigentuemer: KONTO,
    ...overrides,
  };
}

/** Legt eine Warteschlange ab, wie sie ein frueherer, offline gefahrener Besuch hinterlassen hat. */
function warteschlangeVorhanden(ops: QueuedOp[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
}

function gespeicherteWarteschlange(): QueuedOp[] {
  const roh = localStorage.getItem(STORAGE_KEY);
  return roh ? (JSON.parse(roh) as QueuedOp[]) : [];
}

function Sonde(): null {
  const q = useOfflineQueue();
  sicht.queue = q.queue;
  sicht.pending = q.pending;
  return null;
}

/** Startet die Anwendung frisch — genau das, was ein Mensch im Buero tut, der die Seite oeffnet. */
async function anwendungOeffnen(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(AuthProvider, null, createElement(Sonde, null)),
      ),
    );
  });
  // Der Aufbau ist erst fertig, wenn die Sitzung steht: `/auth/status` und `/auth/me` laufen
  // nacheinander, und bis die zweite Antwort da ist, sendet die Warteschlange zu Recht nichts.
  for (let i = 0; i < 5; i++) {
    await act(flush);
  }
}

describe("F-0027 · JOB 2951 D2 — Entwuerfe ohne Netz werden wirklich nachsynchronisiert", () => {
  beforeEach(() => {
    draftsApi.create.mockReset();
    draftsApi.update.mockReset();
    draftsApi.create.mockResolvedValue({ id: "d1" });
    draftsApi.update.mockResolvedValue({ id: "d1" });
    localStorage.clear();
    sicht.queue = [];
    sicht.pending = 0;
    setzeOnline(true);
  });

  afterEach(async () => {
    if (root) {
      const r = root;
      await act(async () => r.unmount());
    }
    container?.remove();
    root = null;
    container = null;
  });

  it("A · im Buero geoeffnet: die offline erfasste Warteschlange geht beim Start raus", async () => {
    warteschlangeVorhanden([op({})]);
    setzeOnline(true);

    // Kein `online`-Ereignis (die Verbindung bestand schon), kein `focus`-Ereignis (das Fenster
    // hat den Fokus beim ersten Aufbau bereits). Genau die Lage aus dem Registersatz.
    await anwendungOeffnen();

    expect(
      draftsApi.create.mock.calls.length,
      "Der offline erfasste Entwurf muss beim Start genau einmal gesendet werden — " +
        "sonst liegt er unsichtbar im Browser und der Mensch glaubt, er sei angekommen.",
    ).toBe(1);
    // JOB 4249: die Nutzlast UND die Vorgangskennung. Sie ist der Grund, warum ein Antwortverlust
    // beim Wiederholen keinen zweiten Entwurf mehr erzeugt (JOB 2697 D7), und sie ist `op.id` —
    // dieselbe über jede Wiederholung, auch über ein Neuladen hinweg.
    //
    // JOB 4249 R6: UND DER EIGENTÜMER, als Voraussetzung des Aufrufs (`expectedOwner`). Er ist die
    // Zusage, die der Client allein nicht halten kann: welches Cookie der Browser anhängt,
    // entscheidet sich erst beim Absenden. Kommt der Aufruf mit einem anderen Konto an, legt der
    // Server nichts an (409 `DRAFT_OWNER_MISMATCH`).
    expect(draftsApi.create).toHaveBeenCalledWith(
      { title: "Pumpe P-12", statement: "Lager laeuft heiss" },
      "op-pumpe",
      KONTO,
    );
    expect(sicht.queue, "nach erfolgreichem Sync ist die Warteschlange leer").toEqual([]);
    expect(gespeicherteWarteschlange(), "auch im Speicher bleibt nichts liegen").toEqual([]);
  });

  it("B · offline geoeffnet: vorher kein Versand, nach dem Verbindungsereignis genau einer", async () => {
    warteschlangeVorhanden([op({})]);
    setzeOnline(false);

    await anwendungOeffnen();
    expect(draftsApi.create.mock.calls.length, "ohne Verbindung darf nichts gesendet werden").toBe(
      0,
    );

    setzeOnline(true);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await act(flush);

    expect(
      draftsApi.create.mock.calls.length,
      "genau EIN Versand — ein Start-Sync, der zusaetzlich zum online-Ereignis feuert, " +
        "wuerde denselben Entwurf doppelt anlegen",
    ).toBe(1);
    expect(sicht.queue).toEqual([]);
  });

  it("C · nach abgebrochenem Lauf: ein pending-Rest bleibt nicht fuer immer liegen", async () => {
    // So sieht der Speicher aus, wenn das Fenster mitten im Senden geschlossen wurde.
    warteschlangeVorhanden([op({ status: "pending" })]);
    setzeOnline(true);

    await anwendungOeffnen();

    expect(
      draftsApi.create.mock.calls.length,
      "ein beim Abbruch auf `pending` stehengebliebener Entwurf muss beim Neustart wieder " +
        "synchronisierbar sein — sonst zaehlt ihn die Anzeige ewig als offen und er geht nie raus.",
    ).toBe(1);
    expect(sicht.queue).toEqual([]);
    expect(sicht.pending, "danach ist nichts mehr offen").toBe(0);
  });
});
