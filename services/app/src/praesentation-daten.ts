// ================================================================================================
// KLARA POWERPOINT · PP-02 — DATENHERKUNFT UND BINDUNG AN FOLIEN
// (Auftrag produkt:20261015:klara-powerpoint-datenherkunft, Integrationsplan Abschnitt 2).
// ================================================================================================
//
// WAS DAS IST. Ein gemeinsames Daten-/Aussagenobjekt („Datenpunkt“) für eine Zahl oder Aussage auf
// einer Folie: Wert, Einheit/Währung, Bezugszeitraum, Bezugsgröße, Quelle mit der verwendeten
// Fassung, Fundstelle, Erfassungsart (direkt, OCR, manuell, berechnet, prognostiziert), Rechenweg
// mit den tatsächlich verwendeten Eingaben, Annahmen, Prüfungen, Korrekturen — und die Bindung an
// Folie und Element. Es schließt L04 und L17 aus `docs/klara-powerpoint/BESTAND.md`.
//
// WAS WIEDERVERWENDET WIRD, statt es ein zweites Mal zu bauen:
//   · Folien lesen: dieselbe Bedeutung wie `lesePraesentation` (W06) — `p:sldId`, Folienteil, Titel;
//     seit dem Prüfbefund B1 (18.10.2026) als lineare Abtastung in dieser Datei, weil der
//     Regex-Leser von W06 bei fremden Bytes quadratisch lief (siehe „LINEARE ABTASTUNG“).
//   · Folienidentität: `p:sldId` + Dateifassung (SHA-256 der Bytes), wie W10 sie führt; nie die
//     Foliennummer. Das Element dazu ist die Shape-Kennung (`p:cNvPr/@id`).
//   · Rechenweg: die Arten und die Rechnung von V06 (`rechne`, `BERECHNUNGSARTEN`).
//   · Rechte: der Aufrufer liefert Artikel nur, wenn `ko.read` und `darfSehen` gelten (Umgebung).
//   · OCR: die Erkennung läuft unverändert im vorhandenen Weg (W03/W01). Hier wird nur ihr Ergebnis
//     an das Bild gebunden — über die Inhaltskennung der Bildbytes, die der Server selbst nachrechnet.
//
// VALIDIERUNG (Abschnitt 5 des Pakets). Die Prüfdimensionen Erkennung, Struktur, Berechnung,
// Konsistenz, Aktualität und fachliche Freigabe stehen getrennt. Jede Prüfung ist an den
// FINGERABDRUCK der Datenfassung gebunden (Wert, Einheit, Zeitraum, Bezugsgröße, Quelle samt
// Fassung, Fundstelle, Rechenweg samt Eingabefassungen, Annahmen). Ändert sich einer davon, gilt die
// alte Prüfung als überholt — sie bleibt sichtbar, trägt aber keinen Status mehr. Eine neue
// Quellfassung oder eine geänderte Eingabe macht den Datenpunkt „Überprüfung nötig“. OCR allein,
// eine verlässliche Quelle oder ein grüner Teiltest validieren nie: „validiert“ heißt nur, dass alle
// für DIESE Fassung erforderlichen Dimensionen bestanden sind, die fachliche Freigabe eingeschlossen.
//
// KEIN MODELL läuft hier. Kein Schreiben in die Präsentation: Bindungen sind Verweise auf Elemente.

import { createHash } from "node:crypto";
import JSZip from "jszip";
import type { KnowledgeObject } from "../../knowledge-object";
import { BERECHNUNGSARTEN, rechne } from "./office-nachbearbeitung";

// ------------------------------------------------------------------------------------------------
// FEHLER
// ------------------------------------------------------------------------------------------------

/** `kein_zugriff` wird an der Route zu 404 (keine Existenzauskunft), `ungueltig` zu 400. */
export class DatenFehler extends Error {
  constructor(
    readonly art: "kein_zugriff" | "ungueltig",
    message: string,
  ) {
    super(message);
    this.name = "DatenFehler";
  }
}

// ------------------------------------------------------------------------------------------------
// FOLIEN UND ELEMENTE EINER PPTX-FASSUNG
// ------------------------------------------------------------------------------------------------

export interface Tabellenzelle {
  /** Ab 1. */
  readonly zeile: number;
  /** Ab 1. */
  readonly spalte: number;
  readonly text: string;
}

export interface FolienElement {
  /** `p:cNvPr/@id` — die Kennung des Elements auf seiner Folie. */
  readonly shapeId: string;
  readonly name: string;
  readonly art: "text" | "tabelle" | "bild";
  /** Absätze durch Zeilenumbruch getrennt; bei Tabellen die Zeilen als „Zelle | Zelle“. */
  readonly text: string;
  readonly zellen?: readonly Tabellenzelle[];
  /** Bei Bildern: `sha256:<hex>` der Bildbytes (dieselbe Form wie die OCR-Inhaltskennung). */
  readonly bild?: { readonly kennung: string; readonly bildAufFolie: number };
}

export interface FolieMitElementen {
  readonly sldId: string;
  readonly position: number;
  readonly titel: string;
  readonly ausgeblendet: boolean;
  readonly elemente: readonly FolienElement[];
}

export interface FoliensatzDaten {
  /** SHA-256 der Dateibytes — dieselbe Fassungskennung wie W10. */
  readonly fassung: string;
  readonly folien: readonly FolieMitElementen[];
}

function sha256(daten: Uint8Array | string): string {
  return createHash("sha256").update(daten).digest("hex");
}

function xmlText(roh: string): string {
  return roh
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number.parseInt(d, 10)))
    .replace(/&amp;/g, "&");
}

