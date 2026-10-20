import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { leseVortragsAuftrag } from "../../services/app/src/praesentation-vortrag";
import { vortragsWelt } from "./pp08-welt";

let w: Awaited<ReturnType<typeof vortragsWelt>>;
beforeEach(async () => {
  w = await vortragsWelt();
});
afterEach(async () => {
  await w?.app.close();
});

describe("PP-08 · echter Anhang-/Herkunfts-/Prüfweg, keine Hostsimulation", () => {
  it("Notiz, Übergang und Zeit bleiben an stabiler Folie und Datenfassung; fehlende Erklärung wird Aufgabe", async () => {
    const r = await w.auswerten(w.auftrag());
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(r.body.zeit).toEqual({ geplant: 60, ziel: 120, abweichung: -60 });
    expect(r.body.notizen[0]).toMatchObject({
      sldId: "256",
      uebergang: "Im Anschluss folgt der Ausblick.",
      aussagen: [{ id: w.dp.id, fassung: 1 }],
    });
    expect(r.body.aufgaben).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          titel: "Erklärung ergänzen",
          sldId: "256",
          aussage: { id: w.dp.id, fassung: 1 },
        }),
      ]),
    );
    expect(r.body.probe).toBeNull();
    const dp = (await w.ruf("GET", `/api/datenpunkte/${w.dp.id}`)).body;
    expect(
      r.body.aufgaben
        .filter((a: { titel: string }) => a.titel === "Datenprüfung offen")
        .map((a: { arbeit: string }) => a.arbeit),
    ).toEqual(dp.kontrolle.naechsteArbeit);
    expect(dp.kontrolle.zustand).not.toBe("validiert");
  });
  it("Rückfrage zu 1.500 führt zur richtigen Datenfassung und ihrem echten Beleg", async () => {
    const r = await w.auswerten(
      w.auftrag({ modus: "frage", frage: { text: "Woher stammen 1.500?", sldId: "256" } }),
    );
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.antwort).toMatchObject({
      stand: "beleg",
      kandidaten: [{ id: w.dp.id, fassung: 1 }],
      sldIds: ["256"],
    });
    const dp = (await w.ruf("GET", `/api/datenpunkte/${r.body.antwort.kandidaten[0].id}`)).body;
    expect(dp.quelle).toMatchObject({
      koId: w.koId,
      anhangId: w.anhangId,
      dateiFassung: w.lage.dateiFassung,
    });
    expect(dp.fundstelle).toMatchObject({
      art: "tabellenzelle",
      sldId: "256",
      shapeId: "4",
      zeile: 2,
      spalte: 3,
    });
    expect(dp).toHaveProperty("kontrolle.dimensionen");
  });
  it("explizit unpassende Einheit oder Periode wird bei der Zahlensuche nicht unterschlagen", async () => {
    for (const text of ["Woher stammen 1.500 %?", "Warum 1.500 EUR?", "Warum 1.500 im Q3 2025?"]) {
      const r = await w.auswerten(w.auftrag({ modus: "frage", frage: { text, sldId: "256" } }));
      expect(r.status).toBe(200);
      expect(r.body.antwort.stand, text).toBe("kein_beleg");
    }
  });
  it("gleiche Zahl in zwei Aussagen verlangt Auswahl; falsche Folie wird abgewiesen", async () => {
    const zweit = await w.erfasse({
      art: "zahl",
      wert: "1.500 T€",
      erfassung: "manuell",
      beleg: "Fiktive manuelle Zweitangabe",
      ort: w.ort,
    });
    const r = await w.auswerten(w.auftrag({ modus: "frage", frage: { text: "Warum 1.500?" } }));
    expect(r.body.antwort.stand).toBe("auswahl_noetig");
    expect(r.body.antwort.kandidaten).toHaveLength(2);
    const genau = await w.auswerten(
      w.auftrag({
        modus: "frage",
        frage: { text: "Warum?", aussage: { id: zweit.id, fassung: 1 }, sldId: "256" },
      }),
    );
    expect(genau.body.antwort.kandidaten).toEqual([{ id: zweit.id, fassung: 1 }]);
    const falsch = await w.auswerten(
      w.auftrag({
        modus: "frage",
        frage: { text: "Warum?", aussage: { id: zweit.id, fassung: 1 }, sldId: "257" },
      }),
    );
    expect(falsch.status).toBe(400);
  });
  it("keinen Beleg erfinden und fehlende Erklärung der gewählten Folie als Aufgabe zeigen", async () => {
    const r = await w.auswerten(
      w.auftrag({ modus: "frage", frage: { text: "Warum fehlen 9876?", sldId: "256" } }),
    );
    expect(r.body.antwort).toMatchObject({ stand: "kein_beleg", kandidaten: [] });
    expect(r.body.aufgaben).toContainEqual(
      expect.objectContaining({
        titel: "Rückfrage erklären",
        arbeit: "Warum fehlen 9876?",
        sldId: "256",
      }),
    );
  });
  it("Detailfolie nur bei Bindung derselben Aussage, nie aus gleicher Elementnummer ableiten", async () => {
    const a = w.auftrag();
    a.notizen[0]!.detailSldIds = ["257"];
    expect((await w.auswerten(a)).status).toBe(400);
    // Gleiche Aussage auf echter zweiter Folie binden: deren 320 T€ ist ein eigener Datenpunkt.
    const dp = await w.erfasse({
      art: "zahl",
      wert: "320 T€",
      erfassung: "direkt",
      ort: { anhangId: w.anhangId, sldId: "257", shapeId: "6" },
    });
    expect(dp.bindungen[0].sldId).toBe("257");
    expect((await w.auswerten(a)).status).toBe(400);
  });
  it("dieselbe echte Aussage führt nach bewusster Bindung zur passenden Detailfolie", async () => {
    await w.app.close();
    w = await vortragsWelt(undefined, true);
    const bind = await w.ruf("POST", `/api/datenpunkte/${w.dp.id}/bindungen`, {
      koId: w.koId,
      ort: { anhangId: w.anhangId, sldId: "257", shapeId: "6" },
    });
    expect(bind.status, JSON.stringify(bind.body)).toBe(200);
    const a = w.auftrag();
    a.notizen[0]!.detailSldIds = ["257"];
    const r = await w.auswerten({
      ...a,
      modus: "frage",
      frage: { text: "Wo belegen wir 1.500?", sldId: "256" },
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.antwort).toMatchObject({
      stand: "beleg",
      kandidaten: [{ id: w.dp.id, fassung: 1 }],
      sldIds: ["256", "257"],
    });
    expect(r.body.notizen[0].detailSldIds).toEqual(["257"]);
    expect(r.body.sprechhilfen[0]).toMatchObject({
      sldId: "256",
      aussagen: [{ id: w.dp.id, fassung: 1 }],
    });
    expect(r.body.sprechhilfen[0].text).toContain("1.500 T€ (Q4 2025)");
    expect(r.body.sprechhilfen[0].text).not.toContain("validiert");
  });
  it("ausdrücklicher Textstart, angenommene Zeit und ungebundene Zahl an der gewählten Folie", async () => {
    const a = w.auftrag({
      modus: "probe",
      probe: {
        ausdruecklichGestartet: true,
        sldId: "256",
        text: "Wir zeigen 1.500 und versprechen 9999.",
      },
    });
    const r = await w.auswerten(a);
    expect(r.status).toBe(200);
    expect(r.body.probe).toMatchObject({ woerter: 6, schaetzungSekunden: { von: 3, bis: 4 } });
    expect(r.body.probe.grundlage).toContain("keine gemessene Redezeit");
    expect(r.body.aufgaben).toContainEqual(
      expect.objectContaining({
        titel: "Zahlenangabe belegen",
        sldId: "256",
        herkunft: expect.objectContaining({ art: "probe", text: "9999" }),
      }),
    );
    expect(
      (await w.auswerten({ ...a, probe: { ...a.probe, ausdruecklichGestartet: false } })).status,
    ).toBe(400);
    expect((await w.auswerten({ ...a, probe: { ...a.probe, sldId: "257" } })).status).toBe(400);
  });
  it("bereitgestellte Nachbereitung mit Locator an Aussage/Folie; kein stilles Speichern", async () => {
    const eintrag = {
      sldId: "256",
      aussage: { id: w.dp.id, fassung: 1 },
      art: "erklaerung" as const,
      text: "Bitte die regionale Ursache erklären.",
      quelle: "Eigene Notiz, 20.10.2026, Zeile 4",
    };
    const r = await w.auswerten(w.auftrag({ modus: "nachbereitung", nachbereitung: [eintrag] }));
    expect(r.body.aufgaben).toContainEqual(
      expect.objectContaining({
        titel: "Erklärung ergänzen",
        arbeit: eintrag.text,
        aussage: eintrag.aussage,
        sldId: "256",
        herkunft: { art: "nachbereitung", text: eintrag.text, quelle: eintrag.quelle },
      }),
    );
    expect((await w.ruf("GET", "/api/me/klara/notizen")).body.notizen).toEqual([]);
    expect((await w.ruf("GET", "/api/me/klara/aufgaben")).body.aufgaben).toEqual([]);
    expect(
      (
        await w.auswerten(
          w.auftrag({ modus: "nachbereitung", nachbereitung: [{ ...eintrag, quelle: "" }] }),
        )
      ).status,
    ).toBe(400);
  });
  it("alte Datei-/Datenfassung darf keinen alten Vortragsstatus weiterverwenden", async () => {
    expect((await w.auswerten(w.auftrag({ basis: "alte-datei" }))).status).toBe(409);
    const a = w.auftrag();
    a.notizen[0]!.aussagen[0]!.fassung = 99;
    expect((await w.auswerten(a)).status).toBe(409);
    const korr = await w.ruf("POST", `/api/datenpunkte/${w.dp.id}/korrektur`, {
      fassung: 1,
      einheit: "EUR",
      grund: "Einheitenfehler, fiktiv",
    });
    expect(korr.status, JSON.stringify(korr.body)).toBe(200);
    expect((await w.auswerten(w.auftrag())).status).toBe(409);
    expect(korr.body.kontrolle.zustand).not.toBe("validiert");
  });
  it("Anmeldung und aktuelle Leserechte gelten auch an Rückfrage und Nachbereitung", async () => {
    expect((await w.ruf("POST", `${w.pfad}/vortrag`, w.auftrag(), false)).status).toBe(401);
    const source = await w.services.ko.create({
      title: "Fiktive beschränkte Quelle",
      statement: "1.500 T€",
      type: "best_practice",
      category: "Test",
      author: "anderes-fiktives-konto",
      confidentiality: "intern",
    });
    const dp = await w.erfasse({
      art: "zahl",
      wert: "1.500 T€",
      erfassung: "direkt",
      quelleKoId: source.id,
      zitat: "1.500 T€",
    });
    const bind = await w.ruf("POST", `/api/datenpunkte/${dp.id}/bindungen`, {
      koId: w.koId,
      ort: w.ort,
    });
    expect(bind.status).toBe(200);
    const a = w.auftrag({
      notizen: [],
      modus: "frage",
      frage: { text: "9876?", aussage: { id: dp.id, fassung: 1 } },
    });
    expect((await w.auswerten(a)).body.antwort.stand).toBe("beleg");
    await w.services.ko.setConfidentiality(
      source.id,
      "streng_vertraulich",
      "anderes-fiktives-konto",
    );
    const r = await w.auswerten(a);
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).not.toContain("beschränkte Quelle");
    const liste = await w.auswerten(w.auftrag({ notizen: [] }));
    expect(JSON.stringify(liste.body)).not.toContain(dp.id);
    await w.services.ko.setQuellrechte(
      w.koId,
      { stufe: "intern", leser: ["anderes-fiktives-konto"], version: 1 },
      "anderes-fiktives-konto",
    );
    expect((await w.auswerten(w.auftrag())).status).toBe(404);
  });
  it("begrenzte Eingaben und doppelte Folien werden vor Auswertung abgewiesen", async () => {
    expect(() => leseVortragsAuftrag({ ...w.auftrag(), zielSekunden: -1 })).toThrow();
    expect(() => leseVortragsAuftrag({ ...w.auftrag(), notizen: Array(101).fill({}) })).toThrow();
    const a = w.auftrag();
    a.notizen.push(a.notizen[0]!);
    expect((await w.auswerten(a)).status).toBe(400);
  });
});
