// ================================================================================================
// WORD-HOST-GESAMTWEG · KRITERIUM 3 — DER SOLLVERGLEICH NACH SPEICHERN, SCHLIESSEN, WIEDERÖFFNEN.
// ================================================================================================
//
// Gemessen wird `tools/word-host-wiederoeffnen.ts` an echten DOCX-Dateien aus dem vorhandenen
// Baukasten (`tests/m5-docx-bildunterschriften/docx-bauen.ts`) und den vorhandenen Prüfbildern
// (`tests/rueckweg-bilder-nutzerweg/pruefbilder.ts`). Jede Gegenprobe verändert GENAU EINE Sache,
// die ein Wiederöffnen still verlieren könnte — Text, Fettdruck, Tabelle, Bildbytes, Bildpunkte,
// Zuordnung, Doppelübertragung, Herkunft, Dokumentkennung — und der Vergleich muss sie benennen.
// Die Bedienung im echten Word Web bzw. Word für Mac ersetzt diese Datei NICHT.
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { afterAll, describe, expect, it } from "vitest";
import {
  type DocxInhalt,
  PRUEF_FETT,
  PRUEF_FETT_NACH,
  PRUEF_FETT_VOR,
  PRUEF_TABELLE,
  PRUEF_UEBERSCHRIFT,
  PRUEF_UNTERSCHRIFTEN,
  type Sollpaket,
  aenderungssatz,
  bildpunktSha256,
  liesDocx,
  pruefdokumentAbsaetze,
  sollpaket,
  vergleichAusAufruf,
  vergleicheAnleitung,
  vergleicheBild,
  vergleicheDocx,
  vergleicheObjekt,
} from "../../tools/word-host-wiederoeffnen";
import { type Absatz, baueDocx } from "../m5-docx-bildunterschriften/docx-bauen";
import {
  FIXTUREN,
  type Pruefbild,
  erwartetePunkteRGBA,
  rohzeilen,
} from "../rueckweg-bilder-nutzerweg/pruefbilder";
import { repoPfad } from "../support/repoPfad";

const PNGS = FIXTUREN.map((f) => f.png);
const BILD1 = PNGS[0] as Buffer;
const BILD2 = PNGS[1] as Buffer;
const WEB = sollpaket("Word Web", PNGS);
const MAC = sollpaket("Word Mac", PNGS);

/** Das Prüfdokument, wie es nach Bearbeiten, Speichern und Wiederöffnen aussehen MUSS. */
function nachDemLauf(soll: Sollpaket, bilder: readonly Buffer[] = PNGS): Absatz[] {
  return [...pruefdokumentAbsaetze(bilder), { art: "text", text: soll.aenderung }];
}

async function gelesen(absaetze: readonly Absatz[]): Promise<DocxInhalt> {
  return liesDocx((await baueDocx(absaetze)).bytes);
}

function felder(urteil: { befunde: readonly { feld: string }[] }): string[] {
  return urteil.befunde.map((b) => b.feld);
}

// --- PNG-Varianten derselben Prüfbilder (wie sie ein Host beim Speichern erzeugen könnte) -------

function crc32(daten: Buffer): number {
  let c = 0xffffffff;
  for (const byte of daten) {
    c ^= byte;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function block(typ: string, daten: Buffer): Buffer {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length, 0);
  const kopf = Buffer.from(typ, "ascii");
  const summe = Buffer.alloc(4);
  summe.writeUInt32BE(crc32(Buffer.concat([kopf, daten])), 0);
  return Buffer.concat([laenge, kopf, daten, summe]);
}

function pruefbild(nr: 0 | 1): Pruefbild {
  const bild = FIXTUREN[nr]?.bild;
  if (bild === undefined) {
    throw new Error(`Prüfbild ${nr + 1} fehlt`);
  }
  return bild;
}

/** Ein 8-Bit-RGB-PNG aus Rohzeilen, mit wählbarer Kompressionsstufe. */
function pngAus(bild: Pruefbild, roh: Buffer, stufe: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(bild.breite, 0);
  ihdr.writeUInt32BE(bild.hoehe, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(2, 9);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    block("IHDR", ihdr),
    block("IDAT", deflateSync(roh, { level: stufe })),
    block("IEND", Buffer.alloc(0)),
  ]);
}

