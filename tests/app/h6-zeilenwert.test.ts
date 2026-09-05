// ================================================================================================
// JOB 3065 H6 · DER WERT EINER ZEILE LÜGT NICHT — das Zustandsmodell, DOM-frei geprüft.
// ================================================================================================
//
// REGELN §7 und Auftrag §9 verlangen für jede Zeile denselben Vertrag. Er liegt in
// `components/einstellungen/zeilenWert.ts` und wird hier Zustand für Zustand nachgerechnet:
//
//   laden ........................... "–"            · nie eine 0, nie „keine"
//   offline ohne Daten .............. "–"
//   Fehler ohne Daten ............... nicht abrufbar
//   erfolgreich leer ................ „keine" (bzw. der eigene Leertext der Zeile)
//   erfolgreich mit Wert ............ der Wert
//   Cache + laufende Auffrischung ... Wert + Stand
//   Cache + gescheiterte Auffrischung Wert + Stand + nicht aktualisiert
//   Cache + offline ................. Wert + Stand + nicht aktualisiert
//
// Der springende Punkt (LEHREN JOB 3027 R2, 3034, 3037 R4/R5): vorhandene Daten bleiben SICHTBAR.
// Eine gescheiterte Auffrischung leert die Zeile nicht, und ein leerer Cache bleibt leer statt zum
// Erstfehler umgedeutet zu werden.
import { describe, expect, it } from "vitest";
import {
  abfragelage,
  gruppenlage,
  wertBefund,
} from "../../apps/web/src/components/einstellungen/zeilenWert";

const STAND = 1_725_000_000_000;

/** Die Minimalsicht einer react-query-Abfrage, wie sie die Zeile bekommt. */
function q(over: Partial<Parameters<typeof abfragelage>[0]> = {}) {
  return {
    data: undefined as unknown,
    isError: false,
    isFetching: false,
    fetchStatus: "idle",
    dataUpdatedAt: 0,
    ...over,
  };
}

describe("JOB 3065 H6 · Zeilenwert — das Zustandsmodell", () => {
  it("lädt: keine Daten, kein Fehler → unbekannt (Gedankenstrich)", () => {
    const b = wertBefund(abfragelage(q({ isFetching: true, fetchStatus: "fetching" }), true), null);
    expect(b.art).toBe("laedt");
    expect(b.wert).toBeNull();
  });

  it("offline ohne Daten: unbekannt — weder keine noch nicht abrufbar", () => {
    const b = wertBefund(abfragelage(q(), false), null);
    expect(b.art).toBe("offline");
    // Auch dann, wenn die Abfrage selbst noch gar nicht pausiert gemeldet ist (LEHREN 3044 R2).
    expect(wertBefund(abfragelage(q({ fetchStatus: "paused" }), true), null).art).toBe("offline");
  });

  it("Fehler ohne Daten: nicht abrufbar", () => {
    expect(wertBefund(abfragelage(q({ isError: true }), true), null).art).toBe("fehler");
  });

  it("erfolgreich leer: keine — und nur nach einer echten leeren Antwort", () => {
    const b = wertBefund(abfragelage(q({ data: [], dataUpdatedAt: STAND }), true), null, true);
    expect(b.art).toBe("leer");
    expect(b.nichtAktualisiert).toBe(false);
    expect(b.standMs).toBe(0);
  });

  it("erfolgreich mit Wert: der Wert, ohne Zusatz", () => {
    const b = wertBefund(abfragelage(q({ data: [1, 2], dataUpdatedAt: STAND }), true), "2");
    expect(b).toEqual({ art: "wert", wert: "2", standMs: 0, nichtAktualisiert: false });
  });

  it("Cache mit LAUFENDER Auffrischung: Wert bleibt, Stand kommt dazu", () => {
    const b = wertBefund(
      abfragelage(
        q({ data: [1], isFetching: true, fetchStatus: "fetching", dataUpdatedAt: STAND }),
        true,
      ),
      "1",
    );
    expect(b.art).toBe("wert");
    expect(b.wert).toBe("1");
    expect(b.standMs).toBe(STAND);
    expect(b.nichtAktualisiert).toBe(false);
  });

  it("Cache mit GESCHEITERTER Auffrischung: Wert bleibt sichtbar, Stand + nicht aktualisiert", () => {
    const b = wertBefund(
      abfragelage(q({ data: [1], isError: true, dataUpdatedAt: STAND }), true),
      "1",
    );
    expect(b.art).toBe("wert");
    expect(b.wert).toBe("1");
    expect(b.standMs).toBe(STAND);
    expect(b.nichtAktualisiert).toBe(true);
  });

  it("LEERER Cache mit gescheiterter Auffrischung bleibt LEER — kein Erstfehler (LEHREN 3027 R2)", () => {
    const b = wertBefund(
      abfragelage(q({ data: [], isError: true, dataUpdatedAt: STAND }), true),
      null,
      true,
    );
    expect(b.art).toBe("leer");
    expect(b.nichtAktualisiert).toBe(true);
    expect(b.standMs).toBe(STAND);
  });

  it("Cache und offline: Wert bleibt, Stand + nicht aktualisiert (kein Rückfall auf unbekannt)", () => {
    const b = wertBefund(abfragelage(q({ data: [1], dataUpdatedAt: STAND }), false), "1");
    expect(b.art).toBe("wert");
    expect(b.standMs).toBe(STAND);
    expect(b.nichtAktualisiert).toBe(true);
  });

  it("KEIN positiver Wert ohne Daten: ein mitgegebener Fachwert ohne `data` wird nicht ausgegeben", () => {
    // Der Fachwert entsteht im Aufrufer aus `data`; wäre er dennoch gesetzt, darf er nicht in eine
    // Tatsachenaussage geraten, solange die Abfrage nichts geliefert hat.
    const b = wertBefund(abfragelage(q(), true), "3 erreichbar");
    expect(b.art).toBe("laedt");
    expect(b.wert).toBeNull();
  });
});

