// ================================================================================================
// AUFTRAG-mega74 BLOCK A — DIE EINE STELLE, AN DER „DARF DIESER MENSCH DIESES OBJEKT SEHEN" FÄLLT.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. Bis mega74 gab es im Code zwei Welten. Die EGRESS-Wege setzten die
// SCRUM-506-Regel durch — Bibliotheks-Export (library-routes.ts:168-172), Herkunftskette
// (provenance-routes.ts:78-97), Nachbarschaft (library-routes.ts:381-389) und die KI-Wege über
// `dropConfidential`. Der HAUPTLESEPFAD setzte nichts durch: `GET /api/kos/:id` forderte `ko.read`
// und gab danach alles heraus; der Code vermerkte das selbst als „die ehrliche Grenze aus mega45".
// Jede dieser Stellen trug ihre EIGENE Kopie derselben Zeile `can(user.role, "ko.validate")`.
//
// Das ist die Lehre aus A22, und sie hat uns schon eine Runde gekostet: sechs Flächen trugen
// dieselbe Zeile, und weil niemand entschied, wie viele Zustände diese Zeile kennt, waren alle
// sechs falsch. Wenn dieselbe Frage an mehreren Orten beantwortet wird, ist die Frage nicht
// „welcher Ort ist falsch", sondern „wo wird das entschieden" — und die Antwort ist ab hier: hier.
//
// WARUM IN DER KOMPOSITIONSWURZEL UND NICHT IM DATENMODELL. Die Frage verbindet DREI Dinge, die in
// verschiedenen Modulen wohnen: die Rolle (auth), die Rechtematrix (rbac) und die Stufe am Objekt
// (knowledge-object). `services/app` ist das einzige Modul, das alle drei bereits kennt — und es
// ist der Ort, an dem das Projekt diese Entscheidung schon bisher getroffen hat (library-routes.ts
// :382 sagt es wörtlich: „HIER, IN DER KOMPOSITIONSWURZEL, FÄLLT DIE RECHTEENTSCHEIDUNG").
// `isConfidential` ins rbac-Modul zu ziehen hätte die Rechtematrix vom Datenmodell abhängig
// gemacht; `can` ins knowledge-object zu ziehen hätte das Datenmodell von der Rechtematrix abhängig
// gemacht. Beides wäre eine neue Modulkante für eine Frage, die eine Routen-Frage ist.
//
// ================================================================================================
// DIE BENANNTE GRENZE — BITTE NICHT ÜBERLESEN.
// ================================================================================================
//
// `isConfidential` behandelt `vertraulich` und `streng_vertraulich` GLEICH (confidentiality.ts:41).
// Dieses Prädikat erbt das bewusst. Wir ZEIGEN drei Stufen und SCHÜTZEN zwei davon identisch:
// für die Sichtbarkeit macht `streng_vertraulich` heute keinen Unterschied zu `vertraulich`.
//
// Das ist Pedis Variante A und ausdrücklich so gewollt — nicht ein übersehener Fall. Eine dritte
// Schutzstufe wäre eine Freigabestufe je Nutzer (Variante B): ein Feld am Nutzer, eine
// Verwaltungsfläche, eine Wanderung und eine zweite Achse neben der Rolle. Das ist NICHT
// entschieden. Wer hier heimlich eine Rangprüfung einbaut, baut Variante B durch die Hintertür.
//
// Ebenfalls Grenze: eine UNBEKANNTE Stufe gilt als „intern" (also sichtbar), weil
// `isConfidential` das so auslegt. Das ist hier bewusst NICHT strenger gefasst, denn eine zweite
// Auslegung derselben Stufe wäre genau die zweite Wahrheit, gegen die diese Datei gebaut ist.
// Getragen wird das davon, dass die Schreibwege nur geprüfte Werte durchlassen
// (`isValidConfidentiality` an der Upload-Grenze, SCRUM-509 am Änderungsweg).
import { type Confidentiality, isConfidential } from "../../knowledge-object";
import { can } from "../../rbac";
import type { SessionUser } from "./http";

// Die MINDESTFORM, die dieses Prädikat braucht. Bewusst strukturell und nicht `KnowledgeObject`:
// die Frage wird auch für Projektionen gestellt (Suchtreffer, Nachbarn, Anhänge), die das volle
// Objekt gar nicht tragen. Wer weniger als diese zwei Felder hat, kann die Frage nicht stellen.
export interface SichtbarkeitsFakten {
  confidentiality?: Confidentiality | null | undefined;
  author?: string | null | undefined;
}

/**
 * Darf dieser Mensch dieses Wissensobjekt sehen?
 *
 * Die Regel (SCRUM-506, erweitert um den Autor):
 *   - nicht vertraulich  → jeder mit `ko.read` (die Route prüft das vorher)
 *   - vertraulich        → nur `ko.validate` (Controller/Admin) ODER der Autor selbst
 *
 * Die Autor-Ausnahme ist keine Erfindung dieses Auftrags: dieselbe Zeile trägt bereits das Löschen
 * (`ko-routes.ts:1019`). Ohne sie könnte ein Experte ein vertrauliches Objekt erfassen und es
 * danach nicht mehr öffnen — der Alltagsweg „ich schreibe etwas Sensibles auf" ginge zu.
 */
export function darfSehen(user: SessionUser, ko: SichtbarkeitsFakten): boolean {
  if (!isConfidential(ko.confidentiality)) {
    return true;
  }
  if (can(user.role, "ko.validate")) {
    return true;
  }
  // Leerer/fehlender Autor ist KEINE Autorschaft — sonst wäre ein Altobjekt ohne Autorfeld für
  // jeden sichtbar, dessen Kennung ebenfalls leer ist.
  return typeof ko.author === "string" && ko.author.length > 0 && ko.author === user.id;
}

/**
 * Dieselbe Regel auf eine Menge — für jede Route, die eine LISTE ausgibt.
 *
 * Bewusst als eigener Name statt eines nackten `.filter(...)` an jeder Route: ein unsichtbares
 * Objekt soll überall gleich verschwinden, und ein künftiger Leser soll die Stelle finden können.
 */
export function sichtbareFuer<T extends SichtbarkeitsFakten>(
  user: SessionUser,
  items: readonly T[],
): T[] {
  return items.filter((item) => darfSehen(user, item));
}

/**
 * Dieselbe Entscheidung als DATUM für Dienste, die selbst über den Bestand laufen.
 *
 * Manche Ausgaben lassen sich an der Route nicht filtern, weil dort die tragenden Felder gar nicht
 * mehr ankommen: `/api/graph` liefert Knoten aus `{id, title}` — die Stufe ist da längst weg, und
 * die KANTEN würden verborgene Objekte ohnehin über die Struktur verraten. Für solche Fälle
 * bekommt der Dienst die fertige Entscheidung übergeben und wendet sie auf die GRUNDMENGE an,
 * bevor er rechnet (dasselbe Vorgehen wie `neighbors` seit mega71 Block C).
 *
 * Ausdrücklich ein Filter und KEIN `includeConfidential`-Schalter: seit Variante A hängt die
 * Sichtbarkeit auch am Autor, und ein Boolescher Wert kann „vertrauliches, aber eigenes Objekt"
 * nicht ausdrücken. Ein Dienst, der stattdessen ein Flag bekäme, müsste die Regel ein zweites Mal
 * auslegen — genau das soll es hier nicht mehr geben.
 */
export type Sichtbarkeitsfilter = (ko: SichtbarkeitsFakten) => boolean;

export function sichtbarkeitsfilterFuer(user: SessionUser): Sichtbarkeitsfilter {
  return (ko) => darfSehen(user, ko);
}

