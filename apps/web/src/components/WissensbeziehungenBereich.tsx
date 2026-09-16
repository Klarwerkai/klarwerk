// ================================================================================================
// JOB 4153 (WG-ANZEIGE) — DIE GESETZTE FACHBEZIEHUNG: SICHTBAR, SETZBAR, WIDERRUFBAR.
// ================================================================================================
//
// WAS DIESER BEREICH IST. Bis hierher zeigte die Eintragsansicht nur die aus geteilten
// Schlagwörtern ABGELEITETE Nachbarschaft (`KnowledgeNeighborhood`, `GET /api/kos/:id/neighbors`).
// Die ausdrücklich GESETZTEN Fachbeziehungen — „gehört zu", „ergänzt", „ersetzt", „widerspricht",
// „Beispiel für" — lagen serverseitig als Typ fertig (`services/knowledge-object/src/kanten-types.ts`)
// und waren an keiner Stelle zu sehen. Hier sind sie: mit Richtung in einem Satz, der ohne
// Vorwissen stimmt, mit dem Menschen, der sie gesetzt hat, mit Datum, Status und Fassungsvermerk.
//
// ================================================================================================
// DIE TRENNUNG IST DER KERN, NICHT DIE OPTIK.
// ================================================================================================
//
// Eine geteilte Schlagwortnähe ist KEINE verantwortete Fachaussage. Deshalb ist dieser Bereich ein
// eigener Block ÜBER der Schlagwort-Zeichnung und nicht in sie hinein gemischt, deshalb trägt jede
// Zeile hier das Herkunftsetikett „gesetzt" und der Nachbarschaftsblock das Etikett „aus
// Schlagwörtern abgeleitet", und deshalb gibt es im Graphen zwei Kantenmengen und zwei Zahlen statt
// einer Summe (durchgängiger Vertrag Nr. 6, `gespraech/wiki-graph-integration-20260915/AUFTRAG.md`).
//
// ================================================================================================
// WAS HIER NIE BEHAUPTET WIRD (Vertrag Nr. 2, 6, 7 — G6)
// ================================================================================================
//
//   · „aktuell geprüft", „bestätigt", „geprüft konfliktfrei" — kommt an keiner Stelle vor. Die
//     Beziehungs-`version` ist eine Konfliktnummer für den Widerruf und wird dem Menschen NIE als
//     Inhaltsaussage angeboten; sie wird hier deshalb überhaupt nicht angezeigt.
//   · Weicht die heutige Fassung eines Endpunkts von der beurteilten ab, steht das als Vermerk da
//     („an Fassung n beurteilt, heute Fassung m"). Fehlt die beurteilte Fassung, steht „Bezug zur
//     Fassung unbekannt" — und nicht der heutige Stand.
//   · „widerspricht" ist ein verantworteter Vermerk und kein Beweis; „ersetzt" ändert keine
//     Freigabe. Beide Sätze stehen an der Kante selbst, nicht in einer Fußnote.
//   · Ein Widerruf ist keine Löschung. Kein Text hier behauptet eine.
//   · Eine angekommene Antwort ist keine geltende Beziehung: kommt sie mit `status: "widerrufen"`
//     zurück, steht hier kein Erfolg (BEN-R3-W). Und eine ausgelöste Auffrischung ist kein frischer
//     Bestand: auf die Liste zeigt der Satz erst, wenn ihre Abfrage ERFOLGREICH zurück war.
//   · Eine leere Liste heißt „niemand hat eine Beziehung gesetzt" — nie „keine Widersprüche".
//     Im FEHLERfall steht überhaupt keine Mengenaussage.
//
// ================================================================================================
// DAS ZUSTANDSMODELL — JEDE AUSSAGE HÄNGT AN IHRER VORAUSSETZUNG (Auftrag §9)
// ================================================================================================
//
//   LADEN                    → „Lädt …". Keine Mengenaussage, keine Leermeldung.
//   ERFOLGREICH LEER         → der Leersatz samt Hinweis, was er NICHT bedeutet.
//   FEHLER (ohne Cache)      → ein Fehlersatz, und gar keine Mengen-/Negativaussage.
//   CACHE + AUFFRISCHUNG     → der zwischengespeicherte Stand bleibt SICHTBAR, gekennzeichnet als
//                              „Stand von <Zeit> · Auffrischung läuft". Nichts wird leer geräumt.
//   CACHE + FEHLGESCHLAGEN   → derselbe Stand bleibt stehen UND der Fehler ist sichtbar
//                              („Stand von <Zeit> · Auffrischung fehlgeschlagen"). Er wird nicht
//                              als frisch ausgegeben. (Regel 7 des Bahnvertrags, Auftrag §9.)
//   OFFLINE / NICHT GESENDET → wie Fehler; die Eingabe bleibt VOLLSTÄNDIG erhalten, und nichts
//                              wird als gespeichert dargestellt.
//
// ================================================================================================
// OHNE KI, OHNE MAUS (G8)
// ================================================================================================
//
// Hier setzt ausschließlich ein Mensch über ein Formular; es gibt keinen Vorschlag, keine
// Automatik, kein Modell. Jede Handlung hängt an einem echten `<button>` oder `<a>` — kein `div`
// mit `onClick`, kein `tabIndex={-1}`. Keine Aussage steht nur in einer Farbe: jede Farbfläche
// trägt ihren Satz, und keine Zeile wird abgeschnitten (kein `truncate`, kein `nowrap`) — bei
// schmaler Breite bricht sie um. `tests/wissensgraph-anzeige/tastatur-und-schmal.test.tsx` hält das.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import {
  useBeziehungSetzen,
  useBeziehungWiderrufen,
  useKo,
  useKoBeziehungen,
  useLibrarySearch,
} from "../api/hooks";
import type { KantenArt, KantenRichtung, KantenRolle, KuratierteKanteAnsicht } from "../api/types";
import { auffrischungGescheitert } from "../lib/confidentiality";
import { koDetailPath } from "../lib/graphNav";
import { formatKoTimestamp } from "../lib/koDates";
import { AuffrischungHinweis } from "./bibliothek/AuffrischungHinweis";

