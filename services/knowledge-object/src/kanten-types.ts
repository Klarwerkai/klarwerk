// ================================================================================================
// JOB 1495 · D3 · H3 — DAS AGGREGAT, OHNE DIENST DRUMHERUM.
// ================================================================================================
//
// WARUM DIESE DATEI ENTSTEHT. Bis D3 standen Aggregat und Lesedienst in derselben Datei. Das trug,
// solange nur der Dienst die Typen brauchte. Mit `kanten-paar.ts` (der Kanonisierungsregel) gibt es
// einen zweiten Träger derselben Typen — und ein Import in beide Richtungen wäre ein Zyklus:
// `dependency-cruiser` hat ihn beim ersten Versuch sofort gemeldet
// (`no-circular: kanten-paar.ts → kanten-service.ts → kanten-paar.ts`).
//
// Der Feldbestand ist UNVERÄNDERT aus `kanten-service.ts` hierher gezogen — kein Feld kommt hinzu,
// keines fällt weg, keine Bedeutung verschiebt sich. Er stammt aus dem geschlossenen Vertrag der
// Kette JOB 1045 (D2 §2.3) und ist dort nicht neu erfunden worden, damit die Persistenzscheibe
// denselben Satz vorfindet.
//
// `kanten-service.ts` exportiert alles hier Stehende weiterhin — jeder bestehende Importpfad bleibt
// gültig, insbesondere der des Vertragstests
// (`tests/ko/kanten-lesekette-sichtbarkeit.test.ts:25-29`).

/** Die fachliche Beziehungsart. Bewusst geschlossen: eine freie Zeichenkette wäre kein Vertrag. */
export type KantenArt = "gehoert_zu" | "ergaenzt" | "ersetzt" | "widerspricht" | "beispiel_fuer";

/**
 * JOB 4151 — DIE ARTEN ALS WERT, weil eine Tür sie PRÜFEN muss.
 *
 * Die Union oben ist ein Vertrag für den Compiler. Was aus einem HTTP-Rumpf kommt, hat der Compiler
 * nie gesehen; die Route braucht dieselbe Menge zur LAUFZEIT. Sie hier abzuschreiben wäre die
 * zweite Wahrheit, gegen die dieses Modul durchgehend gebaut ist — deshalb steht sie einmal und
 * die Union leitet sich aus ihr NICHT ab (umgekehrt wäre die Reihenfolge die Aussage, und eine
 * Umsortierung änderte den Typ). Dass beide deckungsgleich bleiben, erzwingt `satisfies`.
 */
export const KANTEN_ARTEN = [
  "gehoert_zu",
  "ergaenzt",
  "ersetzt",
  "widerspricht",
  "beispiel_fuer",
] as const satisfies readonly KantenArt[];

/**
 * `gerichtet` behält die Reihenfolge der Endpunkte (A ersetzt B ist nicht B ersetzt A).
 * `ungerichtet` und `symmetrisch` tragen keine Richtungsaussage; ihr Endpunktpaar wird kanonisch
 * abgelegt — die Regel dafür steht in `kanten-paar.ts` und wird seit JOB 1495 D3 auch angewandt.
 */
export type KantenRichtung = "gerichtet" | "ungerichtet" | "symmetrisch";

/** Dieselbe Menge als Wert, aus demselben Grund wie `KANTEN_ARTEN` oben. */
export const KANTEN_RICHTUNGEN = [
  "gerichtet",
  "ungerichtet",
  "symmetrisch",
] as const satisfies readonly KantenRichtung[];

/**
 * `widerrufen` ist eine URHEBERAUSSAGE: ein Mensch hat die Beziehung zurückgenommen. Deshalb setzt
 * ein Papierkorbvorgang am Endpunkt diesen Wert NICHT (D3 §3.3) — sonst wäre nach der
 * Wiederherstellung nicht mehr unterscheidbar, ob jemand widerrufen hat oder ob die Kante nur ein
 * Papierkorbereignis überlebt hat. Die Sichtbarkeit trägt das allein.
 */
export type KantenStatus = "aktiv" | "widerrufen";