// ================================================================================================
// JOB 3065 R5 · BENs Korrekturpflicht 1 — DIE GRUPPE LÜGT AUCH NICHT.
// ================================================================================================
//
// Die Bereitschaft ist der einzige Wert der Einstellungen, der aus SECHS Quellen zugleich entsteht.
// Bis Runde 4 fasste ihn `lib/loadingState.ts` zusammen — und das kennt nur `isError`. BENs Messung:
// vollständiger Bestand, danach `onlineManager.setOnline(false)` → sichtbar blieben „Teilweise
// verbunden", „2" und „10 Anhänge · 20 MB" OHNE jeden Hinweis, dass seither nichts mehr nachgeholt
// wird. `gruppenlage()` faltet die Quellen deshalb auf EINE Lage, die danach durch denselben
// `wertBefund` läuft wie jede einzelne Zeile.
describe("JOB 3065 H6 R5 · Gruppenwert — dieselben Regeln für sechs Quellen", () => {
  const geladen = (over = {}) => abfragelage(q({ data: [1], dataUpdatedAt: STAND, ...over }), true);

  it("alle geladen, nichts gestört: der Wert ohne Zusatz", () => {
    const b = wertBefund(gruppenlage([geladen(), geladen()]), "4 von 6");
    expect(b.art).toBe("wert");
    expect(b.standMs).toBe(0);
    expect(b.nichtAktualisiert).toBe(false);
  });

  it("BENs Fall: vollständiger Bestand, dann OFFLINE → Wert bleibt, aber Stand + nicht aktualisiert", () => {
    const offline = [
      abfragelage(q({ data: [1], dataUpdatedAt: STAND }), false),
      abfragelage(q({ data: [1], dataUpdatedAt: STAND + 5_000 }), false),
    ];
    const b = wertBefund(gruppenlage(offline), "4 von 6");
    expect(b.art).toBe("wert");
    expect(b.wert).toBe("4 von 6");
    expect(b.nichtAktualisiert).toBe(true);
    // Der Stand der Gruppe ist der ÄLTESTE ihrer Quellen — nie der frischere.
    expect(b.standMs).toBe(STAND);
  });

  it("eine gescheiterte Auffrischung in der Gruppe: Bestand bleibt, als nicht aktualisiert markiert", () => {
    const b = wertBefund(gruppenlage([geladen(), geladen({ isError: true })]), "4 von 6");
    expect(b.art).toBe("wert");
    expect(b.nichtAktualisiert).toBe(true);
    expect(b.standMs).toBe(STAND);
  });

  it("offline OHNE Bestand: unbekannt — kein Fehler, keine 0", () => {
    const b = wertBefund(gruppenlage([abfragelage(q(), false), abfragelage(q(), false)]), null);
    expect(b.art).toBe("offline");
    expect(b.wert).toBeNull();
  });

  it("eine tragende Quelle scheitert ohne Daten: nicht abrufbar (mega3 Block B)", () => {
    const b = wertBefund(gruppenlage([geladen(), abfragelage(q({ isError: true }), true)]), null);
    expect(b.art).toBe("fehler");
  });

  it("eine Quelle lädt noch, eine andere hat einen Refetch-Fehler: die Gruppe LÄDT (kein Fehler)", () => {
    // Nur die FEHLENDEN Quellen entscheiden über Fehler und Offline — eine Quelle mit Bestand macht
    // die Gruppe nicht „nicht abrufbar".
    const b = wertBefund(gruppenlage([geladen({ isError: true }), abfragelage(q(), true)]), null);
    expect(b.art).toBe("laedt");
  });
});