function attribut(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

function aufloesen(verzeichnis: string, ziel: string): string {
  const teile = ziel.startsWith("/") ? [] : verzeichnis.split("/").filter(Boolean);
  for (const t of ziel.replace(/^\//, "").split("/")) {
    if (t === "..") {
      teile.pop();
    } else if (t !== "." && t !== "") {
      teile.push(t);
    }
  }
  return teile.join("/");
}

// ------------------------------------------------------------------------------------------------
// LINEARE ABTASTUNG (unabhängige Prüfung 0001–0006, Befund B1, 18.10.2026)
// ------------------------------------------------------------------------------------------------
//
// DER BEFUND: Gelesen wurde über reguläre Ausdrücke der Form „Start-Tag, dann bis zum nächsten
// Schluss-Tag“ (`<p:sp…>([\s\S]*?)</p:sp>`, ebenso Absatz, Lauf, Zeile, Zelle — auch in W06
// `lesePraesentation`). Fehlt der Schluss, sucht jeder Start bis zum Textende: 64 000 offene `<p:sp>`
// (2 KB gepackt) hielten den Server über die Route `folien-abgleich` rund neun Sekunden fest.
//
// JETZT: Jeder Folienteil wird EINMAL durchgegangen. `indexOf` springt zum nächsten Tag, das Tag-Ende
// wird unter Beachtung von Anführungszeichen gefunden, Kommentar, Verarbeitungsanweisung und CDATA am
// Stück. Fehlt ein Abschluss, endet die Abtastung dort — sie sucht nie ein zweites Mal. Gezählt
// wird die Schachtelung, nicht gesucht.
//
// DIESELBE BEDEUTUNG wie W06 für wohlgeformte Dateien: Folien über `p:sldId` in Dokumentreihenfolge,
// Titel aus der ersten Form `<p:sp>` mit Titelplatzhalter (sonst der erste Absatz der Folie),
// Ausblendung über `show="0|false"`. Belegt in pp02-hostanschluss.test.ts (H8, Vergleich mit W06).

/** Höchstzahl der `p:sldId`-Einträge; mehrfach genannte Folienteile werden nur einmal gelesen. */
export const MAX_FOLIEN = 2000;
/** Höchstgröße EINES Folienteils (Zeichen) — ein echter Folienteil liegt weit darunter. */
export const MAX_FOLIENTEIL_ZEICHEN = 16 * 1024 * 1024;

interface XmlTag {
  readonly name: string;
  readonly art: "auf" | "zu" | "leer";
  /** Der Tag von „<“ bis „>“ — für `attribut`. */
  readonly roh: string;
}

/** Hat der Tag Attribute (Leerraum nach dem Namen)? So verlangten es die früheren Muster `<x\s…>`. */
function mitAttributen(t: XmlTag): boolean {
  return (
    t.art !== "zu" && t.roh.length > t.name.length + 1 && t.roh.charCodeAt(t.name.length + 1) <= 32
  );
}

/**
 * Geht einen XML-Teil genau einmal durch: `tag` je Start-, End- oder leerem Tag, `text` je Rohtext
 * dazwischen (als Bereich, CDATA als Text). Linear in der Länge; endet am ersten offenen Konstrukt.
 */
function tastAb(
  xml: string,
  tag: (t: XmlTag) => void,
  text: (von: number, bis: number) => void = () => {},
): void {
  const n = xml.length;
  let pos = 0;
  while (pos < n) {
    const lt = xml.indexOf("<", pos);
    if (lt < 0) {
      text(pos, n);
      return;
    }
    if (lt > pos) {
      text(pos, lt);
    }
    if (xml.startsWith("<!--", lt)) {
      const ende = xml.indexOf("-->", lt + 4);
      if (ende < 0) {
        return;
      }
      pos = ende + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", lt)) {
      const ende = xml.indexOf("]]>", lt + 9);
      if (ende < 0) {
        return;
      }
      text(lt + 9, ende);
      pos = ende + 3;
      continue;
    }
    if (xml.startsWith("<?", lt)) {
      const ende = xml.indexOf("?>", lt + 2);
      if (ende < 0) {
        return;
      }
      pos = ende + 2;
      continue;
    }
    if (xml.startsWith("<!", lt)) {
      return; // DOCTYPE u. Ä. — in OOXML nicht vorgesehen; nicht gedeutet, hier endet das Lesen.
    }
    let i = lt + 1;
    const zu = xml.charCodeAt(i) === 47; // „/“
    if (zu) {
      i += 1;
    }
    const nameStart = i;
    while (i < n) {
      const c = xml.charCodeAt(i);
      if (c === 62 || c === 47 || c <= 32) {
        break;
      }
      i += 1;
    }
    const name = xml.slice(nameStart, i);
    let ende = -1;
    while (i < n) {
      const c = xml.charCodeAt(i);
      if (c === 62) {
        ende = i;
        break;
      }
      if (c === 34 || c === 39) {
        const q = xml.indexOf(c === 34 ? '"' : "'", i + 1);
        if (q < 0) {
          return;
        }
        i = q + 1;
        continue;
      }
      i += 1;
    }
    if (ende < 0) {
      return;
    }
    tag({
      name,
      art: zu ? "zu" : xml.charCodeAt(ende - 1) === 47 ? "leer" : "auf",
      roh: xml.slice(lt, ende + 1),
    });
    pos = ende + 1;
  }
}

/** `Id` → `Target` der Beziehungen eines Teils (spätere gleiche `Id` gewinnt, wie zuvor die Map). */
function beziehungsZiele(rels: string): Map<string, string> {
  const ziele = new Map<string, string>();
  tastAb(rels, (t) => {
    if (t.name === "Relationship" && mitAttributen(t)) {
      ziele.set(attribut(t.roh, "Id") ?? "", attribut(t.roh, "Target") ?? "");
    }
  });
  return ziele;
}

interface ElementRoh {
  readonly name: string;
  /** Start-Tag genau `<p:sp>` — die Form, in der W06 den Titel sucht. */
  readonly nackt: boolean;
  tiefe: number;
  cNvPr?: string;
  blip?: string;
  tabelle: boolean;
  titelPlatzhalter: boolean;
  readonly absaetze: string[];
  readonly zellen: Tabellenzelle[];
}

interface FolieRoh {
  readonly elemente: ElementRoh[];
  readonly titel: string;
  readonly ausgeblendet: boolean;
}

const ELEMENTNAMEN = new Set(["p:sp", "p:graphicFrame", "p:pic"]);
const TITELPLATZHALTER = /^<p:ph\s[^>]*type="(title|ctrTitle)"/;

/** Eine Folie in einem Durchgang: Elemente (Text, Tabellenzellen, Bildverweis), Titel, Ausblendung. */
function folieAbtasten(xml: string): FolieRoh {
  const elemente: ElementRoh[] = [];
  let el: ElementRoh | undefined;
  let titel: string | undefined;
  let ersterAbsatz: string | undefined;
  let ausgeblendet = false;
  // Absatz (a:p) mit seinen Läufen (a:t), Tabellenzeile (a:tr) und -zelle (a:tc) — je mit Tiefe.
  let absatzTiefe = 0;
  let laeufe: string[] = [];
  let lauf: string[] | undefined;
  let zeile = 0;
  let zeilenTiefe = 0;
  let spalte = 0;
  let zelle:
    | { readonly zeile: number; readonly spalte: number; readonly absaetze: string[] }
    | undefined;
  let zellenTiefe = 0;

  const absatzFertig = () => {
    const satz = laeufe.join("");
    laeufe = [];
    if (satz.trim().length === 0) {
      return;
    }
    ersterAbsatz ??= satz;
    el?.absaetze.push(satz);
    zelle?.absaetze.push(satz);
  };

  tastAb(
    xml,
    (t) => {
      if (t.name === "p:sld" && mitAttributen(t) && /\sshow="(0|false)"/.test(t.roh)) {
        ausgeblendet = true;
      }
      if (!el) {
        if (t.art === "auf" && ELEMENTNAMEN.has(t.name)) {
          el = {
            name: t.name,
            nackt: t.roh === "<p:sp>",
            tiefe: 1,
            tabelle: false,
            titelPlatzhalter: false,
            absaetze: [],
            zellen: [],
          };
          zeile = 0;
          zeilenTiefe = 0;
          zellenTiefe = 0;
          zelle = undefined;
          absatzTiefe = 0;
          laeufe = [];
          lauf = undefined;
        }
      } else if (t.name === el.name) {
        el.tiefe += t.art === "auf" ? 1 : t.art === "zu" ? -1 : 0;
        if (el.tiefe === 0) {
          if (el.nackt && el.titelPlatzhalter && titel === undefined) {
            const kandidat = el.absaetze.join(" ").trim();
            if (kandidat) {
              titel = kandidat;
            }
          }
          elemente.push(el);
          el = undefined;
          return;
        }
      } else if (t.art !== "zu") {
        if (t.name === "p:cNvPr" && el.cNvPr === undefined && mitAttributen(t)) {
          el.cNvPr = t.roh;
        } else if (t.name === "a:blip" && el.blip === undefined && mitAttributen(t)) {
          const ziel = attribut(t.roh, "r:embed");
          if (ziel) {
            el.blip = ziel;
          }
        } else if (t.name === "p:ph" && TITELPLATZHALTER.test(t.roh)) {
          el.titelPlatzhalter = true;
        }
        if (t.name.startsWith("a:tbl")) {
          el.tabelle = true;
        }
      }
      // Tabellen: Zeilen und Zellen (auch leere `<a:tc/>`) in Dokumentreihenfolge.
      if (el && t.name === "a:tr") {
        if (t.art === "auf") {
          zeilenTiefe += 1;
          if (zeilenTiefe === 1) {
            zeile += 1;
            spalte = 0;
          }
        } else if (t.art === "zu" && zeilenTiefe > 0) {
          zeilenTiefe -= 1;
        }
      } else if (el && t.name === "a:tc" && zeilenTiefe > 0) {
        if (t.art === "leer" && zellenTiefe === 0) {
          spalte += 1;
          el.zellen.push({ zeile, spalte, text: "" });
        } else if (t.art === "auf") {
          zellenTiefe += 1;
          if (zellenTiefe === 1) {
            spalte += 1;
            zelle = { zeile, spalte, absaetze: [] };
          }
        } else if (t.art === "zu" && zellenTiefe > 0) {
          zellenTiefe -= 1;
          if (zellenTiefe === 0 && zelle) {
            el.zellen.push({
              zeile: zelle.zeile,
              spalte: zelle.spalte,
              text: zelle.absaetze.join("\n").replace(/\n/g, " "),
            });
            zelle = undefined;
          }
        }
      }
      // Absätze und Läufe — überall auf der Folie (der erste Absatz ist der Ersatztitel).
      if (t.name === "a:p") {
        if (t.art === "auf") {
          absatzTiefe += 1;
          if (absatzTiefe === 1) {
            laeufe = [];
          }
        } else if (t.art === "zu" && absatzTiefe > 0) {
          absatzTiefe -= 1;
          if (absatzTiefe === 0) {
            absatzFertig();
          }
        }
      } else if (t.name === "a:t" && absatzTiefe > 0) {
        if (t.art === "auf" && lauf === undefined) {
          lauf = [];
        } else if (t.art === "zu" && lauf !== undefined) {
          laeufe.push(xmlText(lauf.join("")));
          lauf = undefined;
        }
      }
    },
    (von, bis) => {
      lauf?.push(xml.slice(von, bis));
    },
  );
  return { elemente, titel: titel ?? ersterAbsatz ?? "", ausgeblendet };
}

/**
 * Liest Folien und Elemente einer `.pptx`. Gelesen wird nur; Tabellen kommen mit Zeile und Spalte,
 * Bilder mit der Inhaltskennung ihrer Bytes. Diagramme, SmartArt und Notizen liest dieser Weg nicht
 * (L03) — sie erscheinen nicht als Element und lassen sich daher auch nicht binden.
 *
 * Grenzen (B1): höchstens `MAX_FOLIEN` Einträge in der Folienliste, je Folienteil höchstens
 * `MAX_FOLIENTEIL_ZEICHEN`; ein mehrfach genannter Folienteil wird nur EINMAL gelesen und geliefert,
 * ein mehrfach verwendetes Bild nur einmal entpackt. Die Entpackgrenze des ganzen Archivs setzt der
 * Aufrufer, der fremde Bytes annimmt (Route `folien-abgleich`).
 */
export async function leseFolienDaten(bytes: Buffer): Promise<FoliensatzDaten> {
  const zip = await JSZip.loadAsync(bytes);
  const praes = await zip.file("ppt/presentation.xml")?.async("string");
  const praesRels = await zip.file("ppt/_rels/presentation.xml.rels")?.async("string");
  if (!praes || !praesRels) {
    throw new DatenFehler("ungueltig", "Die Datei enthält keine PowerPoint-Präsentation.");
  }
  const ziele = beziehungsZiele(praesRels);
  const eintraege: { readonly folieId: number; readonly pfad: string }[] = [];
  let genannt = 0;
  tastAb(praes, (t) => {
    if (t.name !== "p:sldId" || !mitAttributen(t)) {
      return;
    }
    genannt += 1;
    const folieId = Number(attribut(t.roh, "id"));
    const ziel = ziele.get(attribut(t.roh, "r:id") ?? "");
    if (Number.isInteger(folieId) && ziel) {
      eintraege.push({ folieId, pfad: aufloesen("ppt", ziel) });
    }
  });
  if (genannt > MAX_FOLIEN) {
    throw new DatenFehler(
      "ungueltig",
      `Die Präsentation nennt ${genannt} Folien; gelesen werden höchstens ${MAX_FOLIEN}.`,
    );
  }
  const folien: FolieMitElementen[] = [];
  const gelesen = new Set<string>();
  const bildKennung = new Map<string, string | undefined>();
  for (const { folieId, pfad } of eintraege) {
    if (gelesen.has(pfad)) {
      continue; // Derselbe Folienteil ein zweites Mal genannt: nur einmal lesen und liefern.
    }
    gelesen.add(pfad);
    const xml = (await zip.file(pfad)?.async("string")) ?? "";
    if (xml.length > MAX_FOLIENTEIL_ZEICHEN) {
      throw new DatenFehler("ungueltig", "Ein Folienteil ist für das Lesen zu groß.");
    }
    const verzeichnis = pfad.slice(0, pfad.lastIndexOf("/"));
    const relsPfad = `${verzeichnis}/_rels/${pfad.slice(verzeichnis.length + 1)}.rels`;
    const bildZiele = beziehungsZiele((await zip.file(relsPfad)?.async("string")) ?? "");
    const roh = folieAbtasten(xml);
    const elemente: FolienElement[] = [];
    let bilder = 0;
    for (const e of roh.elemente) {
      const shapeId = e.cNvPr ? attribut(e.cNvPr, "id") : undefined;
      if (!shapeId) {
        continue;
      }
      const name = xmlText((e.cNvPr && attribut(e.cNvPr, "name")) ?? "");
      if (e.name === "p:pic") {
        bilder += 1;
        const ziel = e.blip ? bildZiele.get(e.blip) : undefined;
        const bildPfad = ziel ? aufloesen(verzeichnis, ziel) : undefined;
        let kennung = bildPfad === undefined ? undefined : bildKennung.get(bildPfad);
        if (bildPfad !== undefined && !bildKennung.has(bildPfad)) {
          const daten = await zip.file(bildPfad)?.async("uint8array");
          kennung = daten ? `sha256:${sha256(daten)}` : undefined;
          bildKennung.set(bildPfad, kennung);
        }
        if (kennung) {
          elemente.push({
            shapeId,
            name,
            art: "bild",
            text: "",
            bild: { kennung, bildAufFolie: bilder },
          });
        }
        continue;
      }
      if (e.name === "p:graphicFrame") {
        if (!e.tabelle) {
          continue; // Diagramm, SmartArt, OLE: nicht gelesen (L03).
        }
        const zeilen = new Map<number, string[]>();
        for (const z of e.zellen) {
          zeilen.set(z.zeile, [...(zeilen.get(z.zeile) ?? []), z.text]);
        }
        elemente.push({
          shapeId,
          name,
          art: "tabelle",
          text: [...zeilen.values()].map((z) => z.join(" | ")).join("\n"),
          zellen: e.zellen,
        });
        continue;
      }
      const text = e.absaetze.join("\n");
      if (text.trim()) {
        elemente.push({ shapeId, name, art: "text", text });
      }
    }
    folien.push({
      sldId: String(folieId),
      position: folien.length + 1,
      titel: roh.titel,
      ausgeblendet: roh.ausgeblendet,
      elemente,
    });
  }
  return { fassung: sha256(bytes), folien };
}

// ------------------------------------------------------------------------------------------------
// ZAHLEN
// ------------------------------------------------------------------------------------------------

const ZAHLTOKEN = /(?:(?<![\p{L}\p{N}])[-+−])?\d+(?:[.,]\d+)*/gu;

/**
 * Liest eine Zahl in deutscher Schreibweise: „1.500“ = 1500, „1,5“ = 1,5, „1.234,5“ = 1234,5.
 * Mehrere Kommas („1,234,567“) lesen sich als Tausendertrennung, ein einzelner Punkt mit weniger
 * oder mehr als drei Nachkommastellen als Dezimalpunkt („1.5“).
 */
function zahlAusToken(token: string): number {
  let s = token.replace(/−/g, "-").replace(/^\+/, "");
  const punkte = (s.match(/\./g) ?? []).length;
  const kommas = (s.match(/,/g) ?? []).length;
  if (punkte > 0 && kommas > 0) {
    s =
      s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  } else if (kommas > 1) {
    s = s.replace(/,/g, "");
  } else if (kommas === 1) {
    s = s.replace(",", ".");
  } else if (punkte > 1 || /^-?\d{1,3}\.\d{3}$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  return Number(s);
}

/** Die EINE Zahl eines Werts („1.500 T€“ → 1500); `undefined`, wenn keine oder mehrere drinstehen. */
export function zahlAusWert(wert: string): number | undefined {
  const token = [...wert.matchAll(ZAHLTOKEN)].map((m) => m[0]);
  if (token.length !== 1 || token[0] === undefined) {
    return undefined;
  }
  const zahl = zahlAusToken(token[0]);
  return Number.isFinite(zahl) ? zahl : undefined;
}

function normal(text: string): string {
  return text.replace(/[\s\u00a0\u202f]+/g, " ").trim();
}

/** Steht der Wert (so wie geschrieben) im Text? Leerraum zählt nicht. */
export function stehtIn(text: string, wert: string): boolean {
  const w = normal(wert);
  return w.length > 0 && normal(text).includes(w);
}

const ZIFFER = /\p{N}/u;
const ZIFFER_ODER_BUCHSTABE = /[\p{L}\p{N}]/u;
const VORZEICHEN = new Set(["-", "−", "+"]);

/** Setzt das Zeichen VOR `i` eine Zahl fort, die bei `i` mit einer Ziffer beginnt? */
function zahlGehtVornWeiter(t: string, i: number): boolean {
  const c = t.charAt(i - 1);
  if (!c) {
    return false;
  }
  if (ZIFFER.test(c)) {
    return true;
  }
  if ((c === "." || c === ",") && ZIFFER.test(t.charAt(i - 2))) {
    return true;
  }
  // Nachprüfung N1: ein Vorzeichen direkt davor gehört zur Zahl — wie in `ZAHLTOKEN` nur, wenn davor
  // kein Buchstabe und keine Ziffer steht („−300 T€“ ja, „Q4-300 T€“ nein).
  return VORZEICHEN.has(c) && !ZIFFER_ODER_BUCHSTABE.test(t.charAt(i - 2));
}

/** Setzt das Zeichen AN `j` eine Zahl fort, die vor `j` mit einer Ziffer endet? */
function zahlGehtHintenWeiter(t: string, j: number): boolean {
  const c = t.charAt(j);
  if (!c) {
    return false;
  }
  return ZIFFER.test(c) || ((c === "." || c === ",") && ZIFFER.test(t.charAt(j + 1)));
}

/**
 * Die Lage am Element (passt/abweichung) — NUR für `elementBefund` (Prüfbefund B3, Nachprüfung N1/N2,
 * 18.10.2026). Ist der Wert eine Zahl (`zahlAusWert`), muss sie als GANZE Zahl dastehen: keine Ziffer,
 * kein „.“/„,“ mit Ziffer und kein Vorzeichen unmittelbar davor, keine Ziffer und kein „.“/„,“ mit
 * Ziffer danach. „1.200 T€“ passt so nicht in „11.200 T€“, „300 T€“ nicht in „−300 T€“, „12 %“ nicht in
 * „112 %“. Buchstaben trennen wie in `ZAHLTOKEN` („1.500“ passt in „1.500T€“). Eine Aussage (keine
 * einzelne Zahl) vergleicht wie `stehtIn`.
 *
 * Erfassen, Binden und Korrigieren prüfen weiter mit `stehtIn` — der PP-02-Kern bleibt, wie er war.
 */
export function zahlStehtImText(text: string, wert: string): boolean {
  if (zahlAusWert(wert) === undefined) {
    return stehtIn(text, wert);
  }
  const w = normal(wert);
  const t = normal(text);
  const vorn = ZIFFER.test(w.charAt(0));
  const hinten = ZIFFER.test(w.charAt(w.length - 1));
  for (let i = t.indexOf(w); i >= 0; i = t.indexOf(w, i + 1)) {
    if (vorn && zahlGehtVornWeiter(t, i)) {
      continue;
    }
    if (hinten && zahlGehtHintenWeiter(t, i + w.length)) {
      continue;
    }
    return true;
  }
  return false;
}

/** Ersetzt die Zahl in einer Vorlage („29,4 %“) durch eine neue, mit `stellen` Nachkommastellen. */
export function formatiere(zahl: number, stellen: number, vorlage: string): string {
  const neu = zahl.toLocaleString("de-DE", {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  });
  const token = [...vorlage.matchAll(ZAHLTOKEN)][0];
  if (!token || token.index === undefined) {
    return neu;
  }
  return `${vorlage.slice(0, token.index)}${neu}${vorlage.slice(token.index + token[0].length)}`;
}

function runde(zahl: number, stellen: number): number {
  const f = 10 ** stellen;
  return Math.round(zahl * f) / f;
}

// ------------------------------------------------------------------------------------------------
// DAS DATENOBJEKT
// ------------------------------------------------------------------------------------------------

/** Wie der Wert in Klarwerk gekommen ist (Abschnitt 4: Kennzeichnung). */
export type Erfassung = "direkt" | "ocr" | "manuell" | "berechnet" | "prognose";
export const ERFASSUNGEN: readonly Erfassung[] = [
  "direkt",
  "ocr",
  "manuell",
  "berechnet",
  "prognose",
];

/** Die Prüfdimensionen aus Abschnitt 5 — getrennt geführt. */
export type Dimension =
  | "erkennung"
  | "struktur"
  | "berechnung"
  | "konsistenz"
  | "aktualitaet"
  | "fachliche_freigabe";
export const DIMENSIONEN: readonly Dimension[] = [
  "erkennung",
  "struktur",
  "berechnung",
  "konsistenz",
  "aktualitaet",
  "fachliche_freigabe",
];

export type Berechnungsart = (typeof BERECHNUNGSARTEN)[number];

/** Die Quelle mit der tatsächlich verwendeten Fassung. */
export interface Quellbezug {
  readonly koId: string;
  /** Die Artikelfassung beim Erfassen. */
  readonly koFassung: number;
  /** Bei einer Datei: der Anhang, sein Objekt und die Dateifassung (SHA-256). */
  readonly anhangId?: string;
  readonly objectId?: string;
  readonly dateiFassung?: string;
}

/** Wo der Wert in der Quelle steht. Folie und Element über ihre stabilen Kennungen. */
export type Fundstelle =
  | {
      readonly art: "folienelement";
      readonly sldId: string;
      readonly shapeId: string;
      readonly folienPosition: number;
      readonly folienTitel: string;
      readonly elementName: string;
      readonly zitat: string;
    }
  | {
      readonly art: "tabellenzelle";
      readonly sldId: string;
      readonly shapeId: string;
      readonly folienPosition: number;
      readonly folienTitel: string;
      readonly elementName: string;
      readonly zeile: number;
      readonly spalte: number;
      readonly zeilenkopf: string;
      readonly spaltenkopf: string;
      readonly zitat: string;
    }
  | {
      readonly art: "bild";
      readonly sldId: string;
      readonly shapeId: string;
      readonly folienPosition: number;
      readonly folienTitel: string;
      readonly elementName: string;
      readonly bildKennung: string;
      /** Der erkannte Text, wie die Texterkennung ihn geliefert hat. */
      readonly ocrText: string;
      /** Die Erkennung meldete unsichere Stellen. */
      readonly unsicher: boolean;
    }
  | { readonly art: "artikel"; readonly zitat: string }
  | { readonly art: "eingabe"; readonly beleg?: string }
  | { readonly art: "rechenweg" };

export interface RechenwegEingabe {
  readonly datenpunktId: string;
  /** Die Fassung der Eingabe, mit der gerechnet wurde. */
  readonly fassung: number;
  readonly wert: string;
  readonly zahl: number;
}

export interface Rechenweg {
  readonly art: Berechnungsart;
  readonly eingaben: readonly RechenwegEingabe[];
  /** Lesbar, mit den eingesetzten Werten. */
  readonly formel: string;
  /** Nachkommastellen der Rundung. */
  readonly stellen: number;
  /** Das ungerundete Ergebnis. */
  readonly roh: number;
  readonly ergebnis: number;
}

export interface Pruefung {
  readonly id: string;
  readonly dimension: Dimension;
  readonly ergebnis: "bestanden" | "klaerung";
  readonly grund: string;
  /** Konto-Kennung; maschinelle Prüfungen tragen `klarwerk:<weg>`. */
  readonly von: string;
  readonly am: string;
  /** Die Datenfassung, für die die Prüfung gilt. */
  readonly datenFassung: number;
  readonly fingerabdruck: string;
}

export interface Bindung {
  readonly id: string;
  readonly koId: string;
  readonly anhangId: string;
  /** Objekt und Dateifassung, an denen gebunden wurde. */
  readonly objectId: string;
  readonly dateiFassung: string;
  readonly artikelFassung: number;
  readonly sldId: string;
  readonly shapeId: string;
  readonly zeile?: number;
  readonly spalte?: number;
  readonly folienPosition: number;
  readonly folienTitel: string;
  readonly elementName: string;
  /** Die Datenfassung beim Binden. */
  readonly datenFassung: number;
  readonly von: string;
  readonly am: string;
}

export interface Inhalt {
  readonly art: "zahl" | "aussage";
  /** Wie auf der Folie bzw. in der Quelle geschrieben („1.500 T€“). */
  readonly wert: string;
  readonly zahl?: number;
  readonly einheit?: string;
  readonly waehrung?: string;
  readonly zeitraum?: string;
  readonly bezugsgroesse?: string;
  readonly erfassung: Erfassung;
  readonly quelle?: Quellbezug;
  readonly fundstelle: Fundstelle;
  readonly rechenweg?: Rechenweg;
  readonly annahmen?: readonly string[];
  readonly modellbezug?: string;
}

export interface Korrektur {
  /** Die Datenfassung, die durch die Korrektur entstand. */
  readonly fassung: number;
  readonly felder: readonly string[];
  readonly vorher: Readonly<Record<string, unknown>>;
  readonly grund: string;
  readonly von: string;
  readonly am: string;
}

export interface Datenpunkt extends Inhalt {
  readonly id: string;
  /** Der Artikel, dem der Datenpunkt gehört; Leserecht an ihm ist Voraussetzung jeder Sicht. */
  readonly heimatKoId: string;
  /** Die Datenfassung: steigt mit jeder inhaltlichen Änderung. */
  readonly fassung: number;
  /** Speicherstand: steigt mit jedem Schreiben (Grundlage des bedingten Schreibens). */
  readonly stand: number;
  readonly erfasstVon: string;
  readonly erfasstAm: string;
  readonly pruefungen: readonly Pruefung[];
  readonly bindungen: readonly Bindung[];
  readonly korrekturen: readonly Korrektur[];
}

/** Der Fingerabdruck der Datenfassung: alles, woran eine Prüfung hängt. */
export function fingerabdruck(d: Inhalt): string {
  return sha256(
    JSON.stringify({
      art: d.art,
      wert: normal(d.wert),
      zahl: d.zahl ?? null,
      einheit: d.einheit ?? null,
      waehrung: d.waehrung ?? null,
      zeitraum: d.zeitraum ?? null,
      bezugsgroesse: d.bezugsgroesse ?? null,
      erfassung: d.erfassung,
      quelle: d.quelle ?? null,
      fundstelle: d.fundstelle,
      rechenweg: d.rechenweg
        ? {
            art: d.rechenweg.art,
            stellen: d.rechenweg.stellen,
            eingaben: d.rechenweg.eingaben.map((e) => [e.datenpunktId, e.fassung, e.zahl]),
          }
        : null,
      annahmen: d.annahmen ?? null,
      modellbezug: d.modellbezug ?? null,
    }),
  );
}

// ------------------------------------------------------------------------------------------------
// UMGEBUNG — Rechte und Bestand kommen vom Aufrufer
// ------------------------------------------------------------------------------------------------

/** Was ohne Inhalt über einen Artikel bekannt sein darf (für Status und Schutzstufe). */
export interface ArtikelMeta {
  readonly version: number;
  readonly confidentiality?: KnowledgeObject["confidentiality"];
  readonly anhaenge: readonly { readonly id: string; readonly objectId?: string }[];
}

export interface DatenUmgebung {
  /** Der Artikel, wenn der handelnde Nutzer ihn lesen darf (`ko.read` + `darfSehen`); sonst nichts. */
  artikel(koId: string): Promise<KnowledgeObject | undefined>;
  /** Fassung, Schutzstufe und Anhangsobjekte ohne Inhalt — nur für Status und Schutzstufe. */
  meta(koId: string): Promise<ArtikelMeta | undefined>;
  /** Folien der AKTUELLEN Fassung eines PPTX-Anhangs eines lesbaren Artikels. */
  folien(
    koId: string,
    anhangId: string,
  ): Promise<{ objectId: string; name: string; satz: FoliensatzDaten } | undefined>;
  /** Ein gespeicherter Datenpunkt — ohne Rechteprüfung; die Sicht prüft selbst. */
  datenpunkt(id: string): Promise<Datenpunkt | undefined>;
  /** Anzeigename eines Kontos. */
  name(nutzerId: string): Promise<string | undefined>;
}

async function lesbar(dp: Datenpunkt, u: DatenUmgebung): Promise<boolean> {
  return vollLesbar(dp, u);
}

/** Die Tiefe, bis zu der Eingabeketten verfolgt werden (Rechte, Sicht, Schutzstufe). */
const KETTENTIEFE = 8;

/**
 * Nacharbeit 2 (Bens Befund 1) — LESEN HEISST: DIE GANZE HERKUNFT LESEN DÜRFEN.
 *
 * Ein Datenpunkt trägt Inhalte seiner Quelle (Wert, Fundstelle mit Zitat, OCR-Text) und seiner
 * Eingaben (Formel mit deren Werten, Prüfgründe, Korrekturen). Wer die Quelle oder eine Eingabe
 * nicht lesen darf, erhielte sie sonst über den Datenpunkt. Deshalb ist ein Datenpunkt nur lesbar,
 * wenn der Handelnde den Heimatartikel UND jede Quelle UND — rekursiv — jede Eingabe lesen darf,
 * jeweils auch die, die in der Korrekturhistorie stehen (frühere Quellfassung, früherer Rechenweg).
 * Sonst gibt es ihn für diesen Nutzer nicht: weder einzeln noch in Listen noch als Eingabe noch als
 * Ziel einer Wirkung. Damit ist auch die berechnete Schutzstufe durchgesetzt, nicht nur angezeigt.
 */
export async function vollLesbar(
  dp: Datenpunkt,
  u: DatenUmgebung,
  tiefe = KETTENTIEFE,
): Promise<boolean> {
  if (!(await u.artikel(dp.heimatKoId))) {
    return false;
  }
  const quellen = new Set<string>();
  const eingaben = new Set<string>();
  const quelleVon = (q: unknown) => {
    if (istObjekt(q) && typeof q.koId === "string") {
      quellen.add(q.koId);
    }
  };
  const eingabenVon = (r: unknown) => {
    if (istObjekt(r) && Array.isArray(r.eingaben)) {
      for (const e of r.eingaben) {
        if (istObjekt(e) && typeof e.datenpunktId === "string") {
          eingaben.add(e.datenpunktId);
        }
      }
    }
  };
  quelleVon(dp.quelle);
  eingabenVon(dp.rechenweg);
  for (const k of dp.korrekturen) {
    quelleVon(k.vorher.quelle);
    eingabenVon(k.vorher.rechenweg);
  }
  for (const koId of quellen) {
    if (!(await u.artikel(koId))) {
      return false;
    }
  }
  if (eingaben.size > 0 && tiefe <= 0) {
    return false; // Nicht bis zum Ende prüfbar: fail-closed.
  }
  for (const id of eingaben) {
    const ein = await u.datenpunkt(id);
    if (ein && !(await vollLesbar(ein, u, tiefe - 1))) {
      return false;
    }
  }
  return true;
}

/** Alle Eingaben eines Datenpunkts — aus dem Rechenweg UND aus früheren Rechenwegen der Historie. */
function eingabeKennungen(dp: Datenpunkt): Set<string> {
  const ids = new Set<string>();
  const von = (r: unknown) => {
    if (istObjekt(r) && Array.isArray(r.eingaben)) {
      for (const e of r.eingaben) {
        if (istObjekt(e) && typeof e.datenpunktId === "string") {
          ids.add(e.datenpunktId);
        }
      }
    }
  };
  von(dp.rechenweg);
  for (const k of dp.korrekturen) {
    von(k.vorher.rechenweg);
  }
  return ids;
}

/**
 * Die Tiefe der Herkunftskette — dieselbe Zählung wie `vollLesbar`: 0 ohne Eingaben, sonst 1 plus
 * die größte Tiefe der Eingaben (auch der Historie). Gezählt wird höchstens bis `grenze + 1`; mehr
 * braucht die Entscheidung nicht.
 */
export async function kettentiefe(
  dp: Datenpunkt,
  u: DatenUmgebung,
  grenze = KETTENTIEFE + 1,
): Promise<number> {
  const ids = eingabeKennungen(dp);
  if (ids.size === 0) {
    return 0;
  }
  if (grenze <= 0) {
    return 1;
  }
  let tiefste = 0;
  for (const id of ids) {
    const ein = await u.datenpunkt(id);
    if (ein) {
      tiefste = Math.max(tiefste, await kettentiefe(ein, u, grenze - 1));
    }
  }
  return 1 + tiefste;
}

/**
 * Nacharbeit 5 (Bens Befund) — DER ENTSTEHENDE GESAMTGRAPH WIRD VOR DEM SCHREIBEN GEPRÜFT.
 *
 * Jede Eingabe für sich kann lesbar sein und der neue Datenpunkt trotzdem eine Stufe zu tief hängen:
 * X9 = X8 + Z mit X8 bereits 8 Stufen tief. Gespeichert wäre X9 danach für niemanden erreichbar
 * (Abruf 404, kein Listeneintrag), weil Lesen und Status die Herkunft nur bis `KETTENTIEFE` verfolgen.
 * Deshalb prüfen Erfassen und Korrigieren den fertigen Datenpunkt — mit Historie — vor jeder
 * Speicherung: zu tief → verständlich abgelehnt, nichts geschrieben; danach muss er für den
 * Handelnden vollständig lesbar sein, sonst ebenfalls keine Speicherung.
 */
export async function pruefeHerkunftsgraph(dp: Datenpunkt, u: DatenUmgebung): Promise<void> {
  if ((await kettentiefe(dp, u)) > KETTENTIEFE) {
    throw new DatenFehler(
      "ungueltig",
      `Die Herkunftskette wäre tiefer als ${KETTENTIEFE} Stufen (Rechenweg auf Rechenweg). Unterstützt sind höchstens ${KETTENTIEFE}; nichts wurde gespeichert. Bitte mit weniger tief abgeleiteten Eingaben rechnen.`,
    );
  }
  if (!(await vollLesbar(dp, u))) {
    throw new DatenFehler(
      "ungueltig",
      "Die entstehende Herkunft wäre für dich nicht vollständig lesbar; nichts wurde gespeichert.",
    );
  }
}

/**
 * Nacharbeit 2 (Bens Befund 2) — EINE FRÜHERE DATENFASSUNG, aus der Korrekturhistorie zurückgerechnet.
 * Jede Korrektur hält den Stand VOR ihr fest (`vorher`, `null` = Angabe fehlte); rückwärts angewandt
 * ergibt das den Inhalt der Fassung, mit der z. B. eine Berechnung tatsächlich gerechnet hat —
 * samt ihrer damaligen Quelle (Fassung, Fundstelle) und ihrem damaligen Rechenweg. Prüfungen,
 * Korrekturen und Bindungen dieser Fassung bleiben, spätere nicht. `undefined` für eine Fassung, die
 * es nicht gibt.
 */
export function inFassung(dp: Datenpunkt, fassung: number): Datenpunkt | undefined {
  if (!Number.isInteger(fassung) || fassung < 1 || fassung > dp.fassung) {
    return undefined;
  }
  if (fassung === dp.fassung) {
    return dp;
  }
  const stand = new Map<string, unknown>(Object.entries(dp));
  for (const k of [...dp.korrekturen].sort((a, b) => b.fassung - a.fassung)) {
    if (k.fassung <= fassung) {
      break;
    }
    for (const [feld, wert] of Object.entries(k.vorher)) {
      if (wert === null || wert === undefined) {
        stand.delete(feld);
      } else {
        stand.set(feld, wert);
      }
    }
  }
  const alt = Object.fromEntries(stand) as unknown as Datenpunkt;
  return {
    ...alt,
    fassung,
    korrekturen: dp.korrekturen.filter((k) => k.fassung <= fassung),
    pruefungen: dp.pruefungen.filter((p) => p.datenFassung <= fassung),
    bindungen: dp.bindungen.filter((b) => b.datenFassung <= fassung),
  };
}

// ------------------------------------------------------------------------------------------------
// ERFASSEN — der Auftrag aus der Anfrage
// ------------------------------------------------------------------------------------------------

export interface Ort {
  readonly anhangId: string;
  readonly sldId: string;
  readonly shapeId: string;
  readonly zeile?: number;
  readonly spalte?: number;
}

export interface Erfassungsauftrag {
  readonly art: "zahl" | "aussage";
  readonly wert: string;
  readonly einheit?: string;
  readonly waehrung?: string;
  readonly zeitraum?: string;
  readonly bezugsgroesse?: string;
  readonly erfassung: Erfassung;
  /** Wo der Wert auf einer Folie steht. Bei `direkt`/`ocr` zugleich die Fundstelle. */
  readonly ort?: Ort;
  /** `direkt` aus einem anderen Artikel: dessen Kennung und die wörtliche Stelle. */
  readonly quelleKoId?: string;
  readonly zitat?: string;
  /** `ocr`: das Ergebnis der vorhandenen Texterkennung für das Bild am Ort. */
  readonly ocr?: {
    readonly text: string;
    readonly bildKennung: string;
    readonly unsicher: boolean;
  };
  /** `manuell`: worauf sich die Eingabe stützt (frei, optional). */
  readonly beleg?: string;
  /** `berechnet` (und optional `prognose`): Art, Eingaben in Reihenfolge, Nachkommastellen. */
  readonly rechenweg?: {
    readonly art: Berechnungsart;
    readonly eingaben: readonly string[];
    readonly stellen: number;
  };
  readonly annahmen?: readonly string[];
  readonly modellbezug?: string;
}

function istObjekt(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function text(x: unknown, max: number, feld: string, pflicht = false): string | undefined {
  if (x === undefined || x === null || x === "") {
    if (pflicht) {
      throw new DatenFehler("ungueltig", `${feld} fehlt.`);
    }
    return undefined;
  }
  if (typeof x !== "string" || x.length > max) {
    throw new DatenFehler("ungueltig", `${feld} ist kein Text bis ${max} Zeichen.`);
  }
  const t = x.trim();
  if (!t && pflicht) {
    throw new DatenFehler("ungueltig", `${feld} fehlt.`);
  }
  return t || undefined;
}

function ganzzahl(x: unknown, feld: string, min: number, max: number): number {
  if (!Number.isInteger(x) || (x as number) < min || (x as number) > max) {
    throw new DatenFehler("ungueltig", `${feld} muss eine Ganzzahl von ${min} bis ${max} sein.`);
  }
  return x as number;
}

export function leseOrt(roh: unknown): Ort | undefined {
  if (roh === undefined || roh === null) {
    return undefined;
  }
  if (!istObjekt(roh)) {
    throw new DatenFehler("ungueltig", "ort ist kein Objekt.");
  }
  const anhangId = text(roh.anhangId, 200, "ort.anhangId", true) as string;
  const sldId = text(roh.sldId, 20, "ort.sldId", true) as string;
  const shapeId = text(roh.shapeId, 20, "ort.shapeId", true) as string;
  const zelle = roh.zeile !== undefined || roh.spalte !== undefined;
  return {
    anhangId,
    sldId,
    shapeId,
    ...(zelle
      ? {
          zeile: ganzzahl(roh.zeile, "ort.zeile", 1, 1000),
          spalte: ganzzahl(roh.spalte, "ort.spalte", 1, 1000),
        }
      : {}),
  };
}

/** Prüft den Rumpf einer Erfassung. Wirft `DatenFehler("ungueltig")` mit einem lesbaren Satz. */
export function leseErfassung(roh: unknown): Erfassungsauftrag {
  if (!istObjekt(roh)) {
    throw new DatenFehler("ungueltig", "Die Erfassung fehlt.");
  }
  const art = roh.art;
  if (art !== "zahl" && art !== "aussage") {
    throw new DatenFehler("ungueltig", "art muss zahl oder aussage sein.");
  }
  const erfassung = roh.erfassung as Erfassung;
  if (!ERFASSUNGEN.includes(erfassung)) {
    throw new DatenFehler(
      "ungueltig",
      "erfassung muss direkt, ocr, manuell, berechnet oder prognose sein.",
    );
  }
  const wert = text(roh.wert, art === "zahl" ? 100 : 1000, "wert", true) as string;
  if (art === "zahl" && zahlAusWert(wert) === undefined) {
    throw new DatenFehler(
      "ungueltig",
      `„${wert}“ enthält nicht genau eine Zahl. Bezugsjahr oder Zeitraum gehören in „zeitraum“.`,
    );
  }
  const ort = leseOrt(roh.ort);
  let ocr: Erfassungsauftrag["ocr"];
  if (roh.ocr !== undefined) {
    if (!istObjekt(roh.ocr)) {
      throw new DatenFehler("ungueltig", "ocr ist kein Objekt.");
    }
    const bildKennung = text(roh.ocr.bildKennung, 80, "ocr.bildKennung", true) as string;
    if (!/^sha256:[0-9a-f]{64}$/.test(bildKennung)) {
      throw new DatenFehler("ungueltig", "ocr.bildKennung ist keine Inhaltskennung (sha256:…).");
    }
    ocr = {
      text: text(roh.ocr.text, 20_000, "ocr.text", true) as string,
      bildKennung,
      unsicher: roh.ocr.unsicher === true,
    };
  }
  let rechenweg: Erfassungsauftrag["rechenweg"];
  if (roh.rechenweg !== undefined) {
    const r = roh.rechenweg;
    if (
      !istObjekt(r) ||
      !BERECHNUNGSARTEN.includes(r.art as Berechnungsart) ||
      !Array.isArray(r.eingaben) ||
      r.eingaben.length < 2 ||
      r.eingaben.length > 50 ||
      !r.eingaben.every((e) => typeof e === "string" && e.length > 0 && e.length <= 100)
    ) {
      throw new DatenFehler(
        "ungueltig",
        "rechenweg braucht art (summe, differenz, anteil_prozent) und mindestens zwei Eingaben.",
      );
    }
    if (r.art === "anteil_prozent" && r.eingaben.length !== 2) {
      throw new DatenFehler("ungueltig", "Ein Anteil in Prozent braucht genau Anteil und Basis.");
    }
    rechenweg = {
      art: r.art as Berechnungsart,
      eingaben: r.eingaben as string[],
      stellen: r.stellen === undefined ? 0 : ganzzahl(r.stellen, "rechenweg.stellen", 0, 6),
    };
  }
  const annahmen =
    roh.annahmen === undefined
      ? undefined
      : Array.isArray(roh.annahmen) && roh.annahmen.length <= 20
        ? roh.annahmen.map((a, i) => text(a, 500, `annahmen[${i + 1}]`, true) as string)
        : (() => {
            throw new DatenFehler("ungueltig", "annahmen ist eine Liste (höchstens 20).");
          })();
  const auftrag: Erfassungsauftrag = {
    art,
    wert,
    erfassung,
    ...opt("einheit", text(roh.einheit, 100, "einheit")),
    ...opt("waehrung", text(roh.waehrung, 20, "waehrung")),
    ...opt("zeitraum", text(roh.zeitraum, 100, "zeitraum")),
    ...opt("bezugsgroesse", text(roh.bezugsgroesse, 200, "bezugsgroesse")),
    ...(ort ? { ort } : {}),
    ...opt("quelleKoId", text(roh.quelleKoId, 200, "quelleKoId")),
    ...opt("zitat", text(roh.zitat, 2000, "zitat")),
    ...(ocr ? { ocr } : {}),
    ...opt("beleg", text(roh.beleg, 1000, "beleg")),
    ...(rechenweg ? { rechenweg } : {}),
    ...(annahmen && annahmen.length > 0 ? { annahmen } : {}),
    ...opt("modellbezug", text(roh.modellbezug, 500, "modellbezug")),
  };
  // Je Erfassungsart die Pflichtangaben — die Kennzeichnung muss stimmen, nicht nur dastehen.
  switch (erfassung) {
    case "direkt":
      if (!ort && !(auftrag.quelleKoId && auftrag.zitat)) {
        throw new DatenFehler(
          "ungueltig",
          "Direkt übernommen braucht eine Fundstelle: ein Folienelement (ort) oder einen Artikel mit wörtlicher Stelle (quelleKoId, zitat).",
        );
      }
      break;
    case "ocr":
      if (!ort || !ocr) {
        throw new DatenFehler(
          "ungueltig",
          "OCR-erkannt braucht das Bild (ort) und das Ergebnis der Texterkennung (ocr).",
        );
      }
      break;
    case "berechnet":
      if (!rechenweg || art !== "zahl") {
        throw new DatenFehler(
          "ungueltig",
          "Ein berechneter Wert ist eine Zahl mit Rechenweg (Art und Eingaben).",
        );
      }
      break;
    case "prognose":
      if (!auftrag.annahmen) {
        throw new DatenFehler(
          "ungueltig",
          "Eine Prognose braucht mindestens eine ausdrücklich genannte Annahme.",
        );
      }
      break;
    case "manuell":
      break;
  }
  if (rechenweg && erfassung !== "berechnet" && erfassung !== "prognose") {
    throw new DatenFehler(
      "ungueltig",
      "Einen Rechenweg tragen nur berechnete Werte und Prognosen.",
    );
  }
  if (ocr && erfassung !== "ocr") {
    throw new DatenFehler("ungueltig", "Ein OCR-Ergebnis gehört nur zu einem OCR-erkannten Wert.");
  }
  return auftrag;
}

function opt<K extends string, V>(schluessel: K, wert: V | undefined): { [P in K]?: V } {
  return (wert === undefined ? {} : { [schluessel]: wert }) as { [P in K]?: V };
}

// ------------------------------------------------------------------------------------------------
// ORT, QUELLE, RECHENWEG
// ------------------------------------------------------------------------------------------------

interface OrtsLage {
  readonly koId: string;
  readonly anhangId: string;
  readonly objectId: string;
  readonly satz: FoliensatzDaten;
  readonly folie: FolieMitElementen;
  readonly element: FolienElement;
  readonly zelle?: Tabellenzelle;
}

async function ortLesen(u: DatenUmgebung, koId: string, ort: Ort): Promise<OrtsLage> {
  const datei = await u.folien(koId, ort.anhangId);
  if (!datei) {
    throw new DatenFehler(
      "ungueltig",
      "Diese Präsentation ist nicht lesbar (kein PowerPoint-Anhang dieses Artikels).",
    );
  }
  const folie = datei.satz.folien.find((f) => f.sldId === ort.sldId);
  const element = folie?.elemente.find((e) => e.shapeId === ort.shapeId);
  if (!folie || !element) {
    throw new DatenFehler(
      "ungueltig",
      "Diese Folie oder dieses Element gibt es in der aktuellen Fassung nicht.",
    );
  }
  let zelle: Tabellenzelle | undefined;
  if (ort.zeile !== undefined) {
    zelle = element.zellen?.find((z) => z.zeile === ort.zeile && z.spalte === ort.spalte);
    if (!zelle) {
      throw new DatenFehler("ungueltig", "Diese Tabellenzelle gibt es nicht.");
    }
  }
  return {
    koId,
    anhangId: ort.anhangId,
    objectId: datei.objectId,
    satz: datei.satz,
    folie,
    element,
    ...(zelle ? { zelle } : {}),
  };
}

function ortText(l: OrtsLage): string {
  return l.zelle ? l.zelle.text : l.element.text;
}

function ortName(l: OrtsLage): string {
  return l.element.name || (l.element.art === "bild" ? "Bild" : "Element");
}

function fundstelleAusOrt(l: OrtsLage): Fundstelle {
  const kopf = {
    sldId: l.folie.sldId,
    shapeId: l.element.shapeId,
    folienPosition: l.folie.position,
    folienTitel: l.folie.titel,
    elementName: ortName(l),
  };
  if (l.zelle) {
    const zellen = l.element.zellen ?? [];
    return {
      art: "tabellenzelle",
      ...kopf,
      zeile: l.zelle.zeile,
      spalte: l.zelle.spalte,
      zeilenkopf: zellen.find((z) => z.zeile === l.zelle?.zeile && z.spalte === 1)?.text ?? "",
      spaltenkopf: zellen.find((z) => z.zeile === 1 && z.spalte === l.zelle?.spalte)?.text ?? "",
      zitat: l.zelle.text,
    };
  }
  return { art: "folienelement", ...kopf, zitat: l.element.text };
}

function quelleAusOrt(l: OrtsLage, artikel: KnowledgeObject): Quellbezug {
  return {
    koId: artikel.id,
    koFassung: artikel.version,
    anhangId: l.anhangId,
    objectId: l.objectId,
    dateiFassung: l.satz.fassung,
  };
}

/** Wie der Wert am Ort zu erkennen ist: Text bzw. Zelle enthält ihn, ein Bild ist dasselbe Bild. */
function passtAmOrt(l: OrtsLage, wert: string, bildKennung?: string): string | undefined {
  if (l.element.art === "bild") {
    if (bildKennung === undefined) {
      return "Ein Bild trägt nur einen OCR-erkannten Wert desselben Bildes; nichts gebunden.";
    }
    return l.element.bild?.kennung === bildKennung
      ? undefined
      : "An dieser Stelle steht ein anderes Bild als das erkannte; nichts gebunden.";
  }
  return stehtIn(ortText(l), wert)
    ? undefined
    : `„${wert}“ steht nicht in diesem Element (Folie ${l.folie.position}${l.zelle ? `, Zeile ${l.zelle.zeile}, Spalte ${l.zelle.spalte}` : ""}).`;
}

function artikelText(ko: KnowledgeObject): string {
  const body = (ko.bodyHtml ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
  return `${ko.title}\n${ko.statement}\n${body}`;
}

const ZEICHEN: Record<Berechnungsart, string> = {
  summe: " + ",
  differenz: " − ",
  anteil_prozent: " ÷ ",
};

async function rechenwegBauen(
  r: NonNullable<Erfassungsauftrag["rechenweg"]>,
  u: DatenUmgebung,
): Promise<Rechenweg> {
  const eingaben: RechenwegEingabe[] = [];
  for (const id of r.eingaben) {
    const dp = await u.datenpunkt(id);
    if (!dp || !(await lesbar(dp, u))) {
      throw new DatenFehler("kein_zugriff", "Eine Eingabe des Rechenwegs gibt es nicht.");
    }
    if (dp.art !== "zahl" || dp.zahl === undefined) {
      throw new DatenFehler("ungueltig", `Die Eingabe „${dp.wert}“ ist keine Zahl.`);
    }
    eingaben.push({ datenpunktId: dp.id, fassung: dp.fassung, wert: dp.wert, zahl: dp.zahl });
  }
  // V06 unverändert: `ergebnis` wertet `rechne` nicht aus, es gehört nur zur Form des Zahlenbelegs.
  const roh = rechne({ art: r.art, eingaben: eingaben.map((e) => e.zahl), ergebnis: "" });
  if (!Number.isFinite(roh)) {
    throw new DatenFehler("ungueltig", "Der Rechenweg ergibt keinen Wert (Basis 0?).");
  }
  const formel = `${eingaben.map((e) => e.wert).join(ZEICHEN[r.art])}${r.art === "anteil_prozent" ? " × 100" : ""}`;
  return {
    art: r.art,
    eingaben,
    formel,
    stellen: r.stellen,
    roh,
    ergebnis: runde(roh, r.stellen),
  };
}

function rechnungPasst(wert: string, rw: Rechenweg): string | undefined {
  const zahl = zahlAusWert(wert);
  if (zahl === undefined || Math.abs(zahl - rw.ergebnis) > 0.5 * 10 ** -rw.stellen) {
    return `Der Rechenweg ergibt ${rw.ergebnis.toLocaleString("de-DE", { maximumFractionDigits: rw.stellen, minimumFractionDigits: rw.stellen })}, nicht „${wert}“.`;
  }
  return undefined;
}

// ------------------------------------------------------------------------------------------------
// ERFASSEN, BINDEN, PRÜFEN, KORRIGIEREN — reine Übergänge; Speichern macht der Aufrufer
// ------------------------------------------------------------------------------------------------

export interface Handelnder {
  readonly nutzerId: string;
  readonly jetzt: string;
  readonly kennung: () => string;
}

function bindungAus(
  l: OrtsLage,
  artikel: KnowledgeObject,
  fassung: number,
  h: Handelnder,
): Bindung {
  return {
    id: h.kennung(),
    koId: l.koId,
    anhangId: l.anhangId,
    objectId: l.objectId,
    dateiFassung: l.satz.fassung,
    artikelFassung: artikel.version,
    sldId: l.folie.sldId,
    shapeId: l.element.shapeId,
    ...(l.zelle ? { zeile: l.zelle.zeile, spalte: l.zelle.spalte } : {}),
    folienPosition: l.folie.position,
    folienTitel: l.folie.titel,
    elementName: ortName(l),
    datenFassung: fassung,
    von: h.nutzerId,
    am: h.jetzt,
  };
}

function maschinell(
  dimension: Dimension,
  grund: string,
  weg: string,
  inhalt: Inhalt,
  fassung: number,
  h: Handelnder,
): Pruefung {
  return {
    id: h.kennung(),
    dimension,
    ergebnis: "bestanden",
    grund,
    von: `klarwerk:${weg}`,
    am: h.jetzt,
    datenFassung: fassung,
    fingerabdruck: fingerabdruck(inhalt),
  };
}

/**
 * Legt einen Datenpunkt am Heimatartikel an. Alle Quellen, Orte und Eingaben werden aus dem Bestand
 * gelesen — mit den Rechten des Handelnden —, nie aus dem Rumpf übernommen.
 */
export async function erfasse(
  auftrag: Erfassungsauftrag,
  heimat: KnowledgeObject,
  u: DatenUmgebung,
  h: Handelnder,
): Promise<Datenpunkt> {
  const ortLage = auftrag.ort ? await ortLesen(u, heimat.id, auftrag.ort) : undefined;
  let quelle: Quellbezug | undefined;
  let fundstelle: Fundstelle;
  let rechenweg: Rechenweg | undefined;
  const maschinelle: { dimension: Dimension; grund: string; weg: string }[] = [];

  switch (auftrag.erfassung) {
    case "direkt": {
      if (ortLage) {
        if (ortLage.element.art === "bild") {
          throw new DatenFehler(
            "ungueltig",
            "Ein Wert aus einem Bild ist OCR-erkannt, nicht direkt übernommen.",
          );
        }
        const fehler = passtAmOrt(ortLage, auftrag.wert);
        if (fehler) {
          throw new DatenFehler("ungueltig", fehler);
        }
        quelle = quelleAusOrt(ortLage, heimat);
        fundstelle = fundstelleAusOrt(ortLage);
        maschinelle.push({
          dimension: "erkennung",
          grund:
            "Der Wert steht wörtlich an der Fundstelle der verwendeten Dateifassung (vom Server gelesen).",
          weg: "pptx-leser",
        });
      } else {
        const ko = await u.artikel(auftrag.quelleKoId ?? "");
        if (!ko) {
          throw new DatenFehler("kein_zugriff", "Die Quelle gibt es nicht.");
        }
        const zitat = auftrag.zitat ?? "";
        if (!stehtIn(artikelText(ko), zitat) || !stehtIn(zitat, auftrag.wert)) {
          throw new DatenFehler(
            "ungueltig",
            "Die Stelle steht nicht wörtlich in der Quelle oder enthält den Wert nicht.",
          );
        }
        quelle = { koId: ko.id, koFassung: ko.version };
        fundstelle = { art: "artikel", zitat };
        maschinelle.push({
          dimension: "erkennung",
          grund: "Der Wert steht wörtlich an der genannten Stelle der verwendeten Artikelfassung.",
          weg: "artikeltext",
        });
      }
      break;
    }
    case "ocr": {
      if (!ortLage || !auftrag.ocr || ortLage.element.art !== "bild") {
        throw new DatenFehler("ungueltig", "OCR-erkannt braucht ein Bild auf der Folie.");
      }
      const fehler = passtAmOrt(ortLage, auftrag.wert, auftrag.ocr.bildKennung);
      if (fehler) {
        throw new DatenFehler("ungueltig", fehler);
      }
      if (!stehtIn(auftrag.ocr.text, auftrag.wert)) {
        throw new DatenFehler(
          "ungueltig",
          `„${auftrag.wert}“ steht nicht im erkannten Bildtext; nichts erfasst.`,
        );
      }
      quelle = quelleAusOrt(ortLage, heimat);
      fundstelle = {
        art: "bild",
        sldId: ortLage.folie.sldId,
        shapeId: ortLage.element.shapeId,
        folienPosition: ortLage.folie.position,
        folienTitel: ortLage.folie.titel,
        elementName: ortName(ortLage),
        bildKennung: auftrag.ocr.bildKennung,
        ocrText: auftrag.ocr.text,
        unsicher: auftrag.ocr.unsicher,
      };
      // Keine maschinelle Erkennungsprüfung: OCR allein bestätigt nichts.
      break;
    }
    case "manuell":
      fundstelle = { art: "eingabe", ...(auftrag.beleg ? { beleg: auftrag.beleg } : {}) };
      break;
    case "berechnet":
    case "prognose": {
      if (auftrag.rechenweg) {
        rechenweg = await rechenwegBauen(auftrag.rechenweg, u);
        const fehler = rechnungPasst(auftrag.wert, rechenweg);
        if (fehler) {
          throw new DatenFehler("ungueltig", fehler);
        }
        maschinelle.push({
          dimension: "berechnung",
          grund: `Nachgerechnet mit den gebundenen Eingaben: ${rechenweg.formel} = ${rechenweg.roh}, gerundet auf ${rechenweg.stellen} Nachkommastellen.`,
          weg: "rechenweg",
        });
        fundstelle = { art: "rechenweg" };
      } else {
        fundstelle = { art: "eingabe", ...(auftrag.beleg ? { beleg: auftrag.beleg } : {}) };
      }
      break;
    }
  }

  // Wo der Wert angezeigt wird (manuell/berechnet/prognose): er muss dort stehen.
  if (ortLage && auftrag.erfassung !== "direkt" && auftrag.erfassung !== "ocr") {
    const fehler = passtAmOrt(ortLage, auftrag.wert);
    if (fehler) {
      throw new DatenFehler("ungueltig", fehler);
    }
  }

  const inhalt: Inhalt = {
    art: auftrag.art,
    wert: auftrag.wert,
    ...opt("zahl", auftrag.art === "zahl" ? zahlAusWert(auftrag.wert) : undefined),
    ...opt("einheit", auftrag.einheit),
    ...opt("waehrung", auftrag.waehrung),
    ...opt("zeitraum", auftrag.zeitraum),
    ...opt("bezugsgroesse", auftrag.bezugsgroesse),
    erfassung: auftrag.erfassung,
    ...opt("quelle", quelle),
    fundstelle,
    ...opt("rechenweg", rechenweg),
    ...opt("annahmen", auftrag.annahmen),
    ...opt("modellbezug", auftrag.modellbezug),
  };
  const neu: Datenpunkt = {
    ...inhalt,
    id: h.kennung(),
    heimatKoId: heimat.id,
    fassung: 1,
    stand: 1,
    erfasstVon: h.nutzerId,
    erfasstAm: h.jetzt,
    pruefungen: maschinelle.map((m) => maschinell(m.dimension, m.grund, m.weg, inhalt, 1, h)),
    bindungen: ortLage ? [bindungAus(ortLage, heimat, 1, h)] : [],
    korrekturen: [],
  };
  await pruefeHerkunftsgraph(neu, u);
  return neu;
}

/**
 * Bindet einen Datenpunkt an ein Element einer Präsentation — auch an eine andere als die, aus der
 * er stammt (gemeinsam nutzbar). Der Wert muss dort stehen; ein Bild muss dasselbe Bild sein.
 */
export async function binde(
  dp: Datenpunkt,
  ziel: KnowledgeObject,
  ort: Ort,
  u: DatenUmgebung,
  h: Handelnder,
  ausgabe?: "datenwert",
): Promise<Datenpunkt> {
  const l = await ortLesen(u, ziel.id, ort);
  const fehler = passtAmOrt(
    l,
    dp.wert,
    ausgabe !== "datenwert" && dp.fundstelle.art === "bild" ? dp.fundstelle.bildKennung : undefined,
  );
  if (fehler) {
    throw new DatenFehler("ungueltig", fehler);
  }
  const doppelt = dp.bindungen.some(
    (b) =>
      b.koId === ziel.id &&
      b.anhangId === ort.anhangId &&
      b.objectId === l.objectId &&
      b.sldId === ort.sldId &&
      b.shapeId === ort.shapeId &&
      b.zeile === ort.zeile &&
      b.spalte === ort.spalte,
  );
  if (doppelt) {
    return dp;
  }
  return { ...dp, bindungen: [...dp.bindungen, bindungAus(l, ziel, dp.fassung, h)] };
}

/** Hält eine Prüfung fest — gebunden an die AKTUELLE Datenfassung und ihren Fingerabdruck. */
export function pruefe(
  dp: Datenpunkt,
  eingabe: { dimension: Dimension; ergebnis: "bestanden" | "klaerung"; grund?: string },
  h: Handelnder,
): Datenpunkt {
  if (!DIMENSIONEN.includes(eingabe.dimension)) {
    throw new DatenFehler("ungueltig", "Unbekannte Prüfdimension.");
  }
  if (!erforderlich(dp).includes(eingabe.dimension)) {
    throw new DatenFehler(
      "ungueltig",
      `Die Dimension ${eingabe.dimension} trifft auf diesen Datenpunkt nicht zu.`,
    );
  }
  const grund = eingabe.grund?.trim() ?? "";
  if (eingabe.ergebnis === "klaerung" && !grund) {
    throw new DatenFehler("ungueltig", "Ein Klärungsbedarf braucht einen Grund.");
  }
  return {
    ...dp,
    pruefungen: [
      ...dp.pruefungen,
      {
        id: h.kennung(),
        dimension: eingabe.dimension,
        ergebnis: eingabe.ergebnis,
        grund: grund || "Geprüft.",
        von: h.nutzerId,
        am: h.jetzt,
        datenFassung: dp.fassung,
        fingerabdruck: fingerabdruck(dp),
      },
    ],
  };
}

export interface Korrekturauftrag {
  readonly wert?: string;
  readonly einheit?: string | null;
  readonly waehrung?: string | null;
  readonly zeitraum?: string | null;
  readonly bezugsgroesse?: string | null;
  /** Den Rechenweg mit den AKTUELLEN Fassungen der Eingaben neu rechnen. */
  readonly neuBerechnen?: boolean;
  /** Den Wert an seiner Fundstelle in der AKTUELLEN Quellfassung neu lesen. */
  readonly quelleAktualisieren?: boolean;
  readonly grund: string;
}

export function leseKorrektur(roh: unknown): Korrekturauftrag {
  if (!istObjekt(roh)) {
    throw new DatenFehler("ungueltig", "Die Korrektur fehlt.");
  }
  const leer = (x: unknown, max: number, feld: string) =>
    x === null || x === "" ? null : text(x, max, feld);
  const k: Korrekturauftrag = {
    grund: text(roh.grund, 1000, "grund", true) as string,
    ...opt("wert", text(roh.wert, 1000, "wert")),
    ...(roh.einheit !== undefined ? { einheit: leer(roh.einheit, 100, "einheit") ?? null } : {}),
    ...(roh.waehrung !== undefined ? { waehrung: leer(roh.waehrung, 20, "waehrung") ?? null } : {}),
    ...(roh.zeitraum !== undefined
      ? { zeitraum: leer(roh.zeitraum, 100, "zeitraum") ?? null }
      : {}),
    ...(roh.bezugsgroesse !== undefined
      ? { bezugsgroesse: leer(roh.bezugsgroesse, 200, "bezugsgroesse") ?? null }
      : {}),
    ...(roh.neuBerechnen === true ? { neuBerechnen: true } : {}),
    ...(roh.quelleAktualisieren === true ? { quelleAktualisieren: true } : {}),
  };
  return k;
}

/**
 * Ändert Wert, Bezugsrahmen, Rechenweg oder Quellfassung. Es entsteht eine neue Datenfassung; die
 * Korrektur steht mit Grund, Person und dem vorherigen Stand fest. Frühere Prüfungen bleiben
 * sichtbar, gelten aber nicht für die neue Fassung (anderer Fingerabdruck).
 */
export async function korrigiere(
  dp: Datenpunkt,
  k: Korrekturauftrag,
  u: DatenUmgebung,
  h: Handelnder,
): Promise<Datenpunkt> {
  let neu: Inhalt = { ...dp };
  const vorher: Record<string, unknown> = {};
  const merke = (feld: keyof Inhalt) => {
    if (!(feld in vorher)) {
      vorher[feld] = dp[feld] ?? null;
    }
  };
  for (const feld of ["einheit", "waehrung", "zeitraum", "bezugsgroesse"] as const) {
    const w = k[feld];
    if (w !== undefined && w !== (dp[feld] ?? null)) {
      merke(feld);
      const ohne = Object.fromEntries(
        Object.entries(neu).filter(([schluessel]) => schluessel !== feld),
      );
      neu = (w === null ? ohne : { ...ohne, [feld]: w }) as unknown as Inhalt;
    }
  }
  if (k.neuBerechnen) {
    if (!dp.rechenweg) {
      throw new DatenFehler("ungueltig", "Dieser Datenpunkt hat keinen Rechenweg.");
    }
    const rw = await rechenwegBauen(
      {
        art: dp.rechenweg.art,
        eingaben: dp.rechenweg.eingaben.map((e) => e.datenpunktId),
        stellen: dp.rechenweg.stellen,
      },
      u,
    );
    merke("rechenweg");
    merke("wert");
    merke("zahl");
    const wert = k.wert ?? formatiere(rw.ergebnis, rw.stellen, dp.wert);
    const fehler = rechnungPasst(wert, rw);
    if (fehler) {
      throw new DatenFehler("ungueltig", fehler);
    }
    neu = { ...neu, rechenweg: rw, wert, zahl: zahlAusWert(wert) as number };
  } else if (k.quelleAktualisieren) {
    const f = dp.fundstelle;
    if (dp.erfassung !== "direkt" || !dp.quelle) {
      throw new DatenFehler("ungueltig", "Nur direkt übernommene Werte lassen sich neu lesen.");
    }
    const ko = await u.artikel(dp.quelle.koId);
    if (!ko) {
      throw new DatenFehler("kein_zugriff", "Die Quelle gibt es nicht.");
    }
    const wert = k.wert ?? dp.wert;
    merke("quelle");
    merke("fundstelle");
    if (f.art === "folienelement" || f.art === "tabellenzelle") {
      const l = await ortLesen(u, ko.id, {
        anhangId: dp.quelle.anhangId ?? "",
        sldId: f.sldId,
        shapeId: f.shapeId,
        ...(f.art === "tabellenzelle" ? { zeile: f.zeile, spalte: f.spalte } : {}),
      });
      const fehler = passtAmOrt(l, wert);
      if (fehler) {
        throw new DatenFehler(
          "ungueltig",
          `${fehler} In der aktuellen Fassung steht dort: „${ortText(l)}“. Bitte den Wert ausdrücklich korrigieren.`,
        );
      }
      neu = { ...neu, quelle: quelleAusOrt(l, ko), fundstelle: fundstelleAusOrt(l) };
    } else if (f.art === "artikel") {
      if (!stehtIn(artikelText(ko), f.zitat) || !stehtIn(f.zitat, wert)) {
        throw new DatenFehler(
          "ungueltig",
          "Die Stelle steht in der aktuellen Fassung der Quelle nicht mehr; bitte neu erfassen.",
        );
      }
      neu = { ...neu, quelle: { koId: ko.id, koFassung: ko.version } };
    }
    if (k.wert !== undefined && k.wert !== dp.wert) {
      merke("wert");
      merke("zahl");
      neu = { ...neu, wert, ...opt("zahl", dp.art === "zahl" ? zahlAusWert(wert) : undefined) };
    }
  } else if (k.wert !== undefined && k.wert !== dp.wert) {
    if (dp.art === "zahl" && zahlAusWert(k.wert) === undefined) {
      throw new DatenFehler("ungueltig", `„${k.wert}“ enthält nicht genau eine Zahl.`);
    }
    if (dp.rechenweg) {
      const fehler = rechnungPasst(k.wert, dp.rechenweg);
      if (fehler) {
        throw new DatenFehler(
          "ungueltig",
          `${fehler} Ein berechneter Wert wird über „neu berechnen“ geändert.`,
        );
      }
    }
    merke("wert");
    merke("zahl");
    neu = {
      ...neu,
      wert: k.wert,
      ...opt("zahl", dp.art === "zahl" ? zahlAusWert(k.wert) : undefined),
    };
  }
  const felder = Object.keys(vorher);
  if (felder.length === 0 && fingerabdruck(neu) === fingerabdruck(dp)) {
    return dp;
  }
  const fassung = dp.fassung + 1;
  // `neu` begann als vollständige Kopie von `dp`; entfernte Angaben fehlen darin und bleiben weg.
  const ergebnis: Datenpunkt = {
    ...(neu as Datenpunkt),
    fassung,
    korrekturen: [
      ...dp.korrekturen,
      { fassung, felder, vorher, grund: k.grund, von: h.nutzerId, am: h.jetzt },
    ],
  };
  // Neu gelesen bzw. neu gerechnet ist wieder maschinell geprüft — für die NEUE Fassung.
  const maschinelleNeu: Pruefung[] = [];
  if (k.neuBerechnen && ergebnis.rechenweg) {
    maschinelleNeu.push(
      maschinell(
        "berechnung",
        `Neu gerechnet mit den aktuellen Eingaben: ${ergebnis.rechenweg.formel} = ${ergebnis.rechenweg.roh}.`,
        "rechenweg",
        ergebnis,
        fassung,
        h,
      ),
    );
  }
  if (k.quelleAktualisieren) {
    maschinelleNeu.push(
      maschinell(
        "erkennung",
        "Der Wert steht wörtlich an der Fundstelle der aktuellen Quellfassung (vom Server gelesen).",
        dp.fundstelle.art === "artikel" ? "artikeltext" : "pptx-leser",
        ergebnis,
        fassung,
        h,
      ),
    );
  }
  const korrigiert: Datenpunkt = {
    ...ergebnis,
    pruefungen: [...dp.pruefungen, ...maschinelleNeu],
  };
  // Nacharbeit 5: auch eine Korrektur oder Neuberechnung speichert nur einen tragfähigen Graphen.
  await pruefeHerkunftsgraph(korrigiert, u);
  return korrigiert;
}

// ------------------------------------------------------------------------------------------------
// PRÜFSTAND — Abschnitt 5, je Dimension und für die konkrete Datenfassung
// ------------------------------------------------------------------------------------------------

export type DimensionsStand = "bestanden" | "klaerung" | "offen" | "ueberholt" | "nicht_zutreffend";

export type Zustand = "erfasst" | "in_pruefung" | "klaerung" | "validiert" | "ueberpruefung_noetig";

export interface DimensionsBefund {
  readonly dimension: Dimension;
  readonly stand: DimensionsStand;
  /** Warum dieser Stand — ein Satz, den der Nutzer versteht. */
  readonly grund: string;
  /** Die Prüfung, auf der der Stand beruht (auch eine überholte). */
  readonly pruefung?: Pruefung;
}

export interface Pruefstand {
  readonly zustand: Zustand;
  readonly grund: string;
  /** Welche konkrete Arbeit den Zustand ändert. */
  readonly naechsteArbeit: readonly string[];
  readonly datenFassung: number;
  readonly erforderlich: readonly Dimension[];
  readonly dimensionen: readonly DimensionsBefund[];
  /** Eine Prognose ist nie ein beobachteter Wert — auch nicht validiert. */
  readonly prognose: boolean;
}

/** Welche Dimensionen für diesen Datenpunkt gelten. */
export function erforderlich(d: Inhalt): Dimension[] {
  return DIMENSIONEN.filter((dim) => {
    switch (dim) {
      case "erkennung":
        return d.erfassung === "direkt" || d.erfassung === "ocr";
      case "berechnung":
        return d.rechenweg !== undefined;
      case "aktualitaet":
        // Nacharbeit 4: auch ein berechneter Wert hat eine Herkunft mit Fassungen — die seiner
        // Eingaben. Ihre Aktualität gilt für ihn mit.
        return d.quelle !== undefined || d.rechenweg !== undefined;
      default:
        return true;
    }
  });
}

const NICHT_ZUTREFFEND: Record<Dimension, (d: Inhalt) => string> = {
  erkennung: (d) =>
    d.erfassung === "manuell"
      ? "Manuell eingegeben: nicht aus einer Quelle übernommen."
      : "Berechnet bzw. prognostiziert: die Eingaben tragen ihre eigene Erkennung.",
  struktur: () => "",
  berechnung: () => "Kein Rechenweg.",
  konsistenz: () => "",
  aktualitaet: () => "Keine Quelle mit Fassung und kein Rechenweg (manuelle Eingabe).",
  fachliche_freigabe: () => "",
};

function offenGrund(dim: Dimension, d: Inhalt): string {
  switch (dim) {
    case "erkennung":
      return d.erfassung === "ocr"
        ? `OCR-erkannt${d.fundstelle.art === "bild" && d.fundstelle.unsicher ? " (mit unsicheren Stellen)" : ""}: noch nicht am Bild bestätigt. OCR allein validiert nicht.`
        : "Die Übernahme aus der Quelle ist noch nicht geprüft.";
    case "struktur": {
      const fehlt = [
        d.art === "zahl" && !d.einheit && !d.waehrung ? "Einheit/Währung" : "",
        d.art === "zahl" && !d.zeitraum ? "Bezugszeitraum" : "",
      ].filter(Boolean);
      return fehlt.length > 0
        ? `Offen. Es fehlt: ${fehlt.join(", ")}.`
        : "Format, Einheit, Zeitraum und Zuordnung sind noch nicht geprüft.";
    }
    case "berechnung":
      return "Der Rechenweg ist noch nicht geprüft.";
    case "konsistenz":
      return "Noch nicht mit anderen Angaben zum selben Sachverhalt abgeglichen.";
    case "aktualitaet":
      return d.quelle
        ? "Ob die Quellfassung zum Verwendungszeitpunkt passt, ist noch nicht geprüft."
        : "Ob die Quellfassungen der Eingaben zum Verwendungszeitpunkt passen, ist noch nicht geprüft.";
    case "fachliche_freigabe":
      return "Keine fachliche Freigabe für diese Datenfassung.";
  }
}

/** Was sich seit einer Prüfung geändert hat — für den Grund einer überholten Prüfung. */
function seitPruefung(dp: Datenpunkt, p: Pruefung): string[] {
  return [
    ...new Set(dp.korrekturen.filter((k) => k.fassung > p.datenFassung).flatMap((k) => k.felder)),
  ];
}

const FELDNAME: Record<string, string> = {
  wert: "Wert",
  zahl: "Wert",
  einheit: "Einheit",
  waehrung: "Währung",
  zeitraum: "Bezugszeitraum",
  bezugsgroesse: "Bezugsgröße",
  rechenweg: "Rechenweg",
  quelle: "Quelle",
  fundstelle: "Fundstelle",
};

/** Ist die verwendete Quellfassung heute noch die aktuelle? Sonst der Grund. */
async function quellGrund(quelle: Quellbezug, u: DatenUmgebung): Promise<string | undefined> {
  const meta = await u.meta(quelle.koId);
  if (!meta) {
    return "Die Quelle gibt es nicht mehr.";
  }
  if (quelle.anhangId) {
    const jetzt = meta.anhaenge.find((a) => a.id === quelle.anhangId)?.objectId;
    if (jetzt !== quelle.objectId) {
      return jetzt
        ? "Das Quelldokument hat inzwischen eine neue Fassung."
        : "Das Quelldokument hängt nicht mehr am Artikel.";
    }
  }
  if (meta.version !== quelle.koFassung) {
    return `Verwendet wurde Quellfassung ${quelle.koFassung}; die Quelle steht jetzt bei Fassung ${meta.version}.`;
  }
  return undefined;
}

/**
 * Nacharbeit 4 (Bens Befund) — DIE TATSÄCHLICH VERWENDETE HERKUNFT, REKURSIV.
 *
 * Eine Berechnung rechnet mit bestimmten Fassungen ihrer Eingaben; diese hängen ihrerseits an
 * Quellfassungen und Eingabefassungen. Ändert sich irgendwo darunter die Quelle oder erhält eine
 * tiefere Eingabe eine neue Fassung, ist auch das Ergebnis oben nicht mehr aktuell — selbst wenn
 * seine unmittelbaren Eingaben noch dieselbe Fassung tragen (Quelle → A → B). Geprüft wird die
 * Herkunft in der VERWENDETEN Fassung (`inFassung`), nicht der heutige Stand der Zwischenstufen.
 * Ergebnis: der erste konkrete Grund mit dem Weg dorthin, oder `undefined`.
 */
async function herkunftsGrund(
  dp: Datenpunkt,
  u: DatenUmgebung,
  tiefe: number,
): Promise<string | undefined> {
  if (dp.quelle) {
    const grund = await quellGrund(dp.quelle, u);
    if (grund) {
      return grund;
    }
  }
  for (const e of dp.rechenweg?.eingaben ?? []) {
    const grund = await eingabeGrund(e, u, tiefe);
    if (grund) {
      return grund;
    }
  }
  return undefined;
}

/** Ob eine verwendete Eingabe (samt ihrer Herkunft) heute noch so gilt, wie mit ihr gerechnet wurde. */
async function eingabeGrund(
  e: RechenwegEingabe,
  u: DatenUmgebung,
  tiefe: number,
): Promise<string | undefined> {
  const jetzt = await u.datenpunkt(e.datenpunktId);
  if (!jetzt) {
    return `Eingabe „${e.wert}“ gibt es nicht mehr.`;
  }
  if (jetzt.fassung !== e.fassung) {
    return `Eingabe „${e.wert}“ hat jetzt Fassung ${jetzt.fassung} (gerechnet mit ${e.fassung}).`;
  }
  if (tiefe <= 0) {
    return `Die Herkunft von „${e.wert}“ ist nicht bis zum Ende prüfbar.`; // fail-closed
  }
  const damals = inFassung(jetzt, e.fassung) ?? jetzt;
  const tiefer = await herkunftsGrund(damals, u, tiefe - 1);
  return tiefer ? `Über die Eingabe „${e.wert}“: ${tiefer}` : undefined;
}

/** Lebendige Gründe, aus denen eine Dimension überholt ist, obwohl der Datenpunkt gleich blieb. */
async function lebendigUeberholt(
  dp: Datenpunkt,
  u: DatenUmgebung,
): Promise<Partial<Record<Dimension, string>>> {
  const gruende: Partial<Record<Dimension, string>> = {};
  if (dp.quelle) {
    const grund = await quellGrund(dp.quelle, u);
    if (grund) {
      gruende.aktualitaet = grund;
    }
  }
  if (dp.rechenweg && !gruende.aktualitaet) {
    // Eingaben mit unveränderter Fassung: ist IHRE verwendete Herkunft noch aktuell (rekursiv)?
    // Eingaben mit neuer Fassung meldet unten die Berechnung.
    for (const e of dp.rechenweg.eingaben) {
      const jetzt = await u.datenpunkt(e.datenpunktId);
      if (!jetzt || jetzt.fassung !== e.fassung) {
        continue;
      }
      const grund = await eingabeGrund(e, u, KETTENTIEFE);
      if (grund) {
        gruende.aktualitaet = grund;
        break;
      }
    }
  }
  if (dp.rechenweg) {
    const geaendert: string[] = [];
    for (const e of dp.rechenweg.eingaben) {
      const jetzt = await u.datenpunkt(e.datenpunktId);
      if (!jetzt) {
        geaendert.push(`„${e.wert}“ gibt es nicht mehr`);
      } else if (jetzt.fassung !== e.fassung) {
        geaendert.push(
          `„${e.wert}“ hat jetzt Fassung ${jetzt.fassung} (gerechnet mit ${e.fassung})`,
        );
      }
    }
    if (geaendert.length > 0) {
      gruende.berechnung = `Eine Eingabe wurde geändert: ${geaendert.join("; ")}. Bitte neu berechnen.`;
    }
  }
  return gruende;
}

export async function pruefstand(dp: Datenpunkt, u: DatenUmgebung): Promise<Pruefstand> {
  const fp = fingerabdruck(dp);
  const noetig = erforderlich(dp);
  const lebendig = await lebendigUeberholt(dp, u);
  const dimensionen = DIMENSIONEN.map((dim): DimensionsBefund => {
    if (!noetig.includes(dim)) {
      return { dimension: dim, stand: "nicht_zutreffend", grund: NICHT_ZUTREFFEND[dim](dp) };
    }
    const letzte = dp.pruefungen.filter((p) => p.dimension === dim).at(-1);
    const live = lebendig[dim];
    if (live) {
      return {
        dimension: dim,
        stand: "ueberholt",
        grund: live,
        ...(letzte ? { pruefung: letzte } : {}),
      };
    }
    if (letzte && letzte.fingerabdruck !== fp) {
      const felder = [...new Set(seitPruefung(dp, letzte).map((f) => FELDNAME[f] ?? f))];
      return {
        dimension: dim,
        stand: "ueberholt",
        grund: `Geprüft für Datenfassung ${letzte.datenFassung}; seitdem geändert${felder.length > 0 ? `: ${felder.join(", ")}` : ""}. Die alte Prüfung gilt nicht für Fassung ${dp.fassung}.`,
        pruefung: letzte,
      };
    }
    if (letzte) {
      return { dimension: dim, stand: letzte.ergebnis, grund: letzte.grund, pruefung: letzte };
    }
    return { dimension: dim, stand: "offen", grund: offenGrund(dim, dp) };
  });
  const relevant = dimensionen.filter((d) => d.stand !== "nicht_zutreffend");
  const ueberholt = relevant.filter((d) => d.stand === "ueberholt");
  const klaerung = relevant.filter((d) => d.stand === "klaerung");
  const offen = relevant.filter((d) => d.stand === "offen");
  const bestanden = relevant.filter((d) => d.stand === "bestanden");
  const prognose = dp.erfassung === "prognose";
  const namen = (liste: DimensionsBefund[]) =>
    liste.map((d) => DIMENSIONSNAME[d.dimension]).join(", ");
  let zustand: Zustand;
  let grund: string;
  if (ueberholt.length > 0) {
    zustand = "ueberpruefung_noetig";
    grund = `Überprüfung nötig (${namen(ueberholt)}): ${ueberholt.map((d) => d.grund).join(" ")}`;
  } else if (klaerung.length > 0) {
    zustand = "klaerung";
    grund = `Klärungsbedarf (${namen(klaerung)}): ${klaerung.map((d) => d.grund).join(" ")}`;
  } else if (offen.length === 0) {
    zustand = "validiert";
    grund = `Validiert für Datenfassung ${dp.fassung} im Prüfrahmen ${namen(relevant)}.${prognose ? " Es bleibt eine Prognose mit Annahmen, kein beobachteter Wert." : ""}`;
  } else if (bestanden.length > 0) {
    zustand = "in_pruefung";
    grund = `In Prüfung: bestanden ${namen(bestanden)}; offen ${namen(offen)}.`;
  } else {
    zustand = "erfasst";
    grund = `Erfasst, noch nicht geprüft. Offen: ${namen(offen)}.`;
  }
  const naechsteArbeit = [
    ...ueberholt.map((d) =>
      d.dimension === "berechnung" && lebendig.berechnung
        ? "Neu berechnen und den Rechenweg erneut prüfen."
        : d.dimension === "aktualitaet" && lebendig.aktualitaet
          ? dp.quelle
            ? "Wert an der aktuellen Quellfassung neu lesen bzw. bestätigen."
            : "Die betroffene Eingabe an ihrer aktuellen Herkunft aktualisieren, dann neu berechnen."
          : `${DIMENSIONSNAME[d.dimension]} für Fassung ${dp.fassung} erneut prüfen.`,
    ),
    ...klaerung.map((d) => `Klärung zu ${DIMENSIONSNAME[d.dimension]}: ${d.grund}`),
    ...offen.map((d) => `${DIMENSIONSNAME[d.dimension]} prüfen.`),
  ];
  return {
    zustand,
    grund,
    naechsteArbeit,
    datenFassung: dp.fassung,
    erforderlich: noetig,
    dimensionen,
    prognose,
  };
}

export const DIMENSIONSNAME: Record<Dimension, string> = {
  erkennung: "Erkennung",
  struktur: "Struktur",
  berechnung: "Berechnung",
  konsistenz: "Konsistenz",
  aktualitaet: "Aktualität",
  fachliche_freigabe: "Fachliche Freigabe",
};

// ------------------------------------------------------------------------------------------------
// BINDUNGSSTAND — passt die Folie noch zum Datenpunkt?
// ------------------------------------------------------------------------------------------------

export type Bindungslage =
  /** Gebundene Dateifassung ist aktuell und zeigt den Wert. */
  | "aktuell"
  /** Neue Dateifassung; das Element zeigt den Wert weiterhin. */
  | "bestaetigt_in_neuer_fassung"
  /** Das Element zeigt einen anderen Wert als die Datenfassung (manuell geändert oder Wert korrigiert). */
  | "abweichung"
  | "element_fehlt"
  | "anhang_fehlt";

export interface BindungsSicht extends Bindung {
  readonly lage: Bindungslage;
  readonly anhangName?: string;
  /** Was heute am Element steht, wenn es abweicht. */
  readonly heute?: string;
}

/** Was eine Bindung in einem Foliensatz vorfindet. */
export type ElementBefund =
  | { readonly lage: "passt" }
  | { readonly lage: "element_fehlt" }
  | { readonly lage: "abweichung"; readonly heute: string };

/**
 * Derselbe Maßstab für den Anhang am Artikel und für die Präsentation, die PowerPoint auf dem Mac
 * oder im Web gerade geöffnet hat (Hostanschluss über A01): Folie über `p:sldId`, Element über
 * `p:cNvPr/@id`, bei Tabellen die Zelle; der Wert muss dort stehen, ein Bild muss dieselben Bytes
 * tragen.
 */
export function elementBefund(dp: Datenpunkt, b: Bindung, satz: FoliensatzDaten): ElementBefund {
  const element = satz.folien
    .find((f) => f.sldId === b.sldId)
    ?.elemente.find((e) => e.shapeId === b.shapeId);
  if (!element) {
    return { lage: "element_fehlt" };
  }
  const zelle =
    b.zeile !== undefined
      ? element.zellen?.find((z) => z.zeile === b.zeile && z.spalte === b.spalte)
      : undefined;
  if (b.zeile !== undefined && !zelle) {
    return { lage: "element_fehlt" };
  }
  const heute = zelle ? zelle.text : element.text;
  const passt =
    element.art === "bild"
      ? dp.fundstelle.art === "bild" && element.bild?.kennung === dp.fundstelle.bildKennung
      : zahlStehtImText(heute, dp.wert);
  return passt ? { lage: "passt" } : { lage: "abweichung", heute };
}

async function bindungsSicht(
  dp: Datenpunkt,
  b: Bindung,
  u: DatenUmgebung,
): Promise<BindungsSicht | undefined> {
  if (!(await u.artikel(b.koId))) {
    return undefined; // Ohne Leserecht an der Zielpräsentation keine Auskunft über die Bindung.
  }
  const datei = await u.folien(b.koId, b.anhangId);
  if (!datei) {
    return { ...b, lage: "anhang_fehlt" };
  }
  const befund = elementBefund(dp, b, datei.satz);
  if (befund.lage === "element_fehlt") {
    return { ...b, lage: "element_fehlt", anhangName: datei.name };
  }
  if (befund.lage === "abweichung") {
    return { ...b, lage: "abweichung", anhangName: datei.name, heute: befund.heute };
  }
  return {
    ...b,
    lage: datei.objectId === b.objectId ? "aktuell" : "bestaetigt_in_neuer_fassung",
    anhangName: datei.name,
  };
}

// ------------------------------------------------------------------------------------------------
// DIE SICHT — die Herkunft, wie der handelnde Nutzer sie sehen darf
// ------------------------------------------------------------------------------------------------

export type Schutzstufe = NonNullable<KnowledgeObject["confidentiality"]>;
const STUFEN: readonly Schutzstufe[] = ["intern", "vertraulich", "streng_vertraulich"];

export type QuellenSicht =
  | { readonly lesbar: false }
  | {
      readonly lesbar: true;
      readonly koId: string;
      readonly titel: string;
      readonly koFassung: number;
      readonly aktuelleFassung: number;
      readonly anhangId?: string;
      readonly anhangName?: string;
      readonly objectId?: string;
      readonly dateiFassung?: string;
    };

export type EingabeSicht =
  | { readonly lesbar: false; readonly verwendet: { readonly fassung: number } }
  | {
      readonly lesbar: true;
      /** Mit genau diesen Werten wurde gerechnet. */
      readonly verwendet: RechenwegEingabe;
      /**
       * Der Datenpunkt IN DER VERWENDETEN FASSUNG — mit der damaligen Quelle, Fundstelle und den
       * damals verwendeten Eingaben (Nacharbeit 2, Bens Befund 2).
       */
      readonly datenpunkt: DatenpunktSicht;
      /** Der heutige Stand der Eingabe, wenn sie sich seitdem geändert hat, sonst dieselbe Fassung. */
      readonly aktuell: { readonly fassung: number; readonly wert: string };
    };

export interface DatenpunktSicht {
  readonly id: string;
  readonly heimatKoId: string;
  readonly fassung: number;
  readonly art: Inhalt["art"];
  readonly wert: string;
  readonly zahl?: number;
  readonly einheit?: string;
  readonly waehrung?: string;
  readonly zeitraum?: string;
  readonly bezugsgroesse?: string;
  readonly erfassung: Erfassung;
  readonly quelle: QuellenSicht | null;
  readonly fundstelle: Fundstelle;
  readonly rechenweg: (Omit<Rechenweg, "eingaben"> & { readonly eingaben: EingabeSicht[] }) | null;
  readonly annahmen: readonly string[];
  readonly modellbezug?: string;
  readonly erfasstVon: { readonly id: string; readonly name?: string };
  readonly erfasstAm: string;
  readonly korrekturen: readonly (Korrektur & { readonly name?: string })[];
  readonly pruefungen: readonly (Pruefung & { readonly name?: string })[];
  readonly pruefstand: Pruefstand;
  readonly bindungen: readonly BindungsSicht[];
  /** Die strengste Schutzstufe aus Heimat, Quelle und allen Eingaben (V07). */
  readonly schutzstufe: Schutzstufe;
  /** Gesetzt, wenn diese Sicht eine frühere Datenfassung zeigt; Wirkungen gelten nur der aktuellen. */
  readonly historisch?: { readonly aktuelleFassung: number };
}

function strenger(a: Schutzstufe, b: Schutzstufe | undefined): Schutzstufe {
  return b && STUFEN.indexOf(b) > STUFEN.indexOf(a) ? b : a;
}

async function schutzstufeVon(
  dp: Datenpunkt,
  u: DatenUmgebung,
  tiefe: number,
): Promise<Schutzstufe> {
  let stufe = strenger("intern", (await u.meta(dp.heimatKoId))?.confidentiality);
  if (dp.quelle) {
    stufe = strenger(stufe, (await u.meta(dp.quelle.koId))?.confidentiality);
  }
  if (dp.rechenweg && tiefe > 0) {
    for (const e of dp.rechenweg.eingaben) {
      const ein = await u.datenpunkt(e.datenpunktId);
      if (ein) {
        stufe = strenger(stufe, await schutzstufeVon(ein, u, tiefe - 1));
      }
    }
  }
  return stufe;
}

const MAX_TIEFE = KETTENTIEFE;

async function mitNamen<T extends { von: string }>(
  liste: readonly T[],
  u: DatenUmgebung,
): Promise<(T & { name?: string })[]> {
  const ergebnis: (T & { name?: string })[] = [];
  for (const x of liste) {
    const name = x.von.startsWith("klarwerk:") ? undefined : await u.name(x.von);
    ergebnis.push(name ? { ...x, name } : x);
  }
  return ergebnis;
}

/**
 * Die Herkunft eines Datenpunkts für den handelnden Nutzer. `undefined`, wenn er nicht die ganze
 * Herkunft lesen darf (`vollLesbar`: Heimat, Quellen, Eingaben, Historie) — an der Route 404, in
 * Listen fehlt der Datenpunkt. Es gibt keine teilweise geschwärzte Sicht: Formel, Fundstelle,
 * Prüfgründe und Korrekturen tragen Werte der Quellen und Eingaben.
 *
 * `aktuelleFassung` ist gesetzt, wenn `dp` eine frühere Fassung ist (`inFassung`); Eingaben
 * erscheinen immer in der Fassung, mit der gerechnet wurde.
 */
export async function sicht(
  dp: Datenpunkt,
  u: DatenUmgebung,
  tiefe = MAX_TIEFE,
  aktuelleFassung: number = dp.fassung,
): Promise<DatenpunktSicht | undefined> {
  if (!(await lesbar(dp, u))) {
    return undefined;
  }
  let quelle: QuellenSicht | null = null;
  if (dp.quelle) {
    const ko = await u.artikel(dp.quelle.koId);
    if (!ko) {
      quelle = { lesbar: false };
    } else {
      const anhangName = dp.quelle.anhangId
        ? ko.attachments?.find((a) => a.id === dp.quelle?.anhangId)?.name
        : undefined;
      quelle = {
        lesbar: true,
        koId: ko.id,
        titel: ko.title,
        koFassung: dp.quelle.koFassung,
        aktuelleFassung: ko.version,
        ...opt("anhangId", dp.quelle.anhangId),
        ...opt("anhangName", anhangName),
        ...opt("objectId", dp.quelle.objectId),
        ...opt("dateiFassung", dp.quelle.dateiFassung),
      };
    }
  }
  let rechenweg: DatenpunktSicht["rechenweg"] = null;
  if (dp.rechenweg) {
    const eingaben: EingabeSicht[] = [];
    for (const e of dp.rechenweg.eingaben) {
      const ein = await u.datenpunkt(e.datenpunktId);
      // Die Eingabe in der Fassung, mit der gerechnet wurde — nicht ihr heutiger Stand.
      const damals = ein ? inFassung(ein, e.fassung) : undefined;
      const s =
        ein && damals && tiefe > 0 ? await sicht(damals, u, tiefe - 1, ein.fassung) : undefined;
      eingaben.push(
        ein && s
          ? {
              lesbar: true,
              verwendet: e,
              datenpunkt: s,
              aktuell: { fassung: ein.fassung, wert: ein.wert },
            }
          : { lesbar: false, verwendet: { fassung: e.fassung } },
      );
    }
    rechenweg = { ...dp.rechenweg, eingaben };
  }
  const bindungen: BindungsSicht[] = [];
  for (const b of dp.bindungen) {
    const s = await bindungsSicht(dp, b, u);
    if (s) {
      bindungen.push(s);
    }
  }
  const name = await u.name(dp.erfasstVon);
  const pruefungen = await mitNamen(dp.pruefungen, u);
  const stand = await pruefstand(dp, u);
  return {
    id: dp.id,
    heimatKoId: dp.heimatKoId,
    fassung: dp.fassung,
    art: dp.art,
    wert: dp.wert,
    ...opt("zahl", dp.zahl),
    ...opt("einheit", dp.einheit),
    ...opt("waehrung", dp.waehrung),
    ...opt("zeitraum", dp.zeitraum),
    ...opt("bezugsgroesse", dp.bezugsgroesse),
    erfassung: dp.erfassung,
    quelle,
    fundstelle: dp.fundstelle,
    rechenweg,
    annahmen: dp.annahmen ?? [],
    ...opt("modellbezug", dp.modellbezug),
    erfasstVon: { id: dp.erfasstVon, ...(name ? { name } : {}) },
    erfasstAm: dp.erfasstAm,
    korrekturen: await mitNamen(dp.korrekturen, u),
    pruefungen,
    pruefstand: {
      ...stand,
      dimensionen: stand.dimensionen.map((d) =>
        d.pruefung
          ? { ...d, pruefung: pruefungen.find((p) => p.id === d.pruefung?.id) ?? d.pruefung }
          : d,
      ),
    },
    bindungen,
    schutzstufe: await schutzstufeVon(dp, u, MAX_TIEFE),
    ...(aktuelleFassung !== dp.fassung ? { historisch: { aktuelleFassung } } : {}),
  };
}
