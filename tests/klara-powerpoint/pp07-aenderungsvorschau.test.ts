import JSZip from "jszip";
import { afterEach, describe, expect, it } from "vitest";
import {
  type Aenderungsauftrag,
  leseAenderungen,
} from "../../services/app/src/praesentation-aenderungen";
import type { DatenpunktSicht } from "../../services/app/src/praesentation-daten";
import {
  PPTX,
  type Welt,
  artikelMitDeck,
  baueWelt,
  bestandAnlegen,
  deck,
  rufe,
} from "./pp02-hostwelt";

const welten: Welt[] = [];
afterEach(async () => {
  await Promise.all(welten.splice(0).map((w) => w.app.close()));
});

async function welt() {
  const w = await baueWelt();
  welten.push(w);
  const b = await bestandAnlegen(w);
  const lage = () => rufe(w, "anna", "GET", `/api/kos/${b.koId}/office/${b.anhangId}/folien-daten`);
  const vorschau = async (
    aenderungen: readonly Aenderungsauftrag[],
    nutzer = "anna",
    basis?: Record<string, unknown>,
  ) => {
    const l = (await lage()).body;
    return rufe(w, nutzer, "POST", `/api/kos/${b.koId}/office/${b.anhangId}/aenderungsvorschau`, {
      dateiFassung: l.dateiFassung,
      artikelFassung: l.artikelFassung,
      aenderungen,
      ...basis,
    });
  };
  const neuDatei = async (bytes: Buffer) => {
    const ref = await w.objekte.put({
      name: "Neu.pptx",
      mime: PPTX,
      data: `data:${PPTX};base64,${bytes.toString("base64")}`,
      purpose: "attachment",
    });
    await w.ko.updateAttachment(b.koId, b.anhangId, "anna", { objectId: ref.id, size: ref.size });
  };
  return { w, b, lage, vorschau, neuDatei };
}

const aenderung = (
  datenpunktId: string,
  wert: string,
  quelleAktualisieren = false,
): Aenderungsauftrag => ({
  datenpunktId,
  fassung: 1,
  korrektur: { wert, quelleAktualisieren, grund: "Neue Testquellfassung, fiktiv." },
});

