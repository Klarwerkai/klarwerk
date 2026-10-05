// @vitest-environment jsdom
// ================================================================================================
// R-0246 · STAPEL-BEARBEITUNG IM PRÜFBEREICH — an der gemounteten Prüffläche.
// ================================================================================================
//
// Originalanforderung: „Pruefer koennen mehrere Objekte auf einmal auswaehlen, gesammelt bestaetigen
// oder zuweisen." Die Sicherungen der Einzelfreigabe gelten je Objekt weiter:
//   S1 · Mehrfachauswahl: Kästchen je Eintrag, „Alle auswählen", Anzahl; das Kästchen öffnet keine
//        Karte.
//   S2 · Gesammelt bestätigen: geschickt wird NUR, was die Einzelfreigabe auch ohne Rückfrage
//        schicken würde. KI-Prüfung läuft, offene Dublette und fehlende Stufe werden nicht
//        geschickt, stehen mit ihrem Grund im Ergebnis und bleiben ausgewählt.
//   S3 · Die Serverantwort je Objekt ist sein Ergebnis (409 Dublette, 403 ohne Recht).
//   S4 · Gesammelt zuweisen über denselben `assign`-Weg; schon Zugewiesene werden nicht erneut
//        zugewiesen; ein Fehlschlag steht beim Objekt.
//   S5 · Unterhalb von Controller gibt es keine Stapel-Leiste.
//
// Gemockt ist der Endpunkt, nicht der Haken — dieselbe Kulisse wie `tests/validierung-stufe/`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stand = vi.hoisted(() => ({ rolle: "controller" }));
vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("../validierung-stufe/kulisse-mocks")).endpunktMock(),
);
vi.mock("../../apps/web/src/app/AuthContext", async (o) =>
  (await import("../validierung-stufe/kulisse-mocks")).authMock(o as never),
);
vi.mock("../../apps/web/src/app/RoleContext", async (o) =>
  (await import("../validierung-stufe/kulisse-mocks")).rolleMock(o as never, stand),
);
vi.mock("../../apps/web/src/app/ToastContext", async (o) =>
  (await import("../validierung-stufe/kulisse-mocks")).toastMock(o as never),
);

import { act } from "../../apps/web/node_modules/react";
import { ApiError } from "../../apps/web/src/api/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { KoAction } from "../../apps/web/src/api/endpoints";
import {
  type Brett,
  de,
  finde,
  flush,
  klick,
  mounteBrett,
  paar,
  zeile,
} from "../validierung-stufe/kulisse";

type Fn = ReturnType<typeof vi.fn>;
let brett: Brett;

const EINGESTUFT = { confidentiality: "intern", confidentialityProvenance: "ko" } as const;
const LAEUFT = { status: "pending", requestedAt: "2026-10-01T00:00:00.000Z" } as const;

const KAESTCHEN = '[data-testid="pruefen-stapel-waehlen"]';
const ALLE = '[data-testid="pruefen-stapel-alle"]';
const BESTAETIGEN = '[data-testid="pruefen-stapel-bestaetigen"]';
const ZUWEISEN = '[data-testid="pruefen-stapel-zuweisen"]';
const ERGEBNIS = '[data-testid="pruefen-stapel-ergebnis"]';
const ERGEBNIS_ZEILE = '[data-testid="pruefen-stapel-ergebnis-zeile"]';
const KARTENTITEL = '[data-testid="pruefen-karte"] a[data-text="titel"]';

type ZeileOver = Parameters<typeof zeile>[0];

/** Eine eingestufte Zeile mit laufender KI-Prüfung. */
function laufend(id: string, title: string) {
  return zeile({ id, title, ...EINGESTUFT, aiCheck: LAEUFT } as ZeileOver);
}

/** Vier Zeilen, deren Titel die Reihenfolge der Liste festlegen (Gleichstand → Titel). */
function vierZeilen() {
  return [
    zeile({ id: "kA", title: "A frei", ...EINGESTUFT }),
    zeile({ id: "kB", title: "B ohne Stufe" }),
    laufend("kC", "C läuft"),
    zeile({ id: "kD", title: "D Dublette", ...EINGESTUFT }),
  ];
}

function antworten(regel: (id: string, body: KoAction) => void): void {
  (endpoints.ko.act as unknown as Fn).mockImplementation((async (id: string, body: KoAction) => {
    regel(id, body);
    return {};
  }) as never);
}

/** Alle Serveraufrufe als [Kennung, Nutzlast]. */
function aufrufe(): Array<[string, KoAction]> {
  return (endpoints.ko.act as unknown as Fn).mock.calls.map(
    (c: unknown[]) => [c[0], c[1]] as [string, KoAction],
  );
}

function kaestchen(): HTMLInputElement[] {
  return [...brett.container.querySelectorAll<HTMLInputElement>(KAESTCHEN)];
}

/** Das Ergebnis je Objekt: Titel → Ausgang (`data-art`). */
function ergebnis(): Record<string, string | null> {
  const zeilen = [...brett.container.querySelectorAll(ERGEBNIS_ZEILE)];
  return Object.fromEntries(
    zeilen.map((z) => [z.querySelector("span")?.textContent ?? "", z.getAttribute("data-art")]),
  );
}

function zuweisenFeld(): HTMLSelectElement {
  return finde(brett.container, ZUWEISEN) as HTMLSelectElement;
}

async function waehlen(sel: HTMLSelectElement, wert: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    setter?.call(sel, wert);
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush();
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  stand.rolle = "controller";
  antworten(() => undefined);
});
afterEach(() => brett?.abbauen());