// ================================================================================================
// AUFTRAG-BASIC-380 — DIESELBE ENTSCHEIDUNG, EINE EBENE TIEFER: ALS SQL, VOR DEM `LIMIT`.
// ================================================================================================
//
// DER BEFUND, DER DAS ERZWINGT (BASIC 379 §1.2, gemessen). Bis hierher standen ZWEI Sperren
// oberhalb der Datenbank: der Papierkorb wurde im Anwendungsspeicher gefiltert
// (`KoService.listForSearch`), die Sichtbarkeit an der Route (`sichtbareFuer`, s. o.). Solange
// beide dort stehen, ist JEDE Paginierung falsch gebaut — ein `LIMIT 50` liefert 50 ZEILEN, von
// denen danach getrashte und unsichtbare abgezogen werden:
//
//   · der Nutzer bekommt eine Seite mit WENIGER als 50 Einträgen,
//   · ein Cursor auf die 50. Zeile ÜBERSPRINGT reale Treffer,
//   · und jeder Zähler über dieser Menge ist eine EXISTENZAUSKUNFT — genau das, was REF-0001
//     :48/:49 verbietet.
//
// Deshalb steht am Anfang des Wissensraum-Vertrags kein Datenmodell, sondern dieser eine Satz:
// PAPIERKORB- UND SICHTBARKEITSPRÄDIKAT GEHÖREN VOR DAS `LIMIT`, ALSO IN DAS SQL.
//
// WARUM DAS HIER STEHT UND NIRGENDWO SONST (Gate `G-TRIM-EINS`). Diese Datei existiert, damit die
// Frage „darf dieser Mensch dieses Objekt sehen" an EINEM Ort beantwortet wird (s. Kopf). Ein SQL-
// Prädikat in einem Repository-Adapter wäre die zweite Auslegung derselben Regel — und die Lehre
// aus A22 steht oben: sechs Flächen trugen dieselbe Zeile, und alle sechs waren falsch. Das
// Prädikat entsteht deshalb HIER, neben `darfSehen`, und wird INJIZIERT — an genau derselben Naht,
// an der heute schon `sichtbar: sichtbarkeitsfilterFuer(user)` in die Analytics reist.
//
// WARUM DAS ÜBERHAUPT GEHT: der Rollenanteil von `darfSehen` ist ein EINZIGER Boolescher Wert
// (`can(user.role, "ko.validate")`), der Autoranteil eine einzige Zeichenkette (`user.id`). Mehr
// braucht die Regel nicht — deshalb lässt sie sich vollständig als Prädikat über drei Spalten
// ausdrücken, ohne dass die Datenbank etwas über Rollen wissen müsste.
//
// ================================================================================================
// DIE BENANNTEN GRENZEN DIESER ÜBERSETZUNG — BITTE NICHT ÜBERLESEN.
// ================================================================================================
//
// (1) DIE LEBENDE ZEILE IST DIE TRIMQUELLE (Gate `G-TRIM-LIVE`). Das Prädikat liest ausschließlich
//     `confidentiality_key`, `author_key` und `deleted_at_key` — generierte Spalten der `kos`-Zeile
//     selbst. `ko_search_projection.classification_snapshot` ist AUSDRÜCKLICH VERBOTENE Trimquelle:
//     er ist historischer Beleg und veraltet naturgemäß, sobald eine Stufe erhöht wird. Eine
//     Höherstufung muss SOFORT wirken, nicht nach dem nächsten Projektionsbau.
//
// (2) DIE STUFENGRENZE IST ZEICHENGENAU `normalizeConfidentiality` (confidentiality.ts:15-17), und
//     zwar nicht hier, sondern in der generierten Spalte (KO_SICHTBARKEIT_SCHEMA). Damit gibt es
//     den CASE genau einmal, in der Datenbank, statt abschreibbar in jeder Abfrage.
//
// (3) DER PAPIERKORB WIRD ÜBER `deleted_at_key IS NULL` GEPRÜFT. Der Schreibweg setzt `deletedAt`
//     ausschließlich auf einen ISO-Zeitpunkt und ENTFERNT das Feld beim Wiederherstellen
//     (knowledge-object/src/service.ts) — für jeden erreichbaren Wert ist das deckungsgleich mit
//     dem bisherigen `!ko.deletedAt`. Die eine denkbare Abweichung ist eine handgeschriebene
//     Altzeile mit `deletedAt: ""`: die versteckt SQL, während Node sie zeigte. Das ist die
//     fail-closed Richtung und erweitert Sichtbarkeit nie (G-SHADOW) — sie wird hier benannt und
//     nicht stillschweigend in Kauf genommen.
//
// (4) HIER WIRD NICHTS VERSCHÄRFT UND NICHTS GELOCKERT. Die drei Stufen bleiben drei, zwei werden
//     weiter identisch geschützt (Pedis Variante A, s. Kopf), eine unbekannte Stufe gilt weiter als
//     „intern", und ein leerer Autor ist weiter KEINE Autorschaft. Der Paritätstest
//     (tests/security/380-trim-paritaet.integration.test.ts) fährt beide Formen über alle
//     Kombinationen aus Stufe × Autorschaft × Rolle gegen ein echtes Postgres — Mengengleichheit,
//     nicht Stichprobe.
export interface SqlSichtbarkeitstrim {
  sql(spaltenTraeger: string, abPlatzhalter: number): string;
  readonly params: readonly unknown[];
  trifftZu(ko: SichtbarkeitsFakten & { deletedAt?: string | null | undefined }): boolean;
}

export function sqlSichtbarkeitFuer(user: SessionUser): SqlSichtbarkeitstrim {
  // Die beiden EINZIGEN Fakten, die `darfSehen` über den Betrachter braucht. Sie werden hier
  // EINMAL erhoben und danach nicht mehr befragt — ein Cursor oder eine Folgeseite, die sie später
  // neu auslegte, wäre genau das Leck, das BASIC 379 §3.3 mit der Betrachterbindung schließt.
  const darfVertraulich = can(user.role, "ko.validate");
  const betrachter = user.id;

  return {
    sql(spaltenTraeger: string, abPlatzhalter: number): string {
      const rolle = `$${abPlatzhalter}`;
      const autor = `$${abPlatzhalter + 1}`;
      // Zeile für Zeile dieselbe Regel wie `darfSehen`, plus der Papierkorb davor:
      //   · nicht getrasht,
      //   · 'intern'                                  ⇒ jeder mit `ko.read` (die Route prüft es),
      //   · `ko.validate`                             ⇒ auch vertraulich/streng_vertraulich,
      //   · oder der Autor selbst — und ein LEERER Autor ist keine Autorschaft.
      return (
        `(${spaltenTraeger}.deleted_at_key IS NULL` +
        ` AND (${spaltenTraeger}.confidentiality_key = 'intern'` +
        ` OR ${rolle}::boolean` +
        ` OR (COALESCE(${spaltenTraeger}.author_key, '') <> ''` +
        ` AND ${spaltenTraeger}.author_key = ${autor})))`
      );
    },
    params: [darfVertraulich, betrachter],
    // KEIN Nachbau der Regel: derselbe `darfSehen`-Aufruf wie überall sonst, nur um den
    // Papierkorb ergänzt — der in der SQL-Form ebenfalls Teil des Prädikats ist.
    trifftZu(ko): boolean {
      return !ko.deletedAt && darfSehen(user, ko);
    },
  };
}

// ================================================================================================
// AUFTRAG-mega74 BLOCK D — DIE NEBENWEGE (G5): INHALT OHNE DAS OBJEKT ZU ÖFFNEN.
// ================================================================================================
//
// Ein Konflikt trägt `description` und `detector.quotes.a/b` — WÖRTLICHE Belegzitate beider
// beteiligter Objekte (conflicts/src/types.ts:46-49). Eine Überschneidung trägt `aspects`
// (wörtliche gemeinsame Aussagen), `eigenanteilA` und `eigenanteilB` — also genau das, was nur in
// je einem der beiden Objekte steht (overlap-types.ts:45-47). Beide Listen standen jedem
// `ko.read`-Inhaber offen. Wer ein vertrauliches Objekt nicht öffnen darf, konnte seinen Inhalt
// also über das Konflikt-Board lesen.
//
// DIE REGEL IST FAIL-CLOSED UND GILT FÜR DAS PAAR: ein Fund wird nur ausgegeben, wenn BEIDE Seiten
// sichtbar sind. Nicht „die sichtbare Seite zeigen": der Fund ZITIERT beide, und schon die Aussage
// „dein Objekt widerspricht einem anderen" ist eine Auskunft über das andere.
//
// Auch fail-closed: eine Seite, die sich NICHT auflösen lässt, gilt als nicht sichtbar. Ein Zitat
// darf sein Objekt nicht überleben.
export interface KoSichtbarkeitsZugang {
  get: (koId: string) => Promise<SichtbarkeitsFakten | undefined>;
}

// ================================================================================================
// AUFTRAG-mega76 BLOCK A — DER FEHLENDE ZUGANG IST EIN NEIN, KEIN DURCHLASS.
// ================================================================================================
//
// Bis mega76 trugen vier Lesewege ihren Sichtbarkeitszugang OPTIONAL (`kos?:`). Fehlte er, filterte
// die Route nicht etwa fail-closed, sondern gab das ALTE, UNGEFILTERTE Ergebnis heraus — sieben
// Leseendpunkte trafen damit eine zweite Entscheidung: Schutz nur, wenn der Zugang zufällig da ist.
// Die Kompositionswurzel verdrahtete ihn zwar immer; der VERTRAG erlaubte einem zweiten Aufbau,
// einem Testaufbau oder einem späteren Umbau, ihn typgültig wegzulassen.
//
// Seit mega76 sind alle vier Zugänge PFLICHTPARAMETER — der Compiler stoppt den Aufrufer, der sie
// vergisst. Diese Prüfung hier ist die zweite Linie darunter, für die Aufrufer, die der Compiler
// nicht sieht: JavaScript, ein `as never`, ein aus JSON gebautes Deps-Objekt, ein `Partial<Deps>`.
// Sie steht bewusst HIER und nicht in den Routen — vier Kopien derselben Zeile wären genau die
// zweite Wahrheit, gegen die diese Datei gebaut ist.
function zugangTauglich(zugang: KoSichtbarkeitsZugang | undefined): boolean {
  return typeof zugang?.get === "function";
}

export async function paarSichtbar(
  user: SessionUser,
  koA: string,
  koB: string,
  zugang: KoSichtbarkeitsZugang,
): Promise<boolean> {
  if (!zugangTauglich(zugang)) {
    return false;
  }
  for (const id of new Set([koA, koB])) {
    const ko = await zugang.get(id);
    if (!ko || !darfSehen(user, ko)) {
      return false;
    }
  }
  return true;
}

/** Dieselbe Regel auf eine Liste von Paar-Funden (Konflikte, Überschneidungen). */
export async function sichtbarePaare<T extends { koA: string; koB: string }>(
  user: SessionUser,
  funde: readonly T[],
  zugang: KoSichtbarkeitsZugang,
): Promise<T[]> {
  const out: T[] = [];
  for (const fund of funde) {
    if (await paarSichtbar(user, fund.koA, fund.koB, zugang)) {
      out.push(fund);
    }
  }
  return out;
}

/**
 * Dieselbe Regel auf Einträge, die EIN Wissensobjekt nennen (Review-Zuweisungen in der Glocke).
 *
 * Fail-closed in beide Richtungen: ein Eintrag, dessen Objekt sich nicht auflösen lässt,
 * verschwindet (sein Titel wäre sonst eine Auskunft über ein Objekt, über das wir nichts sagen
 * können) — und ein fehlender Zugang lässt gar nichts durch (mega76 Block A, s. `zugangTauglich`).
 */
export async function sichtbareEintraege<T extends { koId: string }>(
  user: SessionUser,
  eintraege: readonly T[],
  zugang: KoSichtbarkeitsZugang,
): Promise<T[]> {
  if (!zugangTauglich(zugang)) {
    return [];
  }
  const out: T[] = [];
  for (const eintrag of eintraege) {
    const ko = await zugang.get(eintrag.koId);
    if (ko && darfSehen(user, ko)) {
      out.push(eintrag);
    }
  }
  return out;
}