/** Die fünf Arten in der Reihenfolge des Vertrags — geschlossen, wie serverseitig. */
export const BEZIEHUNGSARTEN: readonly KantenArt[] = [
  "gehoert_zu",
  "ergaenzt",
  "ersetzt",
  "widerspricht",
  "beispiel_fuer",
];

export const BEZIEHUNGSRICHTUNGEN: readonly KantenRichtung[] = [
  "gerichtet",
  "ungerichtet",
  "symmetrisch",
];

/**
 * Art → i18n-Schlüssel. Bewusst eine ausgeschriebene Abbildung und kein zusammengesetzter Schlüssel
 * (`wb.art.${art}`): ein Rohbezeichner wie `gehoert_zu` darf niemals an der Fläche landen, und eine
 * fehlende Übersetzung soll beim Lesen dieser Datei auffallen, nicht erst im Browser.
 */
const ART_TEXT: Record<KantenArt, string> = {
  gehoert_zu: "wb.art.gehoert_zu",
  ergaenzt: "wb.art.ergaenzt",
  ersetzt: "wb.art.ersetzt",
  widerspricht: "wb.art.widerspricht",
  beispiel_fuer: "wb.art.beispiel_fuer",
};

const RICHTUNG_TEXT: Record<KantenRichtung, string> = {
  gerichtet: "wb.richtung.gerichtet",
  ungerichtet: "wb.richtung.ungerichtet",
  symmetrisch: "wb.richtung.symmetrisch",
};

/**
 * DER RICHTUNGSSATZ — je Art und je Rolle ein eigener, vollständiger Satz.
 *
 * Er steht hier ausgeschrieben, weil „A ersetzt B" und „A wird ersetzt von B" nicht dieselbe
 * Aussage sind und sich nicht aus einem Muster erzeugen lassen: die passive Form ist im Deutschen
 * (und in den anderen zwei Sprachen) je Verb verschieden. Ein Satz, der beides mit demselben
 * Baukasten behauptet, wäre in der Hälfte der Fälle falsch.
 */
const SATZ: Record<KantenArt, Record<KantenRolle, string>> = {
  gehoert_zu: { quelle: "wb.satz.gehoert_zu.quelle", ziel: "wb.satz.gehoert_zu.ziel" },
  ergaenzt: { quelle: "wb.satz.ergaenzt.quelle", ziel: "wb.satz.ergaenzt.ziel" },
  ersetzt: { quelle: "wb.satz.ersetzt.quelle", ziel: "wb.satz.ersetzt.ziel" },
  widerspricht: { quelle: "wb.satz.widerspricht.quelle", ziel: "wb.satz.widerspricht.ziel" },
  beispiel_fuer: { quelle: "wb.satz.beispiel_fuer.quelle", ziel: "wb.satz.beispiel_fuer.ziel" },
};

const RICHTUNG_KURZ: Record<KantenRichtung, string> = {
  gerichtet: "wb.richtungKurz.gerichtet",
  ungerichtet: "wb.richtungKurz.ungerichtet",
  symmetrisch: "wb.richtungKurz.symmetrisch",
};

/**
 * Die Übersetzerform, die diese Datei WEITERGIBT. Sie ist Zeichen für Zeichen die des Hauses
 * (`lib/confidentiality.ts:217`), und das ist kein Zufall: `TFunction` aus i18next ist mehrfach
 * überladen, und unter `exactOptionalPropertyTypes` passt eine Form mit OPTIONALEM zweiten
 * Argument auf keine dieser Überladungen (gemessen: TS2345 an vier Stellen). Ein PFLICHTIGES
 * Wertobjekt passt — deshalb geben die Funktionen unten auch dort `{}` mit, wo es keine Werte gibt,
 * und Zahlen werden vorher zu Zeichenketten (die Interpolation macht ohnehin nichts anderes).
 */
type Uebersetzer = (schluessel: string, werte: Record<string, string>) => string;

/**
 * Art und Richtung in KLARTEXT — die einzige Stelle, an der ein Rohbezeichner in Sprache übersetzt
 * wird. Der Stufe-2-Graph (`pages/Stufe2.tsx`) holt sie von hier und schreibt die Abbildung nicht
 * ein zweites Mal hin: zwei Ausdrücke derselben Sache laufen beim nächsten Umbau auseinander, und
 * dann hieße dieselbe Kante in der Liste „ersetzt" und im Bild etwas anderes.
 */
export function beziehungsartText(art: KantenArt, t: Uebersetzer): string {
  return t(ART_TEXT[art], {});
}

export function beziehungsrichtungKurz(richtung: KantenRichtung, t: Uebersetzer): string {
  return t(RICHTUNG_KURZ[richtung], {});
}

/**
 * Der Satz zu EINER Kante.
 *
 * DIE ENTSCHEIDUNG, DIE HIER GETROFFEN WIRD: eine Richtungsaussage entsteht NUR aus `richtung ===
 * "gerichtet"` UND einer vorhandenen `rolle`. `ungerichtet`/`symmetrisch` tragen laut Vertrag keine
 * Richtung (`kanten-types.ts:23-28`) — ein erfundenes „quelle" wäre eine Behauptung. Und eine
 * gerichtete Kante ohne `rolle` ist eine Lücke in der Auskunft, nicht eine Richtung: dann steht die
 * schwächere Aussage da („Richtung nicht bekannt") und nicht die starke.
 */
export function beziehungssatz(kante: KuratierteKanteAnsicht, t: Uebersetzer): string {
  const title = kante.gegenstueck.title;
  const art = beziehungsartText(kante.art, t);
  if (kante.richtung !== "gerichtet") {
    return t("wb.satz.ohneRichtung", { title, art });
  }
  const rolle = kante.rolle;
  if (rolle === undefined) {
    return t("wb.satz.richtungUnbekannt", { title, art });
  }
  return t(SATZ[kante.art][rolle], { title });
}

