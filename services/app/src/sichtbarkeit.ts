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
// UND (nur) im Schnappschuss eines vertraulichen Objekts, bleibt die Zwischenspeicher-Zusage bei
// der kurzen Frist statt `no-store`. Die Bytes sind über die sichtbare Fassung ohnehin erlaubt
// erreichbar; der Unterschied ist die Frist, nicht der Zugang.
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
  /** Die AKTUELLEN Wissensobjekte. Die billige Stufe. */
  kos: () => Promise<readonly AnhangTraeger[]>;
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

export async function beurteileAnhang(
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

  const aktuelle = await quellen.kos();
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
