// ================================================================================================
// KLARA 10 (produkt:20261007:klara-erinnerungen-kalender) · DIE ZEITREGELN — rein, ohne Ablage.
// ================================================================================================
//
// Gemessen an `services/app/src/klara-erinnerung-zeit.ts`, mit fester Uhr und echten IANA-Zonen der
// Laufzeit (ICU). Alle Daten sind fiktiv.
//
//   Z1 (K1, AW18-K02) „Morgen um neun" ist mehrdeutig (morgens/abends) und wird geklärt; mit
//      Tageszeit oder „09:00" eindeutig; fehlendes Datum/fehlende Uhrzeit/Vergangenes verlangen Klärung.
//   Z2 (K4, AW18-K03) S09 Europe/Berlin: 02:30 am 29.03.2026 existiert nicht, 02:30 am 25.10.2026 ist
//      doppelt. Verschiebe-, Auslass- und Offsetregel liefern je GENAU einen (oder keinen) Zeitpunkt.
//   Z3 (AW18-K02) Eine ganztägige Frist bleibt ein Datum — der Vorlauf rechnet in Kalendertagen und
//      verschiebt sich in keiner Zone um einen Tag.
//   Z4 (K4, AW18-K01) Serien: täglich, wöchentlich mit Wochentagen, monatlich (Monatsende), Ende nach
//      Datum und nach Anzahl; jedes Vorkommen hat eine stabile Kennung.
import { describe, expect, it } from "vitest";
import {
  deuteZeitangabe,
  istZeitzone,
  loeseLokal,
  loeseMitRegel,
  lokalVon,
  nominaleVorkommen,
  versatzMinuten,
  vorkommenId,
  vorlaufDatum,
} from "../../services/app/src/klara-erinnerung-zeit";

const BERLIN = "Europe/Berlin";
// Montag, 12.10.2026, 10:00 in Berlin (MESZ, UTC+2).
const JETZT = Date.parse("2026-10-12T08:00:00.000Z");

describe("Z1 · relative und mehrdeutige Angaben werden vor dem Anlegen geklärt", () => {
  it("„Morgen um neun“ ist morgens oder abends — beide Möglichkeiten mit Datum stehen zur Wahl", () => {
    const d = deuteZeitangabe("Morgen um neun erinnern", JETZT, BERLIN);
    expect(d).toEqual({
      art: "klaerung",
      grund: "tageszeit_mehrdeutig",
      optionen: [
        { datum: "2026-10-13", uhrzeit: "09:00" },
        { datum: "2026-10-13", uhrzeit: "21:00" },
      ],
    });
  });

  it("mit Tageszeit oder als 09:00/21 Uhr ist dieselbe Angabe eindeutig", () => {
    expect(deuteZeitangabe("morgen früh um neun", JETZT, BERLIN)).toEqual({
      art: "eindeutig",
      datum: "2026-10-13",
      uhrzeit: "09:00",
    });
    expect(deuteZeitangabe("morgen abends um neun", JETZT, BERLIN)).toEqual({
      art: "eindeutig",
      datum: "2026-10-13",
      uhrzeit: "21:00",
    });
    expect(deuteZeitangabe("morgen um 09:00", JETZT, BERLIN)).toMatchObject({
      art: "eindeutig",
      uhrzeit: "09:00",
    });
    expect(deuteZeitangabe("übermorgen um 21 Uhr", JETZT, BERLIN)).toEqual({
      art: "eindeutig",
      datum: "2026-10-14",
      uhrzeit: "21:00",
    });
    expect(deuteZeitangabe("am 30.10. um 14:30", JETZT, BERLIN)).toEqual({
      art: "eindeutig",
      datum: "2026-10-30",
      uhrzeit: "14:30",
    });
    // Ein Wochentag ist der nächste — nie der heutige.
    expect(deuteZeitangabe("Montag um 08:15", JETZT, BERLIN)).toMatchObject({
      datum: "2026-10-19",
    });
  });

  it("fehlendes Datum, fehlende Uhrzeit, Unverständliches und Vergangenes verlangen eine Klärung", () => {
    expect(deuteZeitangabe("um neun", JETZT, BERLIN)).toMatchObject({ grund: "datum_fehlt" });
    expect(deuteZeitangabe("morgen", JETZT, BERLIN)).toMatchObject({ grund: "uhrzeit_fehlt" });
    expect(deuteZeitangabe("irgendwann bald", JETZT, BERLIN)).toMatchObject({
      grund: "nicht_erkannt",
    });
    expect(deuteZeitangabe("heute um 08:00", JETZT, BERLIN)).toEqual({
      art: "klaerung",
      grund: "vergangen",
      optionen: [{ datum: "2026-10-13", uhrzeit: "08:00" }],
    });
  });

  it("kurz nach Mitternacht kann „morgen“ auch heute heißen — das wird gefragt", () => {
    const nacht = Date.parse("2026-10-12T22:30:00.000Z"); // 00:30 am 13.10. in Berlin
    expect(deuteZeitangabe("morgen um 09:00", nacht, BERLIN)).toEqual({
      art: "klaerung",
      grund: "morgen_mehrdeutig",
      optionen: [
        { datum: "2026-10-13", uhrzeit: "09:00" },
        { datum: "2026-10-14", uhrzeit: "09:00" },
      ],
    });
  });

  it("dieselbe Angabe in einer anderen Zone meint die lokale Zeit DORT", () => {
    const d = deuteZeitangabe("morgen um 09:00", JETZT, "America/New_York");
    expect(d).toEqual({ art: "eindeutig", datum: "2026-10-13", uhrzeit: "09:00" });
    const ms = loeseMitRegel({ datum: "2026-10-13", uhrzeit: "09:00" }, "America/New_York", {
      luecke: "verschieben",
      doppelt: "erste",
    }).ms;
    expect(new Date(ms ?? 0).toISOString()).toBe("2026-10-13T13:00:00.000Z");
  });

  it("nur IANA-Zonen gelten — keine Abkürzungen", () => {
    expect(istZeitzone(BERLIN)).toBe(true);
    expect(istZeitzone("UTC")).toBe(true);
    expect(istZeitzone("MEZ")).toBe(false);
    expect(istZeitzone("Europe/Nirgendwo")).toBe(false);
  });
});