/** Dieselben Bildpunkte, anders komprimiert — andere Bytes, gleiches Bild. */
function neuVerpackt(nr: 0 | 1): Buffer {
  const bild = pruefbild(nr);
  return pngAus(bild, rohzeilen(bild), 0);
}

/** Ein einziger Bildpunkt anders — dieselbe Größe, dasselbe Format. */
function einPunktAnders(nr: 0 | 1): Buffer {
  const bild = pruefbild(nr);
  const roh = rohzeilen(bild);
  roh.writeUInt8((roh.readUInt8(1) + 1) & 0xff, 1);
  return pngAus(bild, roh, 9);
}

describe("Kriterium 3 · das Sollpaket steht vorher fest und stammt nicht aus dem geprüften System", () => {
  it("S1 · Bildpunktprüfsumme = die Rechenregel der Prüfbilder (unabhängige Gegenrechnung)", () => {
    FIXTUREN.forEach((f, i) => {
      const rgba = erwartetePunkteRGBA(f.bild);
      const rgb = Buffer.from(rgba.filter((_, j) => j % 4 !== 3));
      const erwartet = createHash("sha256").update(rgb).digest("hex");
      expect(bildpunktSha256(f.png), `Bild ${i + 1}`).toBe(erwartet);
      expect(WEB.bilder[i]?.sha256Rgb).toBe(erwartet);
      expect(WEB.bilder[i]?.sha256Png).toBe(f.sha256Png);
    });
  });

  it("S2 · Web und Mac haben getrennte Sollpakete — der Änderungssatz nennt den Host", () => {
    expect(WEB.aenderung).toBe(aenderungssatz("Word Web"));
    expect(MAC.aenderung).toBe(aenderungssatz("Word Mac"));
    expect(WEB.aenderung).not.toBe(MAC.aenderung);
    expect(WEB.bilder.map((b) => b.unterschrift)).toEqual(PRUEF_UNTERSCHRIFTEN);
    expect(WEB.tabelle).toEqual(PRUEF_TABELLE);
  });
});

describe("Kriterium 3 · die wieder geöffnete DOCX gegen das Soll", () => {
  it("D1 · vollständig erhalten — gleich", async () => {
    const urteil = vergleicheDocx(WEB, await gelesen(nachDemLauf(WEB)));
    expect(urteil.befunde).toEqual([]);
    expect(urteil.gleich).toBe(true);
    expect(urteil.host).toBe("Word Web");
  });

  it("D2 · Änderung nicht gespeichert — der Änderungssatz fehlt", async () => {
    const urteil = vergleicheDocx(WEB, await gelesen(pruefdokumentAbsaetze(PNGS)));
    expect(felder(urteil)).toEqual(["absatz[4]"]);
  });

  it("D3 · ein Mac-Ergebnis besteht den Web-Vergleich nicht (und umgekehrt)", async () => {
    const mac = await gelesen(nachDemLauf(MAC));
    expect(vergleicheDocx(WEB, mac).gleich).toBe(false);
    expect(vergleicheDocx(MAC, mac).gleich).toBe(true);
  });

  it("D4 · ein Bild verloren — benannt", async () => {
    const absaetze = nachDemLauf(WEB).filter((a, i) => !(a.art === "bild" && i > 3));
    const urteil = vergleicheDocx(WEB, await gelesen(absaetze));
    expect(felder(urteil)).toContain("bilder");
  });

  it("D5 · Bilder vertauscht — die Bildprüfsummen schlagen an", async () => {
    const urteil = vergleicheDocx(WEB, await gelesen(nachDemLauf(WEB, [BILD2, BILD1])));
    expect(felder(urteil)).toEqual(expect.arrayContaining(["bild[0]", "bild[1]"]));
  });

  it("D6 · Unterschriften vertauscht — die Zuordnung schlägt an", async () => {
    const absaetze = nachDemLauf(WEB).map((a): Absatz => {
      if (a.art !== "beschriftung") {
        return a;
      }
      const andere = PRUEF_UNTERSCHRIFTEN.find((u) => u !== a.text) ?? a.text;
      return { art: "beschriftung", text: andere };
    });
    const urteil = vergleicheDocx(WEB, await gelesen(absaetze));
    expect(felder(urteil)).toEqual(expect.arrayContaining(["zuordnung[0]", "zuordnung[1]"]));
  });

  it("D7 · neu verpacktes, bildpunktgleiches PNG gilt als erhalten", async () => {
    const anders = [neuVerpackt(0), neuVerpackt(1)];
    expect(anders[0]?.equals(BILD1)).toBe(false);
    const urteil = vergleicheDocx(WEB, await gelesen(nachDemLauf(WEB, anders)));
    expect(urteil.befunde).toEqual([]);
  });

  it("D8 · ein einziger veränderter Bildpunkt wird erkannt", async () => {
    const bilder = [einPunktAnders(0), BILD2];
    const urteil = vergleicheDocx(WEB, await gelesen(nachDemLauf(WEB, bilder)));
    expect(felder(urteil)).toEqual(["bild[0]"]);
  });

  it("D9 · Tabellenzeile verloren — benannt", async () => {
    const gekuerzt = PRUEF_TABELLE.slice(0, 2);
    const absaetze = nachDemLauf(WEB).map((a): Absatz => {
      return a.art === "tabelle" ? { art: "tabelle", zeilen: gekuerzt } : a;
    });
    expect(felder(vergleicheDocx(WEB, await gelesen(absaetze)))).toEqual(["tabelle"]);
  });

  it("D10 · Fettdruck verloren — benannt", async () => {
    const absaetze = nachDemLauf(WEB).map((a): Absatz => {
      if (a.art !== "absatz") {
        return a;
      }
      return { art: "absatz", laeufe: a.laeufe.map((l) => ({ text: l.text })) };
    });
    expect(felder(vergleicheDocx(WEB, await gelesen(absaetze)))).toEqual(["fett"]);
  });

  it("D11 · Doppelübertragung — Änderungssatz und Bild zweimal", async () => {
    const doppelt: Absatz[] = [
      ...nachDemLauf(WEB),
      { art: "text", text: WEB.aenderung },
      { art: "bild", png: BILD1.toString("base64") },
    ];
    const urteil = vergleicheDocx(WEB, await gelesen(doppelt));
    expect(felder(urteil)).toEqual(expect.arrayContaining(["aenderung", "bilder"]));
  });
});