// ================================================================================================
// JOB 1125 — DIE ZWEITE STUFE: DAS PAAR ENTSCHEIDET ÜBER DIE EXISTENZ, DAS FELD ÜBER DEN INHALT.
// ================================================================================================
//
// DER BEFUND, DER DAS ERZWINGT (JOB 968 §4, L1 — „hoch"): Die Paarregel oben ist BINÄR. Sie fragt
// „darf dieser Betrachter beide Objekte sehen?" — und wenn ja, fließt ALLES: `eigenanteilA`,
// `eigenanteilB`, `aspects`, `description`, `detector.quotes.a/b`. Das ist für den Regelfall
// richtig und war nie das Problem. Das Problem ist, dass es keine zweite Stufe GIBT: Der Feed der
// Benachrichtigungen hat mit `redacted` längst eine (notification-feed.ts:26-28), Konflikte und
// Überschneidungen haben keine. JOB 968 nennt das wörtlich die „einzige Stelle, an der G5s Sorge
// nach der Paarprüfung noch trägt".
//
// WARUM DAS KEINE VIERTE SICHTBARKEITSREGEL IST — und das ist der Kern des Entwurfs. Die Redaktion
// stellt KEINE neue Frage. Sie stellt DIESELBE Frage (`darfSehen`) ein zweites Mal, diesmal je
// Seite statt über das Paar. Eine zweite Auslegung von „darf sehen" wäre genau die zweite Wahrheit,
// gegen die diese Datei gebaut ist (s. Dateikopf) — deshalb steht hier kein einziges neues
// Prädikat, sondern nur eine feinere Anwendung des vorhandenen.
//
// WARUM ES HIER WOHNT UND NICHT IN DEN ROUTEN: beide Routen sagen es selbst — „die Regel wohnt in
// ../sichtbarkeit, hier steht nur ihre Anwendung" (conflicts-routes.ts:12-13, overlap-routes.ts:22).
// Zwei Kopien der Redaktion in zwei Routen wären dieselbe Krankheit wie die vier optionalen
// Zugänge vor mega76.
//
// EINE VERSUCHUNG, DIE HIER AUSDRÜCKLICH NICHT GENOMMEN WIRD. Die naheliegende zweite Stufe wäre
// „zeige den Fund, sobald EINE Seite sichtbar ist, und redigiere die andere". Das wäre eine
// LOCKERUNG: `:220-222` sagt, warum der Fund beide Seiten braucht — „schon die Aussage ‚dein
// Objekt widerspricht einem anderen' ist eine Auskunft über das andere". Die Paarregel bleibt
// deshalb unverändert davor stehen. Die Redaktion macht den Schutz enger, nie weiter.
//
// WAS SIE KONKRET ÄNDERT: Der Unterschied zu `paarSichtbar` liegt allein in der dritten Bedingung
// von `feldFreigabe` — der Vertraulichkeitsstufe. Ohne sie wäre diese Stufe zur Paarregel
// RECHNERISCH REDUNDANT (dieselbe Frage, zweimal gestellt, immer dieselbe Antwort) und damit
// wertlos; mit ihr schließt sie die von BEN als Prüflücke 4 benannte und von JOB 968 als L2
// ausdrücklich NICHT GEMESSENE Lücke. Die Begründung steht vollständig an `feldFreigabe`.
//
// Und sie trennt zwei Zustände, die heute ununterscheidbar sind: „es gibt nichts" und „es gibt
// etwas, du liest den Inhalt nicht". Erst diese Trennung macht den neutralen Ersatz in der
// Oberfläche möglich (Pflicht 2) — und erst sie macht `redacted` zu einer AUSSAGE statt zu einem
// leeren Feld, das die Oberfläche stillschweigend wegblendet.

/** Freigabe je Seite eines Paar-Fundes. Bewusst zwei Booleans und kein `boolean`: die Seiten
 *  können unterschiedlich ausfallen, und genau diese Asymmetrie ist der Gegenstand. */
export interface PaarFeldFreigabe {
  a: boolean;
  b: boolean;
}

/**
 * Darf der INHALT dieser Seite mitgeliefert werden?
 *
 * DREI BEDINGUNGEN, und die dritte ist der eigentliche Gegenstand dieses Auftrags:
 *   1. Das Objekt lässt sich auflösen. Ein Zitat darf sein Objekt nicht überleben (`:224`).
 *   2. Der Betrachter darf das Objekt sehen (`darfSehen`) — dieselbe Frage wie oben, je Seite.
 *   3. Das Objekt ist NICHT vertraulich, es sei denn, der Betrachter ist sein Autor.
 *
 * WARUM (3) UND WARUM SIE NICHT SCHON IN `darfSehen` STEHT — bitte nicht als Verschärfung um der
 * Strenge willen lesen, sie schließt eine gemessene Lücke:
 *
 * `darfSehen` beantwortet „darf dieser Mensch dieses OBJEKT ÖFFNEN". Für eine Controllerin lautet
 * die Antwort auch bei `vertraulich` ja — richtig so, sie kuratiert es. Der Eigenanteil und das
 * Zitat sind aber keine Öffnung des Objekts, sondern eine KOPIE seines Inhalts, die AUSSERHALB
 * des Objekts lebt. Für den Inhalt selbst gilt eine zweite, strengere Regel:
 * `dropConfidential` (knowledge-object/src/confidentiality.ts:44-53) hält vertrauliche Inhalte aus
 * jedem weitergehenden Kontext heraus — „solche KOs gehen NIE in externe Kontexte". Diese Kopien
 * tragen jedoch KEIN `confidentiality`-Feld (overlap-types.ts:40-60, conflicts/src/types.ts), sind
 * für jenen Filter also unsichtbar und wandern an ihm vorbei.
 *
 * Das ist genau der „Vertraulichkeitsgleichlauf", den BEN als Prüflücke 4 zu JOB 968 benannt hat
 * („vertrauliche Seite darf nicht über Paarregel-Zitate oder Eigenanteile leaken") und den JOB 968
 * selbst als L2 führt — mit dem ausdrücklichen Zusatz „Ob beide dasselbe sagen, ist NICHT
 * gemessen". Gemessen ist es jetzt: sie sagen NICHT dasselbe, und (3) ist die Antwort darauf.
 *
 * DIE AUTOR-AUSNAHME bleibt, aus demselben Grund wie in `darfSehen:63-65`: der Autor liest hier
 * seinen eigenen Text. Ihm den zu verbergen wäre keine Datensparsamkeit, sondern eine Schikane.
 *
 * WAS DAS FÜR DIE KURATORIN HEISST, ausdrücklich benannt: Sie sieht den Fund weiterhin (die
 * Paarregel lässt ihn durch) und weiß, DASS es ihn gibt — aber die wörtlichen Belege stehen dann
 * nicht mehr im Board. Sie öffnet die beiden Objekte, die sie ohnehin öffnen darf. Der Weg bleibt
 * offen, der Nebenweg schließt sich. Genau das ist G5s Formulierung: „Inhalt, ohne das Objekt zu
 * öffnen".
 */
export async function feldFreigabe(
  user: SessionUser,
  koA: string,
  koB: string,
  zugang: KoSichtbarkeitsZugang,
): Promise<PaarFeldFreigabe> {
  if (!zugangTauglich(zugang)) {
    return { a: false, b: false };
  }
  const erlaubt = async (id: string): Promise<boolean> => {
    const ko = await zugang.get(id);
    if (!ko || !darfSehen(user, ko)) {
      return false;
    }
    if (!isConfidential(ko.confidentiality)) {
      return true;
    }
    // Leerer/fehlender Autor ist KEINE Autorschaft — dieselbe Zeile wie in `darfSehen:74-76`.
    return typeof ko.author === "string" && ko.author.length > 0 && ko.author === user.id;
  };
  return { a: await erlaubt(koA), b: await erlaubt(koB) };
}

// ------------------------------------------------------------------------------------------------
// Die redigierten Projektionen. Form und Wortwahl folgen `redactGapForViewer`
// (services/ask/src/gap-visibility.ts:42-64), damit es im Produkt genau EIN Redaktionsmuster gibt:
// Struktur bleibt, Inhalt geht, `redacted: true` sagt es ausdrücklich.
// ------------------------------------------------------------------------------------------------

/** Die an den Client gehende Sicht einer Überschneidung. `eigenanteil*` leer und `aspects` leer,
 *  wo die zugehörige Seite nicht freigegeben ist. */
export type UeberschneidungsSicht<T extends UeberschneidungsFelder> = T & { redacted?: true };

export interface UeberschneidungsFelder {
  koA: string;
  koB: string;
  aspects: readonly unknown[];
  eigenanteilA: string;
  eigenanteilB: string;
  detector?: { rationale?: string } | undefined;
}

/**
 * `aspects` sind GEMEINSAME Aussagen mit je einem Zitat aus BEIDEN Objekten (overlap-types.ts:45).
 * Sie hängen deshalb an beiden Seiten: fehlt EINE Freigabe, gehen sie ganz. Ein halbes Zitatpaar
 * wäre kein Schutz, sondern eine Auskunft mit Rest.
 *
 * `detector.rationale` ist die Modell-Begründung. Sie fasst BEIDE Objekte zusammen und wird
 * derselben Regel unterworfen — sie ist der Titel, den die Glocke anzeigt
 * (notification-feed.ts:66), also der am weitesten hinausreichende dieser Texte.
 */
export function redigiereUeberschneidung<T extends UeberschneidungsFelder>(
  eintrag: T,
  freigabe: PaarFeldFreigabe,
): UeberschneidungsSicht<T> {
  const beide = freigabe.a && freigabe.b;
  if (beide) {
    return eintrag;
  }
  const detector = eintrag.detector;
  return {
    ...eintrag,
    aspects: [],
    eigenanteilA: freigabe.a ? eintrag.eigenanteilA : "",
    eigenanteilB: freigabe.b ? eintrag.eigenanteilB : "",
    ...(detector ? { detector: { ...detector, rationale: "" } } : {}),
    redacted: true,
  };
}