describe("PP-07 · echte PP-02/03-Routen, schreibfreie Änderungsvorschau", () => {
  it("neue Quellzahl, alle lesbaren Vorkommen, Nachfolger, Quellenfassung; kein Speichern", async () => {
    const { w, b, lage, vorschau, neuDatei } = await welt();
    const mitWiederholung = async (bytes: Buffer) => {
      const zip = await JSZip.loadAsync(bytes);
      const text = await zip.file("ppt/slides/slide2.xml")?.async("string");
      if (!text) {
        throw new Error("Testfolie fehlt");
      }
      zip.file(
        "ppt/slides/slide2.xml",
        text.replace("Ergebnis 2026: 320 T€", "Ergebnis Q4: 300 T€"),
      );
      return zip.generateAsync({ type: "nodebuffer" });
    };
    // Dasselbe berechnete Ergebnis steht auf zwei Folien; beide Bindungen müssen erscheinen.
    await neuDatei(await mitWiederholung(await deck()));
    expect(
      (
        await rufe(w, "anna", "POST", `/api/datenpunkte/${b.ids.ergebnis}/bindungen`, {
          koId: b.koId,
          ort: { anhangId: b.anhangId, sldId: "257", shapeId: "6" },
        })
      ).status,
    ).toBe(200);
    await neuDatei(await mitWiederholung(await deck({ kostenQ4: "1.300 T€" })));
    const vorher = (await lage()).body;
    const r = await vorschau([aenderung(b.ids.kosten, "1.300 T€", true)]);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({
      art: "vorschau",
      gespeichert: false,
      uebernahme: { verfuegbar: false },
    });
    expect(r.body.konflikte).toEqual([]);
    const a = r.body.aenderungen as { vorher: DatenpunktSicht; nachher: DatenpunktSicht }[];
    expect(a.map((x) => x.nachher.id)).toEqual([b.ids.kosten, b.ids.ergebnis]);
    expect(a[0]?.nachher).toMatchObject({
      wert: "1.300 T€",
      fassung: 2,
      quelle: { koFassung: vorher.artikelFassung, dateiFassung: vorher.dateiFassung },
    });
    expect(a[1]?.nachher).toMatchObject({
      wert: "200 T€",
      fassung: 2,
      rechenweg: { ergebnis: 200 },
    });
    expect(
      r.body.wirkungen.filter((x: { datenpunktId: string }) => x.datenpunktId === b.ids.ergebnis),
    ).toHaveLength(2);
    expect(
      r.body.wirkungen.find((x: { datenpunktId: string }) => x.datenpunktId === b.ids.kosten).lage,
    ).toBe("bereits_aktuell");
    const nachher = (await lage()).body;
    expect(nachher.dateiFassung).toBe(vorher.dateiFassung);
    for (const id of Object.values(b.ids)) {
      const alt = vorher.datenpunkte.find((d: { id: string }) => d.id === id);
      const neu = nachher.datenpunkte.find((d: { id: string }) => d.id === id);
      expect({ ...neu, kontrolle: undefined }).toEqual({ ...alt, kontrolle: undefined });
    }
  });

  it("manuelle Abweichung, fehlendes Element und unabhängige Inhalte erhalten", async () => {
    const { w, b, vorschau, neuDatei } = await welt();
    await neuDatei(await deck({ kostenQ4: "1.399 T€", ohneMarktanteil: true }));
    const r = await vorschau([
      aenderung(b.ids.kosten, "1.300 T€"),
      aenderung(b.ids.marktanteil, "13 %"),
    ]);
    expect(r.status).toBe(200);
    expect(
      r.body.wirkungen.find((x: { datenpunktId: string }) => x.datenpunktId === b.ids.kosten),
    ).toMatchObject({
      lage: "konflikt",
      grund: expect.stringContaining("Manuelle Änderung erhalten"),
    });
    expect(
      r.body.wirkungen.find((x: { datenpunktId: string }) => x.datenpunktId === b.ids.marktanteil),
    ).toMatchObject({ lage: "konflikt", grund: expect.stringContaining("fehlt") });
    expect(
      r.body.aenderungen.some(
        (x: { nachher: { id: string } }) => x.nachher.id === b.ids.belegschaft,
      ),
    ).toBe(false);
    expect((await rufe(w, "anna", "GET", `/api/datenpunkte/${b.ids.marktanteil}`)).body.wert).toBe(
      "12 %",
    );
  });

  it("frühere Freigabe bleibt historisch, gilt niemals für geänderte Datenfassung", async () => {
    const { w, b, vorschau } = await welt();
    await rufe(w, "anna", "POST", `/api/datenpunkte/${b.ids.marktanteil}/pruefungen`, {
      fassung: 1,
      dimension: "struktur",
      ergebnis: "bestanden",
      grund: "Fiktive Prüfung der alten Fassung.",
    });
    const r = await vorschau([aenderung(b.ids.marktanteil, "13 %")]);
    expect(r.status).toBe(200);
    const neu = r.body.aenderungen[0].nachher;
    expect(neu.pruefungen).toEqual(
      expect.arrayContaining([expect.objectContaining({ dimension: "struktur", datenFassung: 1 })]),
    );
    expect(neu.kontrolle.zustand).not.toBe("validiert");
    expect(
      neu.pruefstand.dimensionen.find((d: { dimension: string }) => d.dimension === "struktur")
        .stand,
    ).toBe("ueberholt");
  });

  it("mehrstufig und unabhängig von Anfragereihenfolge; auch gleiches Ergebnis braucht neue Fassung", async () => {
    const { w, b, vorschau } = await welt();
    const c = await rufe(w, "anna", "POST", `/api/kos/${b.koId}/datenpunkte`, {
      art: "zahl",
      wert: "600 T€",
      einheit: "T€",
      zeitraum: "Q4 2025",
      erfassung: "berechnet",
      rechenweg: { art: "summe", eingaben: [b.ids.ergebnis, b.ids.ergebnis], stellen: 0 },
    });
    expect(c.status).toBe(201);
    // Beide Eingaben um 100 erhöhen: Ergebnis bleibt 300, seine Eingabefassungen wechseln.
    const r = await vorschau([
      aenderung(b.ids.kosten, "1.300 T€"),
      aenderung(b.ids.umsatz, "1.600 T€"),
    ]);
    expect(r.status).toBe(200);
    expect(
      r.body.aenderungen.find((x: { nachher: { id: string } }) => x.nachher.id === b.ids.ergebnis)
        .nachher,
    ).toMatchObject({ wert: "300 T€", fassung: 2 });
    expect(
      r.body.aenderungen.find((x: { nachher: { id: string } }) => x.nachher.id === c.body.id)
        .nachher,
    ).toMatchObject({ wert: "600 T€", fassung: 2 });
  });

  it("nicht bestätigbare Quelle und deren Nachfolger erhalten konkrete Konflikte, keine Teilkorrektur", async () => {
    const { b, vorschau } = await welt();
    const r = await vorschau([aenderung(b.ids.kosten, "1.300 T€", true)]);
    expect(r.status).toBe(200);
    expect(r.body.aenderungen).toEqual([]);
    expect(r.body.konflikte).toEqual([
      expect.objectContaining({
        datenpunktId: b.ids.kosten,
        grund: expect.stringContaining("aktuellen Fassung"),
      }),
      expect.objectContaining({
        datenpunktId: b.ids.ergebnis,
        grund: expect.stringContaining("Eingabe"),
      }),
    ]);
  });

  it("veraltete Daten-, Artikel- und Dateifassung werden als 409 abgewiesen", async () => {
    const { b, vorschau } = await welt();
    const a = aenderung(b.ids.kosten, "1.300 T€");
    expect((await vorschau([{ ...a, fassung: 2 }])).status).toBe(409);
    expect((await vorschau([a], "anna", { artikelFassung: -1 })).status).toBe(409);
    expect((await vorschau([a], "anna", { dateiFassung: "andere-Datei" })).status).toBe(409);
  });

  it("reiner Quellfassungswechsel entwertet Folgefassungen und ändert den Vorschauabdruck", async () => {
    const { w, b, vorschau } = await welt();
    await w.ko.revise(b.koId, { title: "Quelle, Fassung zwei (fiktiv)" }, "anna");
    const a = aenderung(b.ids.kosten, "1.200 T€", true);
    const erste = await vorschau([a]);
    expect(erste.status).toBe(200);
    expect(
      erste.body.aenderungen.map((x: { nachher: { fassung: number; wert: string } }) => [
        x.nachher.wert,
        x.nachher.fassung,
      ]),
    ).toEqual([
      ["1.200 T€", 2],
      ["300 T€", 2],
    ]);
    await w.ko.revise(b.koId, { title: "Quelle, Fassung drei (fiktiv)" }, "anna");
    const zweite = await vorschau([a]);
    expect(zweite.status).toBe(200);
    expect(zweite.body.abdruck).not.toBe(erste.body.abdruck);
    expect(zweite.body.aenderungen[0].nachher.quelle.koFassung).toBeGreaterThan(
      erste.body.aenderungen[0].nachher.quelle.koFassung,
    );
    // Ein unveränderter manueller Wert hat keine neue Fassung und keinen entwerteten Prüfstand.
    const gleich = await vorschau([aenderung(b.ids.marktanteil, "12 %")]);
    expect(gleich.status).toBe(200);
    expect(gleich.body.aenderungen).toEqual([]);
  });

  it("versteckte Quelle und Zielpräsentation verraten weder Werte noch Kennungen", async () => {
    const { w, b, vorschau } = await welt();
    const geheim = await artikelMitDeck(w);
    const s = await rufe(w, "anna", "POST", `/api/kos/${geheim.koId}/datenpunkte`, {
      art: "zahl",
      wert: "500",
      erfassung: "manuell",
      einheit: "Stück",
      zeitraum: "2025",
      beleg: "Vertraulicher Beleg",
    });
    expect(s.status).toBe(201);
    const abhaengig = await rufe(w, "anna", "POST", `/api/kos/${b.koId}/datenpunkte`, {
      art: "zahl",
      wert: "1.000",
      erfassung: "berechnet",
      einheit: "Stück",
      zeitraum: "2025",
      rechenweg: { art: "summe", eingaben: [s.body.id, s.body.id], stellen: 0 },
    });
    expect(abhaengig.status).toBe(201);
    await rufe(w, "anna", "POST", `/api/datenpunkte/${b.ids.ergebnis}/bindungen`, {
      koId: geheim.koId,
      ort: { anhangId: geheim.anhangId, sldId: "256", shapeId: "6" },
    });
    await w.ko.setConfidentiality(geheim.koId, "streng_vertraulich", "anna");
    const r = await vorschau([aenderung(b.ids.kosten, "1.300 T€")], "vera");
    expect(r.status).toBe(200);
    for (const id of [geheim.koId, geheim.anhangId, s.body.id, abhaengig.body.id]) {
      expect(JSON.stringify(r.body)).not.toContain(id);
    }
    expect((await vorschau([aenderung(s.body.id, "600")], "vera")).status).toBe(404);
    expect((await vorschau([aenderung(b.ids.kosten, "1.300 T€")], "unbekannt")).status).toBe(401);
  });

  it("Größe, doppelte Anweisungen und konkurrierende Aktualisierungsarten abweisen", () => {
    const a = aenderung("a", "1");
    expect(() => leseAenderungen([])).toThrow();
    expect(() =>
      leseAenderungen(Array.from({ length: 21 }, (_, i) => ({ ...a, datenpunktId: String(i) }))),
    ).toThrow();
    expect(() => leseAenderungen([a, a])).toThrow();
    expect(() =>
      leseAenderungen([
        { ...a, korrektur: { grund: "Test", neuBerechnen: true, quelleAktualisieren: true } },
      ]),
    ).toThrow();
  });
});