function datenquelle(png: Buffer): string {
  return `data:image/png;base64,${png.toString("base64")}`;
}

function figur(src: string, i: number): string {
  const unterschrift = PRUEF_UNTERSCHRIFTEN[i] ?? "";
  return `<figure><img src="${src}"><figcaption>${unterschrift}</figcaption></figure>`;
}

function reihe(zellen: readonly string[]): string {
  return `<tr>${zellen.map((z) => `<td>${z}</td>`).join("")}</tr>`;
}

const UEBERSCHRIFT_HTML = `<h1>${PRUEF_UEBERSCHRIFT}</h1>`;
const FETT_HTML = `<p>${PRUEF_FETT_VOR}<strong>${PRUEF_FETT}</strong>${PRUEF_FETT_NACH}</p>`;
const TABELLE_HTML = `<table>${PRUEF_TABELLE.map(reihe).join("")}</table>`;
const AENDERUNG_HTML = `<p>${WEB.aenderung}</p>`;

interface Eintragsteil {
  origin?: string;
  dokumentId?: string;
  bilder?: string[];
  /** Ersetzt den ganzen Rumpf — für die Strukturgegenfälle. */
  html?: string;
}

/** Der KLARWERK-Eintrag, wie der Import ihn aus dem Prüfdokument macht (Entwurfsform). */
function eintrag(teil: Eintragsteil = {}) {
  const bilder = teil.bilder ?? PNGS.map(datenquelle);
  const figuren = bilder.map(figur).join("");
  const html = teil.html ?? [UEBERSCHRIFT_HTML, FETT_HTML, TABELLE_HTML, figuren, AENDERUNG_HTML];
  return {
    id: "entwurf-1",
    dokumentHerkunft: { dokumentId: teil.dokumentId ?? "dok-1", fassung: 1, fassungId: "f-1" },
    payload: {
      origin: teil.origin ?? "word_addin",
      bodyHtml: Array.isArray(html) ? html.join("") : html,
    },
  };
}

/** Die vor dem Lauf notierte Erwartung: Entwurfskennung und Dokumentkennung. */
const ERWARTUNG = { objektId: "entwurf-1", dokumentId: "dok-1" };

