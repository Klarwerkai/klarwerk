// ================================================================================================
// produkt:20261015:klara-powerpoint-datenherkunft (PP-02) · HOSTANSCHLUSS ÜBER A01 — DER SERVERWEG
// ================================================================================================
//
// `POST /api/kos/:id/office/:anhangId/folien-abgleich` nimmt die Präsentation, die PowerPoint für
// Mac oder im Web GERADE geöffnet hat (so, wie `getFileAsync` sie als .pptx liefert), liest sie mit
// demselben Leser wie den Anhang und prüft jede Bindung des Anhangs daran. Die Herkunft kommt
// unverändert aus den Sichten von PP-02.
//
//   H1  gleiche Datei: echte p:sldId/cNvPr-Kennungen der geöffneten Datei, jede Bindung „passt“;
//       manuelle, OCR- und berechnete Zahl sind unterscheidbar, alle Eingaben bis zur Quellzelle
//       erreichbar — dieselbe Sicht wie am Anhang.
//   H2  bearbeitete Datei: neue Folie vorn (Position ≠ Kennung), geänderte Zahl, gelöschtes
//       Textfeld → „passt“ über p:sldId, „abweichung“ mit dem heutigen Text, „element_fehlt“.
//       Gespeichert wird nichts; Anhang und Prüfstand bleiben unverändert.
//   H3  Tor und Eingang: ohne Anmeldung 401, BEVOR der Körper gelesen wird; Lesende dürfen;
//       unbekannter Anhang 404; fehlende, kaputte oder fremde Datei 400; zu groß 413.
//   Unabhängige Prüfung 0001–0006 (18.10.2026), Befunde B1, B3, B4:
//   H4  (B4) Sichtbarkeit: ein Datenpunkt mit für die Leserin verborgener Quelle fehlt in
//       `datenpunkte` UND `hostLagen`; ein unsichtbarer Artikel antwortet 404; die Autorin sieht beides.
//   H5  (B3) „passt“ nur an Zahlgrenzen: 1.200 T€ passt nicht in 11.200 T€, 12 % nicht in 112 %.
//   H6  (B1 a) gestreamte Entpackgrenze vor jedem Parser: Summe, Verhältnis, Zahl der Einträge.
//   H7  (B1 b, c) feindliche Folienteile: 64 000 offene <p:sp> ohne Blockade, dieselbe Folie 40-mal
//       genannt wird einmal gelesen, zu viele Folien werden abgewiesen.
//   H8  (B1 d) Takt je Nutzer und gleichzeitige Plätze; ein Platz wird nach jeder Antwort frei.
//   H9  (B1 e, f) die Antwort nennt je Folie nur Kennung, Stelle und Elemente (Kennung, Name); ein
//       ungültiger Körper kostet keinen Lesezugriff auf den gespeicherten Anhang.
//   H10 (B1 c) der lineare Leser liest Titel, Ausblendung und Folienkennungen wie W06.
//   Nachprüfung 0007 (18.10.2026), Punkte N1–N4:
//   H5  (N1) zusätzlich: ein Vorzeichen davor ist eine andere Zahl (300 T€ → −300 T€ ist Abweichung).
//   H11 (N2) Erfassen, Binden und Korrigieren prüfen wie vor 0007 (`stehtIn`): Einheit ohne
//       Leerzeichen, Fußnote als eigener Lauf, Zitat mitten im Wort — alles angenommen.
//   H12 (N3) der Platz wird erst nach dem Empfang belegt: ein langsamer Upload sperrt niemanden aus;
//       höchstens ein Platz je Nutzer.
//   H13 (N4) die Einträge werden im Zentralverzeichnis selbst gezählt: ein Endsatz, der lügt, ist
//       unlesbar bzw. zu groß — bevor jszip die Datei öffnet.
//
// NICHT belegt: PowerPoint selbst. Ob Office auf dem Mac und im Web genau diese Bytes liefert und
// das Fenster die Auswahl richtig zuordnet, zeigt erst der Hostlauf (Prüfoperator H01/H02).
import { PassThrough } from "node:stream";
import JSZip from "jszip";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  abgleichEinlass,
  zentralverzeichnisZaehlen,
} from "../../services/app/src/folien-abgleich-grenzen";
import { lesePraesentation } from "../../services/app/src/office-nachbearbeitung";
import {
  type Bindung,
  type Datenpunkt,
  MAX_FOLIEN,
  elementBefund,
  leseFolienDaten,
} from "../../services/app/src/praesentation-daten";
import { FOLIEN_ABGLEICH_KOERPER } from "../../services/app/src/routes/praesentation-daten-routes";
import {
  type Bestand,
  type Koerper,
  PPTX,
  type Welt,
  abgleichPfad,
  baueWelt,
  bestandAnlegen,
  deck,
  rufe,
} from "./pp02-hostwelt";

const b64 = (b: Buffer) => b.toString("base64");

const NS_P =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL_TYP = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const folienXml = (baum: string) =>
  `<p:sld ${NS_P}><p:cSld><p:spTree>${baum}</p:spTree></p:cSld></p:sld>`;