describe("S1 · Mehrfachauswahl", () => {
  it("Kästchen je Eintrag, Anzahl, und die aktive Karte bleibt, wo sie ist", async () => {
    brett = await mounteBrett({ zeilen: vierZeilen() });
    expect(kaestchen()).toHaveLength(4);
    expect(finde(brett.container, BESTAETIGEN)).toBeNull();

    await klick(kaestchen()[1]);
    await klick(kaestchen()[3]);

    const anzahl = finde(brett.container, '[data-testid="pruefen-stapel-anzahl"]');
    expect(anzahl?.textContent).toBe(de("pruefboard.stapel.anzahl").replace("{{n}}", "2"));
    // Das Kästchen wählt für den Stapel, es öffnet keine Karte: rechts steht weiter „A frei".
    expect(finde(brett.container, KARTENTITEL)?.textContent).toBe("A frei");
    expect(aufrufe()).toEqual([]);
  });

  it("„Alle auswählen“ wählt alle sichtbaren Einträge und hebt sie wieder auf", async () => {
    brett = await mounteBrett({ zeilen: vierZeilen() });
    await klick(finde(brett.container, ALLE));
    expect(kaestchen().every((k) => k.checked)).toBe(true);
    await klick(finde(brett.container, ALLE));
    expect(kaestchen().some((k) => k.checked)).toBe(false);
  });
});

describe("S2 · gesammelt bestätigen mit den Sicherungen je Objekt", () => {
  it("nur das freie Objekt wird geschickt; die drei anderen bleiben mit Grund ausgewählt", async () => {
    brett = await mounteBrett({
      zeilen: vierZeilen(),
      duplikate: [paar({ koA: "kD", koB: "k9" })],
    });
    await klick(finde(brett.container, ALLE));
    await klick(finde(brett.container, BESTAETIGEN));
    await flush();

    // Genau EIN Aufruf: keine Stufe gesetzt, keine Dublette stillschweigend bestätigt.
    expect(aufrufe()).toEqual([["kA", { action: "rate", verdict: "up" }]]);
    expect(ergebnis()).toEqual({
      "A frei": "bestaetigt",
      "B ohne Stufe": "stufeFehlt",
      "C läuft": "gesperrt",
      "D Dublette": "dubletteOffen",
    });
    // Erledigtes verlässt die Auswahl, alles andere bleibt für die Einzelentscheidung.
    expect(kaestchen().map((k) => k.checked)).toEqual([false, true, true, true]);
  });
});

describe("S3 · die Serverantwort je Objekt ist sein Ergebnis", () => {
  it("409 Dublette und 403 ohne Recht werden beim jeweiligen Objekt gemeldet", async () => {
    antworten((id) => {
      if (id === "kA") {
        throw new ApiError(409, "DUPLICATE_ACK_REQUIRED", "Dublette offen.");
      }
      if (id === "kE") {
        throw new ApiError(403, "forbidden", "Keine Berechtigung.");
      }
    });
    brett = await mounteBrett({
      zeilen: [
        zeile({ id: "kA", title: "A frei", ...EINGESTUFT }),
        zeile({ id: "kE", title: "E fremd", ...EINGESTUFT }),
      ],
    });
    await klick(finde(brett.container, ALLE));
    await klick(finde(brett.container, BESTAETIGEN));
    await flush();

    expect(ergebnis()).toEqual({ "A frei": "dubletteOffen", "E fremd": "fehler" });
    expect(finde(brett.container, ERGEBNIS)?.textContent).toContain("Keine Berechtigung.");
    expect(kaestchen().map((k) => k.checked)).toEqual([true, true]);
  });
});

describe("S4 · gesammelt zuweisen", () => {
  it("weist über `assign` zu, überspringt schon Zugewiesene und meldet Fehlschläge je Objekt", async () => {
    antworten((id) => {
      if (id === "kC") {
        throw new ApiError(500, "server_error", "kaputt");
      }
    });
    brett = await mounteBrett({
      zeilen: [
        zeile({ id: "kA", title: "A frei", ...EINGESTUFT }),
        zeile({ id: "kB", title: "B schon da", ...EINGESTUFT, assignments: ["u1"] }),
        zeile({ id: "kC", title: "C kaputt", ...EINGESTUFT }),
      ],
    });
    await klick(finde(brett.container, ALLE));
    await waehlen(zuweisenFeld(), "u1");
    await flush();

    expect(aufrufe()).toEqual([
      ["kA", { action: "assign", userIds: ["u1"] }],
      ["kC", { action: "assign", userIds: ["u1"] }],
    ]);
    expect(ergebnis()).toEqual({
      "A frei": "zugewiesen",
      "B schon da": "bereitsZugewiesen",
      "C kaputt": "fehler",
    });
    expect(kaestchen().map((k) => k.checked)).toEqual([false, false, true]);
  });

  it("eine laufende KI-Prüfung sperrt auch das Sammel-Zuweisen dieses Objekts", async () => {
    brett = await mounteBrett({ zeilen: [laufend("kC", "C läuft")] });
    await klick(finde(brett.container, ALLE));
    await waehlen(zuweisenFeld(), "u1");
    await flush();

    expect(aufrufe()).toEqual([]);
    expect(ergebnis()).toEqual({ "C läuft": "gesperrt" });
  });
});

describe("S5 · die Stapel-Leiste gibt es erst ab Controller", () => {
  it("als Experte: keine Kästchen, keine Leiste", async () => {
    stand.rolle = "experte";
    brett = await mounteBrett({ zeilen: vierZeilen() });
    expect(kaestchen()).toHaveLength(0);
    expect(finde(brett.container, '[data-testid="pruefen-stapel"]')).toBeNull();
  });
});