/**
 * DER FASSUNGSVERMERK (G6) — die unbequeme Tatsache, sichtbar statt geglättet.
 *
 * `geaendert` nennt BEIDE Zahlenpaare, damit die Aussage ohne Rückfrage nachvollziehbar ist.
 * `unbekannt` nennt gar keine Zahl — die beurteilte Fassung fehlt, und sie wird hier nicht mit der
 * heutigen aufgefüllt (Nachtrag 2 §1: „niemals rückwirkend"). `unveraendert` sagt genau das und
 * nichts darüber hinaus: die Fassungen sind dieselben. Das ist keine Inhaltsprüfung.
 */
export function fassungsvermerk(kante: KuratierteKanteAnsicht, t: Uebersetzer): string {
  if (kante.abweichung === "unbekannt" || kante.beurteilt === null) {
    return t("wb.fassung.unbekannt", {});
  }
  if (kante.abweichung === "geaendert") {
    return t("wb.fassung.geaendert", {
      beurteiltQuelle: String(kante.beurteilt.quelleVersion),
      beurteiltZiel: String(kante.beurteilt.zielVersion),
      aktuellQuelle: String(kante.aktuell.quelleVersion),
      aktuellZiel: String(kante.aktuell.zielVersion),
    });
  }
  return t("wb.fassung.unveraendert", {
    aktuellQuelle: String(kante.aktuell.quelleVersion),
    aktuellZiel: String(kante.aktuell.zielVersion),
  });
}

/**
 * ================================================================================================
 * IST DER AUSGANG EINDEUTIG? — DIE FRAGE, DIE RUNDE 2 FALSCH BEANTWORTET HAT.
 * ================================================================================================
 *
 * DER BEFUND (BEN, Runde 2, Gegenbeispiel BEN1, gemessen): der Server SPEICHERT, und die Antwort
 * geht auf dem Rückweg verloren. Die Fläche sagte daraufhin „Nicht gesendet. Nichts wurde
 * gespeichert, deine Eingabe ist erhalten." — eine Aussage über den Bestand, für die es keinen
 * Beleg gab und die im Gegenbeispiel schlicht falsch war (`gespeichert: 1`).
 *
 * EIN TRANSPORTFEHLER BELEGT KEINE NICHT-SPEICHERUNG. Was der Client weiß, ist: er hat keine
 * Antwort bekommen. Über den Bestand weiß er dann NICHTS — und genau das muss dastehen.
 *
 * DESHALB EINE ALLOWLIST UND KEINE BLOCKLISTE, und das ist nicht Geschmack, sondern dieselbe
 * Doktrin, die im Haus schon für das Anhängen an einen Artikel gilt (`lib/appendToArticle.ts`,
 * `DEFINITE_APPEND_REJECTIONS`): EINDEUTIG abgelehnt ist nur, was der Server ausdrücklich als
 * Ablehnung beantwortet hat. Alles andere — Netzabbruch, 5xx, die clientseitige Frist (408), ein
 * unbekannter Code — ist UNKLAR und landet auf der sicheren Seite. Die falsche Richtung wäre teuer:
 * ein zu früh behauptetes „nichts gespeichert" lässt jemanden ein zweites Mal anlegen oder eine
 * gesetzte Beziehung für ungesetzt halten.
 */
const EINDEUTIG_ABGELEHNT: readonly number[] = [400, 401, 403, 404, 409];

export function ausgangEindeutig(err: unknown): boolean {
  return err instanceof ApiError && EINDEUTIG_ABGELEHNT.includes(err.status);
}

/**
 * Der Fehlersatz eines SCHREIBvorgangs.
 *
 * Bewusst eine Abbildung auf eigene Sätze und NICHT die Durchreichung der Servermeldung: eine
 * Servermeldung kann den Titel oder die Kennung eines geschützten Eintrags tragen, und genau das
 * darf an dieser Stelle nicht erscheinen (Vertrag Nr. 3, G4).
 *
 * `unklar` gibt der Aufrufer mit, weil Setzen und Widerruf verschiedene Handlungen sind und der
 * Satz „ob es angekommen ist, ist unklar" beide Male etwas ANDERES offen lässt. Ein gemeinsamer
 * Satz hätte den Menschen im Unklaren darüber gelassen, worüber er im Unklaren ist.
 */
export function schreibfehlerSchluessel(err: unknown, unklar: string): string {
  if (!ausgangEindeutig(err)) {
    return unklar;
  }
  const api = err as ApiError;
  if (api.status === 403) {
    return "wb.fehler.keinRecht";
  }
  if (api.status === 409) {
    return api.code.toLowerCase() === "stand_veraltet"
      ? "wb.fehler.standVeraltet"
      : "wb.fehler.konflikt";
  }
  // 400/401/404: der Server hat geantwortet und abgelehnt. Hier DARF „nichts gesetzt" dastehen.
  return "wb.fehler.abgelehnt";
}

function istStandVeraltet(err: unknown): boolean {
  return (
    err instanceof ApiError && err.status === 409 && err.code.toLowerCase() === "stand_veraltet"
  );
}

/**
 * ================================================================================================
 * PASST DIE ANTWORT ZUM AUFTRAG? — DIE ZWEITE LINIE GEGEN EINE FREMDE ERFOLGSMELDUNG.
 * ================================================================================================
 *
 * DER BEFUND (BEN, Runde 2, Gegenbeispiel BEN2, gemessen): nach einem Antwortverlust ändert der
 * Mensch die Art von `gehoert_zu` auf `widerspricht` und sendet erneut. Mit demselben
 * Vorgangsschlüssel antwortet der Server idempotent mit der ALTEN Kante — und die Fläche meldete
 * „Die Beziehung ist gesetzt — der Server hat sie bestätigt." Bestätigt war aber ein anderer
 * Auftrag als der, den der Mensch gerade gegeben hatte.
 *
 * Die erste Linie dagegen ist die Vorgangsidentität weiter unten: ein geänderter Inhalt ist ein
 * NEUER Vorgang und bekommt einen neuen Schlüssel. Diese Prüfung hier ist die zweite, und sie ist
 * nicht überflüssig: der Server dedupliziert auf kanonisches Paar UND Art (`kanten-paar.ts`), also
 * kann er auch bei korrektem Schlüssel eine bestehende Kante zurückgeben, deren RICHTUNG von der
 * angeforderten abweicht. Eine Erfolgsmeldung dafür wäre wieder eine fremde Bestätigung.
 *
 * Verglichen werden genau die drei Felder, die der Mensch bestimmt hat. `beurteilt`, `version` und
 * `gesetztAm` gehören dem Server; sie sind nicht sein Auftrag und werden nicht verglichen.
 */
