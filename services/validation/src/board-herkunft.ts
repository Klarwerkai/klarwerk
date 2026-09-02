// ================================================================================================
// JOB 3003 · STATION 4 — WIE VERTRAULICH, UND WOHER: DIE ZWEI AUSKUENFTE AM PRUEF-BOARD.
// ================================================================================================
//
// WARUM `null` MIT `provenance: "unknown"` UND NICHT EIN WEGGELASSENES FELD.
//
// Am Wissensobjekt sind beide Auskuenfte OPTIONAL: `confidentiality` wird nur gespeichert, wenn sie
// tatsaechlich vertraulich ist (knowledge-object/src/service.ts:1650-1654 — „intern"/ungueltig
// bleibt weg), und `origin` nur, wenn der Entwurf eine mitbringt (ebd. :1656-1660). Ein nicht
// gesetztes optionales Feld FEHLT im JSON vollstaendig. Fuer den Menschen vor dem Pruef-Board sind
// dann zwei voellig verschiedene Zustaende ununterscheidbar:
//
//   · „dieses Objekt ist nicht eingestuft"  und
//   · „diese Route liefert die Einstufung nicht".
//
// Wer die beiden nicht trennen kann, muss raten — und Raten ist an einer Pruefflaeche das
// Schlimmste, was passieren kann. Deshalb steht hier IMMER ein Schluessel, und der Fehlzustand ist
// eine AUSSAGE: `confidentiality: null` zusammen mit `confidentialityProvenance: "unknown"`.
//
// DIE SPRACHE IST NICHT NEU — sie stand nur nicht auf diesem Lesepfad. `search-projection.ts:691-698`
// haelt denselben Grundsatz fuer die Suchprojektion fest: „Weggelassen heisst AUSDRUECKLICH
// unbestaetigt … nie eine stillschweigend als `verified` gehashte Aussage." Und
// `classificationValueOf` (ebd. :160-172) sagt ausdruecklich, warum dort NICHT
// `normalizeConfidentiality` benutzt wird: die normalisiert fehlende Werte defensiv auf „intern"
// und BEHAUPTET damit eine Einstufung, die nie jemand gesetzt hat.
//
// GENAU DIESE ZEILE WIRD HIER NICHT GEZOGEN, und das ist die wichtigste Grenze dieser Datei:
//
//   DIE ANREICHERUNG IST EINE AUSKUNFT, KEIN TOR. Fuer den ZUGRIFF gilt weiterhin und
//   unveraendert `sichtbareFuer`/`darfSehen` (services/app/src/sichtbarkeit.ts), und DORT gilt eine
//   fehlende Stufe weiter als „intern" — mit ausgeschriebener Begruendung (sichtbarkeit.ts:39-43:
//   „eine zweite Auslegung derselben Stufe waere genau die zweite Wahrheit"). Hier wird nichts
//   verschaerft und nichts gelockert; hier wird nur BENANNT, was der Bestand hergibt. Der Filter
//   laeuft deshalb VOR dieser Anreicherung (validation-routes.ts) — ein unsichtbares Objekt darf
//   nicht als Zeile mit `null`-Feldern auftauchen, denn schon die Zeile waere eine Existenzauskunft.
//
// WARUM DIE QUELLENLISTE NUR DREI FELDER TRAEGT. `KoSource` (knowledge-object/src/types.ts:151-169)
// traegt neben Kennung, Bezeichnung und Art auch `excerpt` — den woertlichen Auszug aus der Quelle —
// sowie `url`, `provider`, `externalId`, `spaceKey`, `author` und `at`. Das Board ist eine
// UEBERSICHTSFLAECHE: es beantwortet „woher kommt das hier ueberhaupt", nicht „was steht in der
// Quelle". Ein Auszug auf der Uebersicht waere ein zweiter Lesepfad in Quelltexte, an einer Stelle,
// die niemand als solchen gebaut hat und an der ihn deshalb auch niemand prueft. Wer den Quelltext
// braucht, oeffnet das Objekt — der Weg dorthin bleibt offen, der Nebenweg entsteht gar nicht erst.
//
// DIE BENANNTE GRENZE, damit sie nicht stillschweigend als Schutz gelesen wird: das Board gibt seit
// jeher VOLLE Wissensobjekte heraus (`ValidationService.board` → `koService.list`), und darin steckt
// `sources` samt `excerpt` unveraendert weiter. Diese Datei ENTFERNT davon nichts — sie fuegt eine
// schlanke Liste HINZU, die die Oberflaeche lesen kann, ohne den Auszug anzufassen. Das Beschneiden
// des bestehenden Board-Vertrags waere eine andere Entscheidung mit anderen Betroffenen (die
// Pruefseite in `apps/web/src`, die dieser Auftrag ausdruecklich nicht anfasst) und ist hier
// bewusst NICHT getroffen.
//
// ================================================================================================
// JOB 3009 — DIE STUFENREGEL WOHNT NICHT MEHR HIER, SONDERN AN IHRER EINEN STELLE.
// ================================================================================================
//
// Der Ausdruck „gueltige Stufe oder ausdruecklich `null`, mit Beleglage `ko` | `unknown`" stand
// nach JOB 3003 dreimal woertlich im Code (media-routes.ts:30, object-routes.ts:203 und hier), und
// der Detailabruf `GET /api/kos/:id` haette die vierte Kopie gebraucht. Er ist deshalb in
// `services/knowledge-object/src/confidentiality.ts` gehoben (`discloseConfidentiality`) — dort
// wohnt die Stufengrenze `isValidConfidentiality` ohnehin schon. Board und Detailabruf sagen
// seither buchstaeblich dasselbe, weil sie dieselbe Funktion rufen.
//
// DIESER DATEIKOPF BLEIBT, weil er die BEGRUENDUNG traegt und nicht die Regel; die Kurzfassung
// steht am neuen Ort, die ausfuehrliche hier. Was hier bleibt, ist die Board-eigene Haelfte:
// `origin` und die schlanke Quellenliste (s. „WARUM DIE QUELLENLISTE NUR DREI FELDER TRAEGT").
import {
  type Confidentiality,
  type ConfidentialityDisclosure,
  type ConfidentialityProvenance,
  type KnowledgeObject,
  type KoSource,
  type KoSourceKind,
  discloseConfidentiality,
} from "../../knowledge-object";

