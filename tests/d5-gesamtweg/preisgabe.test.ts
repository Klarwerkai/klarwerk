// ================================================================================================
// JOB 4304 · DIE PREISGABEPROBE WIRD SELBST KALIBRIERT — SONST IST SIE NUR EINE SCHÖNERE ZEILE.
// ================================================================================================
//
// Der Fachlauf `gesamtweg-pg-browser.integration.test.ts` ersetzt die alte Gleichheitsprobe
// (`.not.toBe(ORIGINALTEXT)`) durch diese Probe. Dass die neue Probe STRENGER ist als die alte, darf
// nicht geglaubt werden: genau dieser Sprung ist der Gegenstand von JOB 4304, und er wird hier an
// der Sache selbst gemessen — ohne Datenbank, ohne Browser, im Tor.
//
// DIE ZWEI FEHLERKLASSEN, beide ausdrücklich:
//   (a) die fachliche Wirkung fehlt  → ein Auszug/Dateiname kommt durch, die Probe muss ihn FINDEN.
//   (b) der Messweg fällt aus        → ein leeres Stück, ein zu kurzes Original: die Probe muss
//                                      WERFEN statt still alles (oder nichts) zu melden.
//
// Es entsteht dadurch keine zweite Testsammlung: dieselbe Mappe, derselbe Gegenstand, nur der Teil,
// der ohne Prüfplatz messbar ist. Der Fachlauf misst ihn danach am echten Weg.
import { describe, expect, it } from "vitest";

import { BILDNAME, bildBytes } from "./bildquelle";
import {
  type GesperrteQuelle,
  kennzeichenStuecke,
  originalStuecke,
  preisgabeImText,
  preisgabeInBytes,
  unerhalteneStuecke,
  verboteneStuecke,
} from "./preisgabe";

// DIESELBE LAGE WIE IM BESTAND DER KETTE, und die Überschneidung ist der Punkt: die Belegstelle ist
// ein ZITAT aus dem Original, hier wörtlich sein Ende (`kette.ts:234-240` tut genau das).
const ORIGINAL =
  "Betriebsanweisung XQ42, Abschnitt 4: Die Zylinderkopfdichtung XQ42 wird entlastet.";
const AUSZUG = "Die Zylinderkopfdichtung XQ42 wird entlastet.";
const QUELLE: GesperrteQuelle = {
  name: "betriebsanweisung-xq42.txt",
  titel: "Zylinderkopfdichtung XQ42 wechseln (JOB 4304)",
  auszug: AUSZUG,
  original: Buffer.from(ORIGINAL, "utf8"),
  bereitsErhalten: ["Betriebsanweisung XQ42 (Abschnitt 4)"],
};

/** Die Absage, die das Produkt heute wirklich schickt (`object-routes.ts:324`). */
const ABSAGE = JSON.stringify({ error: "NOT_FOUND", message: "Objekt nicht gefunden." });

function namen(stuecke: { was: string }[]): string[] {
  return stuecke.map((s) => s.was);
}