describe("Z2 · S09 — Europe/Berlin über die Sommerzeit", () => {
  it("02:30 am 29.03.2026 existiert nicht: Lücke von 60 Minuten, sichtbar", () => {
    const lage = loeseLokal({ datum: "2026-03-29", uhrzeit: "02:30" }, BERLIN);
    expect(lage.art).toBe("luecke");
    if (lage.art !== "luecke") {
      return;
    }
    expect(lage.lueckeMinuten).toBe(60);
    // Verschoben um die Lücke: 03:30 MESZ (= 01:30 UTC).
    expect(new Date(lage.verschoben).toISOString()).toBe("2026-03-29T01:30:00.000Z");
    expect(lokalVon(lage.verschoben, BERLIN)).toEqual({
      datum: "2026-03-29",
      uhrzeit: "03:30",
      versatz: "+02:00",
    });
  });

  it("Regel „verschieben“ gibt genau 03:30, Regel „auslassen“ keinen Zeitpunkt — beides benannt", () => {
    const l = { datum: "2026-03-29", uhrzeit: "02:30" };
    expect(loeseMitRegel(l, BERLIN, { luecke: "verschieben", doppelt: "erste" })).toEqual({
      ms: Date.parse("2026-03-29T01:30:00.000Z"),
      hinweis: "luecke_verschoben",
    });
    expect(loeseMitRegel(l, BERLIN, { luecke: "auslassen", doppelt: "erste" })).toEqual({
      ms: null,
      hinweis: "luecke_ausgelassen",
    });
  });

  it("02:30 am 25.10.2026 ist doppelt: zwei Zeitpunkte eine Stunde auseinander", () => {
    const lage = loeseLokal({ datum: "2026-10-25", uhrzeit: "02:30" }, BERLIN);
    expect(lage).toEqual({
      art: "doppelt",
      erste: Date.parse("2026-10-25T00:30:00.000Z"),
      zweite: Date.parse("2026-10-25T01:30:00.000Z"),
    });
    expect(versatzMinuten(Date.parse("2026-10-25T00:30:00.000Z"), BERLIN)).toBe(120);
    expect(versatzMinuten(Date.parse("2026-10-25T01:30:00.000Z"), BERLIN)).toBe(60);
  });

  it("Offsetregel „erste“/„zweite“ wählt GENAU einen der beiden — kein stiller Doppeltermin", () => {
    const l = { datum: "2026-10-25", uhrzeit: "02:30" };
    const erste = loeseMitRegel(l, BERLIN, { luecke: "verschieben", doppelt: "erste" });
    const zweite = loeseMitRegel(l, BERLIN, { luecke: "verschieben", doppelt: "zweite" });
    expect(erste).toEqual({ ms: Date.parse("2026-10-25T00:30:00.000Z"), hinweis: "doppelt_erste" });
    expect(zweite).toEqual({
      ms: Date.parse("2026-10-25T01:30:00.000Z"),
      hinweis: "doppelt_zweite",
    });
  });

  it("gewöhnliche Zeiten an beiden Umstellungstagen bleiben eindeutig und ohne Hinweis", () => {
    for (const l of [
      { datum: "2026-03-29", uhrzeit: "01:30" },
      { datum: "2026-03-29", uhrzeit: "09:00" },
      { datum: "2026-10-25", uhrzeit: "09:00" },
    ]) {
      const r = loeseMitRegel(l, BERLIN, { luecke: "verschieben", doppelt: "erste" });
      expect(r.hinweis, JSON.stringify(l)).toBeNull();
      expect(lokalVon(r.ms ?? 0, BERLIN).uhrzeit).toBe(l.uhrzeit);
    }
  });

  it("eine tägliche 09:00-Serie über beide Umstellungen bleibt lokal 09:00 (Versatz wechselt sichtbar)", () => {
    const plan = {
      art: "serie" as const,
      datum: "2026-03-28",
      uhrzeit: "09:00",
      wiederholung: {
        takt: "taeglich" as const,
        intervall: 1,
        wochentage: [],
        bis: "2026-03-30",
        anzahl: null,
      },
    };
    const zeiten = [...nominaleVorkommen(plan)].map((l) => {
      const ms = loeseMitRegel(l, BERLIN, { luecke: "verschieben", doppelt: "erste" }).ms ?? 0;
      return `${lokalVon(ms, BERLIN).uhrzeit}${lokalVon(ms, BERLIN).versatz}`;
    });
    expect(zeiten).toEqual(["09:00+01:00", "09:00+02:00", "09:00+02:00"]);
  });
});