/**
 * JOB 4151 (G6) — DER INHALTSSTAND, DEN DER URHEBER BEIM SETZEN WIRKLICH BEURTEILT HAT.
 *
 * WARUM ES DIESES FELD GEBEN MUSS. `version` unten zählt, wie oft die BEZIEHUNG gesetzt wurde.
 * Über den INHALT der Endpunkte sagt sie nichts — und ohne einen zweiten Wert daneben gibt es
 * überhaupt keine Tatsache, aus der sich „gilt diese Beurteilung noch?" beantworten liesse. Eine
 * Oberfläche, die die Beziehungsversion als Inhaltsprüfung liest, behauptet dann etwas, das
 * niemand gemessen hat.
 *
 * DIE FELDNAMEN KOMMEN AUS DEM VERBINDLICHEN API-VERTRAG der Steuerung (HINWEIS zu JOB 4151,
 * 15.09. 17:30) und sind an QUELLE und ZIEL DER KANTE gebunden, nicht an die Kennungen.
 *
 * DARAUS FOLGT EINE PFLICHT, UND SIE IST AN GENAU EINER STELLE EINGELÖST: `kanonischesPaar`
 * (kanten-paar.ts) VERTAUSCHT bei richtungslosen Kanten die Endpunkte — und tauscht seit JOB 4151
 * diesen Block MIT. Täte es das nicht, vertauschte jede Kanonisierung still zwei Fassungsnummern,
 * und die Auskunft „unverändert" hinge an der Eingabereihenfolge.
 *
 * FEHLT DER BLOCK (`null` oder nicht gesetzt), IST DER STAND UNBEKANNT — nicht „unverändert". Der
 * Altbestand (jede Kante vor diesem Auftrag) trägt ihn nicht, und „unbekannt" ist dort die einzige
 * wahre Aussage. Er wird NIE rückwirkend mit der heutigen Version aufgefüllt (Vertrag, wörtlich).
 */
export interface BeurteilterStand {
  quelleVersion: number;
  zielVersion: number;
  /** Wann diese Fassung entstand — `null`, wenn der Verlauf sie nicht ausweist. */
  quelleFassungAm: string | null;
  zielFassungAm: string | null;
}

export interface KuratierteKante {
  /** Eigene Identität, nicht aus den Endpunkten abgeleitet. */
  id: string;
  quelleId: string;
  zielId: string;
  art: KantenArt;
  richtung: KantenRichtung;
  /** Der Mensch, der sie gesetzt hat. Nie ein Automat (D2 §2.6). */
  urheber: string;
  gesetztAm: string;
  geaendertAm: string;
  status: KantenStatus;
  version: number;
  /** JOB 4151 (G6): der beurteilte Inhaltsstand beider Endpunkte. Fehlt = unbekannt. */
  beurteilt?: BeurteilterStand | null;
  /**
   * JOB 4151 — DIE WIEDERHOLSCHLÜSSEL, UNTER DENEN DIESE BEZIEHUNG GESETZT WURDE.
   *
   * WARUM EINE LISTE UND NICHT DER LETZTE. Der Schlüssel ist die Zusage „derselbe Beitrag, nicht
   * ein zweiter": geht die ANTWORT verloren und der Client wiederholt, muss der Server denselben
   * Stand zurückgeben und NICHTS ändern. Behielte die Kante nur den zuletzt benutzten Schlüssel,
   * fiele eine Wiederholung nach einer zwischenzeitlichen zweiten Setzung durch das Netz und
   * zählte die Version hoch — also genau das, was der Schlüssel verhindern soll.
   *
   * Sie ist bewusst UNBEGRENZT und wird nicht beschnitten: ein abgeschnittener Schlüssel wäre eine
   * Idempotenzzusage mit Verfallsdatum, und ein solches Datum kennt kein Client.
   */
  beitragSchluessel?: readonly string[];
  /**
   * JOB 4151 (BEN R2, Korrekturpflicht 3) — DER MENSCH, DER ZURÜCKGENOMMEN HAT.
   *
   * WARUM ES DIESES FELD GEBEN MUSS. `urheber` oben ist eine Tatsache über die Vergangenheit: wer
   * die Beziehung ERFUNDEN hat. Sie bleibt beim Widerruf ausdrücklich stehen (kanten-repo.ts).
   * Damit gab es bis hierher NIEMANDEN, der für die Rücknahme geradesteht: der Schreibdienst
   * verlangte einen Urheber, prüfte ihn — und warf ihn dann weg. Gemessen von BEN: „Controller
   * setzt, Admin widerruft erfolgreich; im gespeicherten Aggregat fehlt der Admin vollständig."
   * Ein Widerruf ist eine URHEBERAUSSAGE (s. `KantenStatus`); eine Urheberaussage ohne Urheber ist
   * keine.
   *
   * ES GILT NUR ZUSAMMEN MIT `status: "widerrufen"` und wird mit ihm zurückgenommen: wer dieselbe
   * Beziehung erneut SETZT, macht sie wieder aktiv — dann steht hier wieder nichts, weil es dann
   * auch keine geltende Rücknahme mehr gibt. Ein stehen gebliebener Name wäre die Auskunft
   * „zurückgenommen" an einer aktiven Beziehung.
   *
   * DEN ZEITPUNKT TRÄGT `geaendertAm`, und zwar ohne zweites Feld daneben: beide entstehen im
   * selben Schritt und werden im selben Schritt zurückgenommen. Ein `widerrufenAm`, das immer
   * `geaendertAm` gliche, wäre eine zweite Wahrheit über denselben Vorgang — so schreibt es auch
   * der API-Vertrag der Steuerung („`status: "widerrufen"`, `geaendertAm`, Widerrufs-Urheber").
   */
  widerrufenVon?: string | null;
}

