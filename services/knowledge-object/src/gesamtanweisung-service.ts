// ================================================================================================
// JOB 4154 · WIKI-GESAMTANWEISUNG — DIE REGELN. OHNE HTTP, OHNE DATENBANK, OHNE KI.
// ================================================================================================
//
// Diese Datei beantwortet fünf Fragen und sonst keine:
//   · Wie entsteht eine Anweisung, und wie kommen Fassungen hinein?
//   · Wie ändert sich Reihenfolge und Voraussetzung?
//   · Was SIEHT ein bestimmter Mensch (Lesestand samt Herkunft je Baustein)?
//   · Worin unterscheiden sich zwei festgehaltene Stände?
//   · Wer darf wann vorlegen und entscheiden?
//
// Sie trifft KEINE Rechteentscheidung: die kommt als `AnweisungSichtbar` übergeben, fail-closed
// (`erzwingeSichtbar`, gesamtanweisung-types.ts) — dasselbe Muster wie `kanten-service.ts:133-148`
// und aus demselben Grund: die Frage verbindet Rolle, Rechtematrix und Stufe am Objekt und wird an
// genau EINER Stelle beantwortet (`services/app/src/sichtbarkeit.ts`). Ein Import von dort wäre
// hier ein Modulgrenzenbruch, ein eigenes Prädikat die zweite Wahrheit.
//
// Sie ruft KEIN Modell. Anlegen, Aufnehmen, Ordnen, Lesen, Vergleichen, Vorlegen und Entscheiden
// laufen vollständig ohne KI (Startvertrag: „Ohne KI bleiben Erstellen, Lesen, manuelle
// Auswirkungsbewertung und berechtigter Workflow möglich").
//
// Sie erzeugt KEINE Gesamtfreigabe aus Bausteinmarkierungen. `stand` ändert sich ausschliesslich
// in `vorlegen` und `entscheiden` — an keiner anderen Stelle dieser Datei.
import { htmlToPlainText, searchImageNames } from "../../structure";
import {
  type Aktualisierungsvorschlag,
  type Anweisung,
  type AnweisungLesestand,
  type AnweisungListe,
  type AnweisungListeneintrag,
  type AnweisungRepo,
  type AnweisungSichtbar,
  type AnweisungStand,
  type AnweisungStandAufnahme,
  type AnweisungVergleich,
  type AufgenommenerBaustein,
  type Auswirkung,
  type Baustein,
  type BausteinInhalt,
  type BausteinLesestand,
  type Fassungslagen,
  INHALT_UNBEKANNT,
  type KoFassungslage,
  PRUEFANBINDUNG_OFFEN,
  type VergleichsBefund,
  anweisungFehler,
  erzwingeSichtbar,
  fassungsSchluessel,
} from "./gesamtanweisung-types";
import type { Confidentiality } from "./types";

// ================================================================================================
// DER INHALT EINER FASSUNG ALS TATSACHEN
// ================================================================================================

/** Die Form, in der eine gebundene Fassung hier hereinkommt — mehr braucht der Vergleich nicht. */
export interface FassungsInhaltQuelle {
  readonly bodyHtml?: string | null | undefined;
  readonly category?: string | null | undefined;
}

// Nur `<th>` — `<td>` ist eine Zelle, keine Überschrift. Der Sanitizer lässt `<th>` samt `colspan`
// durch (`services/structure/src/sanitize.test.ts:158-161`), also steht es wirklich im Rumpf.
const TABELLENUEBERSCHRIFT = /<th\b[^>]*>([\s\S]*?)<\/th\s*>/gi;

/**
 * Die drei vergleichbaren Tatsachen einer gebundenen Fassung.
 *
 * KEINE ZWEITE AUSWERTUNG: Die Beschriftung kommt aus `htmlToPlainText`, die Abbildungen aus
 * `searchImageNames` — beide aus `services/structure`, wo die EINE Auslegung von „was ist der Text
 * dieses Markups" und „wie heisst dieses Bild" wohnt. Was hier neu ist, ist ausschliesslich die
 * `<th>`-Auswahl; für Tabellenüberschriften gibt es im Haus bislang keine Funktion (gemessen:
 * `services/structure/index.ts` kennt keine).
 *
 * `null` heisst UNBEKANNT und nicht „keine": ohne Rumpf ist nicht feststellbar, ob es Tabellen oder
 * Abbildungen gibt. Ein leerer Rumpf dagegen ist eine Tatsache und ergibt `[]`.
 */
export function inhaltAusFassung(fassung: FassungsInhaltQuelle | null | undefined): BausteinInhalt {
  if (!fassung) {
    return INHALT_UNBEKANNT;
  }
  const geltung = typeof fassung.category === "string" ? fassung.category : null;
  if (typeof fassung.bodyHtml !== "string") {
    return { tabellenUeberschriften: null, abbildungen: null, geltung };
  }
  const ueberschriften: string[] = [];
  for (const treffer of fassung.bodyHtml.matchAll(TABELLENUEBERSCHRIFT)) {
    ueberschriften.push(htmlToPlainText(treffer[1] ?? ""));
  }
  return {
    tabellenUeberschriften: ueberschriften,
    abbildungen: searchImageNames(fassung.bodyHtml),
    geltung,
  };
}

// ================================================================================================
// ANLEGEN UND ÄNDERN
// ================================================================================================
//
// DIE NAMENSFORM DIESER FUNKTIONEN IST ABSICHT: `mitGeaendertemKopf`, `mitNeuerReihenfolge`,
// `alsVorgelegt`. Sie ÄNDERN nichts — sie geben eine NEUE Anweisung zurück und lassen die
// übergebene in Ruhe. Ein Imperativ („ändere", „lege vor") verspräche eine Wirkung, die hier nicht
// stattfindet; die Wirkung entsteht erst, wenn der Dienst weiter unten das Ergebnis schreibt.
//
// Es gibt noch einen zweiten, gemessenen Grund: hiesse die reine Funktion wie die Dienstmethode,
// die sie ruft, zählte `tests/capture/aufrufer-waechter.test.ts` den Aufruf NICHT — sein
// `bindungenVon` (`:225-231`) verdeckt innerhalb einer Methode deren eigenen Namen, und der Export
// stünde als „ohne Aufrufer" da, obwohl er einen hat. Verschiedene Namen für verschiedene Dinge
// sind hier also nicht nur sauberer, sondern auch messbar richtig.

export interface AnweisungKopf {
  readonly titel: string;
  readonly zweck: string;
  readonly geltungsbereich: string;
  readonly voraussetzungen: string;
}

function pflichttext(wert: unknown, feld: string): string {
  if (typeof wert !== "string" || wert.trim().length === 0) {
    throw anweisungFehler("INVALID", `Pflichtangabe fehlt: ${feld}.`);
  }
  return wert.trim();
}

function freitext(wert: unknown): string {
  return typeof wert === "string" ? wert.trim() : "";
}

/**
 * Eine entschiedene Anweisung ist keine Arbeitsfläche mehr.
 *
 * Genau das ist der Sinn der gebundenen Fassungen: Wer sie entschieden hat, hat DIESEN Stand
 * entschieden. Wer weiterarbeiten will, legt einen neuen an — das Produkt erfindet hier keinen
 * stillen Weg zurück.
 */