// Die Beleglage der Stufe reist unveraendert weiter durch den oeffentlichen Vertrag dieses Moduls
// (`services/validation/index.ts`) — bestehende Aufrufer merken von der Hebung nichts.
export type { ConfidentialityProvenance };

/** Eine Quelle in der Uebersichtsform: Kennung, Bezeichnung, Art — mehr nicht (s. Dateikopf). */
export interface BoardQuellenhinweis {
  id: string;
  label: string;
  kind: KoSourceKind;
}

/**
 * Die zwei Auskuenfte, die dieser Auftrag an jede Board-Zeile haengt.
 *
 * Die Stufenhaelfte ist seit JOB 3009 der geteilte Lesevertrag `ConfidentialityDisclosure` und
 * keine eigene Feldliste mehr — sonst koennten Board und Detailabruf auseinanderlaufen, ohne dass
 * der Compiler es merkt. Die Felder heissen unveraendert `confidentiality` und
 * `confidentialityProvenance`.
 */
export interface BoardHerkunft extends ConfidentialityDisclosure {
  origin: NonNullable<KnowledgeObject["origin"]> | null;
  originSources: BoardQuellenhinweis[];
}

/**
 * Die Mindestform, aus der sich die Auskunft ableiten laesst. Bewusst strukturell und nicht
 * `KnowledgeObject` — dieselbe Ueberlegung wie bei `SichtbarkeitsFakten`: wer diese Felder hat,
 * kann die Frage stellen; alles andere geht die Anreicherung nichts an.
 */
export interface HerkunftsFakten {
  confidentiality?: Confidentiality | null | undefined;
  origin?: KnowledgeObject["origin"] | null | undefined;
  sources?: readonly KoSource[] | undefined;
}

/**
 * Reine Lese-Sicht auf Felder, die am Wissensobjekt bereits stehen: kein neues Datenmodell, keine
 * Persistenz, kein Backfill. Sie erweitert die Zeile und ueberschreibt kein bestehendes Feld.
 *
 * Die Stufe kommt aus `discloseConfidentiality` — derselben Funktion, die auch `GET /api/kos/:id`
 * ruft (JOB 3009). Warum dort `isValidConfidentiality` und nicht `normalizeConfidentiality` steht,
 * ist an ihr ausgeschrieben: ein unbekannter Wert (Altbestand, fremd geschriebene Zeile) ist eine
 * UNBEKANNTE Stufe, keine interne — dieselbe fail-safe Richtung wie in
 * `parseClassificationSnapshot` (search-projection.ts:306-322).
 */
export function mitHerkunft<T extends HerkunftsFakten>(ko: T): T & BoardHerkunft {
  return {
    ...ko,
    ...discloseConfidentiality(ko.confidentiality),
    // Fehlende Herkunft heisst „unbekannt" und ausdruecklich nicht „ueber die Vordertuer erfasst" —
    // derselbe Satz steht am Modell (knowledge-object/src/types.ts:242-243).
    origin: ko.origin ?? null,
    originSources: (ko.sources ?? []).map((quelle) => ({
      id: quelle.id,
      label: quelle.label,
      kind: quelle.kind,
    })),
  };
}