/** Eine selbst gebaute „Präsentation“ (wie die Sonden der Prüfung): Folienliste und Teile frei. */
async function eigenesDeck(sldIds: string, folien: Record<string, string>): Promise<Buffer> {
  const z = new JSZip();
  z.file(
    "ppt/presentation.xml",
    `<p:presentation ${NS_P}><p:sldIdLst>${sldIds}</p:sldIdLst></p:presentation>`,
  );
  const rels = Object.keys(folien)
    .map((pfad, i) => `<Relationship Id="rId${i + 2}" Type="${REL_TYP}/slide" Target="${pfad}"/>`)
    .join("");
  z.file("ppt/_rels/presentation.xml.rels", `<Relationships>${rels}</Relationships>`);
  for (const [pfad, xml] of Object.entries(folien)) {
    z.file(`ppt/${pfad}`, xml);
  }
  return z.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}

/**
 * Ohne den Prüfzeitpunkt einer Datenkontrolle (`kontrolle.gepruefAm`, PP-03): er ist je Abruf neu
 * und kein Inhalt der Herkunft. So bleiben die Gleichheitsproben auch nach der PP-03-Integration wahr.
 */
function ohneZeitpunkt(x: Koerper): Koerper {
  return JSON.parse(JSON.stringify(x), (k, v) => (k === "gepruefAm" ? undefined : v));
}

describe("PP-02 · Hostanschluss · Abgleich der geöffneten Präsentation", () => {
  let w: Welt;
  let s: Bestand;

  beforeAll(async () => {
    w = await baueWelt();
    s = await bestandAnlegen(w);
  });

  it("H1 · gleiche Datei: echte Kennungen, jede Bindung passt, Herkunft wie am Anhang", async () => {
    const r = await rufe(w, "vera", "POST", abgleichPfad(s), { datei: b64(await deck()) });
    expect(r.status).toBe(200);
    const a = r.body;
    expect(a.geoeffnet.gleicheDatei).toBe(true);
    expect(a.geoeffnet.fassung).toBe(a.dateiFassung);
    expect(a.geoeffnet.folien.map((f: Koerper) => [f.sldId, f.position])).toEqual([
      ["256", 1],
      ["257", 2],
    ]);
    // B1 (e): je Element nur Kennung und Name — keine Texte, Zellen oder Bildkennungen zurück.
    expect(a.geoeffnet.folien[0].elemente).toEqual([
      { shapeId: "2", name: "Titel 1" },
      { shapeId: "4", name: "Tabelle Kennzahlen" },
      { shapeId: "6", name: "Ergebnis" },
      { shapeId: "7", name: "Marktanteil" },
      { shapeId: "8", name: "Grafik Belegschaft" },
    ]);
    const lagen = a.hostLagen.map((l: Koerper) => [l.datenpunktId, l.shapeId, l.lage]);
    expect(lagen).toEqual(
      expect.arrayContaining([
        [s.ids.umsatz, "4", "passt"],
        [s.ids.kosten, "4", "passt"],
        [s.ids.ergebnis, "6", "passt"],
        [s.ids.marktanteil, "7", "passt"],
        [s.ids.belegschaft, "8", "passt"],
      ]),
    );
    expect(lagen).toHaveLength(5);

    // Dieselbe Herkunft wie am Anhang (folien-daten) — die Hostdatei ist nicht die Quelle.
    const amAnhang = await rufe(
      w,
      "vera",
      "GET",
      `/api/kos/${s.koId}/office/${s.anhangId}/folien-daten`,
    );
    expect(ohneZeitpunkt(a.datenpunkte)).toEqual(ohneZeitpunkt(amAnhang.body.datenpunkte));

    const sicht = (id: string) => a.datenpunkte.find((d: Koerper) => d.id === id);
    // Abnahme PP-02: manuell, OCR und berechnet sind unterscheidbar …
    expect(
      [s.ids.marktanteil, s.ids.belegschaft, s.ids.ergebnis].map((id) => sicht(id).erfassung),
    ).toEqual(["manuell", "ocr", "berechnet"]);
    expect(sicht(s.ids.marktanteil).fundstelle).toEqual({
      art: "eingabe",
      beleg: "Mündliche Auskunft Vertrieb (fiktiv)",
    });
    expect(sicht(s.ids.belegschaft).fundstelle).toMatchObject({
      art: "bild",
      sldId: "256",
      shapeId: "8",
      unsicher: true,
    });
    // … und die richtige Quelle samt aller tatsächlich verwendeten Eingaben ist erreichbar.
    const rw = sicht(s.ids.ergebnis).rechenweg;
    expect(rw.formel).toBe("1.500 T€ − 1.200 T€");
    expect(rw.eingaben.map((e: Koerper) => [e.lesbar, e.datenpunkt.wert])).toEqual([
      [true, "1.500 T€"],
      [true, "1.200 T€"],
    ]);
    expect(rw.eingaben[0].datenpunkt.fundstelle).toMatchObject({
      art: "tabellenzelle",
      zeile: 2,
      spalte: 3,
      zeilenkopf: "Umsatz",
      spaltenkopf: "Q4",
    });
    expect(rw.eingaben[0].datenpunkt.quelle).toMatchObject({
      lesbar: true,
      koId: s.koId,
      anhangId: s.anhangId,
      dateiFassung: a.dateiFassung,
    });
  });

  it("H2 · bearbeitete Datei: Kennung statt Position, Abweichung mit heutigem Text, fehlendes Element", async () => {
    const vorher = await rufe(w, "vera", "GET", `/api/datenpunkte/${s.ids.kosten}`);
    const offen = await deck({ kostenQ4: "1.250 T€", neueFolieVorn: true, ohneMarktanteil: true });
    const r = await rufe(w, "vera", "POST", abgleichPfad(s), { datei: b64(offen) });
    expect(r.status).toBe(200);
    const a = r.body;
    expect(a.geoeffnet.gleicheDatei).toBe(false);
    expect(a.geoeffnet.fassung).toBe((await leseFolienDaten(offen)).fassung);
    expect(a.geoeffnet.folien.map((f: Koerper) => [f.sldId, f.position])).toEqual([
      ["258", 1],
      ["256", 2],
      ["257", 3],
    ]);
    const lage = (id: string) => a.hostLagen.find((l: Koerper) => l.datenpunktId === id);
    expect(lage(s.ids.umsatz)).toMatchObject({
      sldId: "256",
      shapeId: "4",
      zeile: 2,
      lage: "passt",
    });
    expect(lage(s.ids.kosten)).toMatchObject({ lage: "abweichung", heute: "1.250 T€" });
    expect(lage(s.ids.ergebnis)).toMatchObject({ lage: "passt" });
    expect(lage(s.ids.marktanteil)).toEqual(
      expect.objectContaining({ shapeId: "7", lage: "element_fehlt" }),
    );
    expect(lage(s.ids.belegschaft)).toMatchObject({ lage: "passt" });

    // Nichts gespeichert: Datenpunkt und Bindung am Anhang sind unverändert.
    const nachher = await rufe(w, "vera", "GET", `/api/datenpunkte/${s.ids.kosten}`);
    expect(ohneZeitpunkt(nachher.body)).toEqual(ohneZeitpunkt(vorher.body));
    expect(nachher.body.bindungen[0].lage).toBe("aktuell");
  });

  it("H3 · Tor und Eingang", async () => {
    // Ohne Anmeldung endet die Anfrage vor dem Parsen: auch ein kaputter Körper ergibt 401.
    const anonym = await w.app.inject({
      method: "POST",
      url: abgleichPfad(s),
      headers: { "content-type": "application/json" },
      payload: "{kein json",
    });
    expect(anonym.statusCode).toBe(401);
    const mitKonto = await w.app.inject({
      method: "POST",
      url: abgleichPfad(s),
      headers: { "content-type": "application/json", "x-test-nutzer": "vera" },
      payload: "{kein json",
    });
    expect(mitKonto.statusCode).toBe(400);

    const unbekannt = await rufe(w, "vera", "POST", abgleichPfad({ koId: s.koId, anhangId: "x" }), {
      datei: b64(await deck()),
    });
    expect(unbekannt.status).toBe(404);
    const ohne = await rufe(w, "vera", "POST", abgleichPfad(s), {});
    expect([ohne.status, ohne.body.error]).toEqual([400, "INVALID"]);
    const keinBase64 = await rufe(w, "vera", "POST", abgleichPfad(s), { datei: "ä?!" });
    expect([keinBase64.status, keinBase64.body.error]).toEqual([400, "INVALID"]);
    const fremd = await rufe(w, "vera", "POST", abgleichPfad(s), {
      datei: b64(Buffer.from("kein Zip, keine Präsentation")),
    });
    expect([fremd.status, fremd.body.error]).toEqual([400, "KEINE_PRAESENTATION"]);

    const zuGross = await w.app.inject({
      method: "POST",
      url: abgleichPfad(s),
      headers: { "content-type": "application/json", "x-test-nutzer": "vera" },
      payload: JSON.stringify({ datei: "A".repeat(FOLIEN_ABGLEICH_KOERPER) }),
    });
    expect(zuGross.statusCode).toBe(413);
  });
});