export interface KonfliktFelder {
  koA: string;
  koB: string;
  description: string;
  detector?: { rationale?: string; quotes?: { a: string; b: string } } | undefined;
}

export type KonfliktSicht<T extends KonfliktFelder> = T & { redacted?: true };

/**
 * `description` beschreibt den Widerspruch zwischen beiden Aussagen und `detector.quotes.a/b` sind
 * die wörtlichen Belege je Seite (conflicts/src/types.ts:47/:57). Die Zitate hängen an je EINER
 * Seite, `description` und `rationale` an beiden.
 *
 * Ein einzelnes Zitat wird NICHT durchgelassen, wenn die andere Seite fehlt: der Konflikt sagt
 * „diese Aussage widerspricht jener", und schon das ist eine Auskunft über die andere (`:221-222`).
 * Deshalb dieselbe Grenze wie bei den `aspects`.
 */
export function redigiereKonflikt<T extends KonfliktFelder>(
  konflikt: T,
  freigabe: PaarFeldFreigabe,
): KonfliktSicht<T> {
  if (freigabe.a && freigabe.b) {
    return konflikt;
  }
  const detector = konflikt.detector;
  return {
    ...konflikt,
    description: "",
    ...(detector ? { detector: { ...detector, rationale: "", quotes: { a: "", b: "" } } } : {}),
    redacted: true,
  };
}

// ================================================================================================
// AUFTRAG-mega74 BLOCK C — DIE RÜCKKANTE (G2): EIN ANHANG WIRD BEHANDELT WIE SEIN OBJEKT.
// ================================================================================================
//
// DER BEFUND: `object-routes.ts` enthielt NULL Bezug auf Vertraulichkeit. Der Anhang wurde
// ausgeliefert, ohne dass die Stufe seines Wissensobjekts je gefragt wurde — der Zugriffsschutz war
// am Lesepfad der Anhänge gar nicht gebaut.
//
// WARUM NICHT DIE STUFE AM OBJEKT SELBST GENÜGT. Der Object-Store persistiert zwar ein eigenes
// `confidentiality` (SCRUM-521), aber GEMESSEN am Aufrufer setzt es nur der Medien-Upload
// (apps/web/src/pages/Capture.tsx:2979). Die normalen Anhang-/Bild-/Dokument-Uploads
// (KnowledgeDetail.tsx:371 und :566, Capture.tsx:954 und :2432, AppendToArticleModal.tsx:87)
// senden KEINE Stufe. Ein Tor, das nur die Objekt-eigene Stufe liest, wäre für Anhänge also ein
// Nullgriff — es sähe aus wie ein Schutz und wäre keiner. Genau diese Sorte Befund hat uns am
// 30.07. schon einmal eine Runde gekostet.
//
// DIE REGEL, und beide Richtungen sind bewusst gewählt:
//
//   · Trägt MINDESTENS EIN sichtbares Wissensobjekt diesen Anhang, ist er sichtbar. Nicht „alle
//     müssen sichtbar sein": hängt dasselbe Bild an einem internen und an einem vertraulichen
//     Objekt, sieht der Betrachter dieselben Bytes ohnehin über das interne — ein Nein würde nur
//     die erlaubte Ansicht zerstören und nichts schützen.
//   · Trägt es KEIN Wissensobjekt, entscheidet das Objekt selbst (eigene Stufe + Hochladender als
//     Autor). Das ist das Upload-Fenster: zwischen Hochladen und Binden ist ein Objekt echt
//     ungebunden und trotzdem lebendig (derselbe Fall, den `retainUntil` abdeckt).
//
// ================================================================================================
// AUFTRAG-mega76 BLOCK B — DIE DREI FEHLENDEN HERKÜNFTE, UND DER TRÄGERLOSE AUSGANG.
// ================================================================================================
//
// Bis mega76 stand hier eine „ehrliche Grenze": befragt wurden nur die AKTUELLEN Fassungen der
// Wissensobjekte. Versions-Schnappschüsse, Belegketten und Entwürfe fielen durch. ben hat gezeigt,
// dass diese Grenze nicht bloß eine Lücke war, sondern der Weg in ein FAIL-OPEN:
//
//   Ein Objekt, das nur in einer dieser drei Herkünfte hängt, galt als trägerlos. Bei normalen
//   Uploads ist die eigene `ObjectRef.confidentiality` gar nicht gesetzt (nur der Medien-Upload
//   setzt sie) — der trägerlose Zweig rief `darfSehen` also mit LEERER Stufe auf, und leer gilt
//   als „intern" und damit als sichtbar. Das Bild eines vertraulichen Wissensobjekts wurde damit
//   an jeden `ko.read`-Inhaber ausgeliefert, sobald die aktuelle Fassung es nicht mehr nannte.
//
// ZWEI ÄNDERUNGEN, und die zweite ist die wichtigere:
//
//   1. Die Trägersuche kennt jetzt alle fünf Orte, an denen eine Referenz stehen kann — dieselbe
//      Aufzählung wie in object-references.ts, dort für den Datenverlust, hier für den Schutz.
//   2. Der TRÄGERLOSE Fall ist fail-closed: eine FEHLENDE Stufe ist keine Aussage „intern",
//      sondern „unbekannt" — und Unbekanntes wird nicht ausgeliefert. Sichtbar bleibt es nur für
//      die, die auch ein vertrauliches Objekt sehen dürften: den Hochladenden selbst (das
//      Hochlade-Fenster, s. u.) und `ko.validate`.
//
//      Bewusst nur die FEHLENDE Stufe. Ein Upload, der ausdrücklich „intern" gesendet hat, hat
//      eine Aussage getroffen; sie zu überschreiben wäre eine zweite Auslegung derselben Stufe —
//      genau das, wogegen diese Datei gebaut ist. Der Fund ist die leere Stufe, und nur sie wird
//      geschlossen.
//
// WAS ES KOSTET, ehrlich und benannt. Die drei zusätzlichen Herkünfte kosten je Abruf einen Lauf
// über den Bestand (Versionen und Belege liegen je Wissensobjekt). Deshalb laufen sie NUR, wenn
// die aktuellen Fassungen KEINEN Träger ergeben haben — der häufigste Lesevorgang (ein Bild in
// einem lebenden Wissensobjekt) bleibt damit genau so teuer wie bisher. Die Rechnung stimmt auch
// in der Sache: findet die billige Stufe einen Träger, kann eine teure Stufe die Sichtbarkeit nur
// noch WEITER öffnen, nie schliessen.
//
// DIE VERBLEIBENDE, BENANNTE GRENZE: hängt dasselbe Objekt an einer sichtbaren aktuellen Fassung
// UND (nur) im Schnappschuss eines vertraulichen Objekts, fällt die Zwischenspeicher-Zusage auf den
// unvertraulichen Wortlaut statt auf `no-store`. Die Bytes sind über die sichtbare Fassung ohnehin
// erlaubt erreichbar.
//
// JOB 579 D5: Diese Grenze WAR grösser, und die alte Formulierung hier („der Unterschied ist die
// Frist, nicht der Zugang") beschrieb genau das, was seither entfallen ist. Der unvertrauliche
// Wortlaut lautet nicht mehr `private, max-age=300`, sondern `private, no-cache, must-revalidate`
// (object-routes.ts) — es gibt keine Frist mehr, in der eine Kopie ohne Rückfrage weiterverwendet
// werden dürfte. Der verbleibende Unterschied ist damit nur noch, dass ein Zwischenspeicher die
// Bytes ABLEGEN darf, statt sie gar nicht erst zu halten; wiederverwendet werden sie in beiden
// Fällen erst nach einer neuen Autorisierung. Die Grenze ist geblieben, ihr Gewicht ist gefallen —
// und sie steht weiter hier, weil sie benannt gehört und nicht stillschweigend verschwinden soll.
//
// ================================================================================================
// AUFTRAG-mega78 BLOCK A — EINE BEHAUPTUNG IST KEIN BERECHTIGUNGSNACHWEIS.
// ================================================================================================
//
// DER FEHLER, den mega76 hier eingebaut hat, und er war eine RECHTEUMGEHUNG. `traegtObjekt` nahm
// JEDES `bodyHtml`, das die Objektkennung als ZEICHENFOLGE enthielt, und `entwurfTraegt`
// zusätzlich frei geliefertes `objectIds`. Sobald EIN so gefundener Träger für den Nutzer sichtbar
// war, gab `beurteileAnhang` den Anhang frei. Wer die Kennung eines fremden Objekts kannte, schrieb
// sie also in ein EIGENES Wissensobjekt oder einen EIGENEN Entwurf — und seine selbstgeschriebene
// Behauptung wurde als sichtbarer Träger gewertet.
//
// bens Satz ist der Maßstab: „Exakte UUIDs sind kein Berechtigungsnachweis; ihre Unerratbarkeit
// darf eine fehlende Autorisierung nicht ersetzen."
//
// DIE RICHTUNG DES ZWEIFELS WAR FALSCH HERUM. Der alte Kommentar sagte „lieber einen Träger zu viel
// finden als einen zu wenig". Bei der Regel EIN SICHTBARER TRÄGER ÖFFNET erweitert ein falsch
// positiver Träger den Zugriff — die Vorsicht wirkte als Loch. Ab hier gilt: IM ZWEIFEL KEIN
// TRÄGER.
//
// ================================================================================================
// DER ANKER, UND WARUM ER NICHT FÄLSCHBAR IST.
// ================================================================================================
//
// Die strukturierte Zuordnung allein genügt NICHT: `PUT /api/kos/:id {action:"attach"}` prüft nur,
// ob die `objectId` EXISTIERT (ko-routes.ts:1202 `objects.metadata`), nicht, wem sie gehört. Ein
// Angreifer hängt eine fremde Kennung also genauso an sein eigenes Objekt, wie er sie in seinen
// Fließtext schreibt. Beides ist eine Behauptung.
//
// Der Anker ist deshalb die HERKUNFT des Anhangs: `ObjectRef.lifecycle.owner` — der Hochladende.
// Er kommt SERVERSEITIG aus der Anmeldung (object-routes.ts:168 `owner: user.id`), NIE aus dem
// Body; der Kommentar am Datenvertrag sagt es wörtlich („eine erfundene Herkunft wäre schlechter
// als keine"). Der Aufrufer reicht ihn als `objekt.author` herein (object-routes.ts:116).
//
// Und die REGEL, in einem Satz: WER EIN OBJEKT HOCHLÄDT, BESTIMMT, WO ES HÄNGT. Eine Zuordnung
// zählt nur, wenn ihr URHEBER der Hochladende ist. Jeder der vier Urheber-Belege steht
// serverseitig fest und ist vom Client nicht setzbar:
//
//   · `KoAttachment.author`      — `ko.addAttachment(id, user.id, …)` (ko-routes.ts:1209/1232)
//   · `EvidenceRecord.createdBy` — beim Anhängen mitgeschrieben, append-only
//   · `KoVersionSnapshot.author` — WER DIESE FASSUNG SCHRIEB (create/revise, aus der Anmeldung).
//      Das ist der Nachweis für Fließtext-Fundstellen: der Text selbst behauptet nichts, aber die
//      Fassung, in der er zuerst steht, hat einen feststehenden Urheber.
//   · `Draft.originalAuthor` / `lastEditor` — die Menschen, denen der Entwurf gehört.
//
// AUSDRÜCKLICH NICHT `KnowledgeObject.author`: `revise` ändert ihn NICHT (service.ts:1834 spreadet
// `...ko`), und `revise` verlangt nur `ko.create` — ein Angreifer schriebe seine Behauptung sonst
// einfach in ein FREMDES Objekt hinein und liehe sich dessen Autor als Nachweis. Genau das prüft
// WEG 5 in tests/security/mega78-traeger-nachweis.test.ts.
//
// WAS EINE BEHAUPTUNG NOCH DARF: einschränken. Eine Fundstelle ohne Urheber-Nachweis öffnet
// nichts, hebt aber weiterhin `vertraulich` — dieselbe Richtung des Zweifels, jetzt konsequent:
// ein Freitext-Treffer ist kein Beleg für ein JA, wohl aber ein hinreichender Verdacht für ein
// NEIN.
//
// WAS ES KOSTET, ehrlich und benannt. Die billige Stufe kann jetzt nur noch über `attachments`
// abkürzen; eine Fundstelle, die NUR im Fließtext steht, braucht die Versionsurheber und damit die
// teure Stufe. Das trifft den Beispielbestand (example-packages schreibt Bilder direkt in den
// Body) und Altbestand ohne Anhangseintrag — der Alltagsweg (Bild über den Anhang-Picker, also mit
// `attachments`-Eintrag) bleibt genau so teuer wie bisher.
export interface AnhangTraeger extends SichtbarkeitsFakten {
  /** Die Kennung des Trägers — ohne sie lässt sich seine Geschichte nicht befragen. */
  id: string;
  /** `author` ist der URHEBER DER ZUORDNUNG (serverseitig), nicht der Autor des Objekts. */
  attachments?:
    | readonly { objectId?: string | undefined; author?: string | null | undefined }[]
    | undefined;
  bodyHtml?: string | null | undefined;
}

