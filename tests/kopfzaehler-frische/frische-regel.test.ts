// ================================================================================================
// JOB 3113 · H1b — DIE REINE FRISCHE-REGEL DES ZÄHLERS (DOM-frei, Node-Gate).
// ================================================================================================
//
// Bis hierher hiess „nicht mehr gedeckt" ausschliesslich „ein Neuabruf ist GESCHEITERT"
// (`isGroupStale`). Ein Cache, den einfach niemand mehr nachgefragt hat, erfüllte diese Bedingung
// nie — die Zahl neben „Prüfen" stand weiter und sah aus wie eine Auskunft über JETZT.
//
// `gruppeVeraltet` schliesst genau diese Lücke: eine Zahl ist nur so lange gedeckt, wie ein
// ERFOLGREICHER Abruf sie deckt (`dataUpdatedAt`) und dieser nicht älter als die Frist ist. Die
// Gruppe wird ATOMAR beurteilt wie in `groupLoadPhase`: sie ist so frisch wie ihre ÄLTESTE Quelle.
import { describe, expect, it } from "vitest";
import {
  ZAEHLER_FRISCHE_MS,
  gruppeVeraltet,
  naechsterFristablauf,
} from "../../apps/web/src/lib/loadingState";

const JETZT = 1_700_000_000_000;
const stand = (vorMs: number) => ({ dataUpdatedAt: JETZT - vorMs });
const nieGeladen = { dataUpdatedAt: 0 };

describe("JOB 3113 H1b: gruppeVeraltet — eine Zahl steht nur, solange ein frischer Abruf sie deckt", () => {
  it("Fall A: beide Quellen vor 5 s bestätigt ⇒ nicht veraltet", () => {
    expect(gruppeVeraltet([stand(5_000), stand(5_000)], JETZT)).toBe(false);
  });

  it("Fall B: eine Quelle vor 5 s, eine vor 31 s ⇒ veraltet (die ÄLTESTE entscheidet)", () => {
    expect(gruppeVeraltet([stand(5_000), stand(31_000)], JETZT)).toBe(true);
    // Reihenfolge ist gleichgültig — die Regel ist atomar, nicht positionsabhängig.
    expect(gruppeVeraltet([stand(31_000), stand(5_000)], JETZT)).toBe(true);
  });

  it("Fall C: eine Quelle ohne jeden Zeitstempel (dataUpdatedAt === 0) ⇒ veraltet", () => {
    expect(gruppeVeraltet([stand(1_000), nieGeladen], JETZT)).toBe(true);
    expect(gruppeVeraltet([nieGeladen], JETZT)).toBe(true);
  });

  it("Fall D: GENAU auf der Frist (jetzt - dataUpdatedAt === 30 000) ⇒ veraltet", () => {
    expect(ZAEHLER_FRISCHE_MS).toBe(30_000);
    expect(gruppeVeraltet([stand(ZAEHLER_FRISCHE_MS)], JETZT)).toBe(true);
    // Eine Millisekunde davor ist die Zahl noch gedeckt — die Grenze liegt wirklich dort.
    expect(gruppeVeraltet([stand(ZAEHLER_FRISCHE_MS - 1)], JETZT)).toBe(false);
  });

  it("die Frist ist überschreibbar, ohne dass ein zweiter Standardwert entsteht", () => {
    expect(gruppeVeraltet([stand(10_000)], JETZT, 5_000)).toBe(true);
    expect(gruppeVeraltet([stand(10_000)], JETZT, 60_000)).toBe(false);
  });
});

describe("JOB 3113 H1b: naechsterFristablauf — der EINE Zeitpunkt, an dem neu gezeichnet werden muss", () => {
  it("nennt den frühesten noch bevorstehenden Ablauf (die älteste Quelle zuerst)", () => {
    expect(naechsterFristablauf([stand(5_000), stand(20_000)], JETZT)).toBe(
      JETZT - 20_000 + ZAEHLER_FRISCHE_MS,
    );
  });

  it("überspringt bereits abgelaufene Quellen und nennt den NÄCHSTEN Ablauf (kein Dauerticker, keine Lücke)", () => {
    // Die 31-s-Quelle ist durch; die 5-s-Quelle läuft in 25 s ab — genau dann muss neu gezeichnet
    // werden, sonst bliebe die Zahl einer jüngeren Gruppe für immer stehen.
    expect(naechsterFristablauf([stand(31_000), stand(5_000)], JETZT)).toBe(
      JETZT - 5_000 + ZAEHLER_FRISCHE_MS,
    );
  });

  it("ohne Zeitstempel und bei komplett abgelaufener Gruppe: kein Ablauf mehr (null ⇒ kein Timer)", () => {
    expect(naechsterFristablauf([nieGeladen], JETZT)).toBeNull();
    expect(naechsterFristablauf([stand(31_000), stand(40_000)], JETZT)).toBeNull();
    expect(naechsterFristablauf([], JETZT)).toBeNull();
  });
});