describe("PP-02 · Hostanschluss · H4 Sichtbarkeit am Abgleich (Prüfbefund B4)", () => {
  let w: Welt;
  let s: Bestand;
  let geheim: { koId: string; anhangId: string };
  let geheimDp: string;

  beforeAll(async () => {
    w = await baueWelt();
    s = await bestandAnlegen(w);
    const bytes = await deck();
    const ref = await w.objekte.put({
      name: "Geheim-fiktiv.pptx",
      mime: PPTX,
      data: `data:${PPTX};base64,${b64(bytes)}`,
      purpose: "attachment",
    });
    const ko = await w.ko.create({
      title: "Vertrauliche Studie (fiktiv)",
      statement: "Vertrauliches Ergebnis: 300 T€ bei 40 Mio. Volumen (fiktiv).",
      type: "best_practice",
      category: "Testbestand",
      author: "anna",
    });
    await w.ko.setConfidentiality(ko.id, "vertraulich", "anna");
    const mit = await w.ko.addAttachment(ko.id, "anna", {
      name: "Geheim-fiktiv.pptx",
      mime: PPTX,
      objectId: ref.id,
      size: ref.size,
    });
    geheim = { koId: ko.id, anhangId: mit.attachments?.[0]?.id ?? "" };
    // Die Autorin bindet einen Datenpunkt mit VERTRAULICHER Quelle an Element 6 des sichtbaren Anhangs.
    const dp = await rufe(w, "anna", "POST", `/api/kos/${s.koId}/datenpunkte`, {
      art: "zahl",
      wert: "300 T€",
      erfassung: "direkt",
      quelleKoId: geheim.koId,
      zitat: "Vertrauliches Ergebnis: 300 T€ bei 40 Mio. Volumen (fiktiv).",
    });
    expect(dp.status, JSON.stringify(dp.body)).toBe(201);
    geheimDp = dp.body.id;
    const gebunden = await rufe(w, "anna", "POST", `/api/datenpunkte/${geheimDp}/bindungen`, {
      koId: s.koId,
      ort: { anhangId: s.anhangId, sldId: "256", shapeId: "6" },
    });
    expect(gebunden.status, JSON.stringify(gebunden.body)).toBe(200);
  });

  it("H4 · verborgene Quelle fehlt in datenpunkte und hostLagen; unsichtbarer Artikel 404; die Autorin sieht beides", async () => {
    const datei = b64(await deck());
    const vera = await rufe(w, "vera", "POST", abgleichPfad(s), { datei });
    expect(vera.status).toBe(200);
    expect(vera.body.datenpunkte.map((d: Koerper) => d.id)).not.toContain(geheimDp);
    expect(vera.body.hostLagen.map((l: Koerper) => l.datenpunktId)).not.toContain(geheimDp);
    expect(vera.body.hostLagen).toHaveLength(5);
    expect(JSON.stringify(vera.body)).not.toContain("40 Mio");
    const anna = await rufe(w, "anna", "POST", abgleichPfad(s), { datei });
    expect(anna.body.datenpunkte.map((d: Koerper) => d.id)).toContain(geheimDp);
    expect(anna.body.hostLagen.map((l: Koerper) => l.datenpunktId)).toContain(geheimDp);
    expect(anna.body.hostLagen).toHaveLength(6);
    // Unsichtbarer Artikel: 404 ohne Existenzauskunft — nicht 400 „keine lesbare Datei“.
    const unsichtbar = await rufe(w, "vera", "POST", abgleichPfad(geheim), { datei });
    expect([unsichtbar.status, unsichtbar.body.error]).toEqual([404, "NOT_FOUND"]);
    expect((await rufe(w, "anna", "POST", abgleichPfad(geheim), { datei })).status).toBe(200);
  });
});