function nurAenderbar(anweisung: Anweisung): void {
  if (anweisung.stand === "entschieden") {
    throw anweisungFehler(
      "CONFLICT",
      "Diese Anweisung ist entschieden und wird nicht mehr geändert.",
      { stand: anweisung.stand, version: anweisung.version },
    );
  }
}

/** Der bedingte Schreibzugriff als Regel: der Aufrufer schreibt auf dem Stand, den er gelesen hat. */
function pruefeVersion(anweisung: Anweisung, version: number): void {
  if (anweisung.version !== version) {
    throw anweisungFehler(
      "CONFLICT",
      "Die Anweisung wurde zwischenzeitlich geändert — bitte erneut lesen.",
      { stand: anweisung.stand, version: anweisung.version },
    );
  }
}

function fortgeschrieben(
  anweisung: Anweisung,
  aenderung: Partial<Anweisung>,
  jetzt: string,
): Anweisung {
  return { ...anweisung, ...aenderung, version: anweisung.version + 1, geaendertAm: jetzt };
}

export function anweisungAnlegen(
  eingabe: { readonly id: string } & Partial<AnweisungKopf>,
  urheber: string,
  jetzt: string,
): Anweisung {
  return {
    id: pflichttext(eingabe.id, "id"),
    titel: pflichttext(eingabe.titel, "titel"),
    zweck: freitext(eingabe.zweck),
    geltungsbereich: freitext(eingabe.geltungsbereich),
    voraussetzungen: freitext(eingabe.voraussetzungen),
    bausteine: [],
    stand: "entwurf",
    version: 1,
    urheber: pflichttext(urheber, "urheber"),
    erstelltAm: jetzt,
    geaendertAm: jetzt,
  };
}

export function mitGeaendertemKopf(
  anweisung: Anweisung,
  version: number,
  kopf: Partial<AnweisungKopf>,
  jetzt: string,
): Anweisung {
  nurAenderbar(anweisung);
  pruefeVersion(anweisung, version);
  return fortgeschrieben(
    anweisung,
    {
      titel: kopf.titel === undefined ? anweisung.titel : pflichttext(kopf.titel, "titel"),
      zweck: kopf.zweck === undefined ? anweisung.zweck : freitext(kopf.zweck),
      geltungsbereich:
        kopf.geltungsbereich === undefined
          ? anweisung.geltungsbereich
          : freitext(kopf.geltungsbereich),
      voraussetzungen:
        kopf.voraussetzungen === undefined
          ? anweisung.voraussetzungen
          : freitext(kopf.voraussetzungen),
    },
    jetzt,
  );
}

export interface BausteinEingabe {
  readonly id: string;
  readonly koId: string;
  readonly koVersion: number;
  readonly nachweisHash: string | null;
  readonly voraussetzung?: string;
}

/**
 * Eine vorhandene Fassung in die Anweisung aufnehmen — ans Ende der Folge.
 *
 * Die Fassungsnummer ist PFLICHT und wird nicht aus dem Bestand geraten. „Nimm den Eintrag" gibt
 * es nicht; es gäbe sonst keinen festen Prüfstand.
 */
export function mitAufgenommenemBaustein(
  anweisung: Anweisung,
  version: number,
  eingabe: BausteinEingabe,
  jetzt: string,
): Anweisung {
  nurAenderbar(anweisung);
  pruefeVersion(anweisung, version);
  const id = pflichttext(eingabe.id, "baustein.id");
  if (anweisung.bausteine.some((b) => b.id === id)) {
    throw anweisungFehler("INVALID", "Diesen Baustein gibt es in der Anweisung bereits.");
  }
  if (!Number.isInteger(eingabe.koVersion) || eingabe.koVersion < 1) {
    throw anweisungFehler("INVALID", "Die gebundene Fassungsnummer fehlt oder ist ungültig.");
  }
  const voraussetzung = freitext(eingabe.voraussetzung);
  const baustein: Baustein = {
    id,
    position: anweisung.bausteine.length,
    koId: pflichttext(eingabe.koId, "baustein.koId"),
    koVersion: eingabe.koVersion,
    nachweisHash: typeof eingabe.nachweisHash === "string" ? eingabe.nachweisHash : null,
    ...(voraussetzung.length > 0 ? { voraussetzung } : {}),
  };
  return fortgeschrieben(anweisung, { bausteine: [...anweisung.bausteine, baustein] }, jetzt);
}

/**
 * Die Folge neu ordnen. Die übergebene Liste muss GENAU die vorhandenen Bausteine nennen — eine
 * Teilliste würde den Rest still ans Ende schieben, und das wäre eine Änderung, die niemand
 * angeordnet hat.
 */
export function mitNeuerReihenfolge(
  anweisung: Anweisung,
  version: number,
  reihenfolge: readonly string[],
  jetzt: string,
): Anweisung {
  nurAenderbar(anweisung);
  pruefeVersion(anweisung, version);
  const vorhanden = new Map(anweisung.bausteine.map((b) => [b.id, b]));
  if (reihenfolge.length !== vorhanden.size || new Set(reihenfolge).size !== reihenfolge.length) {
    throw anweisungFehler("INVALID", "Die Reihenfolge muss jeden Baustein genau einmal nennen.");
  }
  const neu: Baustein[] = [];
  for (const [index, id] of reihenfolge.entries()) {
    const baustein = vorhanden.get(id);
    if (!baustein) {
      throw anweisungFehler("INVALID", "Die Reihenfolge nennt einen fremden Baustein.");
    }
    neu.push({ ...baustein, position: index });
  }
  return fortgeschrieben(anweisung, { bausteine: neu }, jetzt);
}

export function mitGeaenderterVoraussetzung(
  anweisung: Anweisung,
  version: number,
  bausteinId: string,
  text: string | null,
  jetzt: string,
): Anweisung {
  nurAenderbar(anweisung);
  pruefeVersion(anweisung, version);
  if (!anweisung.bausteine.some((b) => b.id === bausteinId)) {
    throw anweisungFehler("NOT_FOUND", "Diesen Baustein gibt es in der Anweisung nicht.");
  }
  const wert = freitext(text);
  const bausteine = anweisung.bausteine.map((b) => {
    if (b.id !== bausteinId) {
      return b;
    }
    const { voraussetzung: _alt, ...rest } = b;
    return wert.length > 0 ? { ...rest, voraussetzung: wert } : rest;
  });
  return fortgeschrieben(anweisung, { bausteine }, jetzt);
}

// ================================================================================================
// DER LESESTAND — HERKUNFT JE BAUSTEIN, KEINE STILLE ERSETZUNG, KEINE SCHEINBARE VOLLSTÄNDIGKEIT
// ================================================================================================

/**
 * Was der Betrachter sieht.
 *
 * DREI ZUSAGEN, jede einzeln geprüft:
 *
 * 1. KEINE STILLE ERSETZUNG (F2). Herkunft und Inhalt stammen aus der GEBUNDENEN Fassung. Gibt es
 *    eine neuere, entsteht ein `aktualisierungsvorschlag` DANEBEN — die Bindung bleibt, wo sie ist.
 *    Ist die gebundene Fassung nicht auffindbar, bleibt `herkunft: null` und der Inhalt unbekannt;
 *    es wird NIE auf die heutige Fassung ausgewichen.
 *
 * 2. FAIL-CLOSED (F3). Ohne übergebene Sichtbarkeitsentscheidung ist nichts sichtbar. Ein Baustein,
 *    dessen Fassungslage fehlt, ist ebenfalls nicht zugänglich — der Betrachter kann ihn so wenig
 *    lesen wie einen verbotenen, und eine geratene Zugänglichkeit wäre das Leck.
 *
 * 3. KEINE FREIGABE AUS BAUSTEINEN (F5). `stand` wird hier DURCHGEREICHT, nicht abgeleitet. Kein
 *    Status eines gebundenen Eintrags hat Einfluss darauf — auch nicht, wenn alle validiert sind.
 */
