// @vitest-environment jsdom
// ================================================================================================
// JOB 562 / D7 — AUF EINER WISSENSSEITE IST DER BIBLIOTHEKSEINTRAG AKTIV.
// ================================================================================================
//
// DIE ENTSCHEIDUNG, die diesen Vertrag bestimmt — `00_CONTROL/ENTSCHEIDUNGEN/JOB-562.md:17`:
//
//   „**Bibliothekseintrag aktiv markieren**“
//   Verworfen wurden ausdrücklich „Kein Eintrag aktiv“ und „Eigener Eintrag für die Detailseite“.
//   `:37` BAUFREIGABE: JA · `:41` „Eine Rückgabe ohne Produktdiff ist hier ein Mangel.“
//
// DAS URTEIL `_relay/kopf/outbox/BEN2-PRUEFUNG-JOB-562-D6.md:69` beschreibt dieselbe Wirkung:
// „aktiver Bibliothekseintrag für `/wissen/:id` und semantisches `aria-current`“.
//
// JOB 3060 · H1: die Seitenleiste ist gegangen; der Bibliothekseintrag ist jetzt ein Punkt im
// Kopfband (shell/KopfbandPunkte.tsx). Die Aktivregel ist dieselbe (`istAktiverEintrag`), gemessen
// wird weiterhin `aria-current="page"` am gerenderten Link — jetzt am Kopfband.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const WURZEL = join(__dirname, "..", "..");

// Die Badge-Quellen des Kopfbands sind hier nicht Gegenstand; sie bleiben dauerhaft offen,
// damit kein Zählwert die Messung stört. Der Ladezustand ist für die Aktivmarkierung ohne Belang.
const offen = vi.hoisted(() => () => vi.fn(() => new Promise(() => {})));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    validation: { board: offen() },
    conflicts: { list: offen() },
    duplicates: { list: offen() },
    gaps: { summary: offen() },
    lifecycle: { pending: offen() },
    notifications: { list: offen(), markSeen: vi.fn(async () => ({})) },
    features: { get: offen() },
  },
}));

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
import { NAV_GROUPS } from "../../apps/web/src/app/navigation";
import { Kopfband } from "../../apps/web/src/shell/Kopfband";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | undefined;
let root: ReturnType<typeof createRoot> | undefined;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Mountet das ECHTE Kopfband unter einer gegebenen Route. */
async function anRoute(pfad: string): Promise<HTMLDivElement> {
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
                NavGuardProvider,
                null,
                createElement(MemoryRouter, { initialEntries: [pfad] }, createElement(Kopfband)),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  return container;
}

/** Die Ziele aller Einträge, die als aktuelle Seite ausgezeichnet sind. */
function aktiveZiele(wo: HTMLDivElement): string[] {
  return [...wo.querySelectorAll('[aria-current="page"]')].map(
    (el) => el.getAttribute("href") ?? "",
  );
}

afterEach(() => {
  if (root && container) {
    const r = root;
    const c = container;
    act(() => r.unmount());
    c.remove();
  }
  root = undefined;
  container = undefined;
});

describe("JOB 562 · A — auf einer Wissensseite ist der Bibliothekseintrag aktiv", () => {
  it("A1 · SELBSTSCHUTZ: auf `/bibliothek` ist genau dieser Eintrag ausgezeichnet", async () => {
    // Ohne diesen Fall bewiese A2 nichts: Er wäre auch dann grün, wenn das Kopfband überhaupt
    // keine Aktivmarkierung kennte oder gar nicht renderte.
    const wo = await anRoute("/bibliothek");
    expect(aktiveZiele(wo)).toEqual(["/bibliothek"]);
  });

  it("A2 · DIE ENTSCHEIDUNG: auf `/wissen/<id>` ist der Bibliothekseintrag ausgezeichnet", async () => {
    const wo = await anRoute("/wissen/ko-562");
    // `aria-current="page"` ist die Zusage an den Screenreader — nicht eine Farbe, nicht eine Klasse.
    expect(
      aktiveZiele(wo),
      "die Detailseite gehört zur Bibliothek; ohne Auszeichnung weiss die Nutzerin nicht, wo sie ist",
    ).toEqual(["/bibliothek"]);
  });

  it("A3 · GEGENPROBE: auf einer fremden Route ist der Bibliothekseintrag NICHT ausgezeichnet", async () => {
    // Ohne diesen Fall wäre A2 auch mit einem dauerhaft aktiven Bibliothekseintrag grün — also mit
    // genau der Falschaussage, die schlimmer wäre als gar keine Markierung.
    const wo = await anRoute("/fragen");
    expect(aktiveZiele(wo)).not.toContain("/bibliothek");
    // Und die fremde Route zeichnet ihren eigenen Eintrag aus — die Mechanik bleibt heil.
    expect(aktiveZiele(wo)).toEqual(["/fragen"]);
  });

  it("A4 · NACHBARVERTRAG: Unterrouten der Bibliothek bleiben ausgezeichnet", async () => {
    const wo = await anRoute("/bibliothek/unterseite-562");
    expect(aktiveZiele(wo)).toEqual(["/bibliothek"]);
  });

  it("A5 · genau EIN Eintrag ist ausgezeichnet — kein Doppelmarker auf der Detailroute", async () => {
    const wo = await anRoute("/wissen/ko-562");
    expect(aktiveZiele(wo)).toHaveLength(1);
    // Und `/wissen` bleibt ein eigener Menüpunkt ausdrücklich ERSPART (Entscheidung `:19`).
    const pfade = NAV_GROUPS.flatMap((g) => g.items).map((i) => i.path);
    expect(pfade.some((p) => p === "/wissen" || p.startsWith("/wissen/"))).toBe(false);
  });

  it("A6 · die Präfixregel endet an der Segmentgrenze — kein Treffer auf Namensverwandte", async () => {
    // `/bibliothekskatalog` beginnt zwar mit `/bibliothek`, ist aber eine andere Seite. Ohne diese
    // Grenze würde jeder gleichnamige Wortanfang den Eintrag fälschlich auszeichnen.
    const wo = await anRoute("/bibliothekskatalog");
    expect(aktiveZiele(wo)).toEqual([]);
  });

  it("A7 · Kopfband und Mobile Drawer sind EIN Vertrag, nicht zwei", () => {
    // Die Urteilsformulierung „in Sidebar und Mobile Drawer“ liest sich wie zwei Orte. Gemessen
    // ist es einer: der Drawer rendert dieselben Punkte über dieselbe Aktivregel (JOB 3060 · H1:
    // `KopfbandPunkteListe` in shell/KopfbandPunkte.tsx, dieselbe `istAktiverEintrag`-Regel wie
    // `KopfbandPunkte`). Wer die Auszeichnung im Kopfband hat, hat sie damit auch mobil.
    const drawer = readFileSync(join(WURZEL, "apps/web/src/shell/MobileNavDrawer.tsx"), "utf8");
    expect(drawer).toContain("<DrawerMenue");
    expect(drawer).not.toContain("GuardedNavLink");
    const drawerMenue = readFileSync(join(WURZEL, "apps/web/src/shell/DrawerMenue.tsx"), "utf8");
    expect(drawerMenue).toContain("<KopfbandPunkteListe");
    const punkte = readFileSync(join(WURZEL, "apps/web/src/shell/KopfbandPunkte.tsx"), "utf8");
    // Beide Renderer fragen dieselbe Regel — nicht zwei Aktivbegriffe.
    expect(punkte.split("istAktiverEintrag(item, pathname)").length - 1).toBeGreaterThanOrEqual(2);
  });
});