describe("PP-02 · Hostanschluss · H5 Zahlgrenzen (Prüfbefund B3)", () => {
  it("H5 · 1.200 T€ passt nicht in 11.200 T€, 12 % nicht in 112 % — über die Route und am Befund", async () => {
    const w = await baueWelt();
    const s = await bestandAnlegen(w);
    const r = await rufe(w, "vera", "POST", abgleichPfad(s), {
      datei: b64(await deck({ kostenQ4: "11.200 T€" })),
    });
    expect(r.status).toBe(200);
    const lage = (id: string) => r.body.hostLagen.find((l: Koerper) => l.datenpunktId === id);
    expect(lage(s.ids.kosten)).toMatchObject({ lage: "abweichung", heute: "11.200 T€" });
    expect(lage(s.ids.umsatz)).toMatchObject({ lage: "passt" });

    const befund = (wert: string, heute: string) =>
      elementBefund(
        { wert, fundstelle: { art: "folienelement" } } as unknown as Datenpunkt,
        { sldId: "256", shapeId: "6" } as Bindung,
        {
          fassung: "x",
          folien: [
            {
              sldId: "256",
              position: 1,
              titel: "",
              ausgeblendet: false,
              elemente: [{ shapeId: "6", name: "Kosten", art: "text", text: heute }],
            },
          ],
        },
      ).lage;
    expect(befund("1.200 T€", "Kosten Q4: 1.200 T€")).toBe("passt");
    expect(befund("1.200 T€", "Kosten Q4: 21.200 T€")).toBe("abweichung");
    expect(befund("1.200 T€", "Kosten Q4: 1.200,5 T€")).toBe("abweichung");
    expect(befund("12 %", "Marktanteil: 112 %")).toBe("abweichung");
    expect(befund("12 %", "Marktanteil: 12 %.")).toBe("passt");
    expect(befund("300 T€", "Ergebnis (Q4): 300 T€")).toBe("passt");
    // Nachprüfung N1: ein Vorzeichen unmittelbar davor macht eine andere Zahl daraus.
    expect(befund("300 T€", "Ergebnis Q4: −300 T€")).toBe("abweichung");
    expect(befund("300 T€", "Ergebnis Q4: -300 T€")).toBe("abweichung");
    expect(befund("300 T€", "Ergebnis Q4: +300 T€")).toBe("abweichung");
    expect(befund("300 T€", "Ergebnis (−300 T€)")).toBe("abweichung");
    // … ein Bindestrich zwischen Buchstabe/Ziffer und Zahl ist kein Vorzeichen (wie `ZAHLTOKEN`).
    expect(befund("300 T€", "Ergebnis Q4-300 T€")).toBe("passt");
    // Buchstaben trennen eine Zahl (Einheit ohne Leerzeichen); eine Ziffer setzt sie fort — auch die
    // Fußnote, die als eigener Lauf direkt folgt („1.500“ + „1“ ⇒ „1.5001“): hier lieber Abweichung.
    expect(befund("1.500", "Umsatz 1.500T€")).toBe("passt");
    expect(befund("1.500", "1.5001")).toBe("abweichung");
    // Eine Aussage (keine einzelne Zahl) vergleicht wie bisher.
    expect(befund("Ergebnis über Plan", "Das Ergebnis über Planwert")).toBe("passt");
  });
});

