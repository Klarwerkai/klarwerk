import { afterEach, describe, expect, it, vi } from "vitest";
import { BildKorrekturDienst } from "../../services/app/src/assistenz-bildkorrekturen";
import { InMemoryAssistenzProfilRepo } from "../../services/app/src/assistenz-profil";
import { BILD_KENNUNG, OCR_TEXT, artikelMitDeck, baueWelt, rufe } from "./pp02-hostwelt";

// Echte bestehende Routen, PPTX-Leser, Korrekturdienst und Speicher. Fiktive Bildbytes;
// keine OCR- oder Office-Hostabnahme. Nur die Anmeldung kommt aus der bestehenden Prüfwelt.
const welten: Awaited<ReturnType<typeof baueWelt>>[] = [];
afterEach(async () => {
  for (const w of welten.splice(0)) await w.app.close();
});

async function welt() {
  const dienst = new BildKorrekturDienst({ repo: new InMemoryAssistenzProfilRepo() });
  const w = await baueWelt({ bildKorrekturen: dienst });
  welten.push(w);
  const { koId, anhangId } = await artikelMitDeck(w);
  const auftrag = (text = OCR_TEXT, korrekturAm: string | null = null, rohText = OCR_TEXT) => ({
    art: "zahl",
    wert: "85",
    erfassung: "ocr",
    zeitraum: "2025",
    bezugsgroesse: "Belegschaft",
    ort: { anhangId, sldId: "256", shapeId: "8" },
    ocr: {
      text,
      bildKennung: BILD_KENNUNG,
      unsicher: true,
      wiederverwendung: { rohText, korrekturAm },
    },
  });
  return {
    w,
    dienst,
    koId,
    anhangId,
    auftrag,
    speichern: (a: unknown, user = "anna") =>
      rufe(w, user, "POST", `/api/kos/${koId}/datenpunkte`, a),
  };
}

