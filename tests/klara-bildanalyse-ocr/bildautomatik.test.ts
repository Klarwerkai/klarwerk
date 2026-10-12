// ================================================================================================
// OCR-02 · DIE AUTOMATIK AN DER ECHTEN IMPORTKETTE — Auslösung, Fundstelle, Wiederverwendung, Status
// ================================================================================================
//
// Auftrag produkt:20261012:klara-bildanalyse-ocr-automatik, Kriterien K1–K5.
//
// Die PowerPoint-Fälle laufen durch DIESELBE Kette wie `readPptxRich`: echte ZIP-Bytes (fflate) →
// `budgetedPptxUnzip` → `extractPptxRich` mit Bildeinbettung → `pptxBildEingang` → Analyse. Ersetzt
// ist allein die Texterkennung: sie liest aus den Bildbytes eine Marke und gibt den dazu gehörenden
// Text zurück. So ist nachprüfbar, dass JEDES Bild SEINEN Text bekommt — die Genauigkeit der echten
// Engine misst `tests-smoke/klara-bildautomatik-browser.spec.ts` im Browser.
import { describe, expect, it, vi } from "vitest";
import {
  BILD_AUTOMATIK_VOREINSTELLUNG,
  type BildBeschreiber,
  type BildQuelleEingang,
  type QuellenBefund,
  bildBeschreiberAus,
  bildVorkommenAusRumpf,
  createBildAnalyse,
  docxBildEingang,
  einzelbildEingang,
  gleicheBilder,
  kennzeichneUnsicheres,
  pptxBildEingang,
  rumpfBildEingang,
  tabelleAusWoertern,
} from "../../apps/web/src/lib/bildAutomatik";
import type { OcrResult, OcrWort } from "../../apps/web/src/lib/ocr";
import {
  FOLIENTEXT,
  TEXT_JE_MARKE,
  bildMit,
  dataUrl,
  deck,
  lesePptx,
  markeAus,
  markenEngine,
} from "./deck";

async function pptxEingang(bytes: Uint8Array = deck()): Promise<BildQuelleEingang> {
  const pptx = await lesePptx(bytes);
  return pptxBildEingang("wartung.pptx", pptx.html, pptx);
}

/** Ohne Weg zur Bildbeschreibung: der Bildinhalt heißt „nicht angebunden". */
const ohneFortschritt = { automatik: true } as const;

/** Ein Beschreibungsweg (W02), der zu jeder Marke einen Bildinhalt liefert. */
function beschreiberMitInhalt() {
  return vi.fn<BildBeschreiber>(async (src) => ({
    status: "beschrieben",
    text: `Foto eines Aushangs (${markeAus(src) ?? "?"})`,
  }));
}

