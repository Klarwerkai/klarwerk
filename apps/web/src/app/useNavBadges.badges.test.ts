// ================================================================================================
// JOB 690 · D2 (Design D-019) — DER AUFGABEN-BADGE ZÄHLT, WAS DIE AUFGABENSEITE ZÄHLT.
// ================================================================================================
//
// DER BEFUND, der diese Datei erzwingt: Die Seitenleiste zeigte „54", die Aufgabenseite „Alle · 57".
// Zwei Zähler, zwei Wahrheiten. Der Badge zählte ZWEI Quellen (Validierungsboard + offene
// Wissenslücken), die Seite FÜNF — zusätzlich ungelöste Konflikte, Lebenszyklus-Fällige und an den
// Autor zurückgegebene Entwürfe (`MyTasks.tsx:84-135`).
//
// WAS DIESE DATEI PINNT — und was ausdrücklich NICHT:
//   · Aufgaben-Badge = Board + offene Lücken + UNGELÖSTE Konflikte + Lebenszyklus-Fällige.
//   · Konflikte-Badge zählt einen GELÖSTEN Konflikt nicht mit (`status !== "geloest"`, dieselbe
//     Regel wie `MyTasks.tsx:98`).
//   · Der Ladezustand ist ATOMAR: solange EINE tragende Quelle fehlt, ist der Badge „loading" —
//     nie eine zu kleine Zahl. Genau das ist der Unterschied zwischen „lädt" und „echte 0"
//     (mega2 Block C), und er darf durch eine neue Quelle nicht verloren gehen.
//   · Autorenübergabe-Auftrag K3 (Ben, Nacharbeit 1): dazu die an mich zurückgegebenen Entwürfe.
//     Bis hierher fehlten sie, und ein eigener zurückgegebener Entwurf ergab Liste=1, Badge=0. Sie
//     kommen jetzt aus dem textfreien Serverzähler `GET /api/me/returned-tasks/summary`. Der rechnet
//     mit derselben Funktion `returnedToAuthor` wie die Seite.
//
// KEIN MOUNT, und das ist begründet: `apps/web` fährt `environment: "node"` (`vite.config.ts:74`),
// `@testing-library/react`/`jsdom` stehen dort nicht im Paket. Der RENDERER-Vertrag (reale Sidebar,
// echte Provider- und Endpointgrenze) ist deshalb NICHT hier, sondern in
// `tests/app/nav-badges-sidebar-mounted.test.tsx` gepinnt — beide zusammen, nicht eines statt des
// anderen (BENs Promptverbesserung zu D1).
//
// JOB 3113 H1b — WAS SICH HIER GEÄNDERT HAT UND WARUM: bis heute stand hier „`useNavBadges` trägt
// selbst KEINEN React-Zustand" und der Hook wurde als gewöhnliche Funktion aufgerufen. Seit H1b
// trägt er einen: er muss zum Ablauf der Frischefrist GENAU EINMAL neu zeichnen lassen
// (`useState` + `useEffect` mit einem `setTimeout`), sonst bliebe eine Zahl stehen, die niemand
// mehr bestätigt hat. Ein Hook mit Zustand darf nur IM Rendern laufen — deshalb läuft er hier
// jetzt in einer winzigen Sonde durch den Server-Renderer (node-tauglich, kein jsdom nötig).
// Gemessen werden unverändert Zahl und Ladezustand; `useEffect` läuft im Server-Renderer nicht,
// die Frist ist hier also NICHT Gegenstand — die misst `tests/kopfzaehler-frische/`.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Quelle {
  data: unknown;
  isError: boolean;
  refetch: () => void;
}

const q = vi.hoisted(() => {
  const leer = (): {
    data: unknown;
    isError: boolean;
    refetch: () => void;
  } => ({ data: undefined, isError: false, refetch: () => {} });
  return {
    board: leer(),
    conflicts: leer(),
    duplicates: leer(),
    gaps: leer(),
    lifecycle: leer(),
    returned: leer(),
  };
});

vi.mock("../api/hooks", () => ({
  useValidationBoard: () => q.board,
  useConflicts: () => q.conflicts,
  useDuplicates: () => q.duplicates,
  useGapsSummary: () => q.gaps,
  useLifecyclePending: () => q.lifecycle,
  useReturnedTasksSummary: () => q.returned,
}));

import { type NavBadge, useNavBadges } from "./useNavBadges";

/** Die Sonde: ruft den Hook IM Rendern und reicht sein Ergebnis heraus. */
function badgesLesen(): Record<string, NavBadge> {
  let ergebnis: Record<string, NavBadge> = {};
  const Sonde = (): null => {
    ergebnis = useNavBadges();
    return null;
  };
  renderToStaticMarkup(createElement(Sonde));
  return ergebnis;
}

// Drei Konflikte, EINER davon gelöst → zwei ungelöste. Dieselbe Menge trägt beide Zählfälle:
// im Aufgaben-Badge als Summand 2, im Konflikte-Badge als Gesamtzahl 2 (nicht 3).
const KONFLIKTE = [
  { id: "c1", status: "offen" },
  // „eskaliert" ist Arbeit — die Regel ist bewusst `!== "geloest"` und keine Positivliste:
  // `ConflictStatus` kennt vier Werte (`api/types.ts:299`), und eine Positivliste müsste bei jedem
  // neuen Zustand nachgezogen werden und ließe ihn bis dahin still verschwinden.
  { id: "c2", status: "eskaliert" },
  { id: "c3", status: "geloest" },
];

function setze(werte: Partial<Record<keyof typeof q, unknown>>): void {
  for (const [name, data] of Object.entries(werte)) {
    (q as unknown as Record<string, Quelle>)[name].data = data;
  }
}