describe("PP-04 · vorhandene OCR und E02 im Datenpunktweg", () => {
  it("Rohtext, Folie/Element und Quellfassung bleiben beim Abruf erhalten; Erkennung validiert nichts", async () => {
    const x = await welt();
    const neu = await x.speichern(x.auftrag());
    expect(neu.status).toBe(201);
    const gelesen = await rufe(x.w, "anna", "GET", `/api/datenpunkte/${neu.body.id}`);
    expect(gelesen.body.fundstelle).toMatchObject({
      art: "bild",
      sldId: "256",
      shapeId: "8",
      bildKennung: BILD_KENNUNG,
      ocrText: OCR_TEXT,
      uebernahme: { rohText: OCR_TEXT },
    });
    expect(gelesen.body.quelle).toMatchObject({ lesbar: true, anhangId: x.anhangId });
    expect(gelesen.body.quelle.dateiFassung).toMatch(/^[a-f0-9]{64}$/);
    expect(gelesen.body.pruefstand.zustand).not.toBe("validiert");
    expect(gelesen.body.pruefungen).toEqual([]);
    expect(
      gelesen.body.pruefstand.dimensionen.find(
        (d: { dimension: string }) => d.dimension === "erkennung",
      ).stand,
    ).not.toBe("bestanden");
  });

  it("bestätigte Berichtigung mit Rohtext wird eingefroren, auch wenn 85 nur im korrigierten Text steht", async () => {
    const x = await welt();
    const k = await x.dienst.aendere("anna", {
      aktion: "setzen",
      quelle: `office:${x.anhangId}`,
      inhaltskennung: BILD_KENNUNG,
      text: OCR_TEXT,
    });
    const am = k.eintraege[0]?.geaendertAm ?? "";
    const r = await x.speichern(x.auftrag(OCR_TEXT, am, "Mitarbeitende 2025: B5\n"));
    expect(r.status).toBe(201);
    expect(r.body.fundstelle.uebernahme).toEqual({
      rohText: "Mitarbeitende 2025: B5\n",
      korrektur: { quelle: `office:${x.anhangId}`, geaendertAm: am, text: OCR_TEXT },
    });
    expect(r.body.pruefstand.zustand).not.toBe("validiert");
    // Spätere persönliche Berichtigung ändert die erfasste Datenfassung nicht heimlich.
    await x.dienst.aendere("anna", {
      aktion: "setzen",
      quelle: `office:${x.anhangId}`,
      inhaltskennung: BILD_KENNUNG,
      text: "86",
    });
    const wieder = await rufe(x.w, "anna", "GET", `/api/datenpunkte/${r.body.id}`);
    expect(wieder.body.fundstelle.ocrText).toBe(OCR_TEXT);
    expect(wieder.body.fundstelle.uebernahme).toEqual(r.body.fundstelle.uebernahme);
  });

  it("veralteter, fremder oder zurückgesetzter Korrekturstand wird vor dem Speichern abgewiesen", async () => {
    const x = await welt();
    await x.dienst.aendere("anna", {
      aktion: "setzen",
      quelle: `office:${x.anhangId}`,
      inhaltskennung: BILD_KENNUNG,
      text: OCR_TEXT,
    });
    expect((await x.speichern(x.auftrag())).status).toBe(400); // Client kannte die Korrektur noch nicht
    expect((await x.speichern(x.auftrag(OCR_TEXT, "2000-01-01T00:00:00Z"))).status).toBe(400);
    const k = (await x.dienst.lies("anna")).eintraege[0];
    await x.dienst.aendere("anna", {
      aktion: "zuruecksetzen",
      quelle: `office:${x.anhangId}`,
      inhaltskennung: BILD_KENNUNG,
    });
    expect((await x.speichern(x.auftrag(OCR_TEXT, k?.geaendertAm ?? ""))).status).toBe(400);
    const liste = await rufe(x.w, "anna", "GET", `/api/kos/${x.koId}/datenpunkte`);
    expect(liste.body.datenpunkte).toEqual([]);
  });

  it("andere Quellen, andere Bildbytes und andere Konten übertragen keine Berichtigung", async () => {
    const x = await welt();
    for (const [konto, quelle, kennung] of [
      ["vera", `office:${x.anhangId}`, BILD_KENNUNG],
      ["anna", "office:anderer-anhang", BILD_KENNUNG],
      ["anna", `office:${x.anhangId}`, `sha256:${"a".repeat(64)}`],
    ]) {
      await x.dienst.aendere(konto as string, {
        aktion: "setzen",
        quelle,
        inhaltskennung: kennung,
        text: "geheim 99",
      });
    }
    const r = await x.speichern(x.auftrag());
    expect(r.status).toBe(201);
    expect(r.body.fundstelle.uebernahme).toEqual({ rohText: OCR_TEXT });
    expect(JSON.stringify(r.body)).not.toContain("geheim");
    const falsch = x.auftrag();
    falsch.ocr.bildKennung = `sha256:${"a".repeat(64)}`;
    expect((await x.speichern(falsch)).status).toBe(400);
  });

  it("Recht und Sichtbarkeit gelten vor dem Korrekturabruf", async () => {
    const x = await welt();
    const lesen = vi.spyOn(x.dienst, "lies");
    expect((await x.speichern(x.auftrag(), "vera")).status).toBe(403);
    expect(
      (await rufe(x.w, "anna", "POST", "/api/kos/nicht-lesbar/datenpunkte", x.auftrag())).status,
    ).toBe(404);
    expect(lesen).not.toHaveBeenCalled();
  });

  it("leerer Rohtext mit expliziter Berichtigung und OCR-Aussagen sind zulässig; ungültiger Rohtext wird abgewiesen", async () => {
    const x = await welt();
    const k = await x.dienst.aendere("anna", {
      aktion: "setzen",
      quelle: `office:${x.anhangId}`,
      inhaltskennung: BILD_KENNUNG,
      text: "Bildbeleg nur hier",
    });
    const a = {
      ...x.auftrag("Bildbeleg nur hier", k.eintraege[0]?.geaendertAm ?? "", ""),
      art: "aussage",
      wert: "Bildbeleg nur hier",
    };
    const r = await x.speichern(a);
    expect(r.status).toBe(201);
    expect(r.body.art).toBe("aussage");
    const roh = x.auftrag();
    const ungueltig = {
      ...roh,
      ocr: { ...roh.ocr, wiederverwendung: { rohText: 42, korrekturAm: null } },
    };
    expect((await x.speichern(ungueltig)).status).toBe(400);
  });
});
