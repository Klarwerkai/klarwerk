// @vitest-environment jsdom
// ================================================================================================
// JOB 1217 · DAS LADEFENSTER ZWISCHEN LERNPFAD UND FORTSCHRITT
// ================================================================================================
//
// DER MANGEL, den dieser Fall pinnt: `Start.tsx:184-185` laedt zwei Quellen, wobei die zweite von
// der ersten abhaengt — `useLearningProgress(learningPath.data?.id)`. Zwischen „Pfad da" und
// „Fortschritt da" gibt es zwangslaeufig ein Fenster. In diesem Fenster rechnet `:203` bereits, und
// `workCenter.ts:141` liefert wegen `done?.length ?? 0` die VOLLE Schrittzahl:
//
//     Math.max(0, path.steps.length - (done?.length ?? 0))   →   4 - 0   =   4
//
// `buildWorkOverview` nimmt jede Kategorie mit `count > 0` auf (workCenter.ts:56), also erscheint
// „Offene Lernpfad-Schritte 4" — eine erfundene Zahl NACH OBEN. Und weil `:211` die beiden
// Lernquellen aus der Ladegruppe herauslaesst, ist `workLoading` in diesem Fenster `false`: die
// Zahl wird gezeigt, statt eines Ladezustands.
//
// Das ist woertlich die Gefahr aus JOB 698 D3: „ohne den Fortschritt in der Gruppe rechnet
// `learningOpenSteps` mit `done?.length ?? 0` und meldet die volle Schrittzahl als offen".
//
// WARUM GEMOUNTET UND NICHT AM REINEN RECHNER: `learningOpenSteps(pfad, undefined)` IST richtig —
// die Funktion kann nicht wissen, ob `undefined` „noch nicht geladen" oder „nichts erledigt"
// heisst. Der Mangel liegt in der VERDRAHTUNG der Startseite, also wird sie gemessen.
//
// WAS DIESER FALL NICHT PRUEFT: echte Bildschirmausgabe, Zeitverhalten oder das Verhalten ohne
// Lernpfad — dafuer steht der zweite Fall unten, der die Gegenrichtung sichert.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Der Fortschritt bleibt ABSICHTLICH offen: sein Promise wird nie aufgeloest. Genau das ist das
// Fenster. Die tragenden Quellen dagegen loesen sofort auf, damit `workLoading` allein noch am
// Lernfortschritt haengt — sonst waere der Fall gruen aus dem falschen Grund.
const d = vi.hoisted(() => {
  const offen = { fn: vi.fn(() => new Promise(() => {})) };
  // Der Pfad ist UMSCHALTBAR, damit beide Faelle EIN Modul-Mock teilen: ein spaeteres `vi.doMock`
  // greift nicht mehr, wenn das Modul bereits geladen ist.
  const pfad: { wert: unknown } = { wert: { id: "p1", steps: [1, 2, 3, 4] } };
  return { fortschritt: offen, pfad };
});

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      analytics: { overview: ok({ total: 0, byStatus: { offen: 0, validiert: 0 } }) },
      validation: { board: ok([]) },
      conflicts: { list: ok([]) },
      lifecycle: { pending: ok([]) },
      gaps: { summary: ok({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } }) },
      ko: { list: ok([]) },
      learningPaths: {
        // Fall 1: ein Pfad MIT Schritten — sonst gibt es kein Fenster.
        // Fall 2: `null` — die Rolle hat keinen Pfad. Umgeschaltet ueber `d.pfad.wert`.
        byRole: vi.fn(async () => d.pfad.wert),
        progress: d.fortschritt.fn,
      },
      livewall: { get: ok({ saved: [], helped: [], helpedToday: 0 }) },
      reasoner: { config: ok(null), assistPresets: ok([]), status: ok(null) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Start } from "../../apps/web/src/pages/Start";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
                createElement(MemoryRouter, { initialEntries: ["/"] }, createElement(Start)),
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

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("JOB 1217 · Startseite: das Fenster zwischen geladenem Lernpfad und fehlendem Fortschritt", () => {
  it("zeigt im Fenster einen Ladezustand statt der vollen Schrittzahl", async () => {
    await mount();

    // Der Beleg, dass das Fenster wirklich offen ist: der Fortschritt wurde angefragt (der Pfad ist
    // also da und lieferte eine Id) und ist nicht aufgeloest.
    expect(d.fortschritt.fn).toHaveBeenCalled();

    // DIE ZUSAGE: keine erfundene Zahl. Ohne Fortschritt darf die Uebersicht die vier Schritte
    // NICHT als offen melden — sie weiss nicht, wie viele davon erledigt sind.
    expect(container.textContent).not.toContain(i18n.t("work.learning"));

    // Und sie sagt ehrlich, dass sie noch laedt, statt zu schweigen.
    expect(container.textContent).toContain(i18n.t("start.todoLoading"));
  });
});

// ================================================================================================
// DIE GEGENRICHTUNG — sie bewacht die Falle, die beim Bau dieses Durchgangs beinahe entstanden waere.
// ================================================================================================
//
// `useLearningProgress` ist ohne Pfad-Id dauerhaft `enabled: false` und liefert NIE `data`. Haengte
// man den Fortschritt bedingungslos in die Ladegruppe, bliebe die Uebersicht fuer jede Rolle OHNE
// Lernpfad EWIG im Ladezustand — die zweite Unwahrheit statt der ersten.
//
// `byRole` liefert in diesem Fall `null`, nicht `undefined`: eine Bedingung auf `data === undefined`
// wuerde den Fall uebersehen. Genau deshalb steht dieser Fall hier — er ist die Gegenprobe zur
// Bedingung in `Start.tsx`, nicht eine zweite Zusage ueber dasselbe Fenster.
describe("JOB 1217 · Gegenrichtung: ohne Lernpfad entsteht kein Fenster und kein Dauerladen", () => {
  it("ohne Lernpfad zeigt die Uebersicht den echten Leerzustand statt endlos zu laden", async () => {
    // KEIN Pfad fuer diese Rolle — genau der Produktionsfall, den `byRole` mit `null` meldet.
    d.pfad.wert = null;
    await mount();

    // Der Fortschritt wurde GAR NICHT angefragt — ohne Id ist die Abfrage untaetig.
    expect(d.fortschritt.fn).not.toHaveBeenCalled();

    // Und die Uebersicht haengt nicht: sie sagt ehrlich „nichts offen", statt ewig zu laden.
    expect(container.textContent).not.toContain(i18n.t("start.todoLoading"));
    expect(container.textContent).toContain(i18n.t("start.todoEmpty"));
  });
});
