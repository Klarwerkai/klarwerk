// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 AC05 — FÄLLIGKEIT NACH ZEITZONE,
// SOMMERZEIT UND NACHHOLREGEL (`assistenz-lernen-zeitplan.ts`, rein, gestellte Zeit).
// ================================================================================================
//
// Kalender 2026: Mo 19.10. und Mo 26.10.; Sommerzeitende in Europa So 25.10. (03:00 → 02:00),
// Sommerzeitbeginn So 29.03. (02:00 → 03:00); in den USA endet sie So 01.11.
import { describe, expect, it } from "vitest";
import type { Zeitplan } from "../../services/app/src/assistenz-lernen";
import { faelligerTermin, lokalZuUtc } from "../../services/app/src/assistenz-lernen-zeitplan";

const BERLIN = "Europe/Berlin";
const ms = (iso: string) => Date.parse(iso);
const nie = () => false;
const ZWEI_MINUTEN = 2 * 60 * 1000;

const montags8: Zeitplan = {
  art: "woechentlich",
  wochentag: 1,
  uhrzeit: "08:00",
  zeitzone: BERLIN,
  nachholen: "einmal_nachholen",
};

describe("AC05 · lokale Zeit in der Zone, Sommerzeit", () => {
  it("rechnet Sommer- und Winterzeit verschieden um", () => {
    expect(lokalZuUtc(BERLIN, { y: 2026, mo: 10, d: 19, h: 8, mi: 0 })).toBe(
      ms("2026-10-19T06:00:00Z"),
    );
    expect(lokalZuUtc(BERLIN, { y: 2026, mo: 10, d: 26, h: 8, mi: 0 })).toBe(
      ms("2026-10-26T07:00:00Z"),
    );
    const ny = "America/New_York";
    expect(lokalZuUtc(ny, { y: 2026, mo: 11, d: 2, h: 8, mi: 0 })).toBe(ms("2026-11-02T13:00:00Z"));
  });

  it("übersprungene Stunde → erste gültige Zeit danach; doppelte Stunde → erstes Auftreten", () => {
    // 29.03. 02:30 gibt es nicht: 03:30 Sommerzeit = 01:30Z.
    expect(lokalZuUtc(BERLIN, { y: 2026, mo: 3, d: 29, h: 2, mi: 30 })).toBe(
      ms("2026-03-29T01:30:00Z"),
    );
    // 25.10. 02:30 gibt es zweimal: zuerst in Sommerzeit = 00:30Z.
    expect(lokalZuUtc(BERLIN, { y: 2026, mo: 10, d: 25, h: 2, mi: 30 })).toBe(
      ms("2026-10-25T00:30:00Z"),
    );
  });
});

describe("AC05 · fälliger Termin", () => {
  const seit = ms("2026-10-12T00:00:00Z");

  it("wöchentlich: genau zur lokalen Zeit fällig, vorher nicht, erledigt nie wieder", () => {
    const vorher = faelligerTermin(montags8, seit, ms("2026-10-19T05:59:00Z"), nie, ZWEI_MINUTEN);
    // Vor 08:00 am 19.10. ist der jüngste Termin der vom 12.10. (06:00Z, nach dem Setzen um 00:00Z).
    expect(vorher).toEqual({ kennung: "zeitplan-w-2026-10-12", am: ms("2026-10-12T06:00:00Z") });
    const t = faelligerTermin(montags8, seit, ms("2026-10-19T06:00:30Z"), nie, ZWEI_MINUTEN);
    expect(t).toEqual({ kennung: "zeitplan-w-2026-10-19", am: ms("2026-10-19T06:00:00Z") });
    const erledigt = (k: string) => k === "zeitplan-w-2026-10-19";
    expect(faelligerTermin(montags8, seit, ms("2026-10-19T06:05:00Z"), erledigt, 0)).toBeNull();
  });

  it("nach dem Sommerzeitende liegt derselbe Termin eine Stunde später in UTC", () => {
    const t = faelligerTermin(montags8, seit, ms("2026-10-26T07:00:10Z"), nie, ZWEI_MINUTEN);
    expect(t).toEqual({ kennung: "zeitplan-w-2026-10-26", am: ms("2026-10-26T07:00:00Z") });
    // 06:30Z ist am 26.10. erst 07:30 Winterzeit: noch der Termin der Vorwoche.
    const frueh = faelligerTermin(montags8, seit, ms("2026-10-26T06:30:00Z"), nie, ZWEI_MINUTEN);
    expect(frueh?.kennung).toBe("zeitplan-w-2026-10-19");
  });

  it("Nachholregel: einmal_nachholen holt nur den jüngsten versäumten Termin; auslassen nicht", () => {
    const mittwoch = ms("2026-10-28T12:00:00Z");
    const erledigt19 = (k: string) => k === "zeitplan-w-2026-10-19";
    expect(faelligerTermin(montags8, seit, mittwoch, erledigt19, ZWEI_MINUTEN)).toEqual({
      kennung: "zeitplan-w-2026-10-26",
      am: ms("2026-10-26T07:00:00Z"),
    });
    const auslassen: Zeitplan = { ...montags8, nachholen: "auslassen" };
    expect(faelligerTermin(auslassen, seit, mittwoch, erledigt19, ZWEI_MINUTEN)).toBeNull();
    // Innerhalb der Toleranz läuft auch `auslassen`.
    const puenktlich = ms("2026-10-26T07:01:00Z");
    expect(faelligerTermin(auslassen, seit, puenktlich, nie, ZWEI_MINUTEN)?.kennung).toBe(
      "zeitplan-w-2026-10-26",
    );
  });

  it("Termine vor dem Setzen und vor `ab` sind nicht versäumt", () => {
    const spaeterGesetzt = ms("2026-10-19T07:00:00Z");
    const jetzt = ms("2026-10-19T08:00:00Z");
    expect(faelligerTermin(montags8, spaeterGesetzt, jetzt, nie, ZWEI_MINUTEN)).toBeNull();
    const abSpaeter: Zeitplan = { ...montags8, ab: "2026-10-26" };
    expect(faelligerTermin(abSpaeter, seit, ms("2026-10-20T08:00:00Z"), nie, 0)).toBeNull();
  });

  it("ab Datum: einmal zur lokalen Startzeit; sofort: einmal je Setzen", () => {
    const ab: Zeitplan = { art: "ab_datum", start: "2026-10-19T08:00", zeitzone: BERLIN };
    expect(faelligerTermin(ab, seit, ms("2026-10-19T05:59:00Z"), nie, 0)).toBeNull();
    expect(faelligerTermin(ab, seit, ms("2026-10-19T06:00:00Z"), nie, 0)).toEqual({
      kennung: "zeitplan-ab-2026-10-19T08-00",
      am: ms("2026-10-19T06:00:00Z"),
    });
    const sofort = faelligerTermin({ art: "sofort" }, seit, seit + 1, nie, 0);
    expect(sofort).toEqual({ kennung: `zeitplan-sofort-${seit}`, am: seit });
    const erledigt = (k: string) => k === sofort?.kennung;
    expect(faelligerTermin({ art: "sofort" }, seit, seit + 60_000, erledigt, 0)).toBeNull();
  });
});