export function antwortPasstZumAuftrag(
  antwort: KuratierteKanteAnsicht,
  auftrag: { zielId: string; art: KantenArt; richtung: KantenRichtung },
): boolean {
  return (
    antwort.gegenstueck.id === auftrag.zielId &&
    antwort.art === auftrag.art &&
    antwort.richtung === auftrag.richtung
  );
}

/**
 * ================================================================================================
 * EINE HTTP-ANTWORT BELEGT KEINE AKTIVE BEZIEHUNG — DIE DRITTE LINIE (BEN, Runde 3, BEN-R3-W).
 * ================================================================================================
 *
 * DER BEFUND (gemessen): der Mensch sendet, die Antwort geht verloren, jemand anders widerruft die
 * eben entstandene Beziehung, der Mensch wiederholt UNVERÄNDERT. Der Server antwortet idempotent
 * mit derselben Kante — die trägt jetzt `status: "widerrufen"`. Die Fläche meldete „Die Beziehung
 * ist gesetzt — der Server hat sie bestätigt", während die aktive Liste leer war.
 *
 * Inhalt und Status sind ZWEI Fragen: „ist das mein Auftrag?" (Ziel, Art, Richtung) und „gilt diese
 * Beziehung überhaupt?" (`status`). Erst wenn beide mit Ja beantwortet sind, ist etwas gesetzt.
 * Deshalb ein Befund mit drei Werten und kein zweites Ja/Nein: die beiden Fehlschläge brauchen
 * verschiedene Sätze, weil sie den Menschen zu Verschiedenem einladen (erneut senden gegen einen
 * anderen Auftrag geben).
 */
export type Antwortbefund = "erfolg" | "widerrufen" | "andererAuftrag";

export function antwortBefund(
  antwort: KuratierteKanteAnsicht,
  auftrag: { zielId: string; art: KantenArt; richtung: KantenRichtung },
): Antwortbefund {
  if (!antwortPasstZumAuftrag(antwort, auftrag)) {
    return "andererAuftrag";
  }
  return antwort.status === "aktiv" ? "erfolg" : "widerrufen";
}

/**
 * ================================================================================================
 * WAS DIE FLÄCHE ÜBER DEN BESTAND WEISS, NACHDEM EINE ANTWORT VERLOREN GING (BEN-R3-F).
 * ================================================================================================
 *
 * Nach einem unklaren Ausgang verweist der Satz auf die Liste — das war in Runde 3 ein Versprechen
 * ohne Deckung: die Auffrischung wurde zwar AUSGELÖST, aber ihr Erfolg war keine Voraussetzung für
 * den Satz „die Liste oben zeigt den Stand, den der Server jetzt meldet". Scheitert sie (oder hängt
 * sie), steht dort weiterhin der alte Cache, und der Satz erklärt ihn zur jetzigen Serverauskunft.
 *
 * Eine AUSGELÖSTE Auffrischung belegt keinen frischen Bestand. Deshalb hat der Satz jetzt drei
 * Fassungen, und welche dasteht, entscheidet der gemessene Ausgang genau dieser Auffrischung:
 *
 *   laeuft      → sie ist unterwegs; die Liste zeigt bis dahin einen ÄLTEREN Stand.
 *   geladen     → sie ist erfolgreich zurückgekommen; erst hier darf der Satz auf die Liste zeigen.
 *   gescheitert → sie ist fehlgeschlagen; die Liste zeigt einen älteren Stand, und das steht da.
 */
type Nachladestand = "laeuft" | "geladen" | "gescheitert";

const UNKLAR_SETZEN: Record<Nachladestand, string> = {
  laeuft: "wb.fehler.unklarLaedt",
  geladen: "wb.fehler.unklar",
  gescheitert: "wb.fehler.unklarNichtGeladen",
};

const UNKLAR_WIDERRUF: Record<Nachladestand, string> = {
  laeuft: "wb.widerruf.unklarLaedt",
  geladen: "wb.widerruf.unklar",
  gescheitert: "wb.widerruf.unklarNichtGeladen",
};

/**
 * Der laufende Vorgang: EIN Schlüssel gehört zu EINEM Inhalt.
 *
 * Der `beitragSchluessel` macht die Wiederholung einer unklar ausgegangenen Übertragung idempotent
 * (G3) — aber nur die Wiederholung DESSELBEN Auftrags. Wer Ziel, Art oder Richtung ändert, gibt
 * einen anderen Auftrag; ihn unter dem alten Schlüssel zu senden heißt, den Server zu bitten, den
 * ALTEN auszuführen. Deshalb wandert der Inhalt hier neben den Schlüssel, und `absenden` vergleicht.
 */
interface Vorgang {
  schluessel: string;
  zielId: string;
  art: KantenArt;
  richtung: KantenRichtung;
}

const ZEILE = "text-[12.5px] leading-snug text-muted";

