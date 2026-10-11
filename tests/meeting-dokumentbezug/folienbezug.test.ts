// ================================================================================================
// BPA-16 · GESPRÄCHSAUSSAGEN MIT FOLIEN UND DOKUMENTSTELLEN VERBINDEN (produkt:20261011:
// assistenz-meeting-dokumentbezug) — die Kriterien K1..K10 am Bindungsmodul.
// ================================================================================================
//
// Vorrichtung (BPA-S17, nur synthetische Daten): zwei Präsentationen „Nord" und „Süd" mit gleich
// benannten Folien („Umsatzentwicklung"), eine WebVTT-Mitschrift mit Rückmeldungen, Rücksprung,
// umsortierte Fassung, präsentierte Kopie (gleiche und eigene Dateikennung), eingebundene Bilder
// und später geändertes Original. Die Dateien werden hier als OOXML-PresentationML gebaut und
// durch DENSELBEN Leser (`foliensatzLesen`) gelesen wie im Produkt; zusätzlich liest K10 die
// unabhängig erzeugte Referenzdatei `tests/fixtures/d3-referenz.pptx`. Den Weg über die echte App
// (Objektspeicher, Rechte, Ablage, Routen) misst `bedienweg.test.ts`. Eine Datei aus einer echten
// PowerPoint-Installation und ein Live-Meetinghost sind beides NICHT.
//
// Nacharbeit 2 (Bens Befunde): referenzierte Grafikbestandteile im Inhaltsvergleich (K3/K8),
// Kopie und Original mit verschiedenen Dateikennungen (K3/K8/K9) und Rechte auf JEDEM Zugriffspfad
// — klaeren, kopieAbgleich, aenderung, historie (K6/K7).
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { beforeEach, describe, expect, it } from "vitest";
import {
  BindungsFehler,
  type Foliensatz,
  FoliensatzFehler,
  MeetingDokumentbezug,
  type Rechtepruefung,
  type RueckmeldungsArt,
  type RueckmeldungsSicht,
  foliensatzLesen,
  webvttLesen,
} from "../../services/app/src/meeting-dokumentbezug";
import { repoPfad } from "../support/repoPfad";
import { type Folie, NORD, SUED, VTT, pptx } from "./vorrichtung";

const ZEITBASIS = "aufnahme-1";
const MITSCHRIFT = "vtt-1";