describe("PP-02 · Hostanschluss · Grenzen des Abgleichs (Prüfbefund B1)", () => {
  const groesseFolie = () =>
    eigenesDeck('<p:sldId id="256" r:id="rId2"/>', {
      "slides/slide1.xml": folienXml(" ".repeat(1024 * 1024)),
    });

  it("H6 · gestreamte Entpackgrenze vor jedem Parser: Summe, Verhältnis, Zahl der Einträge", async () => {
    const w = await baueWelt({
      abgleichGrenzen: { entpacktMax: 512 * 1024, verhaeltnisMax: 5000 },
    });
    const s = await bestandAnlegen(w);
    const r1 = await rufe(w, "vera", "POST", abgleichPfad(s), { datei: b64(await groesseFolie()) });
    expect([r1.status, r1.body.error]).toEqual([413, "PAYLOAD_TOO_LARGE"]);
    expect(r1.body.message).toContain("entpackt zu groß");
    // Das echte Deck bleibt darunter und geht durch.
    expect(
      (await rufe(w, "vera", "POST", abgleichPfad(s), { datei: b64(await deck()) })).status,
    ).toBe(200);

    const v = await baueWelt({ abgleichGrenzen: { verhaeltnisMax: 20 } });
    const sv = await bestandAnlegen(v);
    const r2 = await rufe(v, "vera", "POST", abgleichPfad(sv), {
      datei: b64(await groesseFolie()),
    });
    expect([r2.status, r2.body.error]).toEqual([413, "PAYLOAD_TOO_LARGE"]);
    expect(r2.body.message).toContain("-fache");

    const e = await baueWelt({ abgleichGrenzen: { eintraegeMax: 3 } });
    const se = await bestandAnlegen(e);
    const r3 = await rufe(e, "vera", "POST", abgleichPfad(se), { datei: b64(await deck()) });
    expect([r3.status, r3.body.error]).toEqual([413, "PAYLOAD_TOO_LARGE"]);
    expect(r3.body.message).toContain("zu viele Teile");
  });

  it("H7 · feindliche Folienteile: offene <p:sp> ohne Blockade, dieselbe Folie 40-mal, zu viele Folien", async () => {
    // Der Fall der Prüfung: 64 000 öffnende <p:sp> ohne Schluss (vorher ≈ 9 s Blockade, 2 KB gepackt).
    const offen = await eigenesDeck('<p:sldId id="256" r:id="rId2"/>', {
      "slides/slide1.xml": folienXml("<p:sp>".repeat(64_000)),
    });
    // Mit den Vorgaben fällt er schon am Verhältnis (≈ 230:1) — vor jedem Parser.
    const vorgabe = await baueWelt();
    const sv = await bestandAnlegen(vorgabe);
    const amVerhaeltnis = await rufe(vorgabe, "vera", "POST", abgleichPfad(sv), {
      datei: b64(offen),
    });
    expect([amVerhaeltnis.status, amVerhaeltnis.body.error]).toEqual([413, "PAYLOAD_TOO_LARGE"]);
    // Der Leser selbst muss ihn auch ohne diese Grenze linear lesen: Verhältnis hier abgeschaltet.
    const w = await baueWelt({ abgleichGrenzen: { verhaeltnisMax: 1_000_000 } });
    const s = await bestandAnlegen(w);
    const t0 = performance.now();
    const ra = await rufe(w, "vera", "POST", abgleichPfad(s), { datei: b64(offen) });
    const dauer = performance.now() - t0;
    expect(ra.status).toBe(200);
    expect(ra.body.geoeffnet.folien).toEqual([{ sldId: "256", position: 1, elemente: [] }]);
    expect(dauer).toBeLessThan(3000);

    // 40 Einträge auf DIESELBE Folie mit ≈1 MiB Text: einmal gelesen, einmal geliefert.
    const lauf = `<a:r><a:t>${"300 T€ ".repeat(149_796)}</a:t></a:r>`;
    const textform = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Text"/></p:nvSpPr><p:txBody><a:p>${lauf}</a:p></p:txBody></p:sp>`;
    const vierzig = Array.from(
      { length: 40 },
      (_, i) => `<p:sldId id="${256 + i}" r:id="rId2"/>`,
    ).join("");
    const rb = await w.app.inject({
      method: "POST",
      url: abgleichPfad(s),
      headers: { "x-test-nutzer": "vera" },
      payload: {
        datei: b64(await eigenesDeck(vierzig, { "slides/slide1.xml": folienXml(textform) })),
      },
    });
    expect(rb.statusCode).toBe(200);
    expect(JSON.parse(rb.body).geoeffnet.folien).toEqual([
      { sldId: "256", position: 1, elemente: [{ shapeId: "2", name: "Text" }] },
    ]);
    expect(rb.body.length).toBeLessThan(200_000);

    // Mehr Einträge als MAX_FOLIEN: abgewiesen, mit Grund.
    const viele = Array.from(
      { length: MAX_FOLIEN + 1 },
      (_, i) => `<p:sldId id="${256 + i}" r:id="rId2"/>`,
    ).join("");
    const rc = await rufe(w, "vera", "POST", abgleichPfad(s), {
      datei: b64(await eigenesDeck(viele, { "slides/slide1.xml": folienXml("") })),
    });
    expect([rc.status, rc.body.error]).toEqual([400, "KEINE_PRAESENTATION"]);
    expect(rc.body.message).toContain(`höchstens ${MAX_FOLIEN}`);
  });

  it("H8 · Takt je Nutzer, gleichzeitige Plätze, der Platz wird nach jeder Antwort frei", async () => {
    const w = await baueWelt({ abgleichGrenzen: { proMinute: 3, gleichzeitig: 1 } });
    const s = await bestandAnlegen(w);
    const datei = b64(await deck());
    // Ein Platz: nacheinander geht jeder Abgleich durch — auch nach einem Fehler ist er wieder frei.
    expect((await rufe(w, "vera", "POST", abgleichPfad(s), { datei })).status).toBe(200);
    expect((await rufe(w, "vera", "POST", abgleichPfad(s), {})).status).toBe(400);
    expect((await rufe(w, "vera", "POST", abgleichPfad(s), { datei })).status).toBe(200);
    // Der vierte Abgleich in der Minute: 429 vor dem Körper.
    const vierter = await rufe(w, "vera", "POST", abgleichPfad(s), { datei });
    expect([vierter.status, vierter.body.error]).toEqual([429, "RATE_LIMITED"]);
    // Der Takt gilt je Nutzer.
    expect((await rufe(w, "anna", "POST", abgleichPfad(s), { datei })).status).toBe(200);

    const voll = await baueWelt({ abgleichGrenzen: { gleichzeitig: 0 } });
    const sv = await bestandAnlegen(voll);
    const besetzt = await rufe(voll, "vera", "POST", abgleichPfad(sv), { datei });
    expect([besetzt.status, besetzt.body.error]).toEqual([429, "ABGLEICH_BESCHAEFTIGT"]);

    // Der Platz selbst (Nachprüfung N3): atomar belegt, höchstens einer je Nutzer und zwei insgesamt,
    // je Halter freigegeben, verwaist nach der Frist frei.
    const e = abgleichEinlass({
      entpacktMax: 1,
      verhaeltnisMax: 1,
      eintraegeMax: 1,
      proMinute: 1,
      gleichzeitig: 2,
      gleichzeitigJeNutzer: 1,
    });
    const [a, b, c, d] = [{}, {}, {}, {}];
    expect(e.belege(a, "vera", 0)).toBe(true);
    expect(e.belege(b, "vera", 1)).toBe(false); // je Nutzer einer
    expect(e.belege(c, "anna", 2)).toBe(true);
    expect(e.belege(d, "otto", 3)).toBe(false); // insgesamt zwei
    e.gibFrei(a);
    expect(e.belege(b, "vera", 4)).toBe(true);
    expect(e.belegt()).toBe(2);
    expect(e.belege(d, "otto", 4 + 30_001)).toBe(true); // verwaiste Plätze nach 30 s frei
  });

  it("H9 · ein ungültiger Körper kostet keinen Lesezugriff auf den gespeicherten Anhang", async () => {
    const w = await baueWelt({ abgleichGrenzen: { entpacktMax: 512 * 1024 } });
    const s = await bestandAnlegen(w);
    const objectId = (await w.ko.get(s.koId))?.attachments?.[0]?.objectId;
    expect(objectId).toBeTruthy();
    const gelesen: string[] = [];
    const lesen = w.objekte.read.bind(w.objekte);
    w.objekte.read = async (id: string) => {
      gelesen.push(id);
      return lesen(id);
    };
    expect((await rufe(w, "vera", "POST", abgleichPfad(s), {})).status).toBe(400);
    expect(
      (await rufe(w, "vera", "POST", abgleichPfad(s), { datei: b64(Buffer.from("kein Zip")) }))
        .status,
    ).toBe(400);
    expect(
      (await rufe(w, "vera", "POST", abgleichPfad(s), { datei: b64(await groesseFolie()) })).status,
    ).toBe(413);
    expect(gelesen.filter((id) => id === objectId)).toEqual([]);
    // Erst ein lesbarer Körper führt zum Anhang (Fassungsvergleich und Herkunft).
    expect(
      (await rufe(w, "vera", "POST", abgleichPfad(s), { datei: b64(await deck()) })).status,
    ).toBe(200);
    expect(gelesen).toContain(objectId);
  });
});