export function lesestand(
  anweisung: Anweisung,
  fassungen: Fassungslagen,
  sichtbar: AnweisungSichtbar | undefined,
): AnweisungLesestand {
  const darf = erzwingeSichtbar(sichtbar);
  const bausteine: BausteinLesestand[] = [];
  let verborgen = 0;
  for (const baustein of anweisung.bausteine) {
    const lage = fassungen.get(fassungsSchluessel(baustein.koId, baustein.koVersion));
    if (!lage || !darf(lage)) {
      verborgen += 1;
      continue;
    }
    const gebunden = lage.gebunden;
    const aktualisierung: Aktualisierungsvorschlag | null =
      lage.aktuelleVersion !== null && lage.aktuelleVersion > baustein.koVersion
        ? { aufVersion: lage.aktuelleVersion }
        : null;
    bausteine.push({
      id: baustein.id,
      position: baustein.position,
      koId: baustein.koId,
      koVersion: baustein.koVersion,
      nachweisHash: baustein.nachweisHash,
      voraussetzung: baustein.voraussetzung ?? null,
      herkunft: gebunden
        ? {
            titel: gebunden.titel,
            autor: gebunden.autor,
            fassungAm: gebunden.fassungAm,
            status: gebunden.status,
          }
        : null,
      // JOB 4233: der Text der GEBUNDENEN Fassung. Er reist auf demselben Weg wie die Herkunft und
      // durch dieselbe Trimmung — ein verborgener Baustein ist hier oben schon übersprungen, sein
      // Rumpf verlässt den Server also nicht (`tests/…/entzogenes-recht-kein-text.test.ts`).
      rumpfHtml: gebunden ? gebunden.rumpfHtml : null,
      aktuelleKoVersion: lage.aktuelleVersion,
      aktualisierungsvorschlag: aktualisierung,
      inhalt: gebunden ? gebunden.inhalt : INHALT_UNBEKANNT,
    });
  }
  return {
    id: anweisung.id,
    titel: anweisung.titel,
    zweck: anweisung.zweck,
    geltungsbereich: anweisung.geltungsbereich,
    voraussetzungen: anweisung.voraussetzungen,
    stand: anweisung.stand,
    version: anweisung.version,
    urheber: anweisung.urheber,
    erstelltAm: anweisung.erstelltAm,
    geaendertAm: anweisung.geaendertAm,
    bausteine,
    unvollstaendig: verborgen > 0,
    verborgeneBausteine: verborgen,
    pruefanbindung: PRUEFANBINDUNG_OFFEN,
  };
}

// ================================================================================================
// JOB 4357 · EIN LISTENEINTRAG — ABGELEITET AUS DEM LESESTAND, NICHT NEBEN IHM GERECHNET.
// ================================================================================================
//
// DIE ENTSCHEIDUNG DIESER FUNKTION IST IHRE ERSTE ZEILE: sie ruft `lesestand` und liest dessen
// Felder ab. Sie zählt NICHTS selbst.
//
// Der naheliegende Entwurf wäre eine eigene Schleife über `anweisung.bausteine` mit demselben
// `!lage || !darf(lage)` darin. Das wäre ZWEIMAL dieselbe Regel, und die Lehre aus A22 steht
// wörtlich in `services/app/src/sichtbarkeit.ts:12-15`: „sechs Flächen trugen dieselbe Zeile, und
// weil niemand entschied, wie viele Zustände diese Zeile kennt, waren alle sechs falsch."
//
// Der Auftrag verlangt ausserdem ausdrücklich, dass die Liste „DIESELBEN Werte" nennt, die
// `GET /api/gesamtanweisungen/:id` für denselben Betrachter liefert (Abnahmekriterium 6). Über eine
// zweite Zählung wäre das eine Behauptung, die bei jeder künftigen Änderung an `lesestand`
// auseinanderlaufen könnte; hier ist es eine Folge der Bauart — und deshalb macht dieselbe
// Verstellung (der `darfSehen`-Filter in `lesestand`) BEIDE Wege rot, was die Gegenprobe des
// Auftrags erst zu einer Aussage über die Liste macht.
//
// WAS DABEI VERWORFEN WIRD, ist der Punkt: Bausteine, Herkünfte, Rümpfe, Inhalte und der
// Lückenvermerk. Aus dem Lesestand kommt hier nur der KOPF und die ZWEI ZAHLEN heraus. Der Preis
// ist ein Lesestand, der gebaut und weggeworfen wird — er ist eine reine Funktion über schon
// geladenen Daten und kostet keine Abfrage.
export function listeneintrag(
  anweisung: Anweisung,
  fassungen: Fassungslagen,
  sichtbar: AnweisungSichtbar | undefined,
): AnweisungListeneintrag {
  const gesehen = lesestand(anweisung, fassungen, sichtbar);
  return {
    id: gesehen.id,
    titel: gesehen.titel,
    stand: gesehen.stand,
    version: gesehen.version,
    urheber: gesehen.urheber,
    erstelltAm: gesehen.erstelltAm,
    geaendertAm: gesehen.geaendertAm,
    sichtbareBausteine: gesehen.bausteine.length,
    verborgeneBausteine: gesehen.verborgeneBausteine,
    unvollstaendig: gesehen.unvollstaendig,
  };
}

/**
 * Die Reihenfolge der Liste: die zuletzt geänderte Anweisung zuerst.
 *
 * SIE STEHT HIER UND NICHT IN DER ABLAGE (Begründung am Port, `AnweisungRepo.liste`): zwei
 * Implementierungen derselben Sortierregel laufen irgendwann auseinander, und dann hinge die
 * Reihenfolge davon ab, ob eine Instanz mit oder ohne Datenbank läuft.
 *
 * `id` als zweiter Schlüssel ist kein Zierrat: zwei Anweisungen können im selben Augenblick
 * entstehen (`geaendertAm` ist ein ISO-Zeitpunkt in Millisekunden, und `anlegen` setzt für Kopf und
 * Prüfstand denselben Wert). Ohne den zweiten Schlüssel wäre ihre Reihenfolge von der Ablage
 * abhängig — und ein Tastaturweg, der „den zweiten Eintrag" ansteuert, wäre dann nicht wiederholbar.
 */