/**
 * Eine frühere Fassung — der Voll-Snapshot MIT seinem Urheber.
 *
 * Der Urheber reist getrennt vom Stand, weil er nicht im Stand steht: `KoVersionSnapshot.author`
 * ist die Person, die DIESE Fassung geschrieben hat, während `snapshot.author` der (über
 * Revisionen unveränderte) Autor des Wissensobjekts ist. Nur der erste ist ein Urheber-Nachweis.
 */
export interface AnhangFassung {
  author?: string | null | undefined;
  stand: AnhangTraeger;
}

/**
 * Ein Entwurf als Träger. Er hat KEINE Vertraulichkeitsstufe — unfertige Arbeit ist noch nicht
 * eingestuft. Deshalb gilt er fail-closed als vertraulich und ist nur für die Menschen sichtbar,
 * die an ihm arbeiten.
 */
export interface AnhangEntwurf {
  originalAuthor?: string | null | undefined;
  lastEditor?: string | null | undefined;
  bodyHtml?: string | null | undefined;
  /** Belegstellen-Originale und Ankerdokumente (`pendingSources`, `anchorDocuments`). */
  objectIds?: readonly (string | null | undefined)[] | undefined;
}

/**
 * Die Quellen, die die Trägersuche befragt. BEWUSST als Funktionen injiziert und nicht als Module
 * importiert — dasselbe Muster und dieselbe Begründung wie `ObjectReferenceSources`: der
 * Object-Store weiß, WAS er gespeichert hat, und darf nicht wissen, WER es benutzt.
 */
export interface AnhangQuellen {
  /**
   * Die AKTUELLEN Wissensobjekte, die diesen Anhang tragen KOENNTEN. Die billige Stufe.
   *
   * JOB 2706 D1 (Review R2-30, Neubau nach 2685 D5): die Quelle bekommt die Kennung des Anhangs
   * und darf damit vorsortieren — eine OBERMENGE der Traeger, nie eine Teilmenge. `beurteileAnhang`
   * legt an jedes gelieferte Objekt dieselben Praedikate an wie zuvor an den ganzen Bestand
   * (`zuordnungAmObjekt`, Belegkette, Fassungen); ein Objekt zu viel aendert deshalb kein Urteil.
   * Ein Objekt zu WENIG wuerde es — darum der Vertrag: jedes Objekt, das den Anhang in seinem
   * aktuellen Stand, in einem Versions-Schnappschuss oder in einem Beleg nennt, muss enthalten
   * sein. Eine Quelle, die die Kennung ignoriert und wie bisher alles liefert, erfuellt den Vertrag
   * trivial — so bleiben der Anwendungsspeicher und jeder bestehende Test unveraendert.
   */
  kos: (objectId: string) => Promise<readonly AnhangTraeger[]>;
  /**
   * JOB 2706 D1: dieselbe Frage fuer MEHRERE Kennungen in EINER Abfrage — die Antwort ist eine
   * Obermenge fuer JEDE der Kennungen. Optional: nur eine Quelle, die an der Datenquelle sucht, hat
   * davon etwas; fehlt sie, arbeitet der Kandidaten-Speicher nicht und jeder Abruf sucht einzeln.
   */
  kosFuer?: (objectIds: readonly string[]) => Promise<readonly AnhangTraeger[]>;
  /**
   * JOB 2706 D1: EIN Wissensobjekt, FRISCH gelesen — `undefined`, wenn es fehlt oder im Papierkorb
   * liegt. Der Kandidaten-Speicher merkt sich nur KENNUNGEN; der Zustand (Stufe, Anhaenge,
   * Papierkorb) wird bei jedem Urteil neu gelesen — so greift ein Entzug beim naechsten Abruf.
   */
  ko?: (koId: string) => Promise<AnhangTraeger | undefined>;
  /**
   * JOB 2706 D1: der SCHREIBSTAND der Ablage — eine Zahl, die bei jedem Schreiben steigt, das einen
   * Traeger erzeugen oder entfernen kann. Der Kandidaten-Speicher merkt sie je Eintrag und verwirft
   * den Eintrag, sobald sie sich geaendert hat. Ohne `stand` arbeitet der Speicher nicht.
   */
  stand?: () => Promise<string>;
  /** Die Voll-Snapshots eines Wissensobjekts, je mit dem Urheber der Fassung. */
  versionen: (koId: string) => Promise<readonly AnhangFassung[]>;
  /** Die append-only Belegkette eines Wissensobjekts — `createdBy` ist der Urheber-Nachweis. */
  belege: (
    koId: string,
  ) => Promise<
    readonly { objectId?: string | null | undefined; createdBy?: string | null | undefined }[]
  >;
  /** Entwürfe — unfertige Nutzerarbeit. */
  entwuerfe: () => Promise<readonly AnhangEntwurf[]>;
}

/**
 * Stammt diese Zuordnung vom Hochladenden?
 *
 * Ein LEERER Hochladender ist keine Herkunft (Altbestand ohne `lifecycle`) — er darf nicht auf
 * einen ebenfalls leeren Urheber passen. Dieselbe Vorsicht wie bei der Autorschaft in `darfSehen`.
 */
function vomHochladenden(
  urheber: string | null | undefined,
  hochladender: string | null | undefined,
): boolean {
  return (
    typeof hochladender === "string" &&
    hochladender.length > 0 &&
    typeof urheber === "string" &&
    urheber === hochladender
  );
}

/**
 * Was dieser Träger über den Anhang aussagt.
 *
 * `keine`      — er nennt den Anhang gar nicht.
 * `behauptet`  — er nennt ihn, aber ohne Urheber-Nachweis (Freitext, fremd gesetzter Anhang).
 * `nachgewiesen` — die Zuordnung stammt vom Hochladenden.
 */
type Zuordnung = "keine" | "behauptet" | "nachgewiesen";

/**
 * Nennt dieser Träger das Objekt als ANHANGSEINTRAG (gleich mit welchem Urheber)?
 *
 * mega80 B: der Unterschied zählt. Ein `attachments`-Eintrag trägt einen SERVERSEITIG gesetzten
 * `author` (ko-routes.ts `attach` → `ko.addAttachment(id, user.id, …)`). Er ist damit eine
 * ABSCHLIESSENDE Aussage darüber, wer diese Zuordnung gemacht hat. Eine Fundstelle im Fließtext
 * trägt dagegen gar keinen Urheber — nur für die kann der Verfasser einer Fassung überhaupt
 * einspringen.
 */
function nenntAlsAnhang(ko: AnhangTraeger, objectId: string): boolean {
  return (ko.attachments ?? []).some((a) => a.objectId === objectId);
}