describe("PP-02 · H10 der lineare Leser liest wie W06 (Prüfbefund B1)", () => {
  it("H10 · Titel, Ausblendung, Folienkennungen und Reihenfolge wie lesePraesentation; Zellen wie zuvor", async () => {
    const besondere = await eigenesDeck(
      '<p:sldId id="300" r:id="rId2"/><p:sldId id="301" r:id="rId3"/><p:sldId id="302" r:id="rId4"/>',
      {
        "slides/slide1.xml": folienXml(
          '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Titel"/><p:cNvSpPr/><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Haupt</a:t></a:r><a:r><a:t>titel &amp; mehr</a:t></a:r></a:p><a:p><a:r><a:t>Zeile 2</a:t></a:r></a:p></p:txBody></p:sp>',
        ),
        "slides/slide2.xml": `<p:sld ${NS_P} show="0"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="3" name="Text"/></p:nvSpPr><p:txBody><a:p/><a:p><a:r><a:t>  </a:t></a:r></a:p><a:p><a:r><a:t>Erster echter Absatz</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
        "slides/slide3.xml": folienXml(
          '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4" name="Tabelle"/></p:nvGraphicFramePr><a:graphic><a:graphicData><a:tbl><a:tr h="1"><a:tc><a:txBody><a:p><a:r><a:t>A</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>B</a:t></a:r></a:p><a:p><a:r><a:t>b</a:t></a:r></a:p></a:txBody></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>',
        ),
      },
    );
    const bearbeitet = await deck({
      kostenQ4: "1.250 T€",
      neueFolieVorn: true,
      ohneMarktanteil: true,
    });
    for (const bytes of [await deck(), bearbeitet, besondere]) {
      const neu = await leseFolienDaten(bytes);
      const w06 = await lesePraesentation(bytes);
      expect(neu.folien.map((f) => [f.sldId, f.position, f.titel, f.ausgeblendet])).toEqual(
        w06.folien.map((f) => [String(f.folieId), f.nummer, f.titel, f.ausgeblendet]),
      );
    }
    const b = await leseFolienDaten(besondere);
    expect(b.folien.map((f) => f.titel)).toEqual([
      "Haupttitel & mehr Zeile 2",
      "Erster echter Absatz",
      "A",
    ]);
    expect(b.folien.map((f) => f.ausgeblendet)).toEqual([false, true, false]);
    expect(b.folien[2]?.elemente[0]).toMatchObject({
      art: "tabelle",
      text: "A | B b",
      zellen: [
        { zeile: 1, spalte: 1, text: "A" },
        { zeile: 1, spalte: 2, text: "B b" },
      ],
    });
    // Das Prüfdeck: Elemente wie bisher (Text, Tabelle mit Zellen, Bild mit Inhaltskennung).
    const pruef = await leseFolienDaten(await deck());
    expect(pruef.folien[0]?.elemente.map((e) => [e.shapeId, e.art, e.text])).toEqual([
      ["2", "text", "Ergebnis Q4 2025"],
      [
        "4",
        "tabelle",
        "Kennzahl | Q3 | Q4\nUmsatz | 1.400 T€ | 1.500 T€\nKosten | 1.100 T€ | 1.200 T€",
      ],
      ["6", "text", "Ergebnis Q4: 300 T€"],
      ["7", "text", "Marktanteil: 12 %"],
      ["8", "bild", ""],
    ]);
  });
});

describe("PP-02 · Nachprüfung 0007 · N2–N4", () => {
  it("H11 · N2 Erfassen, Binden und Korrigieren prüfen wie vor 0007: Einheit ohne Leerzeichen, Fußnote, Zitat mitten im Wort", async () => {
    const w = await baueWelt();
    const lauf = (text: string, hoch = false) =>
      `<a:r>${hoch ? '<a:rPr baseline="30000"/>' : ""}<a:t>${text}</a:t></a:r>`;
    const form = (id: number, name: string, absatz: string) =>
      `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/></p:nvSpPr><p:txBody><a:p>${absatz}</a:p></p:txBody></p:sp>`;
    const bytes = await eigenesDeck('<p:sldId id="256" r:id="rId2"/>', {
      "slides/slide1.xml": folienXml(
        form(10, "Umsatz", lauf("Umsatz 1.500T€")) +
          form(11, "Fußnote", lauf("1.500") + lauf("1", true)),
      ),
    });
    const ref = await w.objekte.put({
      name: "N2-fiktiv.pptx",
      mime: PPTX,
      data: `data:${PPTX};base64,${b64(bytes)}`,
      purpose: "attachment",
    });
    const ko = await w.ko.create({
      title: "Marktbericht (fiktiv)",
      statement: "Das Marktvolumen 2025 lag bei 4,2 Mrd. € (fiktiv).",
      type: "best_practice",
      category: "Testbestand",
      author: "anna",
      confidentiality: "intern",
    });
    const mit = await w.ko.addAttachment(ko.id, "anna", {
      name: "N2-fiktiv.pptx",
      mime: PPTX,
      objectId: ref.id,
      size: ref.size,
    });
    const anhangId = mit.attachments?.[0]?.id ?? "";
    const ort = (shapeId: string) => ({ anhangId, sldId: "256", shapeId });
    const erfasse = (rumpf: Record<string, unknown>) =>
      rufe(w, "anna", "POST", `/api/kos/${ko.id}/datenpunkte`, rumpf);
    // Erfassen — Einheit ohne Leerzeichen, Fußnote als eigener Lauf, Zitat mitten im Wort.
    const einheit = await erfasse({
      art: "zahl",
      wert: "1.500",
      erfassung: "direkt",
      ort: ort("10"),
    });
    expect(einheit.status, JSON.stringify(einheit.body)).toBe(201);
    const fussnote = await erfasse({
      art: "zahl",
      wert: "1.500",
      erfassung: "direkt",
      ort: ort("11"),
    });
    expect(fussnote.status, JSON.stringify(fussnote.body)).toBe(201);
    const zitat = await erfasse({
      art: "zahl",
      wert: "4,2 Mrd. €",
      erfassung: "direkt",
      quelleKoId: ko.id,
      zitat: "arktvolumen 2025 lag bei 4,2 Mrd. €",
    });
    expect(zitat.status, JSON.stringify(zitat.body)).toBe(201);
    // Binden — dieselbe Zahl am Fußnoten-Element.
    const gebunden = await rufe(
      w,
      "anna",
      "POST",
      `/api/datenpunkte/${einheit.body.id}/bindungen`,
      {
        koId: ko.id,
        ort: ort("11"),
      },
    );
    expect(gebunden.status, JSON.stringify(gebunden.body)).toBe(200);
    // Korrigieren — „Quelle aktualisieren“ für Ort und Zitat findet beide unverändert.
    for (const dp of [einheit.body, zitat.body]) {
      const k = await rufe(w, "anna", "POST", `/api/datenpunkte/${dp.id}/korrektur`, {
        fassung: dp.fassung,
        grund: "Quelle neu gelesen (fiktiv)",
        quelleAktualisieren: true,
      });
      expect(k.status, JSON.stringify(k.body)).toBe(200);
    }
    // Die LAGE (elementBefund) nutzt die Zahlgrenze: Einheit ohne Leerzeichen passt, die Fußnote
    // ergibt „1.5001“ und erscheint ehrlich als Abweichung mit dem heutigen Text.
    const sicht = await rufe(w, "anna", "GET", `/api/datenpunkte/${einheit.body.id}`);
    expect(sicht.body.bindungen.map((b: Koerper) => [b.shapeId, b.lage, b.heute ?? null])).toEqual([
      ["10", "aktuell", null],
      ["11", "abweichung", "1.5001"],
    ]);
  });

  it("H12 · N3 der Platz wird erst nach dem Empfang belegt — ein langsamer Upload sperrt niemanden aus", async () => {
    const w = await baueWelt({ abgleichGrenzen: { gleichzeitig: 1 } });
    const s = await bestandAnlegen(w);
    const datei = b64(await deck());
    const strom = new PassThrough();
    const langsam = w.app.inject({
      method: "POST",
      url: abgleichPfad(s),
      headers: { "x-test-nutzer": "vera", "content-type": "application/json" },
      payload: strom,
    });
    strom.write('{"datei":"');
    await new Promise((weiter) => setTimeout(weiter, 50));
    // Während veras Körper noch unterwegs ist, gleicht anna ab — der einzige Platz ist frei.
    const anna = await rufe(w, "anna", "POST", abgleichPfad(s), { datei });
    expect([anna.status, anna.body.error]).toEqual([200, undefined]);
    strom.end(`${datei}"}`);
    const vera = await langsam;
    expect(vera.statusCode).toBe(200);
  });

  it("H13 · N4 die Einträge werden im Zentralverzeichnis selbst gezählt — ein lügender Endsatz", async () => {
    const echt = await deck();
    const ende = echt.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const gezaehlt = zentralverzeichnisZaehlen(echt, 20_000);
    expect(gezaehlt).toEqual({ art: "ok", eintraege: echt.readUInt16LE(ende + 10) });
    // Der Endsatz behauptet EINEN Eintrag; das Verzeichnis hat mehr.
    const luege = Buffer.from(echt);
    luege.writeUInt16LE(1, ende + 8);
    luege.writeUInt16LE(1, ende + 10);
    expect(zentralverzeichnisZaehlen(luege, 20_000)).toMatchObject({ art: "widerspruch", laut: 1 });
    expect(zentralverzeichnisZaehlen(luege, 3)).toEqual({ art: "zu_viele", gezaehlt: 4 });

    const geoeffnet = vi.spyOn(JSZip, "loadAsync");
    try {
      const w = await baueWelt();
      const s = await bestandAnlegen(w);
      geoeffnet.mockClear();
      const r1 = await rufe(w, "vera", "POST", abgleichPfad(s), { datei: b64(luege) });
      expect([r1.status, r1.body.error]).toEqual([400, "KEINE_PRAESENTATION"]);
      expect(r1.body.message).toContain("widersprüchlich");
      const e = await baueWelt({ abgleichGrenzen: { eintraegeMax: 3 } });
      const se = await bestandAnlegen(e);
      geoeffnet.mockClear();
      const r2 = await rufe(e, "vera", "POST", abgleichPfad(se), { datei: b64(luege) });
      expect([r2.status, r2.body.error]).toEqual([413, "PAYLOAD_TOO_LARGE"]);
      // Beide abgewiesen, BEVOR jszip die Datei geöffnet hat.
      expect(geoeffnet).not.toHaveBeenCalled();
    } finally {
      geoeffnet.mockRestore();
    }
  });
});