function rumpfFelder(html: string): string[] {
  return felder(vergleicheObjekt(WEB, eintrag({ html }), ERWARTUNG));
}

const FIGUREN = PNGS.map(datenquelle).map(figur).join("");

describe("Kriterium 3 · der KLARWERK-Eintrag gegen dasselbe Soll (Inhalt, Bilder, Zuordnung, Quelle)", () => {
  it("O1 · vollständig — gleich, mit erwarteter Kennung", () => {
    const urteil = vergleicheObjekt(WEB, eintrag(), ERWARTUNG);
    expect(urteil.befunde).toEqual([]);
  });

  it("O2 · falsche Herkunft und fremde Dokumentkennung sind Quellenbefunde", () => {
    const herkunft = vergleicheObjekt(WEB, eintrag({ origin: "frontdoor" }), ERWARTUNG);
    expect(felder(herkunft)).toEqual(["quelle.origin"]);
    const fremd = vergleicheObjekt(WEB, eintrag({ dokumentId: "dok-2" }), ERWARTUNG);
    expect(felder(fremd)).toEqual(["quelle.dokumentHerkunft"]);
  });

  it("O3 · ein anderer Eintrag (Dublette) wird an der Kennung erkannt", () => {
    const andere = { ...ERWARTUNG, objektId: "entwurf-2" };
    expect(felder(vergleicheObjekt(WEB, eintrag(), andere))).toEqual(["id"]);
  });

  it("O4 · Bild im Eintrag verändert — benannt; Bild nur als Adresse — offen, nicht bestanden", () => {
    const erstes = datenquelle(BILD1);
    const zweitesAnders = datenquelle(einPunktAnders(1));
    const bilder = [erstes, zweitesAnders];
    const veraendert = vergleicheObjekt(WEB, eintrag({ bilder }), ERWARTUNG);
    expect(felder(veraendert)).toEqual(["bild[1]"]);
    const nurAdresse = [erstes, "/api/assets/bild-2"];
    const adresse = vergleicheObjekt(WEB, eintrag({ bilder: nurAdresse }), ERWARTUNG);
    expect(adresse.gleich).toBe(false);
    expect(adresse.befunde.map((b) => [b.feld, b.lage])).toEqual([["bild[1]", "offen"]]);
  });

  it("O5 · Unterschriften im Eintrag vertauscht — Reihenfolge und Zuordnung schlagen an", () => {
    const vertauscht = eintrag({ bilder: [datenquelle(BILD1), datenquelle(BILD2)] });
    vertauscht.payload.bodyHtml = vertauscht.payload.bodyHtml
      .replace(PRUEF_UNTERSCHRIFTEN[0] ?? "", "§")
      .replace(PRUEF_UNTERSCHRIFTEN[1] ?? "", PRUEF_UNTERSCHRIFTEN[0] ?? "")
      .replace("§", PRUEF_UNTERSCHRIFTEN[1] ?? "");
    const urteil = vergleicheObjekt(WEB, vertauscht, ERWARTUNG);
    expect(felder(urteil)).toEqual(["absatz[3]", "zuordnung"]);
  });

  it("O6 · ein einzeln heruntergeladenes Bild lässt sich gegen das Soll prüfen", () => {
    expect(vergleicheBild(WEB, 2, BILD2).gleich).toBe(true);
    expect(vergleicheBild(WEB, 2, neuVerpackt(1)).gleich).toBe(true);
    expect(vergleicheBild(WEB, 2, BILD1).gleich).toBe(false);
  });
});