beforeEach(() => {
  for (const name of [
    "board",
    "conflicts",
    "duplicates",
    "gaps",
    "lifecycle",
    "returned",
  ] as const) {
    q[name].data = undefined;
    q[name].isError = false;
    q[name].refetch = () => {};
  }
});

describe("JOB 690 D-019: der Aufgaben-Badge zählt dieselben Quellen wie die Aufgabenseite", () => {
  it("zählt Board + offene Lücken + ungelöste Konflikte + Lebenszyklus-Fällige", () => {
    setze({
      board: [{ id: "k1" }, { id: "k2" }, { id: "k3" }],
      gaps: { open: 5, byPriority: { hoch: 1, mittel: 2, niedrig: 2 } },
      conflicts: KONFLIKTE,
      lifecycle: ["l1", "l2", "l3", "l4"],
      duplicates: [],
      returned: { open: 0 },
    });
    const badges = badgesLesen();
    expect(
      badges.tasks?.count,
      "Der Aufgaben-Badge zählt zu wenig (Board 3 + Lücken 5 + ungelöste Konflikte 2 + Lebenszyklus 4)",
    ).toBe(14);
    expect(badges.tasks?.state).toBe("loaded");
  });

  it("der Konflikte-Badge zählt einen GELÖSTEN Konflikt nicht mit", () => {
    setze({
      board: [],
      gaps: { open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } },
      conflicts: KONFLIKTE,
      lifecycle: [],
      duplicates: [],
      returned: { open: 0 },
    });
    const badges = badgesLesen();
    expect(badges.conflicts?.count, "Der Konflikte-Badge zählt den gelösten Konflikt c3 mit").toBe(
      2,
    );
  });

  it("ohne Lebenszyklus-Daten bleibt der Badge im Ladezustand statt eine zu kleine Zahl zu zeigen", () => {
    setze({
      board: [{ id: "k1" }, { id: "k2" }],
      gaps: { open: 1, byPriority: { hoch: 1, mittel: 0, niedrig: 0 } },
      conflicts: KONFLIKTE,
      duplicates: [],
      returned: { open: 0 },
      // lifecycle bleibt bewusst `undefined` — die Quelle lädt noch.
    });
    const badges = badgesLesen();
    expect(
      badges.tasks?.state,
      "Ohne Lebenszyklus-Daten muss der Badge im Ladezustand bleiben, nicht eine zu kleine Zahl zeigen",
    ).toBe("loading");
  });

  it("Kalibrierung: eine ECHTE Null bleibt eine Null (der Test ist nicht pauschal rot)", () => {
    setze({
      board: [],
      gaps: { open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } },
      conflicts: [],
      lifecycle: [],
      duplicates: [],
      returned: { open: 0 },
    });
    const badges = badgesLesen();
    expect(badges.tasks?.count).toBe(0);
    expect(badges.tasks?.state).toBe("loaded");
    expect(badges.conflicts?.count).toBe(0);
  });
});

// ================================================================================================
// Autorenübergabe-Auftrag K3 (Ben, Nacharbeit 1) — die sechste Quelle: zurückgegebene Entwürfe.
// ================================================================================================
describe("K3: der Aufgaben-Badge zählt die an mich zurückgegebenen Entwürfe mit", () => {
  it("Gegenfall aus Bens Befund: EIN eigener zurückgegebener Entwurf, sonst alles leer ⇒ 1, nicht 0", () => {
    setze({
      board: [],
      gaps: { open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } },
      conflicts: [],
      lifecycle: [],
      duplicates: [],
      returned: { open: 1 },
    });
    const badges = badgesLesen();
    expect(badges.tasks?.count, "Liste=1, Badge=0: der zurückgegebene Entwurf fehlt").toBe(1);
    expect(badges.tasks?.state).toBe("loaded");
    // Die Prüfzahl bleibt das Board allein: ein zurückgegebener Entwurf ist keine Prüfung.
    expect(badges.validation?.count).toBe(0);
  });

  it("zählt den Summanden zu den übrigen Quellen hinzu", () => {
    setze({
      board: [{ id: "k1" }, { id: "k2" }, { id: "k3" }],
      gaps: { open: 5, byPriority: { hoch: 1, mittel: 2, niedrig: 2 } },
      conflicts: KONFLIKTE,
      lifecycle: ["l1", "l2", "l3", "l4"],
      duplicates: [],
      returned: { open: 2 },
    });
    // Board 3 + Lücken 5 + ungelöste Konflikte 2 + Lebenszyklus 4 + zurückgegeben 2.
    expect(badgesLesen().tasks?.count).toBe(16);
  });

  it("solange die Rückgabe-Quelle lädt, steht keine zu kleine Zahl (Ladezustand)", () => {
    setze({
      board: [{ id: "k1" }],
      gaps: { open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } },
      conflicts: [],
      lifecycle: [],
      duplicates: [],
      // returned bleibt bewusst `undefined` — die Quelle lädt noch.
    });
    expect(badgesLesen().tasks?.state).toBe("loading");
  });

  it("scheitert die Rückgabe-Quelle ohne Daten, ist der Badge im Fehlerzustand und holt sie neu", () => {
    setze({
      board: [{ id: "k1" }],
      gaps: { open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } },
      conflicts: [],
      lifecycle: [],
      duplicates: [],
    });
    q.returned.isError = true;
    const neuGeholt = vi.fn();
    q.returned.refetch = neuGeholt;
    const badges = badgesLesen();
    expect(badges.tasks?.state).toBe("error");
    badges.tasks?.refetch();
    expect(neuGeholt, "Wiederholen holt die Rückgabe-Quelle nicht neu").toHaveBeenCalledTimes(1);
  });
});