export function WissensbeziehungenBereich({ koId }: { koId: string }): JSX.Element {
  const { t, i18n } = useTranslation();
  const liste = useKoBeziehungen(koId);
  // Die Fassung DIESES Eintrags — sie wandert als `gesehen.quelleVersion` in den Schreibvorgang.
  // Fehlt sie, wird nichts gesendet (unten): eine geratene Fassung wäre die stille Behauptung,
  // der Mensch habe einen Stand gesehen, den er nicht gesehen hat.
  const eigen = useKo(koId);
  const setzen = useBeziehungSetzen(koId);
  const widerrufen = useBeziehungWiderrufen(koId);

  const [begriff, setBegriff] = useState("");
  const [ziel, setZiel] = useState<{ id: string; title: string; version: number } | null>(null);
  const [art, setArt] = useState<KantenArt>("gehoert_zu");
  const [richtung, setRichtung] = useState<KantenRichtung>("gerichtet");
  // Der laufende Vorgang — Schlüssel UND der Inhalt, für den er gilt (s. `Vorgang` oben). `null`
  // heißt: es läuft keiner, der nächste Versuch eröffnet einen. Ein zu früh weggeworfener Schlüssel
  // erzeugt beim nächsten Klick eine zweite Kante, ein zu lange gehaltener eine Bestätigung für den
  // falschen Auftrag — dieselbe Doktrin wie `lib/createOperation.ts`, jetzt mit beiden Rändern.
  const [vorgang, setVorgang] = useState<Vorgang | null>(null);
  const [gesetzt, setGesetzt] = useState<KuratierteKanteAnsicht | null>(null);
  // Der Server hat geantwortet — aber etwas anderes zurückgegeben als angefordert, oder eine
  // widerrufene Beziehung. Beides ist KEIN Erfolg, und beides bekommt seinen eigenen Satz.
  const [antwortMangel, setAntwortMangel] = useState<Exclude<Antwortbefund, "erfolg"> | null>(null);
  const [widerrufFrage, setWiderrufFrage] = useState<string | null>(null);
  const [widerrufMeldung, setWiderrufMeldung] = useState(false);
  // Der Widerruf kam mit 200 zurück — und meldet die Beziehung weiterhin als aktiv. Auch das ist
  // kein Erfolg: eine erfolgreiche Übertragung ist keine Zustandsänderung.
  const [widerrufOhneWirkung, setWiderrufOhneWirkung] = useState(false);
  // Der gemessene Ausgang der Auffrischung, die zu einem unklaren Schreibausgang gehört. `null`
  // heisst „es gibt gerade keinen unklaren Ausgang"; der Satz nimmt dann die vorsichtigste Fassung.
  const [nachladen, setNachladen] = useState<Nachladestand | null>(null);

  const suchbegriff = begriff.trim();
  const treffer = useLibrarySearch({ q: suchbegriff }, suchbegriff.length >= 2);

  // Die FRISCHESTE bekannte Fassung des Ziels. Sie wird abgeleitet und nicht gespeichert: nach
  // einem `409 stand_veraltet` frischt der Bereich die Suche auf, und dann muss die angezeigte
  // Fassung dieselbe sein wie die, die der nächste Versuch mitsendet. Zwei Speicher desselben
  // Wertes wären genau die Stelle, an der Anzeige und Rumpf auseinanderlaufen.
  const zielFrisch = ziel ? treffer.data?.find((k) => k.id === ziel.id) : undefined;
  const zielVersion = zielFrisch?.version ?? ziel?.version;
  const quelleVersion = eigen.data?.version;

  // Die zwei Schreibwege haben ZWEI getrennte Fehlerstellen. Ein gemeinsamer Satz hätte den
  // Widerruf-Fehler unter das Setzen-Formular gelegt — dort sucht ihn niemand, und er sähe aus wie
  // ein Fehler der Eingabe, die er nicht betrifft.
  // Der unklare Satz kennt den Ausgang der Auffrischung. Solange nichts gemessen ist, gilt die
  // vorsichtigste Fassung („wird neu geladen") — nie die, die auf die Liste zeigt.
  const setzFehlerSchluessel = setzen.error
    ? schreibfehlerSchluessel(setzen.error, UNKLAR_SETZEN[nachladen ?? "laeuft"])
    : null;
  const widerrufFehlerSchluessel = widerrufen.error
    ? schreibfehlerSchluessel(widerrufen.error, UNKLAR_WIDERRUF[nachladen ?? "laeuft"])
    : null;
  // Bei `stand_veraltet` nennt der Satz den NEUEN Stand — aber nur, wenn er wirklich vorliegt.
  // Solange die Auffrischung läuft, steht die Fassung ohne Zahlen da; eine alte Zahl als „neuer
  // Stand" auszugeben wäre die Verwechslung, die dieser Fall gerade sichtbar macht.
  const standSatz =
    setzFehlerSchluessel === "wb.fehler.standVeraltet"
      ? quelleVersion !== undefined &&
        zielVersion !== undefined &&
        !eigen.isFetching &&
        !treffer.isFetching
        ? t("wb.fehler.standVeraltet", { quelle: quelleVersion, ziel: zielVersion })
        : t("wb.fehler.standVeraltetOhneZahlen")
      : null;

  /**
   * DIE AUFFRISCHUNG NACH EINEM SCHREIBVORGANG — UND IHR GEMESSENER AUSGANG.
   *
   * Entwertet werden die Auskünfte im Hook (`useBeziehungSetzen`, `onSettled`); das bleibt dort,
   * weil es für jeden Einbauort gilt. Was hier dazukommt, ist die ANTWORT auf die Frage, ob die
   * dadurch ausgelöste Auffrischung angekommen ist — denn nur der Ausgang trägt den Satz, den die
   * Fläche daneben schreibt. `cancelRefetch: false` hängt sich an die bereits laufende Abfrage an,
   * statt sie abzubrechen und eine zweite zu starten: es soll EIN Abruf sein, dessen Ende hier
   * bekannt wird, und nicht ein zweiter, der den ersten verdrängt.
   *
   * Ein eindeutig abgelehnter Vorgang (403/409/…) braucht das nicht: dort steht der Ausgang fest,
   * und der Satz behauptet ohnehin nichts über den Bestand.
   */
  const bestandNachladen = (fehler: unknown): void => {
    if (fehler === null || fehler === undefined || ausgangEindeutig(fehler)) {
      setNachladen(null);
      return;
    }
    setNachladen("laeuft");
    void liste.refetch({ cancelRefetch: false }).then(
      (ergebnis) =>
        setNachladen(ergebnis.isSuccess && ergebnis.data !== undefined ? "geladen" : "gescheitert"),
      () => setNachladen("gescheitert"),
    );
  };

  const absenden = (): void => {
    if (!ziel || zielVersion === undefined || quelleVersion === undefined) {
      return;
    }
    const auftrag = { zielId: ziel.id, art, richtung };
    // DIE VORGANGSREGEL, an einer Stelle: derselbe Inhalt behält seinen Schlüssel (Wiederholung
    // einer unklaren Übertragung, G3) — ein anderer Inhalt bekommt einen neuen (er ist ein anderer
    // Auftrag). Ohne diese Unterscheidung bestätigt der Server den alten Auftrag, und die Fläche
    // gibt das als Erfolg des neuen aus (BEN2).
    const fortsetzung =
      vorgang !== null &&
      vorgang.zielId === auftrag.zielId &&
      vorgang.art === auftrag.art &&
      vorgang.richtung === auftrag.richtung;
    const schluessel = fortsetzung ? vorgang.schluessel : crypto.randomUUID();
    if (!fortsetzung) {
      setVorgang({ schluessel, ...auftrag });
    }
    setGesetzt(null);
    setAntwortMangel(null);
    setWiderrufMeldung(false);
    setWiderrufOhneWirkung(false);
    setNachladen(null);
    setzen.mutate(
      { ...auftrag, beitragSchluessel: schluessel, gesehen: { quelleVersion, zielVersion } },
      {
        // BESTÄTIGT WIRD ERST HIER — und nur, wenn die Antwort der Auftrag ist UND die Beziehung
        // aktiv ist. Vorher gibt es keine Erfolgsmeldung und keinen Listeneintrag; die Liste kommt
        // nach der Entwertung (siehe `useBeziehungSetzen`) wieder vom Server.
        onSuccess: (kante) => {
          const befund = antwortBefund(kante, auftrag);
          if (befund !== "erfolg") {
            // Der Vorgang ist verbraucht: ein erneutes Senden unter DIESEM Schlüssel bekäme
            // dieselbe Antwort — die fremde Kante bzw. dieselbe widerrufene. Der nächste Versuch
            // eröffnet deshalb einen neuen Vorgang.
            setVorgang(null);
            setAntwortMangel(befund);
            return;
          }
          setGesetzt(kante);
          setVorgang(null);
          setZiel(null);
          setBegriff("");
        },
        // KEIN LEEREN DES FORMULARS. Bei jedem Fehlschlag bleibt jede Eingabe stehen, und der
        // Vorgang bleibt offen — der nächste unveränderte Versuch ist dieselbe Übertragung.
        onError: (err) => {
          if (istStandVeraltet(err)) {
            void eigen.refetch();
            void treffer.refetch();
          }
        },
        onSettled: (_kante, fehler) => bestandNachladen(fehler),
      },
    );
  };

  const widerrufAusfuehren = (kante: KuratierteKanteAnsicht): void => {
    setGesetzt(null);
    setAntwortMangel(null);
    setWiderrufOhneWirkung(false);
    setNachladen(null);
    widerrufen.mutate(
      { kanteId: kante.id, version: kante.version },
      {
        // Auch hier: die Antwort wird GELESEN und nicht nur ihr Eintreffen gefeiert. Meldet der
        // Server die Beziehung weiterhin als aktiv, ist der Widerruf nicht geschehen — dann steht
        // das da und nicht „Widerrufen".
        onSuccess: (antwort) => {
          setWiderrufFrage(null);
          if (antwort.status !== "widerrufen") {
            setWiderrufOhneWirkung(true);
            return;
          }
          setWiderrufMeldung(true);
        },
        onSettled: (_antwort, fehler) => bestandNachladen(fehler),
      },
    );
  };

  const stand = formatKoTimestamp(new Date(liste.dataUpdatedAt).toISOString(), i18n.language);

  return (
    <section className="space-y-3" data-testid="wissensbeziehungen">
      <div>
        <h3 className="text-[13.5px] font-semibold text-text">{t("wb.titel")}</h3>
        {/* Das Herkunftsetikett des BLOCKS steht hier, an jeder Kante steht es noch einmal —
            beides ist nötig: der Block sagt, was diese Liste ist, die Zeile sagt, was DIESE
            Verbindung ist (und unterscheidet sie von der abgeleiteten Nachbarschaft darunter). */}
        <p className={ZEILE}>{t("wb.hinweis")}</p>
      </div>

      {liste.data === undefined ? (
        liste.isError ? (
          // FEHLER OHNE CACHE: ein Satz. Keine Zahl, keine Liste, keine Leermeldung — über die
          // Menge der gesetzten Beziehungen ist an dieser Stelle NICHTS bekannt.
          <p
            className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
            data-testid="wb-fehler"
          >
            {t("wb.fehler")}
          </p>
        ) : (
          <p className={ZEILE} data-testid="wb-laedt">
            {t("state.loading")}
          </p>
        )
      ) : (
        <>
          {/* Der Stand des gezeigten Bestands — und ob er frisch ist. Die Werte verschwinden nie,
              auch nicht bei gescheiterter Auffrischung: nur ihre Gültigkeitsaussage wird schwächer.
              Den Satz für den gescheiterten Fall liefert die BESTEHENDE Bauform des Hauses
              (`AuffrischungHinweis`, `state.staleRefetchFailed`) — hier wird er nicht ein zweites
              Mal getippt. */}
          {auffrischungGescheitert(liste) ? (
            <AuffrischungHinweis query={liste} />
          ) : (
            <p className="text-[11.5px] text-muted-2" data-testid="wb-stand">
              {liste.isFetching
                ? t("wb.standAuffrischung", { zeit: stand ?? "—" })
                : t("wb.standFrisch", { zeit: stand ?? "—" })}
            </p>
          )}
          {liste.data.kanten.length === 0 ? (
            <div data-testid="wb-leer">
              <p className={ZEILE}>{t("wb.leer")}</p>
              {/* Die Ehrlichkeitsauflage: was der Leerfall NICHT heißt. Ohne diesen Satz liest
                  jemand „keine Beziehungen" als „nichts widerspricht sich". */}
              <p className="text-[11.5px] text-muted-2">{t("wb.leerHinweis")}</p>
            </div>
          ) : (
            <ul className="space-y-2.5" data-testid="wb-liste">
              {liste.data.kanten.map((kante) => (
                <li
                  key={kante.id}
                  className="rounded-card border border-hairline p-2.5"
                  data-testid="wb-kante"
                  data-kante-id={kante.id}
                >
                  <p className="text-[12.5px] font-semibold leading-snug text-text">
                    {beziehungssatz(kante, t)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {/* Die Herkunft dieser Verbindung, als Wort. Nicht als Farbe. */}
                    <span
                      className="rounded-btn bg-hairline-soft px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted"
                      data-testid="wb-herkunft"
                    >
                      {t("wb.herkunft.gesetzt")}
                    </span>
                    <span className="text-[11.5px] text-muted-2">
                      {t("wb.urheber", { urheber: kante.urheber })}
                    </span>
                    <span className="text-[11.5px] text-muted-2">
                      {formatKoTimestamp(kante.gesetztAm, i18n.language) === null
                        ? t("wb.gesetztAmUnbekannt")
                        : t("wb.gesetztAm", {
                            zeit: formatKoTimestamp(kante.gesetztAm, i18n.language),
                          })}
                    </span>
                    <Link
                      to={koDetailPath(kante.gegenstueck.id)}
                      className="ml-auto shrink-0 text-[11.5px] font-semibold text-ai hover:underline"
                    >
                      {t("nb.open")} <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                  {/* G6: der Fassungsvermerk. Er steht IMMER — auch wenn nichts abweicht —, damit
                      niemand aus seiner Abwesenheit „aktuell" schließt. */}
                  <p className="mt-1 text-[11.5px] text-muted" data-testid="wb-fassung">
                    {fassungsvermerk(kante, t)}
                  </p>
                  {kante.art === "widerspricht" ? (
                    <p className="mt-1 text-[11.5px] text-muted" data-testid="wb-grenze">
                      {t("wb.grenze.widerspricht")}
                    </p>
                  ) : null}
                  {kante.art === "ersetzt" ? (
                    <p className="mt-1 text-[11.5px] text-muted" data-testid="wb-grenze">
                      {t("wb.grenze.ersetzt")}
                    </p>
                  ) : null}
                  {widerrufFrage === kante.id ? (
                    <div className="mt-2 space-y-1.5" data-testid="wb-widerruf-frage">
                      <p className="text-[12px] font-semibold text-text">
                        {t("wb.widerruf.frage")}
                      </p>
                      {/* Der Text sagt, WAS ein Widerruf ist. Von Löschen steht hier nichts,
                          weil nichts gelöscht wird (Vertrag Nr. 7). */}
                      <p className="text-[11.5px] text-muted">{t("wb.widerruf.frageText")}</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-btn bg-trust-crit-bg px-3 py-1.5 text-[12px] font-semibold text-trust-crit-text disabled:opacity-50"
                          disabled={widerrufen.isPending}
                          onClick={() => widerrufAusfuehren(kante)}
                          data-testid="wb-widerruf-ja"
                        >
                          {widerrufen.isPending ? t("wb.widerruf.laeuft") : t("wb.widerruf.ja")}
                        </button>
                        <button
                          type="button"
                          className="rounded-btn border border-hairline px-3 py-1.5 text-[12px] font-semibold text-text"
                          onClick={() => setWiderrufFrage(null)}
                          data-testid="wb-widerruf-nein"
                        >
                          {t("wb.widerruf.nein")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1.5">
                      <button
                        type="button"
                        className="rounded-btn border border-hairline px-2.5 py-1 text-[11.5px] font-semibold text-muted hover:text-text"
                        onClick={() => {
                          setWiderrufMeldung(false);
                          setWiderrufOhneWirkung(false);
                          setWiderrufFrage(kante.id);
                        }}
                        data-testid="wb-widerruf"
                      >
                        {t("wb.widerruf.knopf")}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {widerrufFehlerSchluessel !== null ? (
        <p
          className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
          data-testid="wb-widerruf-fehler"
        >
          {t(widerrufFehlerSchluessel)}
        </p>
      ) : null}
      {/* 200 gekommen, nichts geschehen: der Server meldet die Beziehung weiterhin als aktiv.
          Das ist keine Erfolgsmeldung und wird auch nicht als eine dargestellt. */}
      {widerrufOhneWirkung ? (
        <p
          className="rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] text-trust-warn-text"
          data-testid="wb-widerruf-ohne-wirkung"
        >
          {t("wb.widerruf.nichtBestaetigt")}
        </p>
      ) : null}
      {widerrufMeldung ? (
        <p
          className="rounded-btn bg-hairline-soft px-3 py-2 text-[12.5px] text-text"
          data-testid="wb-widerruf-erfolg"
        >
          {t("wb.widerruf.erfolg")}
        </p>
      ) : null}

      {/* ==========================================================================================
          SETZEN — ausschließlich durch einen Menschen, über den bestehenden berechtigten Suchweg.
          ========================================================================================== */}
      <div className="space-y-2 border-t border-hairline pt-2.5" data-testid="wb-setzen">
        <h4 className="text-[12.5px] font-semibold text-text">{t("wb.setzen.titel")}</h4>
        {ziel === null ? (
          <>
            <label className="block space-y-1" htmlFor="wb-suche">
              <span className="block text-[12px] font-medium text-muted">
                {t("wb.setzen.suche")}
              </span>
              {/* Der BESTEHENDE Suchweg (`GET /api/library/search`) — dieselbe Rechte-Naht wie die
                  Bibliothek. Keine eigene Heuristik über die volle KO-Liste: die hätte ihre eigene,
                  zweite Antwort auf die Frage „was darf dieser Mensch sehen".

                  KEIN `placeholder` — und das ist keine Vergesslichkeit, sondern zwei Gründe:
                  (1) Ein Platzhalter verschwindet, sobald jemand tippt, und auf schmaler Fläche ist
                      er das Erste, was abgeschnitten wird — genau die Gestalt des Nutzerbefunds
                      N-0022. Ein stehender Hinweis unter dem Feld bleibt lesbar und ist über
                      `aria-describedby` auch für Hilfstechnik mit dem Feld verbunden.
                  (2) Die Platzhalter unter „Mehr" sind GEZÄHLT und mit ihrem Wortlaut je Sprache
                      festgehalten (`tests/bibliothek-mehr-platzhalter/platzhalter-englisch-chromium.test.ts`,
                      Sollwerttabelle mit ACHT Zeilen). Dieser Bereich hängt in einem
                      `[data-bib-abschnitt]`; ein neunter Platzhalter dort wäre eine Zeile in EINER
                      Tabelle, die diesem Auftrag nicht gehört — und hat in Runde 1 genau das Tor
                      rot gemacht (`expected 'de: 9 Platzhalter …' to be 'de: 8 Platzhalter …'`).
                      Dass hier keiner steht, hält `tests/wissensgraph-anzeige/tastatur-und-schmal.test.tsx`
                      fest. */}
              <input
                id="wb-suche"
                type="search"
                value={begriff}
                onChange={(e) => setBegriff(e.target.value)}
                aria-describedby="wb-suche-hinweis"
                className="h-9 w-full rounded-input border border-hairline bg-surface px-3 text-[13px] text-text outline-none focus:border-ink/30"
                data-testid="wb-suche"
              />
            </label>
            <p id="wb-suche-hinweis" className={ZEILE} data-testid="wb-suche-hinweis">
              {t("wb.setzen.sucheHinweis")}
            </p>
            {suchbegriff.length >= 2 ? (
              treffer.data === undefined ? (
                <p className={ZEILE} data-testid="wb-suche-zustand">
                  {treffer.isError ? t("wb.setzen.sucheFehler") : t("wb.setzen.sucheLaedt")}
                </p>
              ) : treffer.data.filter((k) => k.id !== koId).length === 0 ? (
                <p className={ZEILE} data-testid="wb-suche-zustand">
                  {t("wb.setzen.sucheLeer")}
                </p>
              ) : (
                <ul className="space-y-1">
                  {treffer.data
                    .filter((k) => k.id !== koId)
                    .map((k) => (
                      <li key={k.id}>
                        <button
                          type="button"
                          className="w-full rounded-btn border border-hairline px-2.5 py-1.5 text-left text-[12.5px] text-text hover:bg-hairline-soft"
                          onClick={() => setZiel({ id: k.id, title: k.title, version: k.version })}
                          aria-label={t("wb.setzen.zielWaehlen", { title: k.title })}
                          data-testid="wb-treffer"
                        >
                          {k.title}
                        </button>
                      </li>
                    ))}
                </ul>
              )
            ) : null}
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[12.5px] text-text" data-testid="wb-ziel">
              {t("wb.setzen.zielGewaehlt", {
                title: ziel.title,
                version: zielVersion ?? "—",
              })}
            </span>
            <button
              type="button"
              className="rounded-btn border border-hairline px-2 py-0.5 text-[11.5px] font-semibold text-muted hover:text-text"
              onClick={() => setZiel(null)}
              data-testid="wb-ziel-aendern"
            >
              {t("wb.setzen.zielAendern")}
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <label className="block space-y-1" htmlFor="wb-art">
            <span className="block text-[12px] font-medium text-muted">{t("wb.setzen.art")}</span>
            <select
              id="wb-art"
              value={art}
              onChange={(e) => setArt(e.target.value as KantenArt)}
              className="h-9 rounded-input border border-hairline bg-surface px-2 text-[13px] text-text"
              data-testid="wb-art"
            >
              {BEZIEHUNGSARTEN.map((a) => (
                <option key={a} value={a}>
                  {t(ART_TEXT[a])}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1" htmlFor="wb-richtung">
            <span className="block text-[12px] font-medium text-muted">
              {t("wb.setzen.richtung")}
            </span>
            <select
              id="wb-richtung"
              value={richtung}
              onChange={(e) => setRichtung(e.target.value as KantenRichtung)}
              className="h-9 rounded-input border border-hairline bg-surface px-2 text-[13px] text-text"
              data-testid="wb-richtung"
            >
              {BEZIEHUNGSRICHTUNGEN.map((r) => (
                <option key={r} value={r}>
                  {t(RICHTUNG_TEXT[r])}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          className="rounded-btn bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={ziel === null || quelleVersion === undefined || setzen.isPending}
          onClick={absenden}
          data-testid="wb-setzen-knopf"
        >
          {setzen.isPending ? t("wb.setzen.laeuft") : t("wb.setzen.knopf")}
        </button>
        {/* Warum der Knopf gesperrt ist, steht als Satz da — eine graue Fläche ohne Grund ist eine
            Sackgasse. Die Fassung dieses Eintrags ist die Voraussetzung für `gesehen`. */}
        {quelleVersion === undefined ? (
          <p className={ZEILE} data-testid="wb-fassung-fehlt">
            {t("wb.setzen.fassungUnbekannt")}
          </p>
        ) : ziel === null ? (
          <p className={ZEILE} data-testid="wb-ziel-fehlt">
            {t("wb.setzen.zielFehlt")}
          </p>
        ) : null}

        {setzFehlerSchluessel !== null ? (
          <p
            className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
            data-testid="wb-schreibfehler"
          >
            {standSatz ?? t(setzFehlerSchluessel)}
          </p>
        ) : null}
        {/* Der Server hat geantwortet — aber etwas anderes, als angefordert war. Das ist KEIN
            Erfolg und wird auch nicht als einer dargestellt. */}
        {antwortMangel === "andererAuftrag" ? (
          <p
            className="rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] text-trust-warn-text"
            data-testid="wb-abweichende-antwort"
          >
            {t("wb.fehler.andereAntwort")}
          </p>
        ) : null}
        {/* Die Antwort IST der Auftrag — aber die Beziehung ist widerrufen. Eine angekommene
            Antwort belegt keine geltende Beziehung (BEN-R3-W). */}
        {antwortMangel === "widerrufen" ? (
          <p
            className="rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] text-trust-warn-text"
            data-testid="wb-widerrufene-antwort"
          >
            {t("wb.fehler.widerrufeneAntwort")}
          </p>
        ) : null}
        {gesetzt !== null ? (
          <p
            className="rounded-btn bg-trust-pos-bg px-3 py-2 text-[12.5px] text-trust-pos-text"
            data-testid="wb-setzen-erfolg"
          >
            {t("wb.setzen.erfolg")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