describe("Kriterien 3/7 · Strukturverlust im KLARWERK-Eintrag — je ein isolierter Gegenfall", () => {
  it("O7 · Tabellenstruktur aufgelöst, alle Zellentexte stehen noch da — benannt", () => {
    const zellen = `<p>${PRUEF_TABELLE.flat().join(" ")}</p>`;
    const html = [UEBERSCHRIFT_HTML, FETT_HTML, zellen, FIGUREN, AENDERUNG_HTML].join("");
    expect(rumpfFelder(html)).toEqual(["tabelle"]);
  });

  it("O8 · Zellen in einer Zeile vertauscht — benannt", () => {
    const zeilen = [PRUEF_TABELLE[0] ?? [], ["0 bar", "Druck"], PRUEF_TABELLE[2] ?? []];
    const tabelle = `<table>${zeilen.map(reihe).join("")}</table>`;
    const html = [UEBERSCHRIFT_HTML, FETT_HTML, tabelle, FIGUREN, AENDERUNG_HTML].join("");
    expect(rumpfFelder(html)).toEqual(["tabelle"]);
  });

  it("O9 · Fettdruck verloren, Text unverändert — benannt", () => {
    const ohneFett = `<p>${PRUEF_FETT_VOR}${PRUEF_FETT}${PRUEF_FETT_NACH}</p>`;
    const html = [UEBERSCHRIFT_HTML, ohneFett, TABELLE_HTML, FIGUREN, AENDERUNG_HTML].join("");
    expect(rumpfFelder(html)).toEqual(["fett"]);
  });

  it("O10 · ein Absatz doppelt — benannt", () => {
    const html = [UEBERSCHRIFT_HTML, FETT_HTML, FETT_HTML, TABELLE_HTML, FIGUREN, AENDERUNG_HTML];
    expect(rumpfFelder(html.join(""))).toEqual(["doppelt[1]"]);
  });

  it("O11 · Absatzreihenfolge vertauscht — benannt", () => {
    const html = [AENDERUNG_HTML, UEBERSCHRIFT_HTML, FETT_HTML, TABELLE_HTML, FIGUREN].join("");
    expect(rumpfFelder(html)).toEqual(["absatz[4]"]);
  });

  it("O12 · ohne figcaption (Word-Weg) zählt der Textblock nach dem Bild als Unterschrift", () => {
    const [eins = "", zwei = ""] = PNGS.map(datenquelle);
    const [u1 = "", u2 = ""] = PRUEF_UNTERSCHRIFTEN;
    const bloecke = (a: string, b: string): string =>
      `<p><img src="${eins}"></p><p>${a}</p><p><img src="${zwei}"></p><p>${b}</p>`;
    const vorne = [UEBERSCHRIFT_HTML, FETT_HTML, TABELLE_HTML];
    expect(rumpfFelder([...vorne, bloecke(u1, u2), AENDERUNG_HTML].join(""))).toEqual([]);
    const vertauscht = [...vorne, bloecke(u2, u1), AENDERUNG_HTML].join("");
    expect(rumpfFelder(vertauscht)).toEqual(["absatz[3]", "zuordnung"]);
  });
});

describe("Kriterium 3 · der tatsächlich dokumentierte Aufruf `vergleiche-objekt`", () => {
  const ordner = mkdtempSync(join(tmpdir(), "word-host-wiederoeffnen-"));
  const sollDatei = join(ordner, "soll-web.json");
  const fremdDatei = join(ordner, "entwurf-fremd.json");
  const eigenDatei = join(ordner, "entwurf-eigen.json");
  writeFileSync(sollDatei, JSON.stringify(WEB));
  writeFileSync(fremdDatei, JSON.stringify(eintrag({ dokumentId: "dok-fremd" })));
  writeFileSync(eigenDatei, JSON.stringify(eintrag()));

  afterAll(() => {
    rmSync(ordner, { recursive: true, force: true });
  });

  it("C1 · fremde, nicht leere Dokumentkennung besteht den Aufruf nicht", async () => {
    const aufruf = ["vergleiche-objekt", sollDatei, fremdDatei, "entwurf-1", "dok-1"];
    const urteil = await vergleichAusAufruf(aufruf);
    expect(urteil?.gleich).toBe(false);
    expect(urteil === null ? [] : felder(urteil)).toEqual(["quelle.dokumentHerkunft"]);
  });

  it("C2 · mit der notierten Dokumentkennung besteht derselbe Aufruf", async () => {
    const aufruf = ["vergleiche-objekt", sollDatei, eigenDatei, "entwurf-1", "dok-1"];
    expect((await vergleichAusAufruf(aufruf))?.gleich).toBe(true);
  });

  it("C3 · ohne Dokumentkennung gibt es kein Urteil — nur die Gebrauchsanweisung", async () => {
    const ohne = ["vergleiche-objekt", sollDatei, fremdDatei, "entwurf-1"];
    expect(await vergleichAusAufruf(ohne)).toBeNull();
  });
});

