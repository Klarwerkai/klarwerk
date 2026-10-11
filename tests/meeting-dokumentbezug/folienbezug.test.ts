// ================================================================================================
// BPA-16 · GESPRÄCHSAUSSAGEN MIT FOLIEN UND DOKUMENTSTELLEN VERBINDEN (produkt:20261011:
// assistenz-meeting-dokumentbezug) — die Kriterien K1..K10 am echten Bindungsmodul.
// ================================================================================================
//
// Vorrichtung (BPA-S17, nur synthetische Daten): zwei Präsentationen „Nord" und „Süd" mit gleich
// benannten Folien („Umsatzentwicklung"), eine WebVTT-Mitschrift mit Rückmeldungen, Rücksprung,
// umsortierte Fassung, präsentierte Kopie, später geändertes Original. Die Dateien werden hier
// als OOXML-PresentationML gebaut und durch DENSELBEN Leser (`foliensatzLesen`) gelesen wie im
// Produkt; zusätzlich liest K10 die unabhängig erzeugte Referenzdatei `tests/fixtures/
// d3-referenz.pptx`. Eine Datei aus einer echten PowerPoint-Installation und ein Live-Meeting-
// host sind das NICHT — das bleibt in der Rückgabe offen benannt.
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { beforeEach, describe, expect, it } from "vitest";
import {
  BindungsFehler,
  type Foliensatz,
  FoliensatzFehler,
  type Gespraechsstelle,
  MeetingDokumentbezug,
  type Rechtepruefung,
  foliensatzLesen,
  webvttLesen,
} from "../../services/app/src/meeting-dokumentbezug";
import { repoPfad } from "../support/repoPfad";

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

interface Folie {
  sldId: number;
  titel: string;
  inhalt: string;
  versteckt?: boolean;
  notiz?: string;
}

function form(typ: string, text: string): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="2" name="${typ}"/><p:cNvSpPr/><p:nvPr><p:ph type="${typ}"/></p:nvPr></p:nvSpPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
}