/**
 * JOB 4151 — DER FACHFEHLER DES KANTENBESTANDS.
 *
 * WARUM EIN EIGENER TYP UND KEIN `new Error(...)`: Der Bestand wies Selbstbeziehungen bis hierher
 * mit einem nackten `Error` ab. Am Draht ist das nicht von einem Infrastrukturfehler zu
 * unterscheiden — `sendError` (services/app/src/http.ts:129-159) entscheidet über den Status
 * ausschliesslich am `code`, und ohne Code endet jede fachliche Abweisung im generischen 500.
 *
 * DIE DREI CODES SIND KEINE NEUEN NAMEN: `NOT_FOUND`, `CONFLICT` und `VALIDATION` stehen bereits
 * im Haus (`STATUS_BY_CODE`, http.ts:43-70 → 404, 409 und der Vorgabewert 400). Ein vierter,
 * eigener Name für dieselbe Lage wäre genau die Uneinheitlichkeit, die JOB 3618 abgeschafft hat.
 *
 * `NOT_FOUND` TRÄGT ZWEI GRÜNDE UNUNTERSCHEIDBAR: die Beziehung gibt es nicht, oder ihre Kennung
 * ist erfunden. Die Meldung ist deshalb je Fall DIESELBE.
 *
 * `FORBIDDEN` TRÄGT DIE ENDPUNKTGRÜNDE, und zwar ebenfalls ununterscheidbar: unbekannt, im
 * Papierkorb, endgültig gelöscht oder für diesen Menschen unsichtbar. Der API-Vertrag der
 * Steuerung schreibt dafür ausdrücklich `403` vor („403 … bei unsichtbarem Endpunkt — Fehlertext
 * ohne Titel/Kennung/Zahl"), und das ist die stärkere Wahl: ein 404 würde „gibt es nicht" sagen
 * und damit für die Kennungen, die es GIBT, eine Auskunft treffen.
 *
 * `STAND_VERALTET` ist der eine Fall, in dem die Antwort MEHR sagt als „nein": der Aufrufer hat
 * einen älteren Inhaltsstand beurteilt, als heute gilt. Die aktuellen Fassungsnummern reisen mit —
 * sie sind keine Existenzauskunft, denn beide Endpunkte hat der Aufrufer bereits gesehen.
 */
export type KantenErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT"
  | "STAND_VERALTET"
  | "VALIDATION";

/**
 * JOB 4151 (R3) — ZWEI ERSTSETZUNGEN IM SELBEN AUGENBLICK. KEIN FEHLER DES AUFRUFERS.
 *
 * WARUM DIESER TYP NICHT IN `KantenErrorCode` GEHÖRT. Jeder Code dort wird am Draht zu einer
 * Antwort. Dieser Zustand darf den Draht gar nicht erreichen: er sagt nur „ein Zweiter war eine
 * Millisekunde schneller, die Zeile gibt es jetzt" — und die richtige Antwort darauf ist, den
 * Vorgang mit dem nun vorhandenen Stand zu Ende zu bringen, nicht dem Menschen einen Fehler zu
 * zeigen. Ein eigener HTTP-Code dafür wäre die Aufforderung, dem Nutzer die Nebenläufigkeit des
 * Servers zu erklären.
 *
 * WER IHN WIRFT: der Postgres-Bestand, und nur er — wenn der Unique-Index über dem
 * Beziehungsschlüssel eine zweite Zeile derselben fachlichen Beziehung abweist (`23505`). Der
 * Speicherbestand wirft ihn nie: sein `setze` hat zwischen Nachschlag und Ablage kein `await` und
 * ist damit unteilbar. Das ist keine Nachlässigkeit, sondern der Unterschied zwischen einer Map und
 * zwei Datenbankverbindungen — und er steht hier, damit ihn niemand für einen Vertragsbruch hält.
 *
 * WER IHN AUFLÖST: `KantenSchreibService.setze`, an genau einer Stelle. Eine Kennungskollision
 * (`ko_kanten_pkey`) ist AUSDRÜCKLICH kein Wettlauf und bleibt sichtbar — sie ist ein Fehler.
 */
export class KantenWettlauf extends Error {
  constructor() {
    super("Diese Beziehung wurde im selben Augenblick von einer zweiten Seite angelegt.");
    this.name = "KantenWettlauf";
  }
}

export class KantenError extends Error {
  readonly code: KantenErrorCode;
  /**
   * Die heutigen Fassungsnummern beider Endpunkte — NUR bei `STAND_VERALTET` gesetzt.
   *
   * Sie stehen hier und nicht in der Meldung, weil eine Oberfläche sie BRAUCHT: ohne sie müsste
   * der Mensch raten, gegen welchen Stand er seine Beurteilung wiederholen soll. Und sie stehen
   * als Feld und nicht als eingebauter Satz, damit sie kein Übersetzer zerpflückt.
   */
  readonly aktuell?: { quelleVersion: number; zielVersion: number };

  constructor(
    code: KantenErrorCode,
    message: string,
    aktuell?: { quelleVersion: number; zielVersion: number },
  ) {
    super(message);
    this.name = "KantenError";
    this.code = code;
    if (aktuell) {
      this.aktuell = aktuell;
    }
  }
}