function nachLetzterAenderung(a: Anweisung, b: Anweisung): number {
  if (a.geaendertAm !== b.geaendertAm) {
    return a.geaendertAm < b.geaendertAm ? 1 : -1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// ================================================================================================
// DER FESTGEHALTENE PRÜFSTAND
// ================================================================================================

/**
 * Den Stand festhalten — ohne Sichtbarkeitstrimm.
 *
 * Absichtlich: der Prüfstand ist der Bestand des Servers, nicht die Sicht eines Betrachters. Wer
 * ihn LIEST, bekommt ihn über `staendeVergleichen` und die Route, und dort gilt wieder die
 * Rechteprüfung an jedem gebundenen Baustein.
 */
export function standAufnehmen(
  anweisung: Anweisung,
  fassungen: Fassungslagen,
  jetzt: string,
): AnweisungStandAufnahme {
  const bausteine: AufgenommenerBaustein[] = anweisung.bausteine.map((baustein) => {
    const lage = fassungen.get(fassungsSchluessel(baustein.koId, baustein.koVersion));
    return {
      id: baustein.id,
      position: baustein.position,
      koId: baustein.koId,
      koVersion: baustein.koVersion,
      nachweisHash: baustein.nachweisHash,
      voraussetzung: baustein.voraussetzung ?? null,
      inhalt: lage?.gebunden ? lage.gebunden.inhalt : INHALT_UNBEKANNT,
    };
  });
  return {
    anweisungId: anweisung.id,
    version: anweisung.version,
    aufgenommenAm: jetzt,
    titel: anweisung.titel,
    zweck: anweisung.zweck,
    geltungsbereich: anweisung.geltungsbereich,
    voraussetzungen: anweisung.voraussetzungen,
    bausteine,
  };
}

// ================================================================================================
// DER VERGLEICH
// ================================================================================================

function befund(
  feld: VergleichsBefund["feld"],
  bausteinId: string | null,
  auswirkung: Auswirkung,
  hinweis: string,
): VergleichsBefund {
  return { feld, bausteinId, auswirkung, hinweis };
}

function textVergleich(a: string, b: string): Auswirkung {
  return a === b ? "unveraendert" : "geaendert";
}

/**
 * Listenvergleich mit ausdrücklichem Unbekannt.
 *
 * `null` auf EINER Seite genügt für `unbekannt` — wer eine Seite nicht kennt, kann nicht sagen, ob
 * sich etwas geändert hat. Das zu `unveraendert` zu runden wäre die bequeme Unwahrheit.
 */
function listenVergleich(a: readonly string[] | null, b: readonly string[] | null): Auswirkung {
  if (a === null || b === null) {
    return "unbekannt";
  }
  if (a.length !== b.length) {
    return "geaendert";
  }
  return a.every((wert, i) => wert === b[i]) ? "unveraendert" : "geaendert";
}

/**
 * Der Inhaltsvergleich EINES Bausteins.
 *
 * DER NACHWEIS GEHT VOR, und das ist der Kern von F7: sind beide Nachweis-Hashes vorhanden und
 * gleich, IST der Inhalt derselbe — dafür ist ein Nachweis da. Dann heisst das Ergebnis
 * `unveraendert`, und es heisst ausdrücklich nicht „richtig", „geprüft" oder „bestätigt".
 * Startvertrag: „Ein gleicher Hash bestätigt Unverändertheit, nicht Richtigkeit."
 *
 * Fehlt ein Hash oder weichen sie ab, wird auf die einzelnen Tatsachen zurückgefallen — und was
 * dort unbestimmbar ist, bleibt `unbekannt`.
 */
function inhaltsBefunde(
  bausteinId: string,
  vonHash: string | null,
  bisHash: string | null,
  von: BausteinInhalt,
  bis: BausteinInhalt,
): VergleichsBefund[] {
  if (vonHash !== null && bisHash !== null && vonHash === bisHash) {
    const satz = "Gleicher Nachweis: unverändert. Das ist keine Aussage über Richtigkeit.";
    return [
      befund("tabellenueberschriften", bausteinId, "unveraendert", satz),
      befund("abbildungen", bausteinId, "unveraendert", satz),
      befund("geltung", bausteinId, "unveraendert", satz),
    ];
  }
  const tabellen = listenVergleich(von.tabellenUeberschriften, bis.tabellenUeberschriften);
  const abbildungen = listenVergleich(von.abbildungen, bis.abbildungen);
  const geltung: Auswirkung =
    von.geltung === null || bis.geltung === null
      ? "unbekannt"
      : textVergleich(von.geltung, bis.geltung);
  return [
    befund(
      "tabellenueberschriften",
      bausteinId,
      tabellen,
      hinweisZu(tabellen, "Tabellenüberschriften"),
    ),
    befund("abbildungen", bausteinId, abbildungen, hinweisZu(abbildungen, "Abbildungen")),
    befund("geltung", bausteinId, geltung, hinweisZu(geltung, "Geltung")),
  ];
}

function hinweisZu(auswirkung: Auswirkung, was: string): string {
  if (auswirkung === "geaendert") {
    return `${was}: geändert.`;
  }
  if (auswirkung === "unbekannt") {
    return `${was}: Auswirkung nicht bestimmbar — fachlich zu klären.`;
  }
  return `${was}: unverändert.`;
}

/**
 * Zwei festgehaltene Stände vergleichen.
 *
 * DIE REIHENFOLGE ZÄHLT (F1). Dieselben unveränderten Bausteine in anderer Folge ergeben eine
 * GEÄNDERTE Gesamtfassung — eine Anweisung ist eine geordnete Folge, und wer Schritt 3 vor Schritt 1
 * stellt, hat etwas anderes angewiesen. Startvertrag, erster entscheidender Fall.
 *
 * `unbekannt` WIRD NIE ZU `unveraendert` (F7). Der Gesamtwert ist `geaendert`, sobald irgendetwas
 * nachweislich anders ist; sonst `unbekannt`, sobald irgendetwas unbestimmbar blieb; erst wenn
 * nichts von beidem zutrifft, `unveraendert`. Die Zahl der unbestimmbaren Befunde bleibt sichtbar.
 */
export function staendeVergleichen(
  von: AnweisungStandAufnahme,
  bis: AnweisungStandAufnahme,
): AnweisungVergleich {
  const befunde: VergleichsBefund[] = [];

  const kopf =
    textVergleich(von.titel, bis.titel) === "unveraendert" &&
    textVergleich(von.zweck, bis.zweck) === "unveraendert"
      ? "unveraendert"
      : "geaendert";
  befunde.push(befund("kopf", null, kopf, hinweisZu(kopf, "Titel und Zweck")));

  const geltung = textVergleich(von.geltungsbereich, bis.geltungsbereich);
  befunde.push(befund("geltung", null, geltung, hinweisZu(geltung, "Geltungsbereich")));

  const voraussetzungen = textVergleich(von.voraussetzungen, bis.voraussetzungen);
  befunde.push(
    befund("voraussetzungen", null, voraussetzungen, hinweisZu(voraussetzungen, "Voraussetzungen")),
  );

  const vonBausteine = new Map(von.bausteine.map((b) => [b.id, b]));
  const bisBausteine = new Map(bis.bausteine.map((b) => [b.id, b]));
  const alleIds = [...new Set([...vonBausteine.keys(), ...bisBausteine.keys()])];

  for (const id of alleIds) {
    const a = vonBausteine.get(id);
    const b = bisBausteine.get(id);
    if (!a || !b) {
      befunde.push(
        befund(
          "bausteinbestand",
          id,
          "geaendert",
          a ? "Baustein entfallen." : "Baustein neu aufgenommen.",
        ),
      );
      continue;
    }
    // F1: die POSITION ist eine eigene, gleichrangige Aussage — nicht ein Nebenbefund des Inhalts.
    const reihenfolge: Auswirkung = a.position === b.position ? "unveraendert" : "geaendert";
    befunde.push(befund("reihenfolge", id, reihenfolge, hinweisZu(reihenfolge, "Reihenfolge")));

    const fassung: Auswirkung =
      a.koId === b.koId && a.koVersion === b.koVersion ? "unveraendert" : "geaendert";
    befunde.push(befund("fassung", id, fassung, hinweisZu(fassung, "Gebundene Fassung")));

    const voraussetzung: Auswirkung =
      (a.voraussetzung ?? "") === (b.voraussetzung ?? "") ? "unveraendert" : "geaendert";
    befunde.push(
      befund("voraussetzungen", id, voraussetzung, hinweisZu(voraussetzung, "Voraussetzung")),
    );

    befunde.push(...inhaltsBefunde(id, a.nachweisHash, b.nachweisHash, a.inhalt, b.inhalt));
  }

  const unbekannte = befunde.filter((b) => b.auswirkung === "unbekannt").length;
  const gesamt: Auswirkung = befunde.some((b) => b.auswirkung === "geaendert")
    ? "geaendert"
    : unbekannte > 0
      ? "unbekannt"
      : "unveraendert";

  return {
    anweisungId: bis.anweisungId,
    vonVersion: von.version,
    bisVersion: bis.version,
    gesamt,
    befunde,
    unbekannte,
  };
}

// ================================================================================================
// VORLEGEN UND ENTSCHEIDEN
// ================================================================================================

/**
 * Zur Entscheidung vorlegen.
 *
 * Eine Anweisung ohne Bausteine wird nicht vorgelegt: es gäbe nichts zu entscheiden, und eine
 * „vorgelegte" leere Anweisung wäre genau die Scheinfunktion, die der Auftrag verbietet.
 */
export function alsVorgelegt(anweisung: Anweisung, version: number, jetzt: string): Anweisung {
  pruefeVersion(anweisung, version);
  if (anweisung.stand !== "entwurf" && anweisung.stand !== "abgelehnt") {
    throw anweisungFehler("CONFLICT", "Dieser Stand kann nicht vorgelegt werden.", {
      stand: anweisung.stand,
      version: anweisung.version,
    });
  }
  if (anweisung.bausteine.length === 0) {
    throw anweisungFehler("INVALID", "Diese Anweisung hat noch keine Bausteine.");
  }
  return fortgeschrieben(anweisung, { stand: "vorgelegt" }, jetzt);
}

export type Entscheidung = "angenommen" | "abgelehnt";

/**
 * Über die GESAMTFASSUNG entscheiden.
 *
 * DIE EINE REGEL, DIE HIER ZÄHLT (F4). Der Server bestätigt nur genau den unverändert vorgelegten
 * Prüfstand. Passt die mitgegebene `version` nicht mehr, wird nachvollziehbar abgelehnt — mit dem
 * NEUEN Stand — und nichts wird auf die falsche Fassung freigegeben. Der Stand bleibt `vorgelegt`,
 * weil diese Funktion in diesem Fall gar nichts zurückgibt, das jemand schreiben könnte.
 *
 * DIE ZWEITE REGEL (F5). `stand` entsteht hier aus einer menschlichen Entscheidung. Es gibt in
 * diesem Modul keine Zeile, die ihn aus Bausteinmarkierungen ableitet.
 */
export function alsEntschieden(
  anweisung: Anweisung,
  version: number,
  entscheidung: Entscheidung,
  jetzt: string,
): Anweisung {
  pruefeVersion(anweisung, version);
  if (anweisung.stand !== "vorgelegt") {
    throw anweisungFehler("CONFLICT", "Es liegt nichts zur Entscheidung vor.", {
      stand: anweisung.stand,
      version: anweisung.version,
    });
  }
  const stand: AnweisungStand = entscheidung === "angenommen" ? "entschieden" : "abgelehnt";
  return fortgeschrieben(anweisung, { stand }, jetzt);
}

// ================================================================================================
// DER DIENST — DIE REGELN OBEN AN BESTAND UND EINTRÄGEN
// ================================================================================================
//
// Alles über dieser Linie ist rein und synchron. Hier darunter kommt der Bestand dazu: die Ablage
// (`AnweisungRepo`) und die Leseseite der Wissenseinträge (`AnweisungKoLeser`). HTTP kommt weiterhin
// nicht vor — das ist Sache der Route.
//
// WARUM DIE RECHTEPRÜFUNG HIER WOHNT UND NICHT IN DER ROUTE: sie ist an JEDEN gebundenen Baustein
// geknüpft, nicht an die Anweisung. Diese Schleife an neun Endpunkten zu wiederholen wäre neun
// Gelegenheiten, sie einmal zu vergessen — und das eine Mal wäre die Rechtelücke. Die ENTSCHEIDUNG
// kommt trotzdem von aussen: `sichtbar` wird durchgereicht, nie hier gebildet.

/**
 * Die Tatsachen eines Wissenseintrags, die die Anweisung braucht.
 *
 * Strukturell erfüllt von `KnowledgeObject` (`types.ts:260`). Bewusst als eigene Mindestform: die
 * Anweisung braucht acht Felder von über vierzig, und was sie nicht liest, soll sie auch nicht
 * anfassen können.
 */
export interface AnweisungKoFakten {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly version: number;
  readonly author: string;
  readonly category: string;
  readonly confidentiality?: Confidentiality | null | undefined;
  readonly bodyHtml?: string | null | undefined;
}

/** Ein Fassungssatz — strukturell erfüllt von `KoVersionSnapshot` (`types.ts:457`). */
export interface AnweisungFassungssatz {
  readonly version: number;
  readonly at: string;
  readonly author: string;
  readonly snapshot: AnweisungKoFakten;
}

/** Die Leseseite des Eintragsbestands — strukturell erfüllt von `KoService`. */
export interface AnweisungKoLeser {
  get(id: string): Promise<AnweisungKoFakten | undefined>;
  versionsOf(id: string): Promise<readonly AnweisungFassungssatz[]>;
}

/**
 * Die Fassungslagen aller gebundenen Bausteine — EINE Abfrage je Eintrag, nicht je Baustein.
 *
 * FAIL-CLOSED AN DER QUELLE: Ist ein Eintrag nicht lesbar (gelöscht, nicht vorhanden, Abruf
 * scheitert), entsteht für ihn GAR KEINE Lage. Der Lesestand zählt ihn dann als verborgen, statt
 * ihn mit geratener Zugänglichkeit zu zeigen. Eine leere Lage mit fehlender Stufe wäre für
 * `darfSehen` „nicht vertraulich" und damit für jeden sichtbar — genau das Leck.
 *
 * KEIN AUSWEICHEN AUF DIE HEUTIGE FASSUNG (F2): `gebunden` kommt ausschliesslich aus dem
 * Fassungssatz zur GEBUNDENEN Nummer. Gibt es ihn nicht, bleibt `gebunden: null`.
 */
export async function fassungslagenFuer(
  bausteine: readonly Pick<Baustein, "koId" | "koVersion">[],
  ko: AnweisungKoLeser,
): Promise<Fassungslagen> {
  const lagen = new Map<string, KoFassungslage>();
  const eintraege = new Map<string, AnweisungKoFakten | undefined>();
  for (const koId of new Set(bausteine.map((b) => b.koId))) {
    eintraege.set(koId, await ko.get(koId).catch(() => undefined));
  }
  const fassungen = new Map<string, readonly AnweisungFassungssatz[]>();
  for (const [koId, eintrag] of eintraege) {
    if (!eintrag) {
      continue;
    }
    fassungen.set(koId, await ko.versionsOf(koId).catch(() => []));
  }
  for (const baustein of bausteine) {
    const eintrag = eintraege.get(baustein.koId);
    if (!eintrag) {
      continue;
    }
    const satz = fassungen.get(baustein.koId)?.find((f) => f.version === baustein.koVersion);
    const lage: KoFassungslage = {
      koId: baustein.koId,
      confidentiality: eintrag.confidentiality ?? null,
      author: eintrag.author,
      aktuelleVersion: eintrag.version,
      gebunden: satz
        ? {
            koId: baustein.koId,
            version: satz.version,
            titel: satz.snapshot.title,
            autor: satz.author,
            fassungAm: satz.at,
            status: satz.snapshot.status,
            inhalt: inhaltAusFassung(satz.snapshot),
            // JOB 4233: der Rumpf DIESES Fassungssatzes, unverändert. Nicht `eintrag.bodyHtml` —
            // das wäre die heutige Fassung und damit genau die stille Ersetzung aus F2.
            rumpfHtml: typeof satz.snapshot.bodyHtml === "string" ? satz.snapshot.bodyHtml : null,
          }
        : null,
    };
    lagen.set(fassungsSchluessel(baustein.koId, baustein.koVersion), lage);
  }
  return lagen;
}

// ================================================================================================
// JOB 4233 R2 · GEBUNDEN WIRD NUR, WAS BELEGT IST — KEIN NUMMERNBEREICH, KEIN GUTER GLAUBE
// ================================================================================================
//
// RUNDE 1 hat hier einen Nummernbereich genügen lassen („die Fassung hat es ja gegeben, nur ihr
// Abbild fehlt"). BEN hat das mit ROT zurückgewiesen, und die Begründung ist die stärkere:
//
//   · Ein Baustein bindet eine Fassung, DAMIT sein Inhalt feststeht. Ohne Fassungssatz steht
//     nichts fest — weder Titel noch Datum noch Rumpf. Eine solche Bindung ist eine Zusage ohne
//     Gegenstand, und sie lässt sich später durch nichts mehr einlösen.
//   · Der zweite Weg in denselben Zustand ist ein AUSFALL: `fassungslagenFuer` fängt einen
//     gescheiterten `versionsOf`-Abruf ab (`:719`) und arbeitet mit einer leeren Liste weiter.
//     Über einen Nummernbereich würde aus einem Ausfall ein erfolgreicher Schreibvorgang — genau
//     die Klasse Fehler, gegen die dieses Modul sonst überall fail-closed steht.
//
// Deshalb gilt wieder die bestellte Regel, wörtlich: `lage.gebunden !== null`. Sie steht direkt in
// `bausteinAufnehmen` — eine eigene Funktion dafür wäre ein Name für einen Vergleich.
//
// WAS DAMIT NICHT VERBOTEN IST: eine bereits gebundene Fassung, deren Satz später verschwindet.
// Sie bleibt im Bestand, und der Lesestand sagt ehrlich „nicht belegt" (F2, Lieferung 6). Die
// Sperre gilt der NEUEN Bindung, nicht dem Bestand — das ist der Unterschied zwischen „nichts
// Neues auf ungesichertem Grund" und „Geschichte umschreiben".

/**
 * Die Absage samt der Fassungen, die sich wirklich binden lassen.
 *
 * SIE WIRD ERST GERUFEN, WENN DIE SICHTBARKEIT SCHON GEPRÜFT IST (`bausteinAufnehmen` unten): der
 * Betrachter darf den Eintrag also ohnehin lesen, und die Fassungsnummern sagen ihm nichts, was
 * ihm die Eintragsansicht nicht auch sagt. Für jeden anderen endet der Weg vorher bei `FORBIDDEN`.
 *
 * AUFGEZÄHLT WERDEN DIE BELEGTEN SÄTZE, nicht ein Bereich: nur sie sind bindbar, und eine Zahl,
 * die in der Absage steht und beim nächsten Versuch wieder abgelehnt wird, wäre eine Irreführung.
 * Scheitert der Abruf, steht KEINE Auskunft dabei — dann behauptet die Meldung nicht, es gäbe
 * keine Fassungen (BENs Fall „Historienausfall").
 *
 * Der zusätzliche Abruf steht AUSSCHLIESSLICH auf dem Fehlerweg; der erfolgreiche Fall kostet
 * keine Abfrage mehr als vorher.
 */
async function fassungUnbekanntSatz(koId: string, ko: AnweisungKoLeser): Promise<string> {
  const saetze = await ko.versionsOf(koId).catch(() => []);
  const belegt = saetze.map((satz) => satz.version).sort((a, b) => a - b);
  return belegt.length > 0
    ? `Diese Fassung gibt es nicht. Belegt: ${belegt.join(", ")}.`
    : "Diese Fassung gibt es nicht.";
}

export interface GesamtanweisungDienstDeps {
  readonly repo: AnweisungRepo;
  readonly ko: AnweisungKoLeser;
  /** Die Uhr, injiziert — damit Prüfstände in Tests feste Zeiten tragen. */
  readonly jetzt: () => string;
  /** Der Kennungserzeuger für neue Bausteine. */
  readonly kennung: () => string;
}

/**
 * Der Dienst, den die Route ruft.
 *
 * JEDER schreibende Weg prüft VORHER das Recht an jedem gebundenen Baustein und schreibt DANACH
 * den festgehaltenen Prüfstand fort — beides an genau einer Stelle (`mitRecht`, `festhalten`).
 */
export class GesamtanweisungDienst {
  constructor(private readonly deps: GesamtanweisungDienstDeps) {}

  /**
   * Die Anweisung samt geprüfter Rechtelage laden.
   *
   * `streng` unterscheidet die zwei Fälle, und der Unterschied ist der Kern von F3:
   *   · LESEN (`streng: false`) trimmt — der Betrachter sieht, was er darf, und erfährt, dass
   *     etwas fehlt.
   *   · SCHREIBEN und VERGLEICHEN (`streng: true`) verweigern — wer nicht alles sehen darf, ordnet
   *     nichts um und bekommt keine Gegenüberstellung, die Lücken als „unverändert" ausgäbe.
   */
  private async geladen(
    id: string,
    sichtbar: AnweisungSichtbar | undefined,
    streng: boolean,
  ): Promise<{ anweisung: Anweisung; lagen: Fassungslagen }> {
    const anweisung = await this.deps.repo.get(id);
    if (!anweisung) {
      throw anweisungFehler("NOT_FOUND", "Diese Anweisung gibt es nicht.");
    }
    const lagen = await fassungslagenFuer(anweisung.bausteine, this.deps.ko);
    if (streng) {
      const darf = erzwingeSichtbar(sichtbar);
      for (const baustein of anweisung.bausteine) {
        const lage = lagen.get(fassungsSchluessel(baustein.koId, baustein.koVersion));
        if (!lage || !darf(lage)) {
          // KEINE Kennung, kein Titel, keine Zahl — die Meldung sagt nur, dass es nicht geht.
          throw anweisungFehler(
            "FORBIDDEN",
            "Teile dieser Anweisung sind für Sie nicht zugänglich.",
          );
        }
      }
    }
    return { anweisung, lagen };
  }

  /**
   * Schreiben — EIN Aufruf, der den Bestand und seinen Prüfstand zusammen ablegt.
   *
   * RUNDE 3, BENs Befund: hier standen ZWEI Aufrufe hintereinander (`repo.schreiben`, dann
   * `repo.standFesthalten`). Die Postgres-Ablage committet am Ende jedes Aufrufs; scheiterte der
   * zweite, blieb der Bestand geändert und die Historie unvollständig — und ein ausgelassener
   * Zwischenstand ist nicht mehr rekonstruierbar.
   *
   * Der Dienst kann das nicht selbst reparieren: er kennt keine Transaktion und soll auch keine
   * kennen. Die Klammer gehört der Ablage, und deshalb nimmt der Port die Aufnahme jetzt als
   * PARAMETER (`AnweisungRepo.schreiben`). Aus zwei Aufrufen, die man in der falschen Reihenfolge
   * oder gar nicht machen kann, ist einer geworden, den man nicht halbieren kann.
   *
   * Die Aufnahme entsteht weiterhin HIER, aus `neu` und den bereits geladenen Fassungslagen — die
   * Ablage bekommt einen fertigen Prüfstand und legt ihn ab; sie berechnet nichts.
   */
  private async schreiben(
    neu: Anweisung,
    erwartet: number,
    lagen: Fassungslagen,
  ): Promise<Anweisung> {
    await this.deps.repo.schreiben(neu, erwartet, standAufnehmen(neu, lagen, this.deps.jetzt()));
    return neu;
  }

  async anlegen(kopf: Partial<AnweisungKopf>, urheber: string): Promise<Anweisung> {
    const jetzt = this.deps.jetzt();
    const anweisung = anweisungAnlegen({ ...kopf, id: this.deps.kennung() }, urheber, jetzt);
    // Dieselbe Klammer wie beim Ändern: eine angelegte Anweisung ohne ihren ersten Prüfstand
    // hätte eine Historie mit einem Loch am Anfang.
    await this.deps.repo.anlegen(anweisung, standAufnehmen(anweisung, new Map(), jetzt));
    return anweisung;
  }

  async lesen(id: string, sichtbar: AnweisungSichtbar | undefined): Promise<AnweisungLesestand> {
    const { anweisung, lagen } = await this.geladen(id, sichtbar, false);
    return lesestand(anweisung, lagen, sichtbar);
  }

  /**
   * ==============================================================================================
   * JOB 4357 · DEN BESTAND AUFZÄHLEN — GETRIMMT WIE `lesen`, NICHT VERWEIGERT WIE `vergleichen`.
   * ==============================================================================================
   *
   * DIE EINE ENTSCHEIDUNG, DIE HIER FÄLLT, IST DIE DES `streng`-SCHALTERS AUS `geladen` — und sie
   * fällt auf `false`, also auf TRIMMEN. Der Grund ist derselbe, den `geladen` für `lesen` nennt:
   * der Betrachter sieht, was er darf, und ERFÄHRT, dass etwas fehlt. Ein `streng: true` würde die
   * ganze Zeile verschwinden lassen — und dann sähe „für dich verborgen" genauso aus wie „gibt es
   * nicht". Genau diese Verwechslung soll die Liste beenden: wer eine Anweisung gespeichert hat,
   * findet sie wieder.
   *
   * WAS DAS FÜR EINE VOLLSTÄNDIG VERBORGENE ANWEISUNG HEISST, ausdrücklich benannt: sie STEHT in
   * der Liste, mit Kopf und „0 sichtbar / N verborgen". Das ist eine Auskunft über ihre Existenz und
   * über ihren Titel — und sie ist gewollt, denn sie ist genau die Auskunft, die
   * `GET /api/gesamtanweisungen/:id` heute schon jedem `ko.read`-Inhaber gibt (`lesen` oben:
   * `geladen(…, false)` wirft nicht, `lesestand` trimmt). Hier entsteht also keine neue
   * Rechteregel; hier wird die bestehende auf eine zweite Ausgabeform angewandt. Was NICHT
   * hinausgeht, sind Titel, Fassungskennung und Rumpf der verborgenen Bausteine — dafür hat
   * `AnweisungListeneintrag` keinen Platz.
   *
   * KEINE ABLAGE, KEINE LISTE — UND KEINE LEERE LISTE. Fehlt `repo.liste`, ist der Bestand
   * UNBEKANNT, nicht leer. Ein `[]` wäre hier die Behauptung „es ist nichts gespeichert" auf
   * Grundlage von gar keiner Lesung; `INVALID` ist die Bestandsvokabel für „so geht es nicht"
   * (`AnweisungFehlerCode`, `gesamtanweisung-types.ts`), und ein fünfter Code ist hier verboten.
   *
   * EINE FASSUNGSLAGE JE ANWEISUNG, nacheinander: `fassungslagenFuer` fragt den Wissensbestand je
   * gebundenem Baustein. Das ist der ehrliche Preis dieses Endpunkts, und er ist benannt statt
   * versteckt — eine Anweisung ohne Bausteine kostet keine einzige Abfrage, weil die Schleife dort
   * über eine leere Menge läuft.
   */
  async auflisten(sichtbar: AnweisungSichtbar | undefined): Promise<AnweisungListe> {
    const liste = this.deps.repo.liste;
    if (typeof liste !== "function") {
      throw anweisungFehler(
        "INVALID",
        "Diese Ablage kann den Bestand nicht aufzählen — es wird deshalb kein leerer Bestand gemeldet.",
      );
    }
    const bestand = [...(await liste.call(this.deps.repo))].sort(nachLetzterAenderung);
    const eintraege: AnweisungListeneintrag[] = [];
    for (const anweisung of bestand) {
      const lagen = await fassungslagenFuer(anweisung.bausteine, this.deps.ko);
      eintraege.push(listeneintrag(anweisung, lagen, sichtbar));
    }
    return { eintraege };
  }

  async kopfAendern(
    id: string,
    version: number,
    kopf: Partial<AnweisungKopf>,
    sichtbar: AnweisungSichtbar | undefined,
  ): Promise<Anweisung> {
    const { anweisung, lagen } = await this.geladen(id, sichtbar, true);
    const neu = mitGeaendertemKopf(anweisung, version, kopf, this.deps.jetzt());
    return this.schreiben(neu, anweisung.version, lagen);
  }

  /**
   * Eine vorhandene Fassung aufnehmen.
   *
   * Der NEUE Baustein wird zusätzlich einzeln geprüft: Wer einen Eintrag nicht sehen darf, darf ihn
   * auch nicht einbinden — sonst stünde fremdes Wissen in der eigenen Anweisung, und die Kennung
   * allein wäre schon die Auskunft.
   *
   * ==============================================================================================
   * JOB 4233 · ZWEI PRÜFUNGEN IN DIESER REIHENFOLGE, UND DIE REIHENFOLGE IST DER SICHERHEITSKERN
   * ==============================================================================================
   *
   * BIS JOB 4233 stand hier NUR die Rechtefrage, und der Befund T-002 (`recherche/pruefung/
   * BEFUNDE.md:9`) ist ihre Folge: „Gesamtanweisung akzeptiert Version 999 bei einer Quelle mit nur
   * Version 1/2; Bestand und Anweisungsversion ändern sich." Eine Fassungslage entsteht nämlich
   * schon, wenn der EINTRAG lesbar ist — die gesuchte Nummer darf fehlen (`fassungslagenFuer`,
   * oben). Ein Baustein, der auf eine Fassung ohne Beleg zeigt, ist genau der Gegenstand, den der
   * Startvertrag ausschliesst: eine Bindung ohne Gebundenes.
   *
   *   1. SICHTBARKEIT. Wer den Eintrag nicht sehen darf, bekommt `FORBIDDEN` und sonst nichts —
   *      dieselbe Meldung wie für einen Eintrag, den es gar nicht gibt. Keine Kennung, keine Zahl,
   *      keine Auskunft über Existenz.
   *   2. BELEG (`lage.gebunden === null`). Erst danach, und nur für den, der den Eintrag ohnehin
   *      sehen darf, sagt das Produkt ehrlich, dass es DIESE Fassung nicht gibt — samt der
   *      Fassungen, die belegt sind.
   *
   * Vertauscht man die beiden, verrät der Unterschied zwischen den Antworten einem Fremden, welche
   * Fassungen ein geschützter Eintrag hat. Ein Leck ohne eine einzige geleakte Zeichenkette;
   * `tests/wiki-gesamtanweisung-fassungsbindung/absage-verraet-nichts.test.ts` hält es fest.
   *
   * ==============================================================================================
   * WARUM `INVALID` UND NICHT `NOT_FOUND` — DIE ZWEITE KORREKTURPFLICHT AUS RUNDE 1
   * ==============================================================================================
   *
   * DIESER EINE ENDPUNKT KENNT ZWEI „gibt es nicht", und sie sind verschiedene Gegenstände:
   *
   *   · die ANWEISUNG gibt es nicht  → `NOT_FOUND` aus `geladen` oben, HTTP 404.
   *   · die FASSUNG gibt es nicht    → `INVALID` von hier, HTTP 400.
   *
   * In Runde 1 trugen beide `NOT_FOUND`. Am Draht waren sie damit ununterscheidbar, und die Fläche
   * musste raten — BEN hat gemessen, was dabei herauskommt: eine verschwundene Anweisung wurde dem
   * Menschen als „diese Fassung gibt es nicht" gemeldet, über eine Fassung, die es sehr wohl gibt.
   * Ein fünfter Fehlercode wäre der bequeme Ausweg und ist hier verboten (`AnweisungFehlerCode`
   * kennt vier; ein neuer verlangte einen Eintrag in `build-app.ts`, und die Datei gehört JOB
   * 4151/4156). `INVALID` ist keine Notlösung, sondern die Bestandsvokabel für genau diesen Fall:
   * „die Eingabe taugt nicht" (`gesamtanweisung-types.ts`, Kopf der Fehlerliste) — der Aufrufer hat
   * eine Fassungsnummer genannt, die dieser Eintrag nicht hat.
   *
   * Eine unbrauchbare Fassungsnummer (0, negativ, gebrochen) hat ebenfalls keinen Fassungssatz und
   * endet deshalb hier — mit demselben Code, den `mitAufgenommenemBaustein` ihr gäbe. Jene
   * Formprüfung bleibt stehen: sie gehört der reinen Funktion und ihren eigenen Aufrufern.
   */
  async bausteinAufnehmen(
    id: string,
    version: number,
    eingabe: Omit<BausteinEingabe, "id"> & { readonly id?: string },
    sichtbar: AnweisungSichtbar | undefined,
  ): Promise<Anweisung> {
    const { anweisung } = await this.geladen(id, sichtbar, true);
    const kandidat = { koId: eingabe.koId, koVersion: eingabe.koVersion };
    const kandidatLagen = await fassungslagenFuer([kandidat], this.deps.ko);
    const lage = kandidatLagen.get(fassungsSchluessel(kandidat.koId, kandidat.koVersion));
    if (!lage || !erzwingeSichtbar(sichtbar)(lage)) {
      throw anweisungFehler("FORBIDDEN", "Diese Fassung kann nicht aufgenommen werden.");
    }
    if (lage.gebunden === null) {
      throw anweisungFehler("INVALID", await fassungUnbekanntSatz(kandidat.koId, this.deps.ko));
    }
    const neu = mitAufgenommenemBaustein(
      anweisung,
      version,
      { ...eingabe, id: eingabe.id ?? this.deps.kennung() },
      this.deps.jetzt(),
    );
    const lagen = await fassungslagenFuer(neu.bausteine, this.deps.ko);
    return this.schreiben(neu, anweisung.version, lagen);
  }

  async reihenfolgeSetzen(
    id: string,
    version: number,
    reihenfolge: readonly string[],
    sichtbar: AnweisungSichtbar | undefined,
  ): Promise<Anweisung> {
    const { anweisung, lagen } = await this.geladen(id, sichtbar, true);
    const neu = mitNeuerReihenfolge(anweisung, version, reihenfolge, this.deps.jetzt());
    return this.schreiben(neu, anweisung.version, lagen);
  }

  async voraussetzungSetzen(
    id: string,
    version: number,
    bausteinId: string,
    text: string | null,
    sichtbar: AnweisungSichtbar | undefined,
  ): Promise<Anweisung> {
    const { anweisung, lagen } = await this.geladen(id, sichtbar, true);
    const neu = mitGeaenderterVoraussetzung(
      anweisung,
      version,
      bausteinId,
      text,
      this.deps.jetzt(),
    );
    return this.schreiben(neu, anweisung.version, lagen);
  }

  async vorlegen(
    id: string,
    version: number,
    sichtbar: AnweisungSichtbar | undefined,
  ): Promise<Anweisung> {
    const { anweisung, lagen } = await this.geladen(id, sichtbar, true);
    const neu = alsVorgelegt(anweisung, version, this.deps.jetzt());
    return this.schreiben(neu, anweisung.version, lagen);
  }

  async entscheiden(
    id: string,
    version: number,
    entscheidung: Entscheidung,
    sichtbar: AnweisungSichtbar | undefined,
  ): Promise<Anweisung> {
    const { anweisung, lagen } = await this.geladen(id, sichtbar, true);
    const neu = alsEntschieden(anweisung, version, entscheidung, this.deps.jetzt());
    return this.schreiben(neu, anweisung.version, lagen);
  }

  /** Die Versionsnummern, zu denen ein Prüfstand festgehalten ist. */
  async staende(id: string, sichtbar: AnweisungSichtbar | undefined): Promise<readonly number[]> {
    await this.geladen(id, sichtbar, true);
    return this.deps.repo.staende(id);
  }

  /**
   * Zwei festgehaltene Stände gegenüberstellen.
   *
   * STRENG: gibt es einen Baustein, den der Betrachter nicht sehen darf, entsteht hier KEIN
   * getrimmter Vergleich. Ein Vergleich über eine Teilmenge würde „unverändert" sagen, wo der Leser
   * die geänderte Hälfte nur nicht sehen durfte — die gefährlichste Form der Unwahrheit in diesem
   * ganzen Auftrag.
   */
  async vergleichen(
    id: string,
    vonVersion: number,
    bisVersion: number,
    sichtbar: AnweisungSichtbar | undefined,
  ): Promise<AnweisungVergleich> {
    await this.geladen(id, sichtbar, true);
    const von = await this.deps.repo.standLesen(id, vonVersion);
    const bis = await this.deps.repo.standLesen(id, bisVersion);
    if (!von || !bis) {
      throw anweisungFehler("NOT_FOUND", "Zu diesem Stand liegt keine Aufnahme vor.");
    }
    return staendeVergleichen(von, bis);
  }
}