function zuordnungAmObjekt(
  ko: AnhangTraeger,
  objectId: string,
  hochladender: string | null | undefined,
): Zuordnung {
  const anhaenge = (ko.attachments ?? []).filter((a) => a.objectId === objectId);
  if (anhaenge.some((a) => vomHochladenden(a.author, hochladender))) {
    return "nachgewiesen";
  }
  // Bilder und Dateilinks im Fließtext zeigen als `/api/objects/<id>/raw` in den Store, OHNE dass
  // ein `attachments`-Eintrag existieren muss. Die Zeichenfolge allein weist nichts nach — sie ist
  // eine Fundstelle, deren Urheber erst die Fassung liefert (s. `zuordnungInFassung`).
  const imText = typeof ko.bodyHtml === "string" && ko.bodyHtml.includes(objectId);
  return anhaenge.length > 0 || imText ? "behauptet" : "keine";
}

/**
 * Dieselbe Frage an eine FRÜHERE Fassung — hier trägt der Fließtext einen Urheber.
 *
 * Wer eine Fassung geschrieben hat, hat ihren Text geschrieben. Steht die Kennung darin und ist
 * der Verfasser der Hochladende, dann hat der Hochladende diese Zuordnung selbst gemacht — das ist
 * der Nachweis, den die aktuelle Fassung für sich allein nicht führen kann.
 *
 * ==============================================================================================
 * AUFTRAG-mega80 BLOCK B — EIN VERFASSER BÜRGT NICHT FÜR DAS, WAS ER NUR MITKOPIERT HAT.
 * ==============================================================================================
 *
 * DIE ANNAHME, DIE FALSCH WAR. Bis mega80 stand hier nur „Stand nennt die Kennung UND der
 * Verfasser der Fassung ist der Hochladende ⇒ nachgewiesen". Dahinter steckte der Satz „wer die
 * Fassung schrieb, schrieb jede darin enthaltene Zuordnung". Bei einer VOLL-Schnappschuss-Revision
 * ist der falsch: `KoService.revise` übernimmt bei einer Teilrevision alle nicht geänderten Felder
 * (service.ts:1824-1856), und der danach geschriebene Voll-Schnappschuss bekommt den AKTUELLEN
 * Revisionsautor (service.ts:447-459).
 *
 * DIE KETTE, die das ausnutzt:
 *   1. A lädt ein Objekt hoch — `hochladender` = A.
 *   2. B bringt A's Kennung in ein Wissensobjekt ein (Anhang mit `author` = B, oder Fließtext).
 *      Das bleibt korrekt nur `behauptet` — `zuordnungAmObjekt` erkennt den fremden Urheber.
 *   3. A revidiert dieses Objekt später an einem GANZ ANDEREN Feld. Die fremde Fundstelle wandert
 *      unverändert mit, und der neue Schnappschuss trägt A als Verfasser.
 *   4. Die alte Regel hebt die GEERBTE Fundstelle damit auf `nachgewiesen` — und fällt der billige
 *      aktuelle Nachweis weg, öffnen sich die Rohbytes (`beurteileAnhang`, teure Stufe).
 *
 * DIE REGEL AB HIER: nachgewiesen ist eine Zuordnung nur dort, wo sie IN GENAU DIESER MUTATION NEU
 * EINGEBRACHT wurde. Ein Voll-Schnappschuss allein hebt nichts mehr an. Gemessen wird das als
 * DIFFERENZ zum unmittelbaren Vorgänger: nennt schon der Vorgänger die Kennung, hat diese Fassung
 * sie nur GEERBT, und der Verfasser bürgt nicht für sie.
 *
 * WARUM NICHT EINFACH DEN ZWEIG AUF `behauptet` ZURÜCKNEHMEN. Weil er reale Alltagswege trägt:
 * ein Bild oder Dateilink, das NUR im Fließtext steht und keinen `attachments`-Eintrag hat
 * (services/app/src/example-packages.ts:320-334 legt genau das an, und der Ganzdokument-Entwurf
 * aus dem Erfassen ebenso). Für die gäbe es dann gar keinen Nachweis mehr, und Dritte verlören
 * die Bilder eines ansonsten internen Objekts. Die Differenzmessung schließt die Vererbung, ohne
 * das Einbringen zu opfern.
 *
 * DIE BENANNTE RESTGRÖSSE — GESCHLOSSEN IN mega82 BLOCK A. `fassung.author` war typseitig KEIN
 * angemeldeter Nutzer: der Import-Re-Sync rief `koService.revise` mit `item.author ?? actor` auf,
 * und dieser Wert stammt aus dem Request. Ein Schnappschuss-Autor konnte also ein roher Fremd-String
 * sein. Die Differenzmessung entschärfte das für GEERBTE Fundstellen vollständig; für eine im selben
 * Re-Sync NEU eingebrachte Kennung war der Anker nur so stark wie der Import-Weg — und der war über
 * den GENERISCHEN Eingang erreichbar (`POST /api/library/import/candidates` nimmt beliebige
 * `ImportItem[]` mit freiem `author` UND `bodyHtml` entgegen; ein Adapter war dafür nie nötig).
 *
 * Seit mega82 ist der authentifizierte `actor` der alleinige Mutations- und Schnappschussakteur des
 * Imports (library-analytics/src/service.ts, `acceptToKo` Re-Sync-Zweig); der Quellautor reist nur
 * noch als `originalAuthor` und `KoSource.author`, und über beide verzweigt keine Autorisierung.
 * Damit ist `fassung.author` an JEDER schreibenden Stelle ein serverseitig gesetzter Handelnder.
 * Der Beleg am Draht liegt in tests/security/mega82-importeur-handelt.test.ts.
 */
function zuordnungInFassung(
  fassung: AnhangFassung,
  vorgaenger: AnhangTraeger | undefined,
  objectId: string,
  hochladender: string | null | undefined,
): Zuordnung {
  const amStand = zuordnungAmObjekt(fassung.stand, objectId, hochladender);
  if (amStand !== "behauptet") {
    // `nachgewiesen` trägt sich selbst (ein Anhang mit dem Hochladenden als Urheber); `keine`
    // ist ohnehin nichts.
    return amStand;
  }
  if (!vomHochladenden(fassung.author, hochladender)) {
    return "behauptet";
  }
  // (a) DER ANHANGSEINTRAG SCHLÄGT DEN VERFASSER. Wir sind hier, weil `zuordnungAmObjekt` KEINEN
  //     Anhang mit dem Hochladenden als Urheber gefunden hat. Gibt es trotzdem einen Anhang auf
  //     dieses Objekt, hat ihn also nachweislich JEMAND ANDERES gesetzt — und dieser `author`
  //     steht serverseitig fest. Der Verfasser einer späteren Fassung überschreibt das nicht.
  //     Ohne diesen Zweig bliebe der Anhangs-Weg offen: `attach` schreibt gar keinen
  //     Voll-Schnappschuss, deshalb SIEHT die Vorgänger-Differenz unten die fremd gesetzte
  //     Referenz fälschlich als „in dieser Fassung neu eingebracht".
  if (nenntAlsAnhang(fassung.stand, objectId)) {
    return "behauptet";
  }
  // (b) REINE FLIESSTEXT-FUNDSTELLE — hier und nur hier kann der Verfasser einspringen, denn der
  //     Text trägt keinen eigenen Urheber. Aber nur für das, was er NEU eingebracht hat: kannte
  //     schon der Vorgänger diese Kennung, ist sie mitkopiert — und Mitkopieren ist keine
  //     Urheberschaft.
  const schonImVorgaenger =
    vorgaenger !== undefined && zuordnungAmObjekt(vorgaenger, objectId, hochladender) !== "keine";
  return schonImVorgaenger ? "behauptet" : "nachgewiesen";
}

/**
 * Darf dieser Mensch diesen Anhang sehen? (G2 — der Anhang erbt die Stufe seines Objekts.)
 *
 * `traeger` ist der AKTUELLE Bestand der Wissensobjekte; der Aufrufer liefert ihn, damit diese
 * Entscheidung ohne eigene Persistenzkenntnis testbar bleibt (Muster `ObjectReferenceSources`).
 */
export interface AnhangUrteil {
  /** Darf dieser Mensch die Bytes bekommen? */
  sichtbar: boolean;
  /**
   * Ist dieser Anhang vertraulich — geerbt vom tragenden Objekt?
   *
   * Getrennt von `sichtbar` ausgewiesen, weil die Zwischenspeicher-Zusage (G4) daran hängt und
   * NICHT an der eigenen Stufe des gespeicherten Objekts: die ist bei normalen Anhängen gar nicht
   * gesetzt (s. o.). Ohne diese Trennung bekäme das Original eines vertraulichen Wissensobjekts
   * eine Fünf-Minuten-Frist, obwohl das Objekt selbst `no-store` verlangt.
   */
  vertraulich: boolean;
}

function entwurfNenntObjekt(entwurf: AnhangEntwurf, objectId: string): boolean {
  if ((entwurf.objectIds ?? []).some((id) => id === objectId)) {
    return true;
  }
  return typeof entwurf.bodyHtml === "string" && entwurf.bodyHtml.includes(objectId);
}

// Ein Entwurf gehört den Menschen, die an ihm arbeiten. `lastEditor` zählt mit, weil ein Entwurf
// weitergereicht werden darf (capture/src/types.ts) — wer ihn zuletzt bearbeitet hat, sieht seine
// eigenen Bilder.
function entwurfGehoert(entwurf: AnhangEntwurf, wer: string | null | undefined): boolean {
  return (
    typeof wer === "string" &&
    wer.length > 0 &&
    (entwurf.originalAuthor === wer || entwurf.lastEditor === wer)
  );
}

/**
 * Was ein einzelner gefundener Träger über den Anhang aussagt.
 *
 * `sichtbar` zählt NUR bei `nachgewiesen` — eine Behauptung öffnet nichts. `vertraulich` zählt
 * IMMER: im Zweifel gegen die Auslieferung, nie für sie.
 */
interface Traegerfund {
  nachgewiesen: boolean;
  sichtbar: boolean;
  vertraulich: boolean;
}