/** Baut eine .pptx. Der Teilname einer Folie hängt an ihrer sldId, nicht an der Reihenfolge. */
async function pptx(folien: Folie[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const datum = new Date("2026-10-11T00:00:00Z");
  const ablegen = (pfad: string, xml: string): void => {
    zip.file(pfad, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${xml}`, {
      date: datum,
    });
  };
  ablegen(
    "[Content_Types].xml",
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
  );
  const ids = folien.map((f) => `<p:sldId id="${f.sldId}" r:id="rId${f.sldId}"/>`).join("");
  ablegen(
    "ppt/presentation.xml",
    `<p:presentation ${NS}><p:sldIdLst>${ids}</p:sldIdLst></p:presentation>`,
  );
  const rels = folien
    .map(
      (f) =>
        `<Relationship Id="rId${f.sldId}" Type="${REL}/slide" Target="slides/slide${f.sldId}.xml"/>`,
    )
    .join("");
  ablegen(
    "ppt/_rels/presentation.xml.rels",
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`,
  );
  for (const f of folien) {
    const show = f.versteckt ? ' show="0"' : "";
    ablegen(
      `ppt/slides/slide${f.sldId}.xml`,
      `<p:sld ${NS}${show}><p:cSld><p:spTree>${form("title", f.titel)}${form("body", f.inhalt)}</p:spTree></p:cSld></p:sld>`,
    );
    if (f.notiz) {
      ablegen(
        `ppt/slides/_rels/slide${f.sldId}.xml.rels`,
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/notesSlide" Target="../notesSlides/notesSlide${f.sldId}.xml"/></Relationships>`,
      );
      ablegen(
        `ppt/notesSlides/notesSlide${f.sldId}.xml`,
        `<p:notes ${NS}><p:cSld><p:spTree>${form("sldImg", "")}${form("body", f.notiz)}</p:spTree></p:cSld></p:notes>`,
      );
    }
  }
  return zip.generateAsync({ type: "uint8array" });
}

const NORD: Folie[] = [
  { sldId: 256, titel: "Quartal Nord", inhalt: "Überblick" },
  { sldId: 257, titel: "Umsatzentwicklung", inhalt: "Grafik Nord 2025" },
  {
    sldId: 258,
    titel: "Margenreserve",
    inhalt: "Nur intern",
    versteckt: true,
    notiz: "MARGE-GEHEIM-4711 nicht vortragen",
  },
];
const SUED: Folie[] = [
  { sldId: 256, titel: "Quartal Süd", inhalt: "Überblick", notiz: "NOTIZ-SUED-0815" },
  { sldId: 257, titel: "Umsatzentwicklung", inhalt: "Grafik Süd 2025" },
];

const VTT = `WEBVTT

r1
00:01:05.000 --> 00:01:09.000
<v Sprecherin A>Bei dieser Grafik fehlt die Berechnungsgrundlage.</v>

r2
00:02:05.000 --> 00:02:09.500
<v Sprecher B>Hier fehlt die Quelle der Zahlen.</v>

r3
00:02:15.000 --> 00:02:18.000
<v Sprecherin A>Den Überblick bitte kürzen.</v>
`;

const ZEITBASIS = "aufnahme-1";

interface Lage {
  nord: Foliensatz;
  sued: Foliensatz;
  stellen: Gespraechsstelle[];
  rechte: Record<string, Set<string>>;
  pruefung: Rechtepruefung;
}

function rechtepruefung(rechte: Record<string, Set<string>>): Rechtepruefung {
  const hat = (nutzer: string, recht: string): boolean => rechte[nutzer]?.has(recht) ?? false;
  return {
    meetingLesen: (n, m) => hat(n, `meeting:${m}`),
    dokumentLesen: (n, d) => hat(n, `dok:${d}`),
    versteckteFolienLesen: (n, d) => hat(n, `versteckt:${d}`),
    notizenLesen: (n, d) => hat(n, `notizen:${d}`),
  };
}

async function lage(): Promise<Lage> {
  const rechte: Record<string, Set<string>> = {
    eigner: new Set([
      "meeting:m1",
      "dok:nord",
      "dok:sued",
      "versteckt:nord",
      "notizen:nord",
      "notizen:sued",
    ]),
    leser: new Set(["meeting:m1", "dok:nord", "dok:sued"]),
    nurMeeting: new Set(["meeting:m1"]),
    fremd: new Set(["dok:nord"]),
  };
  return {
    nord: await foliensatzLesen("nord", await pptx(NORD)),
    sued: await foliensatzLesen("sued", await pptx(SUED)),
    stellen: webvttLesen(VTT),
    rechte,
    pruefung: rechtepruefung(rechte),
  };
}

function stelle(l: Lage, id: string): Gespraechsstelle {
  const s = l.stellen.find((x) => x.id === id);
  if (!s) {
    throw new Error(`Stelle ${id} fehlt`);
  }
  return s;
}

function host(satz: Foliensatz, sldId: string, zeitMs: number) {
  return {
    quelle: "host" as const,
    zeitMs,
    zeitbasis: ZEITBASIS,
    dateiId: satz.dateiId,
    fassung: satz.fassung,
    sldId,
  };
}

/** Meeting mit beiden Decks (präsentiert = Original), Nord → Süd → Nord. */
function meeting(l: Lage, ocrErlaubt = true): MeetingDokumentbezug {
  const verbindung = { meetingId: "m1", zeitbasis: ZEITBASIS, ocrErlaubt };
  const m = new MeetingDokumentbezug(verbindung, l.pruefung);
  m.verbinden(l.nord, l.nord);
  m.verbinden(l.sued, l.sued);
  m.folienwechsel(host(l.nord, "256", 0));
  m.folienwechsel(host(l.sued, "257", 60_000));
  m.folienwechsel(host(l.nord, "257", 120_000));
  m.folienwechsel(host(l.nord, "256", 130_000));
  return m;
}

let l: Lage;
beforeEach(async () => {
  l = await lage();
});

describe("K1 · richtige Datei, Fassung, Folie und Zeitstelle trotz gleicher Folientitel", () => {
  it("bindet zwei gleichlautende Rückmeldungen an verschiedene Decks", () => {
    const m = meeting(l);
    const sued = m.rueckmeldung({
      stelle: stelle(l, "r1"),
      zeitbasis: ZEITBASIS,
      art: "vorschlag",
      text: "Berechnungsgrundlage ergänzen",
    });
    const nord = m.rueckmeldung({
      stelle: stelle(l, "r2"),
      zeitbasis: ZEITBASIS,
      art: "vorschlag",
      text: "Zahlenquelle ergänzen",
    });
    expect(sued.bindung.status).toBe("gebunden");
    expect(sued.bindung.ziel).toEqual({ dateiId: "sued", fassung: l.sued.fassung, sldId: "257" });
    expect(sued.stelle).toMatchObject({ id: "r1", startMs: 65_000, sprecher: "Sprecherin A" });
    expect(nord.bindung.ziel).toEqual({ dateiId: "nord", fassung: l.nord.fassung, sldId: "257" });
    expect(sued.bindung.praesentiert?.titel).toBe("Umsatzentwicklung");
    expect(nord.bindung.praesentiert?.titel).toBe("Umsatzentwicklung");
    expect(l.nord.fassung).not.toBe(l.sued.fassung);
  });
});

describe("K2 · Rücksprung und Umsortieren; Foliennummer ist keine Identität", () => {
  it("Rücksprung bindet an die zurückgesprungene Folie", () => {
    const m = meeting(l);
    const r = m.rueckmeldung({
      stelle: stelle(l, "r3"),
      zeitbasis: ZEITBASIS,
      art: "vorschlag",
      text: "Überblick kürzen",
    });
    expect(r.bindung.ziel?.sldId).toBe("256");
    expect(r.bindung.ziel?.dateiId).toBe("nord");
  });

  it("umsortierte Fassung behält die Folienkennung, die Position ist nur Anzeige", async () => {
    const m = meeting(l);
    const vorher = m.rueckmeldung({
      stelle: stelle(l, "r2"),
      zeitbasis: ZEITBASIS,
      art: "vorschlag",
      text: "Zahlenquelle ergänzen",
    });
    const umsortiert = await foliensatzLesen("nord", await pptx([NORD[1]!, NORD[0]!, NORD[2]!]));
    expect(umsortiert.fassung).not.toBe(l.nord.fassung);
    expect(umsortiert.folien[0]).toMatchObject({ sldId: "257", position: 1 });
    expect(umsortiert.folien[0]?.inhaltHash).toBe(l.nord.folien[1]?.inhaltHash);
    m.verbinden(umsortiert);
    m.folienwechsel(host(umsortiert, "257", 200_000));
    const nachher = m.rueckmeldung({
      stelle: { id: "r9", startMs: 205_000, endMs: 207_000, sprecher: null, text: "noch einmal" },
      zeitbasis: ZEITBASIS,
      art: "offene_frage",
      text: "Welche Zahlen gelten?",
    });
    expect(nachher.bindung.ziel?.sldId).toBe("257");
    expect(nachher.bindung.praesentiert?.position).toBe(1);
    expect(vorher.bindung.praesentiert?.position).toBe(2);
    const ausFolie = m.ausFolie("leser", "nord", "257").map((s) => s.id);
    expect(ausFolie).toEqual([vorher.id, nachher.id]);
  });

  it("ein Wechsel mit bloßer Foliennummer bleibt in Klärung und adressiert nichts", () => {
    const m = meeting(l);
    m.folienwechsel({ quelle: "nummer", zeitMs: 300_000, zeitbasis: ZEITBASIS, position: 2 });
    const r = m.rueckmeldung({
      stelle: { id: "r10", startMs: 301_000, endMs: 302_000, sprecher: null, text: "Folie zwei" },
      zeitbasis: ZEITBASIS,
      art: "beschlossene_korrektur",
      text: "Achse beschriften",
    });
    expect(r.bindung).toMatchObject({ status: "klaerung_noetig", grund: "nur_foliennummer" });
    expect(r.bindung.ziel).toBeNull();
    expect(m.aenderung(r.id)).toMatchObject({ status: "wartet_auf_klaerung", ziel: null });
  });

  it("abweichende Zeitbasis wird nicht verrechnet, sondern geklärt", () => {
    const m = meeting(l);
    const r = m.rueckmeldung({
      stelle: stelle(l, "r1"),
      zeitbasis: "aufnahme-2",
      art: "vorschlag",
      text: "Berechnungsgrundlage ergänzen",
    });
    expect(r.bindung).toMatchObject({ status: "klaerung_noetig", grund: "zeitbasis_abweichend" });
  });
});

describe("K3 · präsentierte Kopie und Original", () => {
  it("ohne zugängliches Original: ungeklärt, kein Originalzugriff, keine Adressierung", () => {
    const m = new MeetingDokumentbezug(
      { meetingId: "m1", zeitbasis: ZEITBASIS, ocrErlaubt: false },
      l.pruefung,
    );
    expect(m.verbinden(l.sued)).toEqual({ status: "ungeklaert", originalZugriff: false });
    m.folienwechsel(host(l.sued, "257", 60_000));
    const r = m.rueckmeldung({
      stelle: stelle(l, "r1"),
      zeitbasis: ZEITBASIS,
      art: "beschlossene_korrektur",
      text: "Berechnungsgrundlage ergänzen",
    });
    expect(r.bindung.status).toBe("gebunden");
    expect(m.aenderung(r.id)).toMatchObject({ status: "wartet_auf_klaerung", ziel: null });
  });

  it("abweichende Kopie: nur inhaltsgleiche Folien adressieren das Original", async () => {
    const kopie = await foliensatzLesen(
      "sued",
      await pptx([SUED[0]!, { ...SUED[1]!, inhalt: "Grafik Süd 2025 (Vortragsfassung)" }]),
    );
    const m = new MeetingDokumentbezug(
      { meetingId: "m1", zeitbasis: ZEITBASIS, ocrErlaubt: false },
      l.pruefung,
    );
    const abgleich = m.verbinden(kopie, l.sued);
    expect(abgleich).toMatchObject({ status: "abweichend", abweichendeFolien: ["257"] });
    m.folienwechsel(host(kopie, "257", 60_000));
    m.folienwechsel(host(kopie, "256", 120_000));
    const abw = m.rueckmeldung({
      stelle: stelle(l, "r1"),
      zeitbasis: ZEITBASIS,
      art: "vorschlag",
      text: "Grundlage ergänzen",
    });
    const gleich = m.rueckmeldung({
      stelle: stelle(l, "r2"),
      zeitbasis: ZEITBASIS,
      art: "vorschlag",
      text: "Quelle ergänzen",
    });
    expect(abw.bindung.ziel?.fassung).toBe(kopie.fassung);
    expect(m.aenderung(abw.id)).toMatchObject({ status: "wartet_auf_klaerung", ziel: null });
    expect(m.aenderung(gleich.id)).toMatchObject({
      status: "offen",
      ziel: { dateiId: "sued", fassung: l.sued.fassung, sldId: "256" },
    });
  });

  it("identische Fassung wird als identisch verbunden", () => {
    const m = new MeetingDokumentbezug(
      { meetingId: "m1", zeitbasis: ZEITBASIS, ocrErlaubt: false },
      l.pruefung,
    );
    expect(m.verbinden(l.nord, l.nord)).toMatchObject({
      status: "identisch",
      originalZugriff: true,
    });
  });
});

describe("K4 · unsichere Bildschirm-/OCR-Zuordnung", () => {
  it("verlangt Klärung mit konkreten Kandidaten und adressiert keine Änderung", () => {
    const m = meeting(l);
    m.folienwechsel({
      quelle: "ocr",
      zeitMs: 400_000,
      zeitbasis: ZEITBASIS,
      bildschirmtext: "UMSATZENTWICKLUNG  Grafik 2025",
    });
    const r = m.rueckmeldung({
      stelle: { id: "r11", startMs: 401_000, endMs: 404_000, sprecher: null, text: "Grafik" },
      zeitbasis: ZEITBASIS,
      art: "beschlossene_korrektur",
      text: "Berechnungsgrundlage ergänzen",
    });
    expect(r.bindung).toMatchObject({
      status: "klaerung_noetig",
      grund: "bildschirmtext_unsicher",
      ziel: null,
    });
    expect(r.bindung.kandidaten.map((k) => `${k.dateiId}/${k.sldId}`).sort()).toEqual([
      "nord/257",
      "sued/257",
    ]);
    const ae = m.aenderung(r.id);
    expect(ae).toMatchObject({ status: "wartet_auf_klaerung", ziel: null });
    expect(() => m.ausgefuehrt(ae!.id)).toThrow(BindungsFehler);

    m.klaeren(r.id, { dateiId: "sued", fassung: l.sued.fassung, sldId: "257" }, "leser");
    expect(m.aenderung(r.id)).toMatchObject({
      status: "offen",
      ziel: { dateiId: "sued", sldId: "257" },
    });
  });

  it("bei „Keine KI“ wird kein Bildschirmtext angenommen", () => {
    const m = meeting(l, false);
    expect(() =>
      m.folienwechsel({ quelle: "ocr", zeitMs: 1, zeitbasis: ZEITBASIS, bildschirmtext: "x" }),
    ).toThrow(/Keine KI/);
  });
});

describe("K5 · Korrektur, Vorschlag, verworfener Vorschlag und KI-Empfehlung bleiben getrennt", () => {
  it("jede Art behält ihre Kennung, Herkunft und ihren Status", () => {
    const m = meeting(l);
    const s = stelle(l, "r1");
    const korrektur = m.rueckmeldung({
      stelle: s,
      zeitbasis: ZEITBASIS,
      art: "beschlossene_korrektur",
      text: "Quelle unter die Grafik",
    });
    const vorschlag = m.rueckmeldung({
      stelle: s,
      zeitbasis: ZEITBASIS,
      art: "vorschlag",
      text: "Balken statt Linie",
    });
    const verworfen = m.rueckmeldung({
      stelle: s,
      zeitbasis: ZEITBASIS,
      art: "vorschlag",
      text: "Farben ändern",
    });
    const ki = m.rueckmeldung({
      stelle: s,
      zeitbasis: ZEITBASIS,
      art: "ki_empfehlung",
      text: "Fußnote mit Berechnungsweg",
    });
    const frage = m.rueckmeldung({
      stelle: s,
      zeitbasis: ZEITBASIS,
      art: "offene_frage",
      text: "Welche Basis gilt?",
    });
    m.verwerfen(verworfen.id);

    expect(m.sicht("leser", korrektur.id)).toMatchObject({
      art: "beschlossene_korrektur",
      herkunft: "gespraech",
    });
    expect(m.sicht("leser", vorschlag.id)).toMatchObject({ art: "vorschlag" });
    expect(m.sicht("leser", verworfen.id)).toMatchObject({ art: "verworfener_vorschlag" });
    expect(m.sicht("leser", ki.id)).toMatchObject({ art: "ki_empfehlung", herkunft: "ki" });
    expect(m.aenderung(korrektur.id)?.art).toBe("beschlossene_korrektur");
    expect(m.aenderung(vorschlag.id)).toMatchObject({ art: "vorschlag", status: "offen" });
    expect(m.aenderung(verworfen.id)).toMatchObject({ status: "verworfen", ziel: null });
    expect(m.aenderung(ki.id)).toMatchObject({ art: "ki_empfehlung", status: "offen" });
    expect(m.aenderung(frage.id)).toBeUndefined();
    expect(() => m.verwerfen(ki.id)).toThrow(BindungsFehler);
  });
});

describe("K6 · erreichbar aus Folie und Zeitstelle, mit aktuellen Rechten", () => {
  it("findet die Rückmeldung von beiden Seiten und sperrt nach Rechteentzug", () => {
    const m = meeting(l);
    const r = m.rueckmeldung({
      stelle: stelle(l, "r1"),
      zeitbasis: ZEITBASIS,
      art: "vorschlag",
      text: "Berechnungsgrundlage ergänzen",
    });
    expect(m.ausFolie("leser", "sued", "257").map((s) => s.id)).toEqual([r.id]);
    expect(m.ausZeitstelle("leser", 67_000).map((s) => s.id)).toEqual([r.id]);
    expect(m.sicht("leser", r.id)?.stelle).toMatchObject({ id: "r1", startMs: 65_000 });

    l.rechte.leser?.delete("dok:sued");
    expect(m.ausFolie("leser", "sued", "257")).toEqual([]);
    expect(m.sicht("leser", r.id)?.folie).toEqual({ lesbar: false });

    l.rechte.leser?.delete("meeting:m1");
    expect(m.sicht("leser", r.id)).toBeNull();
    expect(m.ausZeitstelle("leser", 67_000)).toEqual([]);
    expect(m.sicht("fremd", r.id)).toBeNull();
  });
});

describe("K7 · versteckte Folie und Sprechernotiz nicht aus Meetingmitgliedschaft", () => {
  it("liest Notizen und versteckte Folien nur mit eigenem Recht", () => {
    const versteckt = l.nord.folien.find((f) => f.sldId === "258");
    expect(versteckt).toMatchObject({
      versteckt: true,
      notizen: "MARGE-GEHEIM-4711 nicht vortragen",
    });

    const m = meeting(l);
    m.folienwechsel(host(l.nord, "258", 500_000));
    m.folienwechsel(host(l.sued, "256", 600_000));
    const aufVersteckt = m.rueckmeldung({
      stelle: { id: "r12", startMs: 501_000, endMs: 503_000, sprecher: null, text: "Marge" },
      zeitbasis: ZEITBASIS,
      art: "offene_frage",
      text: "Stimmt die Reserve?",
    });
    const aufNotiz = m.rueckmeldung({
      stelle: { id: "r13", startMs: 601_000, endMs: 603_000, sprecher: null, text: "Süd" },
      zeitbasis: ZEITBASIS,
      art: "offene_frage",
      text: "Was steht in den Notizen?",
    });

    for (const nutzer of ["nurMeeting", "leser"]) {
      const a = m.sicht(nutzer, aufVersteckt.id);
      const b = m.sicht(nutzer, aufNotiz.id);
      expect(a?.folie).toEqual({ lesbar: false });
      const text = JSON.stringify([a, b]);
      expect(text).not.toContain("MARGE-GEHEIM");
      expect(text).not.toContain("Margenreserve");
      expect(text).not.toContain("NOTIZ-SUED");
      expect(m.ausFolie(nutzer, "nord", "258")).toEqual([]);
    }
    expect(m.sicht("leser", aufNotiz.id)?.folie).toMatchObject({ lesbar: true, notizen: null });
    expect(m.sicht("eigner", aufVersteckt.id)?.folie).toMatchObject({
      titel: "Margenreserve",
      notizen: "MARGE-GEHEIM-4711 nicht vortragen",
    });
    expect(m.sicht("eigner", aufNotiz.id)?.folie).toMatchObject({ notizen: "NOTIZ-SUED-0815" });
  });

  it("OCR-Kandidaten und Klärung zeigen die versteckte Folie nur mit Recht", () => {
    const m = meeting(l);
    m.folienwechsel({
      quelle: "ocr",
      zeitMs: 700_000,
      zeitbasis: ZEITBASIS,
      bildschirmtext: "Margenreserve",
    });
    const r = m.rueckmeldung({
      stelle: { id: "r14", startMs: 701_000, endMs: 702_000, sprecher: null, text: "x" },
      zeitbasis: ZEITBASIS,
      art: "vorschlag",
      text: "Reserve prüfen",
    });
    expect(m.sicht("leser", r.id)?.kandidaten).toEqual([]);
    expect(m.sicht("eigner", r.id)?.kandidaten).toEqual([
      { dateiId: "nord", sldId: "258", titel: "Margenreserve" },
    ]);
    const ziel = { dateiId: "nord", fassung: l.nord.fassung, sldId: "258" };
    expect(() => m.klaeren(r.id, ziel, "leser")).toThrow(BindungsFehler);
    expect(() => m.klaeren(r.id, ziel, "nurMeeting")).toThrow(BindungsFehler);
  });
});

describe("K8 · nachträgliche Dokumentänderung: Fassungsabgleich ohne Inhaltsvererbung", () => {
  it("historische Aussage bleibt an der präsentierten Fassung", async () => {
    const m = meeting(l);
    const geaendert = m.rueckmeldung({
      stelle: stelle(l, "r2"),
      zeitbasis: ZEITBASIS,
      art: "vorschlag",
      text: "Zahlenquelle ergänzen",
    });
    const gleich = m.rueckmeldung({
      stelle: stelle(l, "r3"),
      zeitbasis: ZEITBASIS,
      art: "vorschlag",
      text: "Überblick kürzen",
    });
    m.folienwechsel(host(l.nord, "258", 500_000));
    const entfernt = m.rueckmeldung({
      stelle: { id: "r15", startMs: 501_000, endMs: 502_000, sprecher: null, text: "x" },
      zeitbasis: ZEITBASIS,
      art: "vorschlag",
      text: "Reserve streichen",
    });

    const neu = await foliensatzLesen(
      "nord",
      await pptx([
        NORD[0]!,
        { ...NORD[1]!, titel: "Umsatz neu", inhalt: "Grafik Nord 2026 mit Quelle" },
      ]),
    );
    const abgleich = m.fassungsabgleich(neu);
    const stand = Object.fromEntries(abgleich.map((e) => [e.rueckmeldungId, e.stand]));
    expect(stand).toEqual({
      [geaendert.id]: "geaendert",
      [gleich.id]: "unveraendert",
      [entfernt.id]: "entfernt",
    });

    const sicht = m.sicht("eigner", geaendert.id);
    expect(sicht?.folie).toMatchObject({ fassung: l.nord.fassung, titel: "Umsatzentwicklung" });
    expect(m.aenderung(geaendert.id)).toMatchObject({ status: "fassung_pruefen", ziel: null });
    expect(m.aenderung(entfernt.id)).toMatchObject({ status: "fassung_pruefen", ziel: null });
    expect(m.aenderung(gleich.id)).toMatchObject({
      status: "offen",
      ziel: { fassung: neu.fassung, sldId: "256" },
    });
  });
});

describe("K9 · Klärung/Korrektur aktualisiert nur offene Änderungen, ohne Dublette", () => {
  it("bindet offene Objekte neu, lässt Ausgeführtes stehen und bleibt idempotent", () => {
    const m = meeting(l);
    const ausgefuehrt = m.rueckmeldung({
      stelle: stelle(l, "r2"),
      zeitbasis: ZEITBASIS,
      art: "beschlossene_korrektur",
      text: "Zahlenquelle ergänzen",
    });
    const offen = m.rueckmeldung({
      stelle: stelle(l, "r2"),
      zeitbasis: ZEITBASIS,
      art: "vorschlag",
      text: "Legende vergrößern",
    });
    const unbeteiligt = m.rueckmeldung({
      stelle: stelle(l, "r1"),
      zeitbasis: ZEITBASIS,
      art: "vorschlag",
      text: "Berechnungsgrundlage ergänzen",
    });
    m.ausgefuehrt(`ae-${ausgefuehrt.id}`);
    const unbeteiligtVorher = m.aenderung(unbeteiligt.id);
    const anzahl = m.aenderungenAnzahl();
    const korrekt = { dateiId: "sued", fassung: l.sued.fassung, sldId: "257" };

    m.klaeren(ausgefuehrt.id, korrekt, "leser");
    m.klaeren(offen.id, korrekt, "leser");
    m.klaeren(offen.id, korrekt, "leser");

    expect(m.aenderung(ausgefuehrt.id)).toMatchObject({
      status: "ausgefuehrt",
      ziel: { dateiId: "nord", sldId: "257" },
      bindungVersion: 1,
    });
    expect(m.historie(ausgefuehrt.id)).toHaveLength(1);
    expect(m.historie(ausgefuehrt.id)[0]?.ziel).toMatchObject({ dateiId: "nord", sldId: "257" });
    expect(m.aenderung(offen.id)).toMatchObject({
      status: "offen",
      ziel: korrekt,
      bindungVersion: 2,
    });
    expect(m.historie(offen.id)).toHaveLength(1);
    expect(m.sicht("leser", offen.id)?.folie).toMatchObject({ dateiId: "sued", sldId: "257" });
    expect(m.aenderung(unbeteiligt.id)).toEqual(unbeteiligtVorher);
    expect(m.aenderungenAnzahl()).toBe(anzahl);

    const nochmal = m.rueckmeldung({
      stelle: stelle(l, "r2"),
      zeitbasis: ZEITBASIS,
      art: "vorschlag",
      text: "Legende  vergrößern",
    });
    expect(nochmal.id).toBe(offen.id);
    expect(m.aenderungenAnzahl()).toBe(anzahl);
  });
});

describe("K10 · reales Format und Zuordnungsgrenze", () => {
  it("liest PresentationML: sldId, Reihenfolge, Titel, versteckt, Notiz", () => {
    expect(l.nord.folien.map((f) => [f.sldId, f.position, f.titel, f.versteckt])).toEqual([
      ["256", 1, "Quartal Nord", false],
      ["257", 2, "Umsatzentwicklung", false],
      ["258", 3, "Margenreserve", true],
    ]);
    expect(l.nord.fassung).toMatch(/^[0-9a-f]{64}$/);
  });

  it("liest die unabhängig erzeugte Referenzdatei tests/fixtures/d3-referenz.pptx", async () => {
    const bytes = readFileSync(repoPfad("tests/fixtures/d3-referenz.pptx"));
    const satz = await foliensatzLesen("d3", bytes);
    expect(satz.folien.map((f) => f.titel)).toEqual([
      "D3 Referenz Folie Eins",
      "D3 Referenz Folie Zwei",
      "D3 Referenz Folie Drei",
    ]);
    expect(satz.folien.map((f) => f.sldId)).toEqual(["256", "257", "258"]);
    expect(satz.folien[0]?.notizen).toContain("SPRECHERNOTIZ4203");
  });

  it("liest WebVTT-Mitschriften mit Kennung, Zeit und Sprecher", () => {
    expect(l.stellen).toEqual([
      {
        id: "r1",
        startMs: 65_000,
        endMs: 69_000,
        sprecher: "Sprecherin A",
        text: "Bei dieser Grafik fehlt die Berechnungsgrundlage.",
      },
      {
        id: "r2",
        startMs: 125_000,
        endMs: 129_500,
        sprecher: "Sprecher B",
        text: "Hier fehlt die Quelle der Zahlen.",
      },
      {
        id: "r3",
        startMs: 135_000,
        endMs: 138_000,
        sprecher: "Sprecherin A",
        text: "Den Überblick bitte kürzen.",
      },
    ]);
  });

  it("weist Nicht-PPTX, Archive ohne Präsentation und Nicht-WebVTT ab", async () => {
    await expect(foliensatzLesen("x", new TextEncoder().encode("kein zip"))).rejects.toThrow(
      FoliensatzFehler,
    );
    const leer = new JSZip();
    leer.file("word/document.xml", "<w:document/>");
    await expect(
      foliensatzLesen("x", await leer.generateAsync({ type: "uint8array" })),
    ).rejects.toThrow(/presentation\.xml/);
    expect(() => webvttLesen("00:00:01.000 --> 00:00:02.000\nText")).toThrow(FoliensatzFehler);
  });

  it("Bildschirmansicht allein ist kein Originaldateiadapter", () => {
    const m = new MeetingDokumentbezug(
      { meetingId: "m1", zeitbasis: ZEITBASIS, ocrErlaubt: true },
      l.pruefung,
    );
    m.folienwechsel({
      quelle: "ocr",
      zeitMs: 0,
      zeitbasis: ZEITBASIS,
      bildschirmtext: "Umsatzentwicklung",
    });
    const r = m.rueckmeldung({
      stelle: stelle(l, "r1"),
      zeitbasis: ZEITBASIS,
      art: "beschlossene_korrektur",
      text: "Berechnungsgrundlage ergänzen",
    });
    expect(r.bindung).toMatchObject({ status: "klaerung_noetig", kandidaten: [], ziel: null });
    expect(m.aenderung(r.id)).toMatchObject({ status: "wartet_auf_klaerung", ziel: null });
    expect(() => m.folienwechsel(host(l.nord, "257", 10))).toThrow(/nicht verbundene Fassung/);
  });
});