// ================================================================================================
// K1 · Ein neu bereitgestelltes Bild wird bei aktiver Automatik ohne separaten Auftrag verarbeitet.
// ================================================================================================
describe("K1 · Einzelbild: Automatik an liest, Automatik aus liest nicht", () => {
  it("an: der Eingang allein löst Erkennung UND Bildinhalt aus — einmal, mit Fundstelle", async () => {
    const erkenne = markenEngine();
    const beschreibe = beschreiberMitInhalt();
    const analyse = createBildAnalyse({ erkenne });
    const befund = await analyse.analysiereQuelle(
      einzelbildEingang("aushang.png", dataUrl(bildMit("E"))),
      { automatik: true, beschreibe },
    );
    expect(erkenne).toHaveBeenCalledTimes(1);
    expect(beschreibe).toHaveBeenCalledTimes(1);
    expect(befund.status).toBe("vollstaendig");
    expect(befund.befunde).toHaveLength(1);
    expect(befund.befunde[0]).toMatchObject({
      status: "gelesen",
      text: "AUSHANG 61",
      bildinhalt: { status: "beschrieben", text: "Foto eines Aushangs (E)" },
      fundstelle: { quelle: "aushang.png", art: "bild", bild: 1 },
      wiederverwendet: false,
    });
    expect(befund.befunde[0]?.inhaltskennung).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("an, aber ohne Weg zur Bildbeschreibung: Text gelesen, Quelle nur „teilweise“", async () => {
    const befund = await createBildAnalyse({ erkenne: markenEngine() }).analysiereQuelle(
      einzelbildEingang("aushang.png", dataUrl(bildMit("E"))),
      ohneFortschritt,
    );
    expect(befund.befunde[0]).toMatchObject({
      status: "gelesen",
      bildinhalt: { status: "nicht-angebunden" },
    });
    expect(befund.status).toBe("teilweise");
  });

  it("aus: nichts wird erkannt, und es steht nicht als gelesen da", async () => {
    const erkenne = markenEngine();
    const analyse = createBildAnalyse({ erkenne });
    const fortschritt: QuellenBefund[] = [];
    const befund = await analyse.analysiereQuelle(
      einzelbildEingang("aushang.png", dataUrl(bildMit("E"))),
      { automatik: false, onFortschritt: (s) => fortschritt.push(s) },
    );
    expect(erkenne).not.toHaveBeenCalled();
    expect(befund.status).toBe("aus");
    expect(befund.befunde[0]).toMatchObject({ status: "nicht-analysiert", grund: "automatik-aus" });
    expect(fortschritt.map((s) => s.status)).toEqual(["aus"]);
  });

  it("ohne abweichende Einstellung ist die Automatik an", () => {
    expect(BILD_AUTOMATIK_VOREINSTELLUNG).toBe(true);
  });
});

// ================================================================================================
// K2 · PowerPoint: Text eingebetteter Bilder, der nicht als editierbarer Folientext vorliegt
// ================================================================================================
describe("K2 · PowerPoint-Datei: der Text in den eingebetteten Bildern wird erkannt", () => {
  it("der Bildtext steht nicht im Folientext, aber im Befund", async () => {
    const pptx = await lesePptx(deck());
    for (const zeile of FOLIENTEXT) {
      expect(pptx.text).toContain(zeile);
    }
    for (const bildtext of [TEXT_JE_MARKE.A, TEXT_JE_MARKE.B, TEXT_JE_MARKE.C]) {
      expect(pptx.text).not.toContain(bildtext);
    }
    const analyse = createBildAnalyse({ erkenne: markenEngine() });
    const befund = await analyse.analysiereQuelle(
      pptxBildEingang("wartung.pptx", pptx.html, pptx),
      ohneFortschritt,
    );
    expect(befund.befunde.map((b) => [b.status, b.text])).toEqual([
      ["gelesen", TEXT_JE_MARKE.A],
      ["gelesen", TEXT_JE_MARKE.B],
      ["gelesen", TEXT_JE_MARKE.C],
    ]);
  });

  it("der PPTX-Leser liefert die Folie je eingebettetem Bild und die Verluste je Folie", async () => {
    const pptx = await lesePptx(deck());
    expect(pptx.imageSlides).toEqual([
      { imageId: "kw-img-ocr02-1", slide: 1 },
      { imageId: "kw-img-ocr02-2", slide: 2 },
      { imageId: "kw-img-ocr02-3", slide: 2 },
    ]);
    expect(pptx.imagesNotEmbeddedBySlide).toEqual([{ slide: 2, count: 1 }]);
    expect(pptx.imageCount).toBe(4);
  });
});

// ================================================================================================
// K3 · Dokumente mit mehreren Bildern: korrekte Zuordnung und Reihenfolge
// ================================================================================================
describe("K3 · Zuordnung und Reihenfolge", () => {
  it("PowerPoint: Dokumentreihenfolge, Folie und Bild auf der Folie, Anker", async () => {
    const analyse = createBildAnalyse({ erkenne: markenEngine() });
    const befund = await analyse.analysiereQuelle(await pptxEingang(), ohneFortschritt);
    expect(
      befund.befunde.map((b) => ({
        bild: b.fundstelle.bild,
        folie: b.fundstelle.folie,
        aufFolie: b.fundstelle.bildAufFolie,
        anker: b.fundstelle.imageId,
        text: b.text,
      })),
    ).toEqual([
      { bild: 1, folie: 1, aufFolie: 1, anker: "kw-img-ocr02-1", text: TEXT_JE_MARKE.A },
      { bild: 2, folie: 2, aufFolie: 1, anker: "kw-img-ocr02-2", text: TEXT_JE_MARKE.B },
      { bild: 3, folie: 2, aufFolie: 2, anker: "kw-img-ocr02-3", text: TEXT_JE_MARKE.C },
    ]);
  });

  it("die Reihenfolge der Befunde folgt dem Dokument, nicht der Laufzeit der Erkennung", async () => {
    // Das erste Bild braucht am längsten — trotzdem steht es zuerst.
    const erkenne = vi.fn(async (src: string): Promise<OcrResult> => {
      const marke = markeAus(src) ?? "";
      await new Promise((r) => setTimeout(r, marke === "A" ? 30 : 1));
      return { status: "success", text: TEXT_JE_MARKE[marke] ?? "" };
    });
    const befund = await createBildAnalyse({ erkenne }).analysiereQuelle(
      await pptxEingang(),
      ohneFortschritt,
    );
    expect(befund.befunde.map((b) => b.text)).toEqual([
      TEXT_JE_MARKE.A,
      TEXT_JE_MARKE.B,
      TEXT_JE_MARKE.C,
    ]);
  });

  it("Word: mehrere Bilder in Dokumentreihenfolge mit Anker, verlorene Bilder gezählt", async () => {
    const html = [
      "<p>Einleitung</p>",
      `<figure><img data-image-id="kw-fig-1" src="${dataUrl(bildMit("C"))}"><figcaption data-image-id="kw-fig-1"></figcaption></figure>`,
      "<p>Zwischentext</p>",
      `<figure><img data-image-id="kw-fig-2" src="${dataUrl(bildMit("A"))}"><figcaption data-image-id="kw-fig-2"></figcaption></figure>`,
    ].join("");
    const befund = await createBildAnalyse({ erkenne: markenEngine() }).analysiereQuelle(
      docxBildEingang("handbuch.docx", html, 1),
      ohneFortschritt,
    );
    expect(befund.befunde.map((b) => [b.fundstelle.bild, b.fundstelle.imageId, b.text])).toEqual([
      [1, "kw-fig-1", TEXT_JE_MARKE.C],
      [2, "kw-fig-2", TEXT_JE_MARKE.A],
    ]);
    expect(befund.nichtGelesen).toEqual([{ anzahl: 1 }]);
    expect(befund.status).toBe("teilweise");
  });

  it("Folienansicht-Bilder (W04) tragen ihre eigene Foliennummer", () => {
    const html = `<h2>Folienansicht</h2><figure><img data-image-id="kw-img-abc-s3" src="${dataUrl(bildMit("A"))}"></figure>`;
    const [v] = bildVorkommenAusRumpf(html, { name: "x.pptx", art: "pptx" });
    expect(v?.fundstelle).toMatchObject({ folie: 3, folienansicht: true, bildAufFolie: 1 });
  });
});

// ================================================================================================
// K4 · Geändertes Bild → neuer aktueller Befund; unveränderte Bilder → keine erneute Analyse
// ================================================================================================
describe("K4 · Wiederverwendung und Neuauswertung", () => {
  it("dieselbe Datei noch einmal: keine neue Analyse, gleiche Befunde, als wiederverwendet markiert", async () => {
    const erkenne = markenEngine();
    const analyse = createBildAnalyse({ erkenne });
    const erst = await analyse.analysiereQuelle(await pptxEingang(), ohneFortschritt);
    expect(analyse.anzahlAnalysen()).toBe(3);
    const zweit = await analyse.analysiereQuelle(await pptxEingang(), ohneFortschritt);
    expect(analyse.anzahlAnalysen()).toBe(3);
    expect(erkenne).toHaveBeenCalledTimes(3);
    expect(zweit.befunde.map((b) => b.text)).toEqual(erst.befunde.map((b) => b.text));
    expect(zweit.befunde.every((b) => b.wiederverwendet)).toBe(true);
  });

  it("ein geändertes Bild: genau EINE neue Analyse, neuer Text, der alte gilt nicht mehr", async () => {
    const erkenne = markenEngine();
    const analyse = createBildAnalyse({ erkenne });
    const erst = await analyse.analysiereQuelle(await pptxEingang(), ohneFortschritt);
    const geaendert = await analyse.analysiereQuelle(
      await pptxEingang(deck(bildMit("B2"))),
      ohneFortschritt,
    );
    expect(analyse.anzahlAnalysen()).toBe(4);
    const [a, b, c] = geaendert.befunde;
    expect(a).toMatchObject({ text: TEXT_JE_MARKE.A, wiederverwendet: true });
    expect(c).toMatchObject({ text: TEXT_JE_MARKE.C, wiederverwendet: true });
    expect(b).toMatchObject({ text: TEXT_JE_MARKE.B2, wiederverwendet: false });
    expect(b?.text).not.toBe(TEXT_JE_MARKE.B);
    expect(b?.inhaltskennung).not.toBe(erst.befunde[1]?.inhaltskennung);
  });

  it("gleiche Bytes in anderer Quelle: kein zweiter Lauf, aber die eigene Fundstelle", async () => {
    const analyse = createBildAnalyse({ erkenne: markenEngine() });
    await analyse.analysiereQuelle(await pptxEingang(), ohneFortschritt);
    const einzeln = await analyse.analysiereQuelle(
      einzelbildEingang("a-einzeln.png", dataUrl(bildMit("A"))),
      ohneFortschritt,
    );
    expect(analyse.anzahlAnalysen()).toBe(3);
    expect(einzeln.befunde[0]).toMatchObject({
      text: TEXT_JE_MARKE.A,
      wiederverwendet: true,
      fundstelle: { quelle: "a-einzeln.png", art: "bild", bild: 1 },
    });
  });

  it("ein laufender Lauf wird geteilt, nicht verdoppelt", async () => {
    const erkenne = markenEngine();
    const analyse = createBildAnalyse({ erkenne });
    const v = einzelbildEingang("x.png", dataUrl(bildMit("E"))).vorkommen[0];
    if (!v) {
      throw new Error("kein Vorkommen");
    }
    const [eins, zwei] = await Promise.all([analyse.befundFuerBild(v), analyse.befundFuerBild(v)]);
    expect(erkenne).toHaveBeenCalledTimes(1);
    expect(eins.text).toBe(zwei.text);
  });

  it("ein Fehlschlag wird nicht gemerkt — der nächste Eingang versucht es erneut", async () => {
    const erkenne = vi
      .fn<(src: string) => Promise<OcrResult>>()
      .mockResolvedValueOnce({ status: "failed", text: "", error: "worker-crash" })
      .mockResolvedValueOnce({ status: "success", text: "jetzt gelesen" });
    const analyse = createBildAnalyse({ erkenne });
    const eingang = einzelbildEingang("x.png", dataUrl(bildMit("E")));
    const erst = await analyse.analysiereQuelle(eingang, ohneFortschritt);
    expect(erst.status).toBe("fehlgeschlagen");
    const danach = await analyse.analysiereQuelle(eingang, ohneFortschritt);
    expect(erkenne).toHaveBeenCalledTimes(2);
    expect(danach.befunde[0]).toMatchObject({ status: "gelesen", wiederverwendet: false });
  });
});

// ================================================================================================
// K5 · Unleserliche Stellen, fehlende Bildzugriffe, Fehler und Teilverarbeitung sind erkennbar
// ================================================================================================
describe("K5 · erkennbare Grenzen", () => {
  it("unsichere Wörter werden markiert, unleserliche ersetzt — nichts ergänzt", () => {
    const { textGekennzeichnet, unsicher } = kennzeichneUnsicheres("Druck 4,5 bar\nxq7 ok", [
      { text: "Druck", confidence: 96 },
      { text: "4,5", confidence: 41 },
      { text: "bar", confidence: 90 },
      { text: "xq7", confidence: 9 },
      { text: "ok", confidence: 88 },
    ]);
    expect(textGekennzeichnet).toBe("Druck [?4,5] bar\n[unleserlich] ok");
    expect(unsicher).toEqual([
      { wort: "4,5", sicherheit: 41, unleserlich: false },
      { wort: "xq7", sicherheit: 9, unleserlich: true },
    ]);
  });

  it("die Wortsicherheit der Engine kommt im Befund an", async () => {
    const erkenne = vi.fn(
      async (): Promise<OcrResult> => ({
        status: "success",
        text: "Ventil V3",
        woerter: [
          { text: "Ventil", confidence: 92 },
          { text: "V3", confidence: 20 },
        ],
      }),
    );
    const befund = await createBildAnalyse({ erkenne }).analysiereQuelle(
      einzelbildEingang("x.png", dataUrl(bildMit("E"))),
      ohneFortschritt,
    );
    expect(befund.befunde[0]).toMatchObject({
      text: "Ventil V3",
      textGekennzeichnet: "Ventil [unleserlich]",
      unsicher: [{ wort: "V3", sicherheit: 20, unleserlich: true }],
    });
  });

  it("fehlender Bildzugriff: kein Bytezugriff → „kein-zugriff“, keine Erkennung", async () => {
    const erkenne = markenEngine();
    const html = `<figure><img data-image-id="kw-fig-1" src="https://example.invalid/bild.png"></figure><figure><img data-image-id="kw-fig-2" src="${dataUrl(bildMit("A"))}"></figure>`;
    const befund = await createBildAnalyse({ erkenne }).analysiereQuelle(
      docxBildEingang("extern.docx", html, 0),
      ohneFortschritt,
    );
    expect(erkenne).toHaveBeenCalledTimes(1);
    expect(befund.befunde.map((b) => b.status)).toEqual(["kein-zugriff", "gelesen"]);
    expect(befund.status).toBe("teilweise");
  });

  it("Fehler, Zeitüberschreitung und nicht verfügbare Engine sind eigene Zustände", async () => {
    const nieFertig = createBildAnalyse({
      erkenne: () => new Promise<OcrResult>(() => {}),
      zeitlimitMs: 20,
    });
    const zeit = await nieFertig.analysiereQuelle(
      einzelbildEingang("x.png", dataUrl(bildMit("E"))),
      ohneFortschritt,
    );
    expect(zeit.befunde[0]?.status).toBe("zeitueberschreitung");
    expect(zeit.status).toBe("fehlgeschlagen");

    const weg = createBildAnalyse({ erkenne: async () => ({ status: "unavailable", text: "" }) });
    const nv = await weg.analysiereQuelle(
      einzelbildEingang("x.png", dataUrl(bildMit("E"))),
      ohneFortschritt,
    );
    expect(nv.status).toBe("nicht-verfuegbar");

    const wirft = createBildAnalyse({
      erkenne: async () => {
        throw new Error("kaputt");
      },
    });
    const f = await wirft.analysiereQuelle(
      einzelbildEingang("x.png", dataUrl(bildMit("E"))),
      ohneFortschritt,
    );
    expect(f.befunde[0]).toMatchObject({ status: "fehlgeschlagen", fehler: "kaputt" });
  });

  it("Teilverarbeitung: PowerPoint mit verworfenem Bild ist „teilweise“, mit Folie des Verlusts", async () => {
    const befund = await createBildAnalyse({ erkenne: markenEngine() }).analysiereQuelle(
      await pptxEingang(),
      ohneFortschritt,
    );
    expect(befund.befunde.every((b) => b.status === "gelesen")).toBe(true);
    expect(befund.nichtGelesen).toEqual([{ folie: 2, anzahl: 1 }]);
    expect(befund.hinweise).toContain("pptx-layout-nicht-erfasst");
    expect(befund.status).toBe("teilweise");
  });

  it("eine PowerPoint-Quelle heißt nie „vollständig“ — auch ohne Verlust (Layout/Master, L16)", async () => {
    const html = `<h2>Folie 1</h2><figure><img data-image-id="kw-img-t-1" src="${dataUrl(bildMit("A"))}"></figure>`;
    const eingang = pptxBildEingang("x.pptx", html, {
      imageCount: 1,
      imageSlides: [{ imageId: "kw-img-t-1", slide: 1 }],
      imagesNotEmbeddedBySlide: [],
    });
    const befund = await createBildAnalyse({ erkenne: markenEngine() }).analysiereQuelle(
      eingang,
      ohneFortschritt,
    );
    expect(befund.nichtGelesen).toEqual([]);
    expect(befund.status).toBe("teilweise");
  });

  it("große Quellen: über der Höchstzahl bleibt der Rest sichtbar „nicht analysiert“", async () => {
    const erkenne = markenEngine();
    const befund = await createBildAnalyse({ erkenne, hoechstzahl: 2 }).analysiereQuelle(
      await pptxEingang(),
      ohneFortschritt,
    );
    expect(erkenne).toHaveBeenCalledTimes(2);
    expect(befund.befunde.map((b) => b.status)).toEqual(["gelesen", "gelesen", "nicht-analysiert"]);
    expect(befund.befunde[2]?.grund).toBe("grenze");
    expect(befund.hinweise).toContain("grenze-erreicht");
    expect(befund.status).toBe("teilweise");
  });

  it("solange gelesen wird, steht „läuft“ — kein Zwischenstand gibt sich als fertig aus", async () => {
    const fortschritt: QuellenBefund[] = [];
    const ende = await createBildAnalyse({ erkenne: markenEngine() }).analysiereQuelle(
      einzelbildEingang("x.png", dataUrl(bildMit("E"))),
      {
        automatik: true,
        beschreibe: beschreiberMitInhalt(),
        onFortschritt: (s) => fortschritt.push(s),
      },
    );
    expect(fortschritt.length).toBeGreaterThanOrEqual(2);
    expect(fortschritt[0]?.status).toBe("laeuft");
    expect(fortschritt[0]?.befunde[0]?.status).toBe("laeuft");
    expect(fortschritt.slice(0, -1).every((s) => s.status === "laeuft")).toBe(true);
    expect(ende.status).toBe("vollstaendig");
  });

  it("das Lesen verändert weder die Bilddaten noch die PowerPoint-Bytes", async () => {
    const bytes = deck();
    const vorher = Buffer.from(bytes).toString("base64");
    const eingang = await pptxEingang(bytes);
    const quellen = eingang.vorkommen.map((v) => v.src);
    await createBildAnalyse({ erkenne: markenEngine() }).analysiereQuelle(eingang, ohneFortschritt);
    expect(Buffer.from(bytes).toString("base64")).toBe(vorher);
    expect(eingang.vorkommen.map((v) => v.src)).toEqual(quellen);
  });
});

// ================================================================================================
// Nacharbeit 3 (Bens Befund 2) · Wesentlicher Bildinhalt über W02 — oder der konkrete Grund
// ================================================================================================
describe("K2/K5 · Bildinhalt über den vorhandenen Beschreibungsweg (W02)", () => {
  it("PowerPoint: jedes eingebettete Bild bekommt Text UND Bildinhalt, je Bild der eigene", async () => {
    const beschreibe = beschreiberMitInhalt();
    const befund = await createBildAnalyse({ erkenne: markenEngine() }).analysiereQuelle(
      await pptxEingang(),
      { automatik: true, beschreibe },
    );
    expect(befund.befunde.map((b) => [b.fundstelle.folie, b.text, b.bildinhalt.text])).toEqual([
      [1, TEXT_JE_MARKE.A, "Foto eines Aushangs (A)"],
      [2, TEXT_JE_MARKE.B, "Foto eines Aushangs (B)"],
      [2, TEXT_JE_MARKE.C, "Foto eines Aushangs (C)"],
    ]);
    // PowerPoint bleibt wegen L16 und des verworfenen BMP „teilweise“ — auch mit Bildinhalt.
    expect(befund.status).toBe("teilweise");
  });

  it("die Einstufung verbietet das Modell → „nicht zulässig“, sichtbar als Teilverarbeitung", async () => {
    const describe = vi.fn(async () => ({
      text: null,
      demo: true,
      fallbackReason: "confidential" as const,
    }));
    const befund = await createBildAnalyse({ erkenne: markenEngine() }).analysiereQuelle(
      einzelbildEingang("x.png", dataUrl(bildMit("E"))),
      { automatik: true, beschreibe: bildBeschreiberAus({ available: true, describe }) },
    );
    expect(describe).toHaveBeenCalledTimes(1);
    expect(befund.befunde[0]).toMatchObject({
      status: "gelesen",
      text: "AUSHANG 61",
      bildinhalt: { status: "nicht-zulaessig", grund: "confidential" },
    });
    expect(befund.status).toBe("teilweise");
  });

  it("kein Modell verfügbar → es wird gar nicht erst angefragt, „nicht verfügbar“", async () => {
    const describe = vi.fn(async () => ({ text: "egal", demo: false }));
    const befund = await createBildAnalyse({ erkenne: markenEngine() }).analysiereQuelle(
      einzelbildEingang("x.png", dataUrl(bildMit("E"))),
      { automatik: true, beschreibe: bildBeschreiberAus({ available: false, describe }) },
    );
    expect(describe).not.toHaveBeenCalled();
    expect(befund.befunde[0]?.bildinhalt.status).toBe("nicht-verfuegbar");
    expect(befund.status).toBe("teilweise");
  });

  it("die Vertraulichkeitssperre des Servers (409) ist „nicht zulässig“, ein Fehler „fehlgeschlagen“", async () => {
    const gesperrt = bildBeschreiberAus({
      available: true,
      describe: async () => {
        throw Object.assign(new Error("gesperrt"), { status: 409 });
      },
    });
    const kaputt = bildBeschreiberAus({
      available: true,
      describe: async () => ({ text: null, demo: true, fallbackReason: "model-error" as const }),
    });
    expect((await gesperrt("data:image/png;base64,AA==")).status).toBe("nicht-zulaessig");
    expect((await kaputt("data:image/png;base64,AA==")).status).toBe("fehlgeschlagen");
  });

  it("Text nicht lesbar, Bildinhalt beschrieben → verwertbar, aber „teilweise“", async () => {
    const analyse = createBildAnalyse({
      erkenne: async () => ({ status: "failed", text: "", error: "worker-crash" }),
    });
    const eingang = einzelbildEingang("x.png", dataUrl(bildMit("E")));
    const befund = await analyse.analysiereQuelle(eingang, {
      automatik: true,
      beschreibe: beschreiberMitInhalt(),
    });
    expect(befund.befunde[0]).toMatchObject({
      status: "fehlgeschlagen",
      bildinhalt: { status: "beschrieben" },
    });
    expect(befund.status).toBe("teilweise");
  });

  it("unverändertes Bild: auch der Bildinhalt wird nicht erneut angefragt", async () => {
    const beschreibe = beschreiberMitInhalt();
    const analyse = createBildAnalyse({ erkenne: markenEngine() });
    const eingang = einzelbildEingang("x.png", dataUrl(bildMit("E")));
    await analyse.analysiereQuelle(eingang, { automatik: true, beschreibe });
    const zweit = await analyse.analysiereQuelle(eingang, { automatik: true, beschreibe });
    expect(beschreibe).toHaveBeenCalledTimes(1);
    expect(analyse.anzahlBeschreibungen()).toBe(1);
    expect(zweit.befunde[0]?.bildinhalt.status).toBe("beschrieben");
  });

  it("„nicht zulässig“ wird nicht gemerkt — nach einer Umstufung wird neu gefragt", async () => {
    const analyse = createBildAnalyse({ erkenne: markenEngine() });
    const eingang = einzelbildEingang("x.png", dataUrl(bildMit("E")));
    const gesperrt = vi.fn<BildBeschreiber>(async () => ({
      status: "nicht-zulaessig",
      text: "",
      grund: "confidential",
    }));
    await analyse.analysiereQuelle(eingang, { automatik: true, beschreibe: gesperrt });
    const frei = beschreiberMitInhalt();
    const danach = await analyse.analysiereQuelle(eingang, { automatik: true, beschreibe: frei });
    expect(frei).toHaveBeenCalledTimes(1);
    expect(danach.befunde[0]?.bildinhalt.status).toBe("beschrieben");
  });
});

// ================================================================================================
// Nacharbeit 3 (Bens Befund 2) · Tabellenstruktur — nur, wenn sie zuverlässig bestimmbar ist
// ================================================================================================
function wort(text: string, x0: number, y0: number, sicherheit = 95): OcrWort {
  const bbox = { x0, y0, x1: x0 + text.length * 18, y1: y0 + 30 };
  return { text, confidence: sicherheit, bbox };
}

describe("K3/K5 · Tabellen aus den Wortrahmen", () => {
  it("drei Zeilen, drei ausgerichtete Spalten → Tabelle in Lesereihenfolge", () => {
    const woerter = [
      wort("Teil", 20, 10),
      wort("Menge", 300, 10),
      wort("Preis", 600, 10),
      wort("Ventil", 20, 60),
      wort("4", 300, 60),
      wort("12,50", 600, 60),
      wort("Dichtung", 20, 110),
      wort("10", 300, 110),
      wort("0,80", 600, 110),
    ];
    expect(tabelleAusWoertern(woerter)).toEqual([
      ["Teil", "Menge", "Preis"],
      ["Ventil", "4", "12,50"],
      ["Dichtung", "10", "0,80"],
    ]);
  });

  it("Fließtext ohne Spaltenstruktur → keine Tabelle (kein Raten)", () => {
    const woerter = [
      wort("Vor", 20, 10),
      wort("der", 90, 10),
      wort("Wartung", 160, 10),
      wort("Ventil", 20, 60),
      wort("schließen.", 140, 60),
    ];
    expect(tabelleAusWoertern(woerter)).toBeNull();
  });

  it("unsichere Zellen bleiben gekennzeichnet", () => {
    const woerter = [
      wort("Teil", 20, 10),
      wort("Menge", 300, 10),
      wort("Ventil", 20, 60),
      wort("4", 300, 60, 40),
    ];
    expect(tabelleAusWoertern(woerter)).toEqual([
      ["Teil", "Menge"],
      ["Ventil", "[?4]"],
    ]);
  });

  it("die Tabelle kommt im Befund an", async () => {
    const erkenne = async (): Promise<OcrResult> => ({
      status: "success",
      text: "Teil Menge\nVentil 4",
      woerter: [
        wort("Teil", 20, 10),
        wort("Menge", 300, 10),
        wort("Ventil", 20, 60),
        wort("4", 300, 60),
      ],
    });
    const befund = await createBildAnalyse({ erkenne }).analysiereQuelle(
      einzelbildEingang("x.png", dataUrl(bildMit("E"))),
      ohneFortschritt,
    );
    expect(befund.befunde[0]?.tabelle).toEqual([
      ["Teil", "Menge"],
      ["Ventil", "4"],
    ]);
  });
});

// ================================================================================================
// Nacharbeit 3 (Bens Befund 1) · Weitere Eingänge: Bilder im Text, Objektspeicher, manueller Weg
// ================================================================================================
describe("K1/K3/K5 · Bilder im Text (Editor) und aus dem Objektspeicher", () => {
  it("Rumpf: Bilder in Dokumentreihenfolge, Objektspeicher-Bild über den Lader, fremdes ohne Zugriff", async () => {
    const html = [
      `<p>Einleitung</p><figure><img data-image-id="kw-fig-1" src="${dataUrl(bildMit("A"))}"></figure>`,
      '<p>Gespeichert</p><figure><img data-image-id="kw-fig-2" src="/api/objects/obj-7/raw"></figure>',
      '<figure><img data-image-id="kw-fig-3" src="https://example.invalid/x.png"></figure>',
    ].join("");
    const ladeBild = vi.fn(async (src: string) =>
      src === "/api/objects/obj-7/raw" ? dataUrl(bildMit("C")) : null,
    );
    const befund = await createBildAnalyse({ erkenne: markenEngine(), ladeBild }).analysiereQuelle(
      rumpfBildEingang("diesem Text", html),
      ohneFortschritt,
    );
    const ist = befund.befunde.map((b) => [
      b.fundstelle.bild,
      b.fundstelle.imageId,
      b.status,
      b.text,
    ]);
    expect(ist).toEqual([
      [1, "kw-fig-1", "gelesen", TEXT_JE_MARKE.A],
      [2, "kw-fig-2", "gelesen", TEXT_JE_MARKE.C],
      [3, "kw-fig-3", "kein-zugriff", ""],
    ]);
    expect(ladeBild).toHaveBeenCalledTimes(2);
    expect(befund.status).toBe("teilweise");
  });

  // Nacharbeit 5 (Bens Befund 2): ein hängender Lesezugriff blockiert die übrigen Bilder nicht.
  it("hängendes gespeichertes Bild: nach der Ladefrist abgebrochen, das nächste Bild wird gelesen", async () => {
    const gesehen: { signal?: AbortSignal | undefined } = {};
    const ladeBild = vi.fn((_src: string, signal?: AbortSignal) => {
      gesehen.signal = signal;
      return new Promise<string | null>(() => {});
    });
    const html = [
      '<figure><img data-image-id="kw-fig-1" src="/api/objects/haengt/raw"></figure>',
      `<figure><img data-image-id="kw-fig-2" src="${dataUrl(bildMit("A"))}"></figure>`,
    ].join("");
    const analyse = createBildAnalyse({ erkenne: markenEngine(), ladeBild, ladefristMs: 20 });
    const befund = await analyse.analysiereQuelle(rumpfBildEingang("diesem Text", html), {
      automatik: true,
    });
    expect(befund.befunde.map((b) => [b.status, b.text])).toEqual([
      ["zeitueberschreitung", ""],
      ["gelesen", TEXT_JE_MARKE.A],
    ]);
    expect(befund.befunde[0]?.fehler).toBe("ladefrist");
    expect(gesehen.signal?.aborted).toBe(true);
    expect(befund.status).toBe("teilweise");
  });

  it("gleicheBilder: Textänderung gleich, ersetztes oder neues Bild verschieden", () => {
    const a = `<p>x</p><figure><img data-image-id="kw-fig-1" src="${dataUrl(bildMit("A"))}"></figure>`;
    const mitText = `${a}<p>weitergetippt</p>`;
    const ersetzt = a.replace(dataUrl(bildMit("A")), dataUrl(bildMit("C")));
    const vor = rumpfBildEingang("t", a).vorkommen;
    expect(gleicheBilder(vor, rumpfBildEingang("t", mitText).vorkommen)).toBe(true);
    expect(gleicheBilder(vor, rumpfBildEingang("t", ersetzt).vorkommen)).toBe(false);
    expect(gleicheBilder(vor, rumpfBildEingang("t", `${a}${a}`).vorkommen)).toBe(false);
  });

  it("ausdrücklicher Auftrag (`neu`) erkennt dasselbe Bild noch einmal", async () => {
    const erkenne = markenEngine();
    const analyse = createBildAnalyse({ erkenne });
    const v = einzelbildEingang("x.png", dataUrl(bildMit("E"))).vorkommen[0];
    if (!v) {
      throw new Error("kein Vorkommen");
    }
    await analyse.befundFuerBild(v);
    const wieder = await analyse.befundFuerBild(v);
    expect(erkenne).toHaveBeenCalledTimes(1);
    expect(wieder.wiederverwendet).toBe(true);
    const neu = await analyse.befundFuerBild(v, { neu: true });
    expect(erkenne).toHaveBeenCalledTimes(2);
    expect(neu.wiederverwendet).toBe(false);
  });
});