/** Der Solltext, den die Person VOR dem Lauf schreibt — eine Zeile je Schritt. */
const SOLL_ANLEITUNG = "Ventil schließen\n\nDruck ablassen\nDichtung tauschen\n";

function anleitung(teil: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "ko-anleitung-1",
    version: 4,
    status: "validiert",
    statement: "Ventil warten in drei Schritten.",
    bodyHtml: "<ol><li>Ventil schließen</li><li>Druck ablassen</li><li>Dichtung tauschen</li></ol>",
    ...teil,
  };
}

describe("Ergänzung 4 · die zurückgegebene Anleitung gegen den vorab geschriebenen Solltext", () => {
  const erwartung = { objektId: "ko-anleitung-1", fassung: 4 };

  it("E1 · dieselbe Kennung, neue Fassung, freigegeben, alle Sollzeilen in Reihenfolge — gleich", () => {
    const urteil = vergleicheAnleitung(SOLL_ANLEITUNG, anleitung(), erwartung);
    expect(urteil.befunde).toEqual([]);
    expect(urteil.host).toBe("Word Web");
  });

  it("E2 · andere Kennung, alte Fassung, nicht freigegeben — je ein Befund", () => {
    const urteil = vergleicheAnleitung(
      SOLL_ANLEITUNG,
      anleitung({ id: "ko-anleitung-2", version: 3, status: "offen" }),
      erwartung,
    );
    expect(felder(urteil)).toEqual(["id", "version", "status"]);
  });

  it("E3 · eine Zeile verloren oder vertauscht — benannt", () => {
    const ohneSchritt = "<ol><li>Ventil schließen</li><li>Dichtung tauschen</li></ol>";
    const ohne = anleitung({ bodyHtml: ohneSchritt });
    expect(felder(vergleicheAnleitung(SOLL_ANLEITUNG, ohne, erwartung))).toEqual(["zeile[1]"]);
    const vertauscht = anleitung({
      bodyHtml:
        "<ol><li>Druck ablassen</li><li>Ventil schließen</li><li>Dichtung tauschen</li></ol>",
    });
    expect(felder(vergleicheAnleitung(SOLL_ANLEITUNG, vertauscht, erwartung))).toEqual([
      "zeile[1]",
    ]);
  });

  it("E4 · ein leerer Solltext besteht nie", () => {
    expect(vergleicheAnleitung("\n \n", anleitung(), erwartung).gleich).toBe(false);
  });
});

describe("Kriterium 3 · Anleitung und Protokolle nennen den Sollvergleich je Host", () => {
  const anleitung = readFileSync(repoPfad("docs/operations/word-host-gesamtweg.md"), "utf8");
  const web = readFileSync(repoPfad("docs/operations/word-web-hostabnahme/README.md"), "utf8");
  const mac = readFileSync(repoPfad("docs/operations/word-mac-hostabnahme/README.md"), "utf8");

  it("P1 · die Anleitung nennt alle Befehle und beide Hosts getrennt", () => {
    for (const befehl of [
      "sollpaket web",
      "sollpaket mac",
      "vergleiche-docx",
      "vergleiche-objekt",
      "vergleiche-bild",
      "vergleiche-anleitung",
    ]) {
      expect(anleitung, befehl).toContain(befehl);
    }
  });

  it("P2 · Web- und Mac-Protokoll führen den Sollvergleich je mit ihrem eigenen Sollpaket", () => {
    expect(web).toContain("tools/word-host-wiederoeffnen.ts vergleiche-docx soll-web.json");
    expect(mac).toContain("tools/word-host-wiederoeffnen.ts vergleiche-docx soll-mac.json");
    expect(web).not.toContain("soll-mac.json");
    expect(mac).not.toContain("soll-web.json");
  });

  it("P3 · der dokumentierte Objektvergleich verlangt Entwurfs- UND Dokumentkennung", () => {
    const webAufruf = "vergleiche-objekt soll-web.json entwurf-web.json <id> <dok>";
    expect(anleitung).toContain(webAufruf);
    expect(web).toContain(webAufruf);
    expect(mac).toContain("vergleiche-objekt soll-mac.json entwurf-mac.json <id> <dok>");
    expect(anleitung).not.toMatch(/vergleiche-objekt \S+ \S+ <id>(?! <dok>)/);
  });
});
