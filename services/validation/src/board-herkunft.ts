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
import type {
  Confidentiality,
  KnowledgeObject,
  KoSource,
  KoSourceKind,
} from "../../knowledge-object";
import { isValidConfidentiality } from "../../knowledge-object";

/**
 * WOHER die ausgegebene Stufe stammt.
 *
 * · `ko`      — sie steht am Wissensobjekt selbst und ist ein gueltiger Wert.
 * · `unknown` — der Bestand traegt keine (oder keine gueltige) Stufe. Ausdruecklich KEINE Aussage
 *               „intern": niemand hat hier je eingestuft.
 *
 * Bewusst dieselbe Wortwahl wie `ClassificationConfidence` in der Suchprojektion
 * (search-projection.ts:132-133) — ein zweites Vokabular fuer denselben Gedanken waere eine zweite
 * Wahrheit. Bewusst NICHT dieselbe Aufzaehlung: dort geht es um die HISTORISCHE Belastbarkeit einer
 * Versionsaussage, hier um die Frage, ob der heutige Bestand ueberhaupt eine Stufe traegt.
 */
export type ConfidentialityProvenance = "ko" | "unknown";

/** Eine Quelle in der Uebersichtsform: Kennung, Bezeichnung, Art — mehr nicht (s. Dateikopf). */
export interface BoardQuellenhinweis {
  id: string;
  label: string;
  kind: KoSourceKind;
}

/** Die zwei Auskuenfte, die dieser Auftrag an jede Board-Zeile haengt. */
export interface BoardHerkunft {
  confidentiality: Confidentiality | null;
  confidentialityProvenance: ConfidentialityProvenance;
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
 * `isValidConfidentiality` und nicht `normalizeConfidentiality`: ein unbekannter Wert (Altbestand,
 * fremd geschriebene Zeile) ist eine UNBEKANNTE Stufe, keine interne. Das ist dieselbe fail-safe
 * Richtung wie in `parseClassificationSnapshot` (search-projection.ts:306-322).
 */
export function mitHerkunft<T extends HerkunftsFakten>(ko: T): T & BoardHerkunft {
  const stufe = isValidConfidentiality(ko.confidentiality) ? ko.confidentiality : null;
  return {
    ...ko,
    confidentiality: stufe,
    confidentialityProvenance: stufe ? "ko" : "unknown",
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