describe("Z3 · eine ganztägige Frist bleibt ein Datum", () => {
  it("Vorlauf rechnet Kalendertage — über Monats- und Jahresgrenzen, ohne Zone", () => {
    expect(vorlaufDatum("2026-10-30", 3)).toBe("2026-10-27");
    expect(vorlaufDatum("2026-11-01", 1)).toBe("2026-10-31");
    expect(vorlaufDatum("2027-01-01", 1)).toBe("2026-12-31");
    expect(vorlaufDatum("2026-03-30", 1)).toBe("2026-03-29");
  });

  it("die Erinnerung zur Frist fällt auf den lokalen Tag — in Berlin wie in Tokio und New York", () => {
    const plan = {
      art: "frist" as const,
      fristDatum: "2026-10-30",
      vorlaufTage: 2,
      uhrzeit: "00:30",
    };
    const [l] = [...nominaleVorkommen(plan)];
    expect(l).toEqual({ datum: "2026-10-28", uhrzeit: "00:30" });
    for (const zone of [BERLIN, "Asia/Tokyo", "America/New_York"]) {
      const ms = loeseMitRegel(l ?? { datum: "", uhrzeit: "" }, zone, {
        luecke: "verschieben",
        doppelt: "erste",
      }).ms;
      // Lokal genau der 28. — nie ein um die UTC-Verschiebung „gerutschter" 27. oder 29.
      expect(lokalVon(ms ?? 0, zone).datum, zone).toBe("2026-10-28");
    }
  });
});

describe("Z4 · Serien und Serienende", () => {
  it("wöchentlich Mo/Mi/Fr bis Datum, mit stabiler Vorkommenskennung", () => {
    const plan = {
      art: "serie" as const,
      datum: "2026-10-12",
      uhrzeit: "07:45",
      wiederholung: {
        takt: "woechentlich" as const,
        intervall: 1,
        wochentage: [1, 3, 5] as (1 | 3 | 5)[],
        bis: "2026-10-23",
        anzahl: null,
      },
    };
    const v = [...nominaleVorkommen(plan)].map((l) => l.datum);
    expect(v).toEqual([
      "2026-10-12",
      "2026-10-14",
      "2026-10-16",
      "2026-10-19",
      "2026-10-21",
      "2026-10-23",
    ]);
    expect(vorkommenId("e-1", { datum: "2026-10-14", uhrzeit: "07:45" })).toBe(
      "e-1@2026-10-14T07:45",
    );
  });

  it("alle zwei Tage nach Anzahl; monatlich am 31. fällt in kurzen Monaten auf den Monatsletzten", () => {
    const zweitaegig = [
      ...nominaleVorkommen({
        art: "serie",
        datum: "2026-10-30",
        uhrzeit: "08:00",
        wiederholung: { takt: "taeglich", intervall: 2, wochentage: [], bis: null, anzahl: 3 },
      }),
    ].map((l) => l.datum);
    expect(zweitaegig).toEqual(["2026-10-30", "2026-11-01", "2026-11-03"]);
    const monatlich = [
      ...nominaleVorkommen({
        art: "serie",
        datum: "2026-10-31",
        uhrzeit: "08:00",
        wiederholung: { takt: "monatlich", intervall: 1, wochentage: [], bis: null, anzahl: 4 },
      }),
    ].map((l) => l.datum);
    expect(monatlich).toEqual(["2026-10-31", "2026-11-30", "2026-12-31", "2027-01-31"]);
  });

  it("ohne Ende ist die Serie gedeckelt (höchstens 2000 Vorkommen) — nie unendlich", () => {
    const n = [
      ...nominaleVorkommen({
        art: "serie",
        datum: "2026-10-12",
        uhrzeit: "08:00",
        wiederholung: { takt: "taeglich", intervall: 1, wochentage: [], bis: null, anzahl: null },
      }),
    ].length;
    expect(n).toBe(2000);
  });
});