/**
 * Die EINE Stelle, an der aus Fundstellen ein Urteil wird.
 *
 * Nur nachgewiesene Träger öffnen; jede Fundstelle — nachgewiesen oder behauptet — kann die
 * Vertraulichkeit heben. Gibt es keinen einzigen NACHGEWIESENEN Träger, ist das Objekt für dieses
 * Urteil trägerlos: dann entscheidet die Herkunft (`ruecklage`), und die Behauptungen tragen nur
 * noch ihre Einschränkung bei. Wichtig genau so herum — sonst nähme eine fremde Behauptung dem
 * Hochladenden den Zugriff auf sein eigenes, frisch hochgeladenes Objekt.
 */
function urteile(funde: readonly Traegerfund[], ruecklage: AnhangUrteil): AnhangUrteil {
  const nachweise = funde.filter((f) => f.nachgewiesen);
  if (nachweise.length === 0) {
    // Kein Nachweis: die Herkunft entscheidet — und die Behauptungen dürfen ihre Einschränkung
    // trotzdem beisteuern.
    return {
      sichtbar: ruecklage.sichtbar,
      vertraulich: ruecklage.vertraulich || funde.some((f) => f.vertraulich),
    };
  }
  // Mit Nachweis gilt die Stufe der TRÄGER, nicht die des ungebundenen Objekts — sonst bekäme
  // jeder normale Anhang (dessen eigene Stufe nie gesetzt wird) dauerhaft `no-store`.
  return {
    sichtbar: nachweise.some((f) => f.sichtbar),
    vertraulich: funde.some((f) => f.vertraulich),
  };
}

// Die Stufe, mit der ein Anhang OHNE bekannte Einstufung beurteilt wird. Kein neuer Rang und keine
// zweite Auslegung: derselbe Wert, den ein ausdrücklich vertrauliches Objekt trägt — „unbekannt"
// wird damit exakt so streng behandelt wie „vertraulich", nicht strenger und nicht milder.
const STUFE_FUER_UNBEKANNT: Confidentiality = "vertraulich";

/**
 * DAS Praedikat fuer Anhaenge (Block C der Pruefliste; mega74/g10 messen diesen Namen im Routenaufruf).
 *
 * JOB 2706 D1: mit `speicher` kommt die Liste der aktuellen Traeger aus gemerkten Kennungen und wird
 * FRISCH gelesen (`quellen.ko`) — dieselbe Regel, dieselben Praedikate, derselbe Weg durch die teure
 * Stufe. Kann der Speicher nicht arbeiten (keine Frist, keine `kosFuer`/`ko`/`stand`-Quelle), laeuft
 * der bisherige Weg unveraendert. Ohne `speicher` ist alles wie vor 2706.
 */
export async function beurteileAnhang(
  user: SessionUser,
  objectId: string,
  objekt: SichtbarkeitsFakten,
  quellen: AnhangQuellen,
  speicher?: KandidatenSpeicher,
): Promise<AnhangUrteil> {
  if (speicher) {
    const kandidaten = await speicher.kandidaten(objectId, quellen);
    const lesen = quellen.ko;
    if (kandidaten !== null && typeof lesen === "function") {
      const frisch: AnhangQuellen = {
        ...quellen,
        kos: async () =>
          (await Promise.all(kandidaten.map((id) => lesen(id)))).filter(
            (k): k is AnhangTraeger => k !== undefined,
          ),
      };
      return beurteileAnhangKern(user, objectId, objekt, frisch);
    }
  }
  return beurteileAnhangKern(user, objectId, objekt, quellen);
}

async function beurteileAnhangKern(
  user: SessionUser,
  objectId: string,
  objekt: SichtbarkeitsFakten,
  quellen: AnhangQuellen,
): Promise<AnhangUrteil> {
  // mega78 A: DER ANKER. Der Hochladende kommt serverseitig aus der Anmeldung und reist als
  // `objekt.author` herein (object-routes.ts:116). Alles, was diese Funktion als NACHWEIS gelten
  // lässt, wird gegen ihn gehalten.
  const hochladender = objekt.author;

  // TRÄGERLOS ist die RÜCKLAGE, nicht mehr nur der letzte Zweig: sie gilt, sobald sich KEINE
  // Zuordnung nachweisen lässt. Das ist das Hochlade-Fenster (zwischen Hochladen und Binden ist ein
  // Objekt echt ungebunden und trotzdem lebendig — derselbe Fall, den `retainUntil` abdeckt), und
  // es ist zugleich die Antwort auf jede bloße Behauptung. Eine FEHLENDE Stufe ist dabei keine
  // Aussage „intern", sondern „unbekannt" (mega76 Block B).
  const stufeUnbekannt = objekt.confidentiality === null || objekt.confidentiality === undefined;
  const ruecklage: AnhangUrteil = {
    sichtbar: darfSehen(
      user,
      stufeUnbekannt ? { confidentiality: STUFE_FUER_UNBEKANNT, author: objekt.author } : objekt,
    ),
    vertraulich: stufeUnbekannt || isConfidential(objekt.confidentiality),
  };

  // JOB 2706 D1: die Kennung reist mit, damit die Quelle vorsortieren kann (Vertrag am Interface).
  // Alles, was danach kommt, ist unveraendert — die Praedikate laufen ueber jedes gelieferte Objekt.
  const aktuelle = await quellen.kos(objectId);
  const funde: Traegerfund[] = [];
  for (const ko of aktuelle) {
    const zuordnung = zuordnungAmObjekt(ko, objectId, hochladender);
    if (zuordnung === "keine") {
      continue;
    }
    funde.push({
      nachgewiesen: zuordnung === "nachgewiesen",
      sichtbar: darfSehen(user, ko),
      // Vertraulich, sobald IRGENDEIN Träger es ist — auch wenn der Zugriff über einen internen
      // Träger erlaubt wurde. Die Bytes sind dieselben; ein Zwischenspeicher, der sie festhält,
      // hielte auch den vertraulichen Gebrauch fest.
      vertraulich: isConfidential(ko.confidentiality),
    });
  }
  if (funde.some((f) => f.nachgewiesen)) {
    // Die billige Stufe hat einen NACHWEIS. Die teure könnte die Sichtbarkeit nur noch weiter
    // öffnen, nie schliessen (mega76) — sie bleibt deshalb aus.
    return urteile(funde, ruecklage);
  }

  // Ab hier die TEURE Stufe — sie läuft, wenn die aktuellen Fassungen keinen NACHWEIS ergeben
  // haben. Die bereits gefundenen Behauptungen reisen mit: sie öffnen nichts, tragen aber ihre
  // Vertraulichkeit weiter.
  for (const entwurf of await quellen.entwuerfe()) {
    if (!entwurfNenntObjekt(entwurf, objectId)) {
      continue;
    }
    // Ein Entwurf weist die Zuordnung nur nach, wenn er dem Hochladenden GEHÖRT. Sonst ist auch
    // sein `objectIds` nur ein frei geliefertes Feld — die reinste Form der Behauptung.
    funde.push({
      nachgewiesen: entwurfGehoert(entwurf, hochladender),
      sichtbar: entwurfGehoert(entwurf, user.id),
      vertraulich: true,
    });
  }
  for (const ko of aktuelle) {
    // Die Belegkette überlebt jede Änderung am Objekt — sie ist die letzte Spur eines Trägers.
    // `createdBy` steht serverseitig fest und sagt, WER diesen Beleg geschrieben hat.
    for (const beleg of await quellen.belege(ko.id)) {
      if (beleg.objectId !== objectId) {
        continue;
      }
      funde.push({
        nachgewiesen: vomHochladenden(beleg.createdBy, hochladender),
        sichtbar: darfSehen(user, ko),
        vertraulich: isConfidential(ko.confidentiality),
      });
    }
    // mega80 B: die Fassungen kommen AUFSTEIGEND (KoVersionRepo.listByKo → [1, 2, …],
    // knowledge-object/src/service.test.ts:399-405). Jede Fassung wird gegen ihren unmittelbaren
    // VORGÄNGER gehalten — nur so ist „in dieser Mutation neu eingebracht" überhaupt messbar.
    // Die erste Fassung hat keinen Vorgänger; dort IST alles neu eingebracht (das Erstellen).
    const fassungen = await quellen.versionen(ko.id);
    for (const [i, fassung] of fassungen.entries()) {
      const vorgaenger = i > 0 ? fassungen[i - 1]?.stand : undefined;
      const zuordnung = zuordnungInFassung(fassung, vorgaenger, objectId, hochladender);
      if (zuordnung === "keine") {
        continue;
      }
      // BEIDE Stände müssen erlauben. Ein Objekt, das inzwischen herabgestuft wurde, gibt seine
      // früheren Bytes nicht frei — und eines, das hochgestuft wurde, erst recht nicht.
      funde.push({
        nachgewiesen: zuordnung === "nachgewiesen",
        sichtbar: darfSehen(user, ko) && darfSehen(user, fassung.stand),
        vertraulich:
          isConfidential(ko.confidentiality) || isConfidential(fassung.stand.confidentiality),
      });
    }
  }
  return urteile(funde, ruecklage);
}