describe("JOB 4304 · P — die Preisgabeprobe misst, was die Gleichheitsprobe durchliess", () => {
  // ==============================================================================================
  // P1 · DER GRUND DIESES AUFTRAGS: die alte Probe bleibt grün, die neue wird rot.
  // ==============================================================================================
  it("P1 · ein Auszug besteht die alte Gleichheitsprobe und fällt durch die neue", () => {
    // Genau die Lage aus BENs Testvorschlag: ausgeliefert wird NUR ein geschützter Auszug.
    const auszug = ORIGINAL.slice(0, 40);
    // DIE ALTE PROBE, wörtlich wie in `…integration.test.ts:547-551` vor diesem Auftrag: grün.
    expect(auszug, "Kalibrierung: der Auszug ist nicht das vollständige Original").not.toBe(
      ORIGINAL,
    );
    // UND DIE NEUE. Sie findet ihn.
    const durch = namen(preisgabeImText(auszug, verboteneStuecke(QUELLE)));
    expect(durch.length, "die neue Probe übersieht den ausgelieferten Auszug").toBeGreaterThan(0);
    expect(durch.join(" · ")).toMatch(/Abschnitt des Originals/);
  });

  // ==============================================================================================
  // P1b · BENs GEMESSENE LÜCKE AUS RUNDE 2 — SECHZEHN BYTE.
  // ==============================================================================================
  //
  // Bis Runde 3 bildete `originalStuecke` drei feste Längen (Anfang, Mitte, Ende, je 32 Byte). BEN
  // hat die Lücke nicht vermutet, sondern gemessen: seine Produktmutation lieferte beim
  // Navigationsklick nach dem Entzug die ersten **16 Byte** aus — kürzer als jedes Stück, also von
  // keinem getroffen. G3 blieb grün und nannte den Download „ohne Originalinhalt".
  //
  // Dieser Fall hält die Lücke UND ihre Schliessung fest. Er wird rot, sobald jemand die
  // Fensterprobe wieder durch feste Längen ersetzt.
  it("P1b · ein 16-Byte-Auszug fällt durch — die Lücke, die BEN in Runde 2 gemessen hat", () => {
    const sechzehn = QUELLE.original.subarray(0, 16);
    expect(sechzehn.length, "Kalibrierung: genau die gemessene Länge").toBe(16);
    // Die abgelöste Bauform: drei feste 32-Byte-Stücke. KEINES davon steckt in 16 Byte — das ist
    // der Grund, aus dem die alte Probe grün blieb, hier als Rechnung statt als Behauptung.
    expect(
      sechzehn.length < 32,
      "Kalibrierung: 16 Byte sind kürzer als das kürzeste Stück der alten Bauform",
    ).toBe(true);
    // Und die Fensterprobe sieht ihn trotzdem.
    const durch = namen(preisgabeInBytes(sechzehn, verboteneStuecke(QUELLE)));
    expect(durch.length, "der 16-Byte-Auszug kommt weiterhin durch").toBeGreaterThan(0);
    expect(durch.join(" · ")).toMatch(/12-Byte-Abschnitt des Originals/);
  });

  it("P1d · ein VERSETZTER Auszug fällt ebenso — die alte Bauform suchte nur Anfang, Mitte, Ende", () => {
    // Die abgelöste Bauform kannte genau drei Stellen. Ein Auszug, der an keiner davon beginnt,
    // wäre durchgerutscht, auch wenn er lang genug gewesen wäre. Die Fensterprobe kennt jede Stelle.
    for (const ab of [7, 19, 30, 51]) {
      const versetzt = QUELLE.original.subarray(ab, ab + 16);
      expect(versetzt.length, `Kalibrierung: 16 Byte ab ${ab}`).toBe(16);
      expect(
        preisgabeInBytes(versetzt, verboteneStuecke(QUELLE)).length,
        `ein versetzter Auszug ab Byte ${ab} kommt durch`,
      ).toBeGreaterThan(0);
    }
  });

  it("P1c · die Grenze der Fensterprobe ist benannt: unter 12 Byte wird nicht mehr erkannt", () => {
    // EHRLICHKEIT STATT OPTIK: eine Probe, die auch vier Byte fände, wäre für jede deutsche Absage
    // rot. Diese Zeile schreibt die Grenze fest, statt sie zu verschweigen — und sie wird rot,
    // wenn jemand das Fenster verkleinert, ohne die Rückgabe nachzuziehen.
    const elf = QUELLE.original.subarray(0, 11);
    expect(preisgabeInBytes(elf, verboteneStuecke(QUELLE))).toEqual([]);
    const zwoelf = QUELLE.original.subarray(0, 12);
    expect(preisgabeInBytes(zwoelf, verboteneStuecke(QUELLE)).length).toBeGreaterThan(0);
  });

  it("P2 · der blosse Dateiname ist schon eine Preisgabe", () => {
    const antwort = JSON.stringify({ error: "NOT_FOUND", datei: QUELLE.name });
    expect(antwort, "Kalibrierung: der Dateiname allein ist nicht das Original").not.toBe(ORIGINAL);
    expect(namen(preisgabeImText(antwort, verboteneStuecke(QUELLE)))).toContain(
      "der Dateiname der gesperrten Quelle",
    );
  });

  it("P3 · der Titel der gesperrten Quelle ebenso", () => {
    expect(
      namen(preisgabeImText(`Kein Zugriff auf „${QUELLE.titel}".`, verboteneStuecke(QUELLE))),
    ).toContain("der Titel der gesperrten Quelle");
  });

  it("P4 · das Original in Base64 ist das Original", () => {
    const antwort = `{"data":"data:text/plain;base64,${QUELLE.original.toString("base64")}"}`;
    // Die Rohbyte-Probe allein bliebe hier grün — deshalb gibt es die Base64-Stücke.
    expect(
      namen(preisgabeInBytes(Buffer.from(antwort, "utf8"), originalStuecke(QUELLE))),
    ).toContain("das vollständige Original als Base64");
  });

  it("P5 · die echte Absage des Produkts geht durch — sonst wäre die Probe unbrauchbar streng", () => {
    expect(preisgabeImText(ABSAGE, verboteneStuecke(QUELLE))).toEqual([]);
    expect(preisgabeInBytes(Buffer.from(ABSAGE, "utf8"), verboteneStuecke(QUELLE))).toEqual([]);
  });

  // ==============================================================================================
  // P6 · DIE TRENNUNG, DIE LIEFERUNG 3 VERLANGT: Inhalt immer, Kennzeichen nur für Neues.
  // ==============================================================================================
  it("P6 · auf der schon ausgelieferten Seite darf der Titel stehen, nie Erhaltenes nie", () => {
    const alteSeite = `Antwort … ${QUELLE.titel} … ${QUELLE.auszug}`;
    // DER VOLLE MASSSTAB WÄRE HIER FALSCH: die Belegstelle IST das Ende des Originals, sie steht
    // berechtigt auf der Seite — und das Stück „das Ende des Originals" meldete deshalb eine
    // Preisgabe, wo keine ist. Diese Zeile hält fest, dass die Überschneidung wirklich besteht;
    // ohne sie wäre die Unterscheidung darunter eine Vorsichtsmassnahme gegen nichts.
    const voll = namen(preisgabeImText(alteSeite, originalStuecke(QUELLE)));
    expect(
      voll.length,
      "die Überschneidung Original/Belegstelle besteht nicht mehr — dann misst P6 nichts",
    ).toBeGreaterThan(0);
    // DER ENGERE MASSSTAB nimmt genau diese Abschnitte heraus und behält die anderen.
    const eng = namen(unerhalteneStuecke(QUELLE));
    for (const getroffen of voll) {
      expect(
        eng,
        `der engere Maßstab führt „${getroffen}" weiter — er lässt die Belegstelle nicht stehen`,
      ).not.toContain(getroffen);
    }
    expect(
      eng.length,
      "der engere Maßstab hat keine Stücke mehr — er misst nichts",
    ).toBeGreaterThan(3);
    expect(
      preisgabeImText(alteSeite, unerhalteneStuecke(QUELLE)),
      "auf der schon ausgelieferten Seite steht ein nie erhaltenes Stück des Originals",
    ).toEqual([]);
    // Und die Kennzeichen sind genau das, was dort stehen bleiben darf.
    expect(
      namen(preisgabeImText(alteSeite, kennzeichenStuecke(QUELLE))),
      "Titel und Auszug sind die Kennzeichen, die auf der ALTEN Seite stehen bleiben dürfen",
    ).toEqual(["der Titel der gesperrten Quelle", "der Belegauszug der gesperrten Quelle"]);
  });

  // ==============================================================================================
  // P7 · DAS BILD: derselbe Maßstab, nur ohne Buchstaben.
  // ==============================================================================================
  it("P7 · ein Byte-Bruchstück des Bildes fällt durch — die Absage nicht", () => {
    const bild: GesperrteQuelle = {
      name: BILDNAME,
      titel: "Prüfbild XQ42 (JOB 4304)",
      auszug: "Die Zylinderkopfdichtung XQ42 wird entlastet.",
      original: bildBytes(),
    };
    // Ein echtes Bruchstück: die letzten acht Byte fehlen (damit auch der IEND-Block). Länger als
    // das längste Auszugsstück, kürzer als das Bild — genau die Lage aus BENs Testvorschlag.
    const bruchstueck = bild.original.subarray(0, bild.original.length - 8);
    expect(
      bruchstueck.equals(bild.original),
      "Kalibrierung: das Bruchstück ist nicht das ganze Bild",
    ).toBe(false);
    expect(
      namen(preisgabeInBytes(bruchstueck, verboteneStuecke(bild))).length,
      "die Probe übersieht ein ausgeliefertes Byte-Bruchstück des Bildes",
    ).toBeGreaterThan(0);
    expect(preisgabeInBytes(Buffer.from(ABSAGE, "utf8"), verboteneStuecke(bild))).toEqual([]);
    expect(preisgabeImText(ABSAGE, verboteneStuecke(bild))).toEqual([]);
  });

  // ==============================================================================================
  // P9 · DIE MASKIERUNG — ein gemessener Befund, keine Vorsichtsmassnahme.
  // ==============================================================================================
  //
  // In der Gegenprobe (a) dieses Auftrags (Arbeitsprüfung de0aeb98…, Cloud-Lauf 188af203…) gab die
  // absichtlich preisgebende Sperre die ersten vierzig Byte des BILDES heraus — und G7 meldete
  // damals nur den Dateinamen. Der Rumpf kam als JSON an, die Bytes also maskiert
  // (`"auszug":"PNG\r\n\n …"`), und eine Suche nach den echten Bytes findet darin
  // nichts. Dieser Fall hält den Befund fest und die Reparatur ebenso.
  it("P9 · ein JSON-maskiertes Byte-Bruchstück ist trotzdem eine Preisgabe", () => {
    const bild: GesperrteQuelle = {
      name: BILDNAME,
      titel: "Prüfbild XQ42 (JOB 4304)",
      auszug: "Die Zylinderkopfdichtung XQ42 wird entlastet.",
      original: bildBytes(),
    };
    // Genau die Gestalt, in der es im Cloud-Lauf ankam: der Rumpf, wie ihn Fastify serialisiert.
    const rumpf = JSON.stringify({
      error: "NOT_FOUND",
      message: "Objekt nicht gefunden.",
      auszug: bild.original.subarray(0, 40).toString("latin1"),
    });
    // KALIBRIERUNG: unmaskiert stehen die Bytes wirklich NICHT darin — sonst prüfte dieser Fall
    // etwas anderes als die Maskierung.
    expect(
      rumpf.includes(bild.original.subarray(0, 24).toString("latin1")),
      "der Rumpf trägt die Bytes schon unmaskiert — dann misst P9 die Maskierung nicht",
    ).toBe(false);
    const durch = namen(preisgabeImText(rumpf, verboteneStuecke(bild)));
    expect(durch.length, "das maskierte Byte-Bruchstück des Bildes kommt durch").toBeGreaterThan(0);
    expect(durch.join(" · ")).toMatch(/Abschnitt des Originals/);
    // Und die echte Absage bleibt auch mit der Auflösung unbeanstandet.
    expect(preisgabeImText(ABSAGE, verboteneStuecke(bild))).toEqual([]);
  });

  // ==============================================================================================
  // P8 · FEHLERKLASSE (b): der MESSWEG fällt aus. Dann wird geworfen, nicht stillgehalten.
  // ==============================================================================================
  it("P8 · ein leeres Kennzeichen und ein zu kurzes Original werfen, statt still zu bestehen", () => {
    expect(() => kennzeichenStuecke({ ...QUELLE, name: "" })).toThrow(/LEERES Stück/);
    expect(() => kennzeichenStuecke({ ...QUELLE, titel: "" })).toThrow(/LEERES Stück/);
    expect(() => originalStuecke({ ...QUELLE, original: Buffer.from("kurz", "utf8") })).toThrow(
      /zu kurz/,
    );
    // Und der engere Maßstab, wenn er leerliefe: fiele wirklich JEDES Stück unter „schon erhalten",
    // prüfte er nichts mehr und müsste laut scheitern statt still grün zu sein.
    expect(() =>
      unerhalteneStuecke({
        ...QUELLE,
        auszug: ORIGINAL,
        bereitsErhalten: [Buffer.from(ORIGINAL, "utf8").toString("base64")],
      }),
    ).toThrow(/misst nichts mehr/);
    // Und die Gegenrichtung: mit leerem Namen wäre `includes("")` für JEDE Antwort wahr — die Probe
    // wäre dann immer rot und damit ebenso wertlos wie eine, die immer grün ist.
    expect("".length, "ein leerer Name ist kein Name").toBe(0);
  });
});
