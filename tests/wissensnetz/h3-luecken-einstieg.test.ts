// H3-LUECKEN · JOB 1577 D7 — die Sicherheitskette AM OEFFENTLICHEN EINSTIEG.
//
// KORREKTUR ZU D6 (BENs Pruefluecke 1). D6 hat die Kette `lesemodell.sicht(darfSehen) +
// sichtmetrik` NEBEN dem Einstieg zusammengesetzt und gemessen. BEN hat das zu Recht Scheinbeleg
// genannt: Damit war fuer den GESCHLOSSENEN Zustand nichts belegt — nur, dass die Bausteine
// einzeln taugen.
//
// Hier laeuft n=1 vollstaendig DURCH `wissensnetzLuecken`. Die Naht wird testseitig geschlossen,
// und zwar mit `vi.mock` — einem Mittel, das dem PRODUKTAUFRUFER nicht zur Verfuegung steht.
// Der Einstieg bekommt dadurch KEINE Injektionsmoeglichkeit; sein Vertrag bleibt unveraendert.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { darfSehen } from "../../services/app/src/sichtbarkeit";
import * as wissensnetz from "../../services/wissensnetz";
import { LesemodellService } from "../../services/wissensnetz/src/lesemodell";
import type { WissensnetzKo } from "../../services/wissensnetz/src/lesemodell-ports";
import { NAHT_OFFEN } from "../../services/wissensnetz/src/policy-naht";

// Die Naht wird geschlossen, wie Weg B sie schliessen wuerde: `policyFuer(betrachter)` liefert
// `(ko) => darfSehen(betrachter, ko)`. Name, Signatur und Betrachterkontext sind identisch mit
// dem Aufruf in `luecken-einstieg.ts` — genau das verlangt BENs Korrekturpflicht 2.
vi.mock("../../services/wissensnetz/src/policy-naht", async (echt) => {
  const original = await echt<typeof import("../../services/wissensnetz/src/policy-naht")>();
  return {
    ...original,
    policyFuer: vi.fn(
      (betrachter: { id: string; role: string }) => (ko: unknown) =>
        darfSehen(betrachter as never, ko as never),
    ),
  };
});

interface PruefKo extends WissensnetzKo {
  confidentiality?: string | null;
}

// Echte Unions des Hauses: `Confidentiality` (knowledge-object/src/types.ts:87), `isConfidential`
// nur fuer "vertraulich"/"streng_vertraulich" (confidentiality.ts:40-42), `Role`
// (auth/src/types.ts:1); `ko.validate` haben laut rbac/src/policy.ts:16-17 nur controller/admin.
const BESTAND: readonly PruefKo[] = [
  { id: "ko-offen", category: "Betrieb", author: "anna", confidentiality: "intern" },
  { id: "ko-geheim", category: "Vertraulich", author: "anna", confidentiality: "vertraulich" },
];

// A ist `experte` — ohne `ko.validate`. A sieht das vertrauliche Objekt allein wegen Autorschaft.
const A = { id: "anna", role: "experte" };
const B = { id: "bernd", role: "viewer" };

const lesemodell = () => new LesemodellService<PruefKo>({ kos: { alle: async () => BESTAND } });