interface Lage {
  nord: Foliensatz;
  sued: Foliensatz;
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
  const dateien = ["nord", "sued", "sued-kopie"];
  const rechte: Record<string, Set<string>> = {
    eigner: new Set([
      "meeting:m1",
      ...dateien.flatMap((d) => [`dok:${d}`, `versteckt:${d}`, `notizen:${d}`]),
    ]),
    leser: new Set(["meeting:m1", "dok:nord", "dok:sued", "dok:sued-kopie"]),
    nurMeeting: new Set(["meeting:m1"]),
    fremd: new Set(["dok:nord", "dok:sued", "versteckt:nord", "notizen:nord"]),
  };
  return {
    nord: await foliensatzLesen("nord", await pptx(NORD)),
    sued: await foliensatzLesen("sued", await pptx(SUED)),
    rechte,
    pruefung: rechtepruefung(rechte),
  };
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

function leeresMeeting(l: Lage, ocrErlaubt = true): MeetingDokumentbezug {
  const verbindung = { meetingId: "m1", zeitbasis: ZEITBASIS, ocrErlaubt };
  const m = new MeetingDokumentbezug(verbindung, l.pruefung);
  m.mitschriftVerbinden("eigner", {
    id: MITSCHRIFT,
    zeitbasis: ZEITBASIS,
    stellen: webvttLesen(VTT),
  });
  return m;
}

/** Meeting mit beiden Decks (präsentiert = Original), Nord → Süd → Nord → Rücksprung. */
function meeting(l: Lage, ocrErlaubt = true): MeetingDokumentbezug {
  const m = leeresMeeting(l, ocrErlaubt);
  m.verbinden("eigner", l.nord, l.nord);
  m.verbinden("eigner", l.sued, l.sued);
  m.folienwechsel("eigner", host(l.nord, "256", 0));
  m.folienwechsel("eigner", host(l.sued, "257", 60_000));
  m.folienwechsel("eigner", host(l.nord, "257", 120_000));
  m.folienwechsel("eigner", host(l.nord, "256", 130_000));
  return m;
}

function melde(
  m: MeetingDokumentbezug,
  stelleId: string,
  art: RueckmeldungsArt,
  text: string,
  nutzer = "eigner",
): RueckmeldungsSicht {
  return m.rueckmeldung(nutzer, { mitschriftId: MITSCHRIFT, stelleId, art, text });
}

let l: Lage;
beforeEach(async () => {
  l = await lage();
});

describe("K1 · richtige Datei, Fassung, Folie und Zeitstelle trotz gleicher Folientitel", () => {
  it("bindet zwei Rückmeldungen an gleich benannte Folien verschiedener Decks", () => {
    const m = meeting(l);
    const sued = melde(m, "r1", "vorschlag", "Berechnungsgrundlage ergänzen");
    const nord = melde(m, "r2", "vorschlag", "Zahlenquelle ergänzen");
    expect(sued.status).toBe("gebunden");
    expect(sued.folie).toMatchObject({
      lesbar: true,
      dateiId: "sued",
      fassung: l.sued.fassung,
      sldId: "257",
      titel: "Umsatzentwicklung",
    });
    expect(sued.stelle).toMatchObject({ id: "r1", startMs: 65_000, sprecher: "Sprecherin A" });
    expect(nord.folie).toMatchObject({ dateiId: "nord", fassung: l.nord.fassung, sldId: "257" });
    expect(nord.folie).toMatchObject({ titel: "Umsatzentwicklung" });
    expect(l.nord.fassung).not.toBe(l.sued.fassung);
  });
});

describe("K2 · Rücksprung und Umsortieren; Foliennummer ist keine Identität", () => {
  it("Rücksprung bindet an die zurückgesprungene Folie", () => {
    const m = meeting(l);
    const r = melde(m, "r3", "vorschlag", "Überblick kürzen");
    expect(r.folie).toMatchObject({ dateiId: "nord", sldId: "256" });
  });

  it("umsortierte Fassung behält die Folienkennung, die Position ist nur Anzeige", async () => {
    const m = meeting(l);
    const vorher = melde(m, "r2", "vorschlag", "Zahlenquelle ergänzen");
    const umsortiert = await foliensatzLesen("nord", await pptx([NORD[1]!, NORD[0]!, NORD[2]!]));
    expect(umsortiert.fassung).not.toBe(l.nord.fassung);
    expect(umsortiert.folien[0]).toMatchObject({ sldId: "257", position: 1 });
    expect(umsortiert.folien[0]?.inhaltHash).toBe(l.nord.folien[1]?.inhaltHash);
    m.verbinden("eigner", umsortiert);
    m.folienwechsel("eigner", host(umsortiert, "257", 200_000));
    const nachher = melde(m, "r9", "offene_frage", "Welche Zahlen gelten?");
    expect(nachher.folie).toMatchObject({ sldId: "257", position: 1 });
    expect(vorher.folie).toMatchObject({ sldId: "257", position: 2 });
    const ausFolie = m.ausFolie("leser", "nord", "257").map((s) => s.id);
    expect(ausFolie).toEqual([vorher.id, nachher.id]);
  });

  it("ein Wechsel mit bloßer Foliennummer bleibt in Klärung und adressiert nichts", () => {
    const m = meeting(l);
    m.folienwechsel("eigner", {
      quelle: "nummer",
      zeitMs: 300_000,
      zeitbasis: ZEITBASIS,
      position: 2,
    });
    const r = melde(m, "r10", "beschlossene_korrektur", "Achse beschriften");
    expect(r).toMatchObject({ status: "klaerung_noetig", grund: "nur_foliennummer", folie: null });
    expect(r.aenderung).toMatchObject({ status: "wartet_auf_klaerung", ziel: null });
  });

  it("abweichende Zeitbasis wird nicht verrechnet, sondern geklärt", () => {
    const m = meeting(l);
    m.mitschriftVerbinden("eigner", {
      id: "vtt-2",
      zeitbasis: "aufnahme-2",
      stellen: webvttLesen(VTT),
    });
    const r = m.rueckmeldung("eigner", {
      mitschriftId: "vtt-2",
      stelleId: "r1",
      art: "vorschlag",
      text: "Berechnungsgrundlage ergänzen",
    });
    expect(r).toMatchObject({ status: "klaerung_noetig", grund: "zeitbasis_abweichend" });
  });
});

describe("K3 · präsentierte Kopie und Original", () => {
  it("ohne zugängliches Original: ungeklärt, kein Originalzugriff, keine Adressierung", () => {
    const m = leeresMeeting(l, false);
    expect(m.verbinden("eigner", l.sued)).toEqual({ status: "ungeklaert", originalZugriff: false });
    m.folienwechsel("eigner", host(l.sued, "257", 60_000));
    const r = melde(m, "r1", "beschlossene_korrektur", "Berechnungsgrundlage ergänzen");
    expect(r.status).toBe("gebunden");
    expect(r.aenderung).toMatchObject({ status: "wartet_auf_klaerung", ziel: null });
  });

  it("abweichende Kopie: nur inhaltsgleiche Folien adressieren das Original", async () => {
    const kopie = await foliensatzLesen(
      "sued",
      await pptx([SUED[0]!, { ...SUED[1]!, inhalt: "Grafik Süd 2025 (Vortragsfassung)" }]),
    );
    const m = leeresMeeting(l, false);
    const abgleich = m.verbinden("eigner", kopie, l.sued);
    expect(abgleich).toMatchObject({ status: "abweichend", abweichendeFolien: ["257"] });
    m.folienwechsel("eigner", host(kopie, "257", 60_000));
    m.folienwechsel("eigner", host(kopie, "256", 120_000));
    const abw = melde(m, "r1", "vorschlag", "Grundlage ergänzen");
    const gleich = melde(m, "r2", "vorschlag", "Quelle ergänzen");
    expect(abw.folie).toMatchObject({ fassung: kopie.fassung });
    expect(abw.aenderung).toMatchObject({ status: "wartet_auf_klaerung", ziel: null });
    expect(gleich.aenderung).toMatchObject({
      status: "offen",
      ziel: { dateiId: "sued", fassung: l.sued.fassung, sldId: "256" },
    });
  });

  it("Befund 2: ein geändertes eingebundenes Bild bei gleichem Folien-XML ist eine Abweichung", async () => {
    const kopie = await foliensatzLesen(
      "sued",
      await pptx([SUED[0]!, { ...SUED[1]!, bild: "BALKEN-SUED-V2" }]),
    );
    expect(kopie.folien[1]?.vergleichbar).toBe(true);
    expect(kopie.folien[1]?.inhaltHash).not.toBe(l.sued.folien[1]?.inhaltHash);
    const m = leeresMeeting(l, false);
    expect(m.verbinden("eigner", kopie, l.sued)).toMatchObject({
      status: "abweichend",
      abweichendeFolien: ["257"],
      unvergleichbareFolien: [],
    });
    m.folienwechsel("eigner", host(kopie, "257", 60_000));
    const r = melde(m, "r1", "vorschlag", "Grundlage ergänzen");
    expect(r.aenderung).toMatchObject({ status: "wartet_auf_klaerung", ziel: null });
  });

  it("Befund 2: ein extern verknüpftes Bild macht die Folie nicht vergleichbar — zur Prüfung", async () => {
    const extern: Folie = { ...SUED[1]!, externesBild: "https://bilder.example.test/b.png" };
    const original = await foliensatzLesen("sued", await pptx([SUED[0]!, extern]));
    const kopie = await foliensatzLesen(
      "sued-kopie",
      await pptx([{ ...SUED[0]!, inhalt: "Überblick (Kopie)" }, extern]),
    );
    expect(original.folien[1]?.vergleichbar).toBe(false);
    const m = leeresMeeting(l, false);
    expect(m.verbinden("eigner", kopie, original)).toMatchObject({
      status: "abweichend",
      abweichendeFolien: ["256"],
      unvergleichbareFolien: ["257"],
    });
    m.folienwechsel("eigner", host(kopie, "257", 60_000));
    const r = melde(m, "r1", "vorschlag", "Grundlage ergänzen");
    expect(r.aenderung).toMatchObject({ status: "wartet_auf_klaerung", ziel: null });
  });

  it("Befund 4: Kopie mit eigener Dateikennung adressiert das gespeicherte Original", async () => {
    const kopie = await foliensatzLesen("sued-kopie", await pptx(SUED, "kopie"));
    const m = leeresMeeting(l, false);
    expect(m.verbinden("eigner", kopie, l.sued)).toMatchObject({
      status: "inhaltsgleich",
      originalDateiId: "sued",
      originalFassung: l.sued.fassung,
    });
    m.folienwechsel("eigner", host(kopie, "257", 60_000));
    const r = melde(m, "r1", "vorschlag", "Grundlage ergänzen");
    expect(r.folie).toMatchObject({ dateiId: "sued-kopie", sldId: "257" });
    expect(r.aenderung).toMatchObject({
      status: "offen",
      ziel: { dateiId: "sued", fassung: l.sued.fassung, sldId: "257" },
    });
    // Aus der Folie erreichbar — über die Kopie UND über das Original.
    expect(m.ausFolie("eigner", "sued-kopie", "257").map((s) => s.id)).toEqual([r.id]);
    expect(m.ausFolie("eigner", "sued", "257").map((s) => s.id)).toEqual([r.id]);
  });

  it("identische Fassung wird als identisch verbunden", () => {
    const m = leeresMeeting(l, false);
    expect(m.verbinden("eigner", l.nord, l.nord)).toMatchObject({
      status: "identisch",
      originalZugriff: true,
    });
  });

  it("Befund 3: ohne Leserecht am Original ist der Abgleich ungeklärt; ohne Meetingrecht keiner", async () => {
    const kopie = await foliensatzLesen("sued-kopie", await pptx(SUED, "kopie"));
    const m = leeresMeeting(l, false);
    m.verbinden("eigner", kopie, l.sued);
    l.rechte.leser?.delete("dok:sued");
    expect(m.kopieAbgleich("leser", "sued-kopie", kopie.fassung)).toEqual({
      status: "ungeklaert",
      originalZugriff: false,
    });
    const eignerAbgleich = JSON.stringify(m.kopieAbgleich("eigner", "sued-kopie", kopie.fassung));
    expect(eignerAbgleich).not.toContain("Quartal");
    expect(() => m.kopieAbgleich("fremd", "sued-kopie", kopie.fassung)).toThrow(BindungsFehler);
    expect(() => m.verbinden("nurMeeting", kopie, l.sued)).toThrow(BindungsFehler);
  });
});

describe("K4 · unsichere Bildschirm-/OCR-Zuordnung", () => {
  it("verlangt Klärung mit konkreten Kandidaten und adressiert keine Änderung", () => {
    const m = meeting(l);
    m.folienwechsel("eigner", {
      quelle: "ocr",
      zeitMs: 400_000,
      zeitbasis: ZEITBASIS,
      bildschirmtext: "UMSATZENTWICKLUNG  Grafik 2025",
    });
    const r = melde(m, "r11", "beschlossene_korrektur", "Berechnungsgrundlage ergänzen");
    expect(r).toMatchObject({
      status: "klaerung_noetig",
      grund: "bildschirmtext_unsicher",
      folie: null,
    });
    expect(r.kandidaten.map((k) => `${k.dateiId}/${k.sldId}`).sort()).toEqual([
      "nord/257",
      "sued/257",
    ]);
    expect(r.aenderung).toMatchObject({ status: "wartet_auf_klaerung", ziel: null });
    expect(() => m.ausgefuehrt("eigner", r.aenderung!.id)).toThrow(BindungsFehler);

    const geklaert = m.klaeren("leser", r.id, {
      dateiId: "sued",
      fassung: l.sued.fassung,
      sldId: "257",
    });
    expect(geklaert.aenderung).toMatchObject({
      status: "offen",
      ziel: { dateiId: "sued", sldId: "257" },
    });
  });

  it("bei „Keine KI“ wird kein Bildschirmtext angenommen", () => {
    const m = meeting(l, false);
    const ocr = { quelle: "ocr" as const, zeitMs: 1, zeitbasis: ZEITBASIS, bildschirmtext: "x" };
    expect(() => m.folienwechsel("eigner", ocr)).toThrow(/Keine KI/);
  });
});

describe("K5 · Korrektur, Vorschlag, verworfener Vorschlag und KI-Empfehlung bleiben getrennt", () => {
  it("jede Art behält ihre Kennung, Herkunft und ihren Status", () => {
    const m = meeting(l);
    const korrektur = melde(m, "r1", "beschlossene_korrektur", "Quelle unter die Grafik");
    const vorschlag = melde(m, "r1", "vorschlag", "Balken statt Linie");
    const verworfen = melde(m, "r1", "vorschlag", "Farben ändern");
    const ki = melde(m, "r1", "ki_empfehlung", "Fußnote mit Berechnungsweg");
    const frage = melde(m, "r1", "offene_frage", "Welche Basis gilt?");
    m.verwerfen("leser", verworfen.id);

    expect(m.sicht("leser", korrektur.id)).toMatchObject({
      art: "beschlossene_korrektur",
      herkunft: "gespraech",
      aenderung: { art: "beschlossene_korrektur" },
    });
    expect(m.sicht("leser", vorschlag.id)).toMatchObject({
      art: "vorschlag",
      aenderung: { art: "vorschlag", status: "offen" },
    });
    expect(m.sicht("leser", verworfen.id)).toMatchObject({
      art: "verworfener_vorschlag",
      aenderung: { status: "verworfen", ziel: null },
    });
    expect(m.sicht("leser", ki.id)).toMatchObject({
      art: "ki_empfehlung",
      herkunft: "ki",
      aenderung: { art: "ki_empfehlung", status: "offen" },
    });
    expect(m.sicht("leser", frage.id)).toMatchObject({ art: "offene_frage", aenderung: null });
    expect(() => m.verwerfen("leser", ki.id)).toThrow(BindungsFehler);
  });
});

describe("K6 · erreichbar aus Folie und Zeitstelle, mit aktuellen Rechten", () => {
  it("findet die Rückmeldung von beiden Seiten und sperrt nach Rechteentzug", () => {
    const m = meeting(l);
    const r = melde(m, "r1", "vorschlag", "Berechnungsgrundlage ergänzen");
    expect(m.ausFolie("leser", "sued", "257").map((s) => s.id)).toEqual([r.id]);
    expect(m.ausZeitstelle("leser", 67_000).map((s) => s.id)).toEqual([r.id]);
    expect(m.sicht("leser", r.id)?.stelle).toMatchObject({ id: "r1", startMs: 65_000 });

    l.rechte.leser?.delete("dok:sued");
    expect(m.ausFolie("leser", "sued", "257")).toEqual([]);
    expect(m.sicht("leser", r.id)?.folie).toEqual({ lesbar: false });
    // Befund 3: auch das Änderungsziel ist ohne Dokumentrecht verborgen.
    expect(m.aenderung("leser", r.id)).toMatchObject({ ziel: null, zielVerborgen: true });

    l.rechte.leser?.delete("meeting:m1");
    expect(m.sicht("leser", r.id)).toBeNull();
    expect(m.ausZeitstelle("leser", 67_000)).toEqual([]);
    expect(m.aenderung("leser", r.id)).toBeNull();
    expect(m.historie("leser", r.id)).toEqual([]);
  });

  it("Befund 3: Dokumentrecht ohne Meetingrecht klärt nichts und erfährt nichts", () => {
    const m = meeting(l);
    const r = melde(m, "r1", "vorschlag", "Berechnungsgrundlage ergänzen");
    const ziel = { dateiId: "nord", fassung: l.nord.fassung, sldId: "257" };
    expect(() => m.klaeren("fremd", r.id, ziel)).toThrow(BindungsFehler);
    expect(() => m.verwerfen("fremd", r.id)).toThrow(BindungsFehler);
    expect(() => melde(m, "r2", "vorschlag", "x", "fremd")).toThrow(BindungsFehler);
    expect(() => m.folienwechsel("fremd", host(l.nord, "256", 1))).toThrow(BindungsFehler);
    expect(m.sicht("fremd", r.id)).toBeNull();
    expect(m.aenderung("fremd", r.id)).toBeNull();
    expect(m.historie("fremd", r.id)).toEqual([]);
    expect(m.sicht("eigner", r.id)?.version).toBe(1);
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
    m.folienwechsel("eigner", host(l.nord, "258", 500_000));
    m.folienwechsel("eigner", host(l.sued, "256", 600_000));
    const aufVersteckt = melde(m, "r12", "offene_frage", "Stimmt die Reserve?");
    const aufNotiz = melde(m, "r13", "offene_frage", "Was steht in den Notizen?");

    for (const nutzer of ["nurMeeting", "leser"]) {
      const a = m.sicht(nutzer, aufVersteckt.id);
      const b = m.sicht(nutzer, aufNotiz.id);
      expect(a?.folie).toEqual({ lesbar: false });
      const text = JSON.stringify([a, b, m.praesentationen(nutzer)]);
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

  it("OCR-Kandidaten, Klärung und Historie zeigen die versteckte Folie nur mit Recht", () => {
    const m = meeting(l);
    m.folienwechsel("eigner", {
      quelle: "ocr",
      zeitMs: 700_000,
      zeitbasis: ZEITBASIS,
      bildschirmtext: "Margenreserve",
    });
    const r = melde(m, "r14", "vorschlag", "Reserve prüfen");
    expect(m.sicht("leser", r.id)?.kandidaten).toEqual([]);
    expect(m.sicht("eigner", r.id)?.kandidaten).toEqual([
      { dateiId: "nord", sldId: "258", titel: "Margenreserve" },
    ]);
    const ziel = { dateiId: "nord", fassung: l.nord.fassung, sldId: "258" };
    expect(() => m.klaeren("leser", r.id, ziel)).toThrow(BindungsFehler);
    expect(() => m.klaeren("nurMeeting", r.id, ziel)).toThrow(BindungsFehler);
    // Der Eigner klärt; die Historie zeigt dem Leser danach weder Titel noch Kandidaten.
    expect(m.klaeren("eigner", r.id, ziel).folie).toMatchObject({ titel: "Margenreserve" });
    expect(JSON.stringify(m.historie("leser", r.id))).not.toContain("Margenreserve");
    expect(JSON.stringify(m.sicht("leser", r.id))).not.toContain("Margenreserve");
    expect(m.aenderung("leser", r.id)).toMatchObject({ ziel: null, zielVerborgen: true });
  });
});

describe("K8 · nachträgliche Dokumentänderung: Fassungsabgleich ohne Inhaltsvererbung", () => {
  it("historische Aussage bleibt an der präsentierten Fassung", async () => {
    const m = meeting(l);
    const geaendert = melde(m, "r2", "vorschlag", "Zahlenquelle ergänzen");
    const gleich = melde(m, "r3", "vorschlag", "Überblick kürzen");
    m.folienwechsel("eigner", host(l.nord, "258", 500_000));
    const entfernt = melde(m, "r15", "vorschlag", "Reserve streichen");

    const neu = await foliensatzLesen(
      "nord",
      await pptx([NORD[0]!, { ...NORD[1]!, titel: "Umsatz neu", inhalt: "Grafik 2026" }]),
    );
    const abgleich = m.fassungsabgleich("eigner", neu);
    const stand = Object.fromEntries(abgleich.map((e) => [e.rueckmeldungId, e.stand]));
    expect(stand).toEqual({
      [geaendert.id]: "geaendert",
      [gleich.id]: "unveraendert",
      [entfernt.id]: "entfernt",
    });

    const sicht = m.sicht("eigner", geaendert.id);
    expect(sicht?.folie).toMatchObject({ fassung: l.nord.fassung, titel: "Umsatzentwicklung" });
    expect(sicht?.aenderung).toMatchObject({ status: "fassung_pruefen", ziel: null });
    expect(m.aenderung("eigner", entfernt.id)).toMatchObject({
      status: "fassung_pruefen",
      ziel: null,
    });
    expect(m.aenderung("eigner", gleich.id)).toMatchObject({
      status: "offen",
      ziel: { fassung: neu.fassung, sldId: "256" },
    });
  });

  it("Befund 2: nur das eingebundene Bild geändert → geaendert, nicht still neu adressiert", async () => {
    const m = meeting(l);
    const r = melde(m, "r2", "vorschlag", "Zahlenquelle ergänzen");
    expect(r.aenderung).toMatchObject({ status: "offen" });
    const neu = await foliensatzLesen(
      "nord",
      await pptx([NORD[0]!, { ...NORD[1]!, bild: "BALKEN-NORD-V2" }, NORD[2]!]),
    );
    expect(m.fassungsabgleich("eigner", neu)).toContainEqual({
      rueckmeldungId: r.id,
      sldId: "257",
      stand: "geaendert",
    });
    expect(m.aenderung("eigner", r.id)).toMatchObject({ status: "fassung_pruefen", ziel: null });
  });

  it("Befund 2: neue Fassung mit externem Bild → nicht_vergleichbar, zur Prüfung", async () => {
    const m = meeting(l);
    const r = melde(m, "r2", "vorschlag", "Zahlenquelle ergänzen");
    const neu = await foliensatzLesen(
      "nord",
      await pptx([NORD[0]!, { ...NORD[1]!, externesBild: "https://bilder.example.test/n.png" }]),
    );
    expect(m.fassungsabgleich("eigner", neu)).toContainEqual({
      rueckmeldungId: r.id,
      sldId: "257",
      stand: "nicht_vergleichbar",
    });
    expect(m.aenderung("eigner", r.id)).toMatchObject({ status: "fassung_pruefen", ziel: null });
  });

  it("Befund 4: geändertes Original erfasst auch Bindungen an die Kopie mit eigener Kennung", async () => {
    const kopie = await foliensatzLesen("sued-kopie", await pptx(SUED, "kopie"));
    const m = leeresMeeting(l, false);
    m.verbinden("eigner", kopie, l.sued);
    m.folienwechsel("eigner", host(kopie, "257", 60_000));
    m.folienwechsel("eigner", host(kopie, "256", 120_000));
    const geaendert = melde(m, "r1", "vorschlag", "Grundlage ergänzen");
    const gleich = melde(m, "r2", "vorschlag", "Quelle ergänzen");
    expect(geaendert.aenderung).toMatchObject({ status: "offen", ziel: { dateiId: "sued" } });

    const neu = await foliensatzLesen(
      "sued",
      await pptx([SUED[0]!, { ...SUED[1]!, inhalt: "Grafik Süd 2026" }]),
    );
    const stand = Object.fromEntries(
      m.fassungsabgleich("eigner", neu).map((e) => [e.rueckmeldungId, e.stand]),
    );
    expect(stand).toEqual({ [geaendert.id]: "geaendert", [gleich.id]: "unveraendert" });
    expect(m.aenderung("eigner", geaendert.id)).toMatchObject({
      status: "fassung_pruefen",
      ziel: null,
    });
    expect(m.aenderung("eigner", gleich.id)).toMatchObject({
      status: "offen",
      ziel: { dateiId: "sued", fassung: neu.fassung, sldId: "256" },
    });
    expect(m.sicht("eigner", geaendert.id)?.folie).toMatchObject({
      dateiId: "sued-kopie",
      fassung: kopie.fassung,
    });
  });

  it("Befund 3: Fassungsabgleich verlangt Meeting- und Dokumentrecht", async () => {
    const m = meeting(l);
    const neu = await foliensatzLesen("nord", await pptx(NORD.slice(0, 2)));
    expect(() => m.fassungsabgleich("fremd", neu)).toThrow(BindungsFehler);
    expect(() => m.fassungsabgleich("nurMeeting", neu)).toThrow(BindungsFehler);
  });
});

describe("K9 · Klärung/Korrektur aktualisiert nur offene Änderungen, ohne Dublette", () => {
  it("bindet offene Objekte neu, lässt Ausgeführtes stehen und bleibt idempotent", () => {
    const m = meeting(l);
    const ausgefuehrt = melde(m, "r2", "beschlossene_korrektur", "Zahlenquelle ergänzen");
    const offen = melde(m, "r2", "vorschlag", "Legende vergrößern");
    const unbeteiligt = melde(m, "r1", "vorschlag", "Berechnungsgrundlage ergänzen");
    m.ausgefuehrt("eigner", ausgefuehrt.aenderung!.id);
    const unbeteiligtVorher = m.aenderung("eigner", unbeteiligt.id);
    const anzahl = m.aenderungenAnzahl();
    const korrekt = { dateiId: "sued", fassung: l.sued.fassung, sldId: "257" };

    m.klaeren("leser", ausgefuehrt.id, korrekt);
    m.klaeren("leser", offen.id, korrekt);
    m.klaeren("leser", offen.id, korrekt);

    expect(m.aenderung("eigner", ausgefuehrt.id)).toMatchObject({
      status: "ausgefuehrt",
      ziel: { dateiId: "nord", sldId: "257" },
      bindungVersion: 1,
    });
    expect(m.historie("eigner", ausgefuehrt.id)).toHaveLength(1);
    expect(m.historie("eigner", ausgefuehrt.id)[0]?.folie).toMatchObject({
      dateiId: "nord",
      sldId: "257",
    });
    expect(m.aenderung("eigner", offen.id)).toMatchObject({
      status: "offen",
      ziel: korrekt,
      bindungVersion: 2,
    });
    expect(m.historie("eigner", offen.id)).toHaveLength(1);
    expect(m.sicht("leser", offen.id)).toMatchObject({
      version: 2,
      geklaertVon: "leser",
      folie: { dateiId: "sued", sldId: "257" },
    });
    expect(m.aenderung("eigner", unbeteiligt.id)).toEqual(unbeteiligtVorher);
    expect(m.aenderungenAnzahl()).toBe(anzahl);

    const nochmal = melde(m, "r2", "vorschlag", "Legende  vergrößern");
    expect(nochmal.id).toBe(offen.id);
    expect(m.aenderungenAnzahl()).toBe(anzahl);
  });

  it("Befund 4: Klärung auf eine Kopie mit eigener Kennung adressiert deren Original", async () => {
    const kopie = await foliensatzLesen("sued-kopie", await pptx(SUED, "kopie"));
    const m = meeting(l);
    m.verbinden("eigner", kopie, l.sued);
    m.folienwechsel("eigner", {
      quelle: "ocr",
      zeitMs: 400_000,
      zeitbasis: ZEITBASIS,
      bildschirmtext: "Umsatzentwicklung",
    });
    const r = melde(m, "r11", "vorschlag", "Grundlage ergänzen");
    const sicht = m.klaeren("eigner", r.id, {
      dateiId: "sued-kopie",
      fassung: kopie.fassung,
      sldId: "257",
    });
    expect(sicht.aenderung).toMatchObject({
      status: "offen",
      ziel: { dateiId: "sued", fassung: l.sued.fassung, sldId: "257" },
    });
  });
});

describe("K10 · reales Format, Zuordnungsgrenze und dauerhafter Zustand", () => {
  it("liest PresentationML: sldId, Reihenfolge, Titel, versteckt, Notiz, Bestandteile", () => {
    expect(l.nord.folien.map((f) => [f.sldId, f.position, f.titel, f.versteckt])).toEqual([
      ["256", 1, "Quartal Nord", false],
      ["257", 2, "Umsatzentwicklung", false],
      ["258", 3, "Margenreserve", true],
    ]);
    expect(l.nord.folien.every((f) => f.vergleichbar)).toBe(true);
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
    expect(webvttLesen(VTT).slice(0, 2)).toEqual([
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
    ]);
  });

  it("weist Nicht-PPTX, Archive ohne Präsentation, Nicht-WebVTT und fremde Stellen ab", async () => {
    await expect(foliensatzLesen("x", new TextEncoder().encode("kein zip"))).rejects.toThrow(
      FoliensatzFehler,
    );
    const leer = new JSZip();
    leer.file("word/document.xml", "<w:document/>");
    await expect(
      foliensatzLesen("x", await leer.generateAsync({ type: "uint8array" })),
    ).rejects.toThrow(/presentation\.xml/);
    expect(() => webvttLesen("00:00:01.000 --> 00:00:02.000\nText")).toThrow(FoliensatzFehler);
    expect(() => melde(meeting(l), "gibt-es-nicht", "vorschlag", "x")).toThrow(BindungsFehler);
  });

  it("Bildschirmansicht allein ist kein Originaldateiadapter", () => {
    const m = leeresMeeting(l);
    m.folienwechsel("eigner", {
      quelle: "ocr",
      zeitMs: 0,
      zeitbasis: ZEITBASIS,
      bildschirmtext: "Umsatzentwicklung",
    });
    const r = melde(m, "r1", "beschlossene_korrektur", "Berechnungsgrundlage ergänzen");
    expect(r).toMatchObject({ status: "klaerung_noetig", kandidaten: [], folie: null });
    expect(r.aenderung).toMatchObject({ status: "wartet_auf_klaerung", ziel: null });
    expect(() => m.folienwechsel("eigner", host(l.nord, "257", 10))).toThrow(
      /nicht verbundene Fassung/,
    );
  });

  it("der gespeicherte Zustand ergibt nach dem Wiederherstellen dieselben Sichten", () => {
    const m = meeting(l);
    const r = melde(m, "r1", "vorschlag", "Berechnungsgrundlage ergänzen");
    const json = JSON.parse(JSON.stringify(m.zustand()));
    const wieder = MeetingDokumentbezug.ausZustand(json, l.pruefung);
    expect(wieder.sicht("leser", r.id)).toEqual(m.sicht("leser", r.id));
    expect(wieder.ausFolie("leser", "sued", "257").map((s) => s.id)).toEqual([r.id]);
    // Der Zustand ist eine Kopie: Änderungen daran wirken nicht zurück.
    json.meldungen[0].text = "verändert";
    expect(m.sicht("leser", r.id)?.text).toBe("Berechnungsgrundlage ergänzen");
  });
});
