// @vitest-environment jsdom
// ================================================================================================
// R-0894 — DIE GLOCKE ZEIGT ESKALATION UND RÜCKGABE ALS EIGENE ART, MIT SPRUNGZIEL.
// ================================================================================================
//
// WAS HIER ECHT IST: die Liste der Glocke (`MeldungenListe`, shell/Meldungen.tsx) mit dem echten
// i18n-Bestand (Textmodul `texte/meldungsart.ts`), dem echten `NavGuardProvider` und Router. Ersetzt
// ist nur der Zustand der Glocke (`MeldungenZustand`) — er gibt die Einträge vor und schreibt mit,
// was als gelesen markiert wird. Den Datenweg vom Server her belegt
// `tests/app/r0894-glocke-eskalation-rueckgabe-e2e.test.ts`.
import { afterEach, describe, expect, it } from "vitest";

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "../../apps/web/node_modules/react-router-dom";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import i18n from "../../apps/web/src/i18n";
import { MeldungenListe, type MeldungenZustand } from "../../apps/web/src/shell/Meldungen";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Meldung = MeldungenZustand["items"][number];

const MELDUNGEN: Meldung[] = [
  { id: "esc-c1", kind: "escalation", title: "Widersprüchliches Drehmoment", at: "2026-06-03" },
  {
    id: "ret-ko-1-2026-06-02",
    kind: "return",
    title: "Presse P2 entlüften",
    at: "2026-06-02",
    koId: "ko-1",
  },
  {
    id: "assign-ko-2",
    kind: "assignment",
    title: "Lager schmieren",
    at: "2026-06-01",
    koId: "ko-2",
  },
];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function Ort(): JSX.Element {
  const ort = useLocation();
  return createElement("output", { "data-testid": "ort" }, `${ort.pathname}${ort.search}`);
}

async function mounten(markiert: string[]): Promise<void> {
  const zustand: MeldungenZustand = {
    items: MELDUNGEN,
    isRead: (n) => n.seen === true,
    unreadCount: MELDUNGEN.length,
    frisch: true,
    laedt: false,
    fehler: false,
    markRead: (id) => {
      markiert.push(id);
    },
    markAll: () => undefined,
    alleSichtbarenMarkieren: () => undefined,
  };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const liste = createElement(MeldungenListe, { zustand, onGeoeffnet: () => undefined });
  await act(async () => {
    root.render(
      createElement(
        NavGuardProvider,
        null,
        createElement(
          MemoryRouter,
          { initialEntries: ["/start"] },
          createElement(Ort),
          createElement(Routes, null, createElement(Route, { path: "*", element: liste })),
        ),
      ),
    );
    await flush();
  });
}

function eintrag(art: string): HTMLButtonElement {
  const knopf = container.querySelector<HTMLButtonElement>(
    `[data-testid="meldung-oeffnen"][data-art="${art}"]`,
  );
  if (!knopf) {
    throw new Error(`Eintrag der Art ${art} nicht gefunden. HTML: ${container.innerHTML}`);
  }
  return knopf;
}

const text = (el: Element): string => (el.textContent ?? "").replace(/\s+/g, " ").trim();
const punkt = (el: Element): string =>
  (el.closest("li")?.querySelector("span")?.className ?? "")
    .split(/\s+/)
    .find((k) => k.startsWith("bg-")) ?? "";
const ort = (): string => container.querySelector('[data-testid="ort"]')?.textContent ?? "";

afterEach(() => {
  if (root) {
    act(() => root.unmount());
  }
  container?.remove();
});

describe("R-0894 · Eskalation und Rückgabe in der Glocke", () => {
  it("beide Arten sind im Text gekennzeichnet und in allen drei Sprachen benannt", async () => {
    await mounten([]);
    expect(text(eintrag("escalation"))).toBe(
      `${i18n.t("meldungsart.eskalation.zeile")}: Widersprüchliches Drehmoment`,
    );
    expect(text(eintrag("return"))).toBe(
      `${i18n.t("meldungsart.rueckgabe.zeile")}: Presse P2 entlüften`,
    );
    // Gegenprobe: die gewöhnliche Zuweisung behält ihre bisherige Kennzeichnung.
    expect(text(eintrag("assignment"))).toBe(
      `${i18n.t("topbar.notifAssignment")}: Lager schmieren`,
    );
    expect(punkt(eintrag("escalation"))).toBe("bg-trust-crit-fill");
    expect(punkt(eintrag("return"))).toBe("bg-ai");
    for (const sprache of ["de", "en", "nl"]) {
      for (const schluessel of [
        "meldungsart.eskalation.zeile",
        "meldungsart.eskalation.art",
        "meldungsart.rueckgabe.zeile",
        "meldungsart.rueckgabe.art",
      ]) {
        // Direkt am Sprachbestand, nicht über `t`/`exists` — die fielen still auf Deutsch zurück.
        const wert = i18n.getResource(sprache, "translation", schluessel) as unknown;
        expect(typeof wert === "string" && wert.length > 0, `${sprache}: ${schluessel}`).toBe(true);
      }
    }
  });

  it("Öffnen einer Rückgabe markiert sie als gelesen und springt in den Eintrag", async () => {
    const markiert: string[] = [];
    await mounten(markiert);
    expect(ort()).toBe("/start");
    await act(async () => {
      eintrag("return").click();
      await flush();
    });
    expect(markiert).toEqual(["ret-ko-1-2026-06-02"]);
    expect(ort()).toBe("/wissen/ko-1");
  });

  it("Öffnen einer Eskalation markiert sie als gelesen und springt aufs Konfliktboard", async () => {
    const markiert: string[] = [];
    await mounten(markiert);
    await act(async () => {
      eintrag("escalation").click();
      await flush();
    });
    expect(markiert).toEqual(["esc-c1"]);
    expect(ort()).toBe("/konflikte");
  });
});