describe("H3 · die Sicherheitskette durch wissensnetzLuecken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("K1 · n=1 DURCH den Einstieg: A sieht das vertrauliche Objekt, B weder Kennung noch Zaehlwirkung", async () => {
    const fuerA = await wissensnetz.wissensnetzLuecken(A, lesemodell());
    const fuerB = await wissensnetz.wissensnetzLuecken(B, lesemodell());

    // Zaehlwirkung
    expect(fuerA.objekteGesamt).toBe(2);
    expect(fuerB.objekteGesamt).toBe(1);
    // Kennung: das Thema des vertraulichen Objekts taucht bei B nirgends auf
    expect(fuerA.themen.map((t) => t.thema)).toContain("Vertraulich");
    expect(fuerB.themen.map((t) => t.thema)).not.toContain("Vertraulich");
    expect(JSON.stringify(fuerB)).not.toContain("ko-geheim");
  });

  it("K2 · der Einstieg reicht GENAU den uebergebenen Betrachter an die Naht weiter", async () => {
    // Ohne diese Zusicherung koennte der Einstieg mit dem richtigen Weg den falschen Menschen
    // messen — die Kette waere formal geschlossen und inhaltlich falsch.
    const { policyFuer } = await import("../../services/wissensnetz/src/policy-naht");
    await wissensnetz.wissensnetzLuecken(B, lesemodell());
    expect(policyFuer).toHaveBeenCalledWith(B);
  });

  it("K3 · die Naht wird VOR dem ersten Lesezugriff gezogen", async () => {
    const reihenfolge: string[] = [];
    const { policyFuer } = await import("../../services/wissensnetz/src/policy-naht");
    (
      policyFuer as unknown as { mockImplementationOnce: (f: unknown) => void }
    ).mockImplementationOnce((betrachter: { id: string; role: string }) => {
      reihenfolge.push("naht");
      return (ko: unknown) => darfSehen(betrachter as never, ko as never);
    });
    const zaehlend = new LesemodellService<PruefKo>({
      kos: {
        alle: async () => {
          reihenfolge.push("lesen");
          return BESTAND;
        },
      },
    });
    await wissensnetz.wissensnetzLuecken(A, zaehlend);
    expect(reihenfolge).toEqual(["naht", "lesen"]);
  });

  it("K4 · ein GESCHMUGGELTES Praedikat erreicht die Sicht nicht", async () => {
    // Der Einstieg nimmt kein Praedikat an. Hier wird es trotzdem uebergeben, wie ein Aufrufer
    // es mit `as never` erzwingen wuerde — die Filterung bleibt die des Betrachters.
    const geschmuggelt = { deckel: 50, sichtbar: () => true } as never;
    const fuerB = await wissensnetz.wissensnetzLuecken(B, lesemodell(), geschmuggelt);
    expect(fuerB.objekteGesamt).toBe(1);
    expect(JSON.stringify(fuerB)).not.toContain("ko-geheim");
  });

  it("K7 · die oeffentliche Oberflaeche traegt GENAU EINEN Funktionswert", () => {
    // Aus D6 uebernommen und hier unverzichtbar: Ohne diesen Fall koennte `sichtmetrik` in den
    // Index wandern, ohne dass ein Test anschlaegt — und die frei aufrufbare Auswertung waere
    // zurueck, also genau BENs Verstoss-Befund aus D1. Gleichheit statt `toContain`, damit auch
    // eine umbenannte oder asynchrone Huelle auffaellt.
    // ============================================================================================
    // JOB 2009 D2 — DIE LISTE WAECHST UM ZWEI, UND DIE ZUSAGE BLEIBT DIESELBE.
    // ============================================================================================
    //
    // Bis D1 stand hier `["wissensnetzLuecken"]` — und der Grund war richtig: eine frei aufrufbare
    // Auswertung darf nicht in den Index wandern. Der Fall hat in D2 SOFORT angeschlagen, als der
    // Index breiter wurde. Genau dafuer ist er da.
    //
    // Er wird deshalb PRAEZISIERT, nicht aufgeweicht:
    //   · `toEqual` bleibt `toEqual`. Eine VIERTE Funktion faellt weiterhin sofort auf, und
    //     `sichtmetrik` — auch umbenannt oder als async-Huelle — ebenso.
    //   · `wissensnetzSicht` ist KEINE Auswertung: sie erzeugt die Sicht (wie `wissensnetzLuecken`)
    //     und gibt die Metrik zurueck. Sie nimmt PORTS entgegen, kein Praedikat und keine Sicht.
    //     Ohne sie war der einzige oeffentliche Weg fuer jeden Aufrufer unerreichbar, weil er ein
    //     `LesemodellService` verlangt, das absichtlich nicht im Index steht (C1).
    //   · `policyNahtSchliessen` erzeugt gar nichts — sie nimmt die zentrale Policy entgegen.
    //     Sie ist die Gegenrichtung: nicht Daten heraus, sondern die Entscheidung herein.
    const funktionen = Object.keys(wissensnetz).filter(
      (name) => typeof (wissensnetz as Record<string, unknown>)[name] === "function",
    );
    expect(funktionen.sort()).toEqual([
      "policyNahtSchliessen",
      "wissensnetzLuecken",
      "wissensnetzMetrikFuer",
    ]);
  });

  it("K5 · die Metrik ist semantikneutral — sie zaehlt Sichtbares und klassifiziert nichts", async () => {
    const fuerB = await wissensnetz.wissensnetzLuecken(B, lesemodell());
    // Kein Feld, das eine Luecke behauptet.
    expect(JSON.stringify(fuerB)).not.toMatch(/luecke|Luecke|lücke|Lücke/i);
    // Stattdessen: was sichtbar war, und dass die Zahl eine Untergrenze sein kann.
    const betrieb = fuerB.themen.find((t) => t.thema === "Betrieb");
    expect(betrieb?.sichtbareBeitragende).toBe(1);
    expect(betrieb?.beitragendeAbgeschnitten).toBe(false);
  });
});

describe("H3 · der Einstieg im OFFENEN Nahtzustand", () => {
  it("K6 · ohne geschlossene Naht entsteht keine Metrik, sondern ein Wurf mit Grund", async () => {
    // Hier gilt die echte Naht, nicht der Mock.
    const echt = await vi.importActual<typeof import("../../services/wissensnetz/src/policy-naht")>(
      "../../services/wissensnetz/src/policy-naht",
    );
    expect(() => echt.policyFuer(A)).toThrow(NAHT_OFFEN);
  });
});