// ================================================================================================
// JOB 2706 D1 (Review R2-30) — DER KANDIDATEN-SPEICHER: ZEHN BILDER, EINE TRAEGERSUCHE JE SEITE.
// Neubau auf dem heutigen Stand nach der Vorlage 2685 D2–D5 (GRUEN).
// ================================================================================================
//
// Ein Zwischenspeicher fuer das URTEIL braeche die gepinnte Zusage, dass Hochstufung und Loeschung
// BEIM NAECHSTEN ABRUF greifen (JOB 579 D5, JOB 605 D5). Deshalb merkt sich dieser Speicher NICHT
// das Urteil und NICHT den Zustand der Traeger, sondern nur ihre KENNUNGEN: welche Wissensobjekte
// die Traegersuche fuer eine Anhang-Kennung geliefert hat. Das Urteil selbst liest jeden Kandidaten
// FRISCH (`quellen.ko`) und legt dieselben Praedikate an wie immer. Ein hochgestufter Traeger wird
// mit seiner neuen Stufe gelesen, ein getrashter faellt weg, ein geloester Anhang ist im frischen
// Stand nicht mehr da — der Entzug greift sofort.
//
// DIE GESCHWISTER: eine Seite mit zehn Bildern fragt zehnmal, fast gleichzeitig. Findet die Suche
// fuer das erste Bild seinen Traeger, nennt dessen aktueller Stand die anderen neun Bilder
// (`attachments`, Fliesstext). Fuer diese Geschwister laeuft EINE weitere Abfrage (`kosFuer`), und
// die Antwort ist eine Obermenge fuer jede von ihnen — also eine gueltige Kandidatenmenge fuer jede.
// Eine Seite kostet damit zwei Traegersuchen (Bild 1, dann seine Geschwister), nicht zehn; ein
// zweiter Aufruf derselben Seite innerhalb der Frist kostet keine.
//
// EIN NEUES BILD WAEHREND DER FRIST: Die Frist allein waere ein Fenster — wer in den fuenf Sekunden
// ein Bild an ein weiteres Objekt haengt, dessen Traeger stuende nicht in der gemerkten Menge.
// Deshalb traegt jeder Eintrag den SCHREIBSTAND mit, unter dem er entstand (`quellen.stand`): ein
// Wert der ABLAGE, nicht des Prozesses (zwei App-Prozesse ueber einer Datenbank sehen denselben),
// der sich bei jedem Schreiben aendert, das einen Traeger erzeugen oder entfernen kann — und der in
// Postgres in DERSELBEN Transaktion steigt wie das fachliche Schreiben (repo-pg.ts). Stimmt der
// Stand beim Abruf nicht mehr, ist der Eintrag wertlos und die Suche laeuft neu. Der Stand wird VOR
// der Suche gelesen: ein Schreiben waehrend der laufenden Suche entwertet den Eintrag beim naechsten
// Abruf ebenfalls. Ohne `stand`-Quelle arbeitet der Speicher NICHT (`null` → Urteil wie bisher).
// Eine LEERE Kandidatenmenge wird nie gemerkt: der haeufigste Fall des Hinzukommens — hochladen,
// anhaengen, ansehen — bleibt damit ohne jede Verzoegerung.
//
// Preis: eine O(1)-Abfrage des Schreibstands je Bildabruf — anstelle der Traegersuche, die sie
// erspart; zehn Bilder einer Seite kosten damit zehn Kleinstabfragen und zwei Suchen statt zehn
// Volllasten des Bestands.
export const KANDIDATEN_FRIST_MS = 5_000;
/** Deckel: bei Erreichen werden abgelaufene Eintraege geraeumt, danach — falls noetig — alles. */
const KANDIDATEN_MAX = 5_000;
/** Hoechstens so viele Geschwister werden je Traeger vorbefuellt — ein Objekt mit hundert Bildern ist
 * keine Seite, sondern ein Archiv; der Rest holt sich seine Kandidaten wie bisher einzeln. */
const GESCHWISTER_MAX = 50;

/** Alle Anhang-Kennungen, die ein Traeger in seinem AKTUELLEN Stand nennt (Anhaenge und Fliesstext). */
export function objektKennungenIn(traeger: AnhangTraeger): string[] {
  const kennungen = new Set<string>();
  for (const a of traeger.attachments ?? []) {
    if (typeof a.objectId === "string" && a.objectId.length > 0) {
      kennungen.add(a.objectId);
    }
  }
  if (typeof traeger.bodyHtml === "string") {
    for (const treffer of traeger.bodyHtml.matchAll(/\/api\/objects\/([A-Za-z0-9_.:-]+)\/raw/g)) {
      const id = treffer[1];
      if (id) {
        kennungen.add(id);
      }
    }
  }
  return [...kennungen];
}

export interface KandidatenSpeicherOptionen {
  /** Frist in Millisekunden; `0` schaltet den Speicher aus. */
  fristMs?: number;
  /** Uhr (Millisekunden) — injizierbar fuer Tests. */
  jetzt?: () => number;
}

export class KandidatenSpeicher {
  private readonly frist: number;
  private readonly jetzt: () => number;
  private readonly eintraege = new Map<
    string,
    { bis: number; stand: string; kandidaten: readonly string[] }
  >();
  /** Wie oft die Traegersuche an der Quelle wirklich lief — fuer Zaehler und Belege. */
  traegersuchen = 0;
  /** Wie oft ein gemerkter Eintrag wegen eines geaenderten Schreibstands verworfen wurde. */
  verworfen = 0;
  /** Die Reihe der Suchen: eine nach der anderen, s. `kandidaten`. */
  private kette: Promise<unknown> = Promise.resolve();

  constructor(optionen: KandidatenSpeicherOptionen = {}) {
    this.frist = optionen.fristMs ?? KANDIDATEN_FRIST_MS;
    this.jetzt = optionen.jetzt ?? (() => Date.now());
  }

  /**
   * Die Kandidaten-Kennungen fuer einen Anhang — aus dem Speicher oder frisch gesucht. `null`, wenn
   * der Speicher nicht arbeiten kann (Frist 0, oder die Quelle bietet keine Mehrfachsuche, keinen
   * Einzelzugriff oder keinen Schreibstand): dann urteilt der Aufrufer wie bisher ueber `quellen.kos`.
   */
  async kandidaten(objectId: string, quellen: AnhangQuellen): Promise<readonly string[] | null> {
    const kosFuer = quellen.kosFuer;
    const stand = quellen.stand;
    if (this.frist <= 0 || typeof kosFuer !== "function" || typeof quellen.ko !== "function") {
      return null;
    }
    if (typeof stand !== "function") {
      return null;
    }
    // Der Stand kommt aus der ABLAGE (eine O(1)-Abfrage je Abruf), nicht aus dem Prozess.
    const sofort = this.ausSpeicher(objectId, await stand());
    if (sofort) {
      return sofort;
    }
    // SUCHEN LAUFEN NACHEINANDER. Ein Browser fordert die zehn Bilder einer Seite GLEICHZEITIG an.
    // Ohne Reihung startete jede dieser Anfragen ihre eigene Suche, bevor die erste ihre Geschwister
    // vorbefuellen konnte (gemessen in 2685 D3: zwanzig Suchen statt zwei). Wer wartet, sieht danach
    // zuerst in den Speicher; eine gescheiterte Suche reisst die Reihe nicht ab. Treffer im Speicher
    // warten nie.
    const arbeit = this.kette.then(() => this.suchen(objectId, { ...quellen, kosFuer, stand }));
    this.kette = arbeit.then(
      () => undefined,
      () => undefined,
    );
    return arbeit;
  }

  /** Ein gueltiger Eintrag — oder `undefined`; ein Eintrag mit fremdem Schreibstand wird verworfen. */
  private ausSpeicher(objectId: string, stand: string): readonly string[] | undefined {
    const t = this.jetzt();
    const bekannt = this.eintraege.get(objectId);
    if (bekannt && bekannt.bis > t) {
      if (bekannt.stand === stand) {
        return bekannt.kandidaten;
      }
      this.verworfen += 1;
      this.eintraege.delete(objectId);
    }
    return undefined;
  }

  private async suchen(
    objectId: string,
    quellen: AnhangQuellen & {
      kosFuer: NonNullable<AnhangQuellen["kosFuer"]>;
      stand: () => Promise<string>;
    },
  ): Promise<readonly string[]> {
    // Der Stand VOR der Suche — was danach geschrieben wird, entwertet diesen Eintrag.
    const stand = await quellen.stand();
    // Wer in der Reihe gewartet hat, findet seinen Eintrag oft schon vorbefuellt (Geschwister).
    const inzwischen = this.ausSpeicher(objectId, stand);
    if (inzwischen) {
      return inzwischen;
    }
    const t = this.jetzt();
    this.traegersuchen += 1;
    const traeger = await quellen.kosFuer([objectId]);
    if (traeger.length === 0) {
      // Nicht merken (s. Kopf): der naechste Abruf sucht wieder — ein gerade erst angehaengter
      // Anhang wird so ohne Verzoegerung gefunden.
      return [];
    }
    const geschwister = new Set<string>();
    for (const k of traeger) {
      for (const kennung of objektKennungenIn(k)) {
        if (kennung !== objectId && !this.frisch(kennung, t, stand)) {
          geschwister.add(kennung);
        }
      }
    }
    const nachzufragen = [...geschwister].slice(0, GESCHWISTER_MAX);
    if (nachzufragen.length === 0) {
      const kandidaten = traeger.map((k) => k.id);
      this.merken(objectId, kandidaten, t, stand);
      return kandidaten;
    }
    // EINE Abfrage fuer den Anhang und seine Geschwister: die Antwort ist eine Obermenge fuer jede
    // der Kennungen, also fuer jede eine gueltige Kandidatenmenge.
    this.traegersuchen += 1;
    const alle = await quellen.kosFuer([objectId, ...nachzufragen]);
    const kandidaten = alle.map((k) => k.id);
    for (const kennung of [objectId, ...nachzufragen]) {
      this.merken(kennung, kandidaten, t, stand);
    }
    return kandidaten;
  }

  private frisch(kennung: string, t: number, stand: string): boolean {
    const e = this.eintraege.get(kennung);
    return e !== undefined && e.bis > t && e.stand === stand;
  }

  private merken(kennung: string, kandidaten: readonly string[], t: number, stand: string): void {
    if (this.eintraege.size >= KANDIDATEN_MAX) {
      for (const [k, e] of this.eintraege) {
        if (e.bis <= t) {
          this.eintraege.delete(k);
        }
      }
      if (this.eintraege.size >= KANDIDATEN_MAX) {
        this.eintraege.clear();
      }
    }
    this.eintraege.set(kennung, { bis: t + this.frist, stand, kandidaten });
  }
}
