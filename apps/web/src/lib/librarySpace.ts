// ==================================================================================================
// AUFTRAG PRO 384 — DIE REINE ORTSLOGIK DER BIBLIOTHEK.
// ==================================================================================================
//
// Dieses Modul ist die EINZIGE Stelle im Web-Bestand, an der ein Ort („Wissensraum") überhaupt
// entsteht. Es ist bewusst DOM-frei, importfrei und ohne jeden Netzzugriff: es rechnet nur mit dem,
// was ihm hereingereicht wird. Sichtbares gibt es hier nicht — die Ortszeile und die Heimatzeile
// sind ausdrücklich NICHT Teil dieses Auftrags.
//
// ── WARUM DER ORT KEINE ELFTE FACETTE IST ────────────────────────────────────────────────────────
// Der Vertrag aus PLAN PRO 378 §2.3 hat das nicht aus Geschmack entschieden. Die Bibliothek filtert
// alle zehn Achsen CLIENTSEITIG, leitet die Achsenwerte je Wissensobjekt CLIENTSEITIG aus dem
// Objekt ab und rechnet die Zähler je Option CLIENTSEITIG über die GELADENE Treffermenge. Ein Ort
// in dieser Mechanik wäre zweierlei zugleich: neue Datenwahrheit im Frontend und ein ungetrimmter
// Zähler — also eine Existenzauskunft über Dinge, die der Betrachter nicht sehen darf.
//
// Deshalb ist der Ort ein GELTUNGSBEREICH über der Schiene, kein Wert darin. Die Bauform ist im
// Haus bereits abgenommen: der Bereichsfilter „Zuletzt geändert" läuft seit mega10 über eigene
// URL-Parameter (`von`/`bis`) NEBEN der Achsenauswahl, begründet mit „ein Bereich ist kein
// Facettenwert". Der Ort folgt genau dieser Form mit dem Parameter `raum`.
//
// ── DIE VIER REGELN, DIE DIESES MODUL TRÄGT ──────────────────────────────────────────────────────
//  1. `home` fehlend und `home: null` sind ZEICHENGLEICH stumm. Ein Wissensobjekt ohne Zuordnung
//     und eines mit einem für diesen Betrachter unsichtbaren Zuhause kommen ununterscheidbar an —
//     und sie gehen hier ununterscheidbar wieder heraus. Der Client KANN nicht lecken, weil er es
//     nicht weiss; das ist eine Bauform, keine Disziplin.
//  2. Eine unvollständige Kette ergibt KEINEN Pfad, nicht einen gekürzten. Ein gekürzter Pfad
//     verriete die Tiefe, ein vollständiger die Namen.
//  3. Höchsttiefe 15 (Architekturentscheidung KW-ARCH-WISSENSRAUM-ERSTE-WELLE-01, Punkt 4). Was
//     tiefer hereinkommt, ist eine unbekannte Lage — und auf eine unbekannte Lage antwortet dieses
//     Modul fail-closed mit gar nichts.
//  4. Der Ort wird NIE abgeleitet. Es gibt hier keinen Zweig, der Kategorie, Schlagwörter, Titel
//     oder einen Quellpfad liest. Wer das ändern wollte, müsste dieses Modul umschreiben — und
//     genau das ist der Zweck seiner Enge.
//
// ── WAS HIER BEWUSST FEHLT ───────────────────────────────────────────────────────────────────────
// Kein Import. Nicht einer. Das Modul kennt weder die Achsenableitung noch die Zähler noch die
// Fensterung der Trefferliste noch den Netz-Zugang — es kann deshalb gar keinen Aufrufweg zu einer
// selbst gerechneten Ortszahl haben. Diese Abwesenheit ist zugesichert und wird maschinell geprüft.

/**
 * Der URL-Parameter des Geltungsbereichs. Kurz und lesbar, weil der Link geteilt wird — dieselbe
 * Wahl, die `von`/`bis` für den Bereichsfilter getroffen haben.
 */
export const LIBRARY_SPACE_PARAM = "raum";

/**
 * Maximale Navigationstiefe in Zielstufe 1: **15**.
 *
 * Beschlossen in KW-ARCH-WISSENSRAUM-ERSTE-WELLE-01 (Punkt 4) und serverseitig als CHECK verankert.
 * Die Oberfläche wiederholt die Grenze NICHT, um klug zu sein, sondern um fail-closed zu bleiben:
 * eine Kette jenseits davon kann in Zielstufe 1 nicht rechtmässig entstanden sein, also ist ihre
 * Herkunft unbekannt — und Unbekanntes wird nicht gezeichnet.
 */
export const LIBRARY_SPACE_MAX_DEPTH = 15;

/**
 * „Gesamtes Unternehmen" — die Abwesenheit eines Geltungsbereichs.
 *
 * Bewusst die leere Zeichenkette und nicht `null`: Der Standard ist nicht „kein Raum gewählt", er
 * ist „alles, was ich sehen darf". Das ist der einzige Standard, der nach der Migration nicht
 * schlechter sein kann als der heutige Zustand — vor der Ortsschicht war die Bibliothek global.
 */
export const NO_SPACE = "";

/**
 * Ein Kettenglied, wie der Server es liefert: Kennung plus bereits aufgelöster Name.
 *
 * Die Oberfläche löst KEINE Namen auf. Steht hier ein Name, dann hat der Server ihn geschickt und
 * damit zugleich entschieden, dass dieser Betrachter ihn sehen darf.
 *
 * GRENZE, benannt: PLAN PRO 378 §4.2 sieht diesen Typ langfristig in `apps/web/src/api/types.ts`
 * vor. Diese Runde darf dort nicht schreiben, deshalb wohnt er vorläufig hier. Ein späterer
 * Auftrag führt beides zusammen — es gibt bis dahin nur diese eine Definition, keine zweite.
 */
export interface KnowledgeSpaceNode {
  id: string;
  name: string;
}

/**
 * Glättet einen Ortswert auf seine kanonische Form. Fremdtypen werden zu „gesamtes Unternehmen“ —
 * dieselbe defensive Haltung, die die übrigen URL-Grenzen des Hauses an ihrem Eingang haben.
 */
function normalizeSpace(value: unknown): string {
  return typeof value === "string" ? value.trim() : NO_SPACE;
}

/**
 * Prüft ein einzelnes Kettenglied und gibt es normalisiert zurück — oder `null`, wenn es keines ist.
 *
 * Zurückgegeben wird eine Kopie mit GENAU zwei Feldern. Das ist kein Aufräumen, sondern eine
 * Sperre: käme am Glied je ein weiteres Feld mit (eine Tiefe, ein Elternteil, ein Zustand), dann
 * reichte dieses Modul es nicht an die Oberfläche weiter, wo es versehentlich sichtbar werden
 * könnte.
 */
function spaceNodeOrNull(candidate: unknown): KnowledgeSpaceNode | null {
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  const { id, name } = candidate as { id?: unknown; name?: unknown };
  if (typeof id !== "string" || id.trim().length === 0) {
    return null;
  }
  if (typeof name !== "string" || name.trim().length === 0) {
    return null;
  }
  // Die Werte kommen UNVERÄNDERT durch — getrimmt wird nur zum Prüfen. Ein Servername ist die
  // Wahrheit, nicht ein Vorschlag, den die Oberfläche noch nachbessert.
  return { id, name };
}

/**
 * Holt die rohen Kettenglieder aus dem, was der Server geschickt hat — oder `null`.
 *
 * Zwei Formen sind zulässig, weil beide im Vertrag vorkommen: die nackte Liste und der Umschlag
 * `{ chain }`, wie ihn das Feld `home` am Wissensobjekt trägt.
 *
 * Zum Feld `complete`: Es ist ein OPTIONALER Selbstbericht des Servers. Meldet sich eine Kette
 * ausdrücklich als unvollständig, ist hier Schluss — ohne dass die Glieder überhaupt angesehen
 * werden. FEHLT das Feld, gilt das NICHT als „unvollständig": der Server liefert die Kette laut
 * Vertrag ganz oder lässt `home` ganz weg, eine halbe Kette soll es gar nicht erst geben. Das Feld
 * ist der zweite Gurt, nicht der erste — der erste ist die Gliedprüfung unten.
 */
function chainLinks(chain: unknown): unknown[] | null {
  if (Array.isArray(chain)) {
    return chain;
  }
  if (chain === null || typeof chain !== "object") {
    return null;
  }
  const umschlag = chain as { chain?: unknown; complete?: unknown };
  if (umschlag.complete !== undefined && umschlag.complete !== true) {
    return null;
  }
  return Array.isArray(umschlag.chain) ? umschlag.chain : null;
}

/**
 * Liest den Geltungsbereich aus der Adresse — und verwirft, was der Bestand nicht kennt.
 *
 * `known` ist die Liste der Raumkennungen, die der Server für DIESEN Betrachter geliefert hat; sie
 * ist damit bereits security-getrimmt. Ein Wert, der nicht darin steht, wird am EINGANG verworfen
 * und nicht etwa später aufgeräumt. Zwei Gründe, und beide zählen:
 *
 *  · Ein Wert, der nie echte Auswahl war, kann auch nicht in eine gemerkte Suche geraten. Genau
 *    diesen Weg hat mega11 für Achsenwerte geschlossen, nachdem ein Fremdwert aus der Adresszeile
 *    im Browser-Speicher eines Nutzers landen konnte.
 *  · Bei einem getrimmten Bestand heisst „unbekannt" auch „für dich nicht sichtbar". Würde ein
 *    Fremdwert angewendet, wäre die Adresszeile eine Sonde: man tippte Kennungen hinein und läse
 *    an der Reaktion ab, welche es gibt.
 *
 * Solange noch nichts geladen ist (`known` leer), gibt es folglich noch keine Auswahl — nicht etwa
 * „alles erlaubt". Auch das ist fail-closed und kostet nichts: ohne Bestand ist ohnehin nichts zu
 * zeigen.
 */
export function spaceFromParams(params: URLSearchParams, known: readonly string[]): string {
  const wert = normalizeSpace(params.get(LIBRARY_SPACE_PARAM));
  if (wert === NO_SPACE) {
    return NO_SPACE;
  }
  return known.includes(wert) ? wert : NO_SPACE;
}

/**
 * Schreibt den Geltungsbereich in die Adresse fort und gibt eine NEUE Parametermenge zurück.
 *
 * „Gesamtes Unternehmen" ENTFERNT den Parameter, statt ihn leer zu schreiben. `?raum=` wäre eine
 * lügende Adresse: sie behauptete einen Geltungsbereich, der keiner ist — und ein geteilter Link
 * soll dieselbe Treffermenge zeigen, nicht eine ähnliche.
 *
 * Alles Übrige bleibt unangetastet. Der Ort ist additiv, kein Ersatz: die Achsenauswahl, der
 * Bereichsfilter und die Volltextsuche stehen unverändert daneben.
 */
export function writeSpaceToParams(params: URLSearchParams, space: string): URLSearchParams {
  const next = new URLSearchParams(params);
  const wert = normalizeSpace(space);
  if (wert === NO_SPACE) {
    next.delete(LIBRARY_SPACE_PARAM);
  } else {
    next.set(LIBRARY_SPACE_PARAM, wert);
  }
  return next;
}

/**
 * Die kanonische Zeichenkette eines Geltungsbereichs — die Schleifenbremse der URL-Fortschreibung.
 *
 * Die Bibliothek vergleicht ihren Zustand gegen die Adresse über kanonische Zeichenketten, nicht
 * über Objektidentität. Ohne das drehte sich Effekt → Adresse schreiben → Rendern → Effekt im
 * Kreis. Der Ort tritt in denselben Effekt ein und braucht deshalb dieselbe Eigenschaft.
 */
export function serializeSpace(space: string): string {
  return normalizeSpace(space);
}

/**
 * Projiziert eine servergelieferte Kette auf einen darstellbaren Pfad — oder auf `null`.
 *
 * **Ganz oder gar nicht.** Es gibt in dieser Funktion keinen Zweig, der aus einer lückenhaften
 * Kette etwas zeichnet: kein Kürzen, kein Auslassen, kein Platzhalter, kein Gedankenstrich. Ein
 * gekürzter Pfad verriete die Tiefe („da geht es noch weiter"), ein vollständiger die Namen — und
 * beides ist genau die Metadatenspur, die der Vertrag verbietet.
 *
 * Vier Wege führen deshalb zu `null`, und sie sind alle gleich still:
 *   · gar keine Kette, eine leere Kette oder etwas, das keine Kette ist,
 *   · eine Kette, die sich selbst als unvollständig meldet,
 *   · eine Kette mit auch nur EINEM unbrauchbaren Glied,
 *   · eine Kette jenseits der Höchsttiefe 15.
 *
 * Dass die Oberfläche hier so misstrauisch ist, obwohl der Server die Kette laut Vertrag ganz oder
 * gar nicht schickt, ist Absicht: sonst hinge die Leckfreiheit an fremder Disziplin statt an der
 * eigenen Bauform.
 */
export function spacePath(chain: unknown): KnowledgeSpaceNode[] | null {
  const links = chainLinks(chain);
  if (links === null || links.length === 0) {
    return null;
  }
  if (links.length > LIBRARY_SPACE_MAX_DEPTH) {
    return null;
  }
  const path: KnowledgeSpaceNode[] = [];
  for (const link of links) {
    const node = spaceNodeOrNull(link);
    if (node === null) {
      return null;
    }
    path.push(node);
  }
  return path;
}

/**
 * Der Pfad zum Zuhause eines Wissensobjekts — oder `null`.
 *
 * Diese Funktion liest GENAU EIN Feld: `home`. Sie sieht Kategorie, Schlagwörter, Titel und
 * Quellpfad nicht einmal an. Das ist die technische Form der Regel „der Ort wird nie abgeleitet":
 * es gibt keinen Zweig, der eine Ableitung auch nur versuchen könnte.
 *
 * Fehlt `home` oder ist es `null`, ist das Ergebnis dasselbe leere Ergebnis — und zwar über
 * denselben Zweig. Das ist der Kern der Sicherheitsvariante `V-2`: ein Wissensobjekt ohne
 * Zuordnung und eines mit einem zurückgehaltenen Zuhause sind hier nicht unterscheidbar, weil das
 * Modul nichts hat, woran es sie unterscheiden könnte. Ein zweiter Marker am Objekt bliebe
 * folgenlos — er wird nirgends gelesen.
 */
export function koHomePath(ko: unknown): KnowledgeSpaceNode[] | null {
  if (ko === null || typeof ko !== "object" || Array.isArray(ko)) {
    return null;
  }
  const home = (ko as { home?: unknown }).home;
  if (home === null || home === undefined) {
    return null;
  }
  return spacePath(home);
}

/**
 * Reicht eine SERVERGELIEFERTE Trefferzahl durch — und erzeugt unter keinen Umständen eine eigene.
 *
 * Der Umschalter zwischen einem Raum und dem gesamten Unternehmen zeigt eine Zahl nur dann, wenn
 * der Server sie mitgeschickt hat. Sonst zeigt er gar keine.
 *
 * `null` ist deshalb die Antwort auf alles, was keine echte Zahl ist — ausdrücklich auch auf eine
 * Liste. Wer hier aus drei geladenen Treffern eine `3` bekäme, hätte den ungetrimmten Zähler
 * gebaut: der Client kennt nur die Menge, die er geladen hat, nie die wahre. Und `0` ist keine
 * ehrliche Ersatzantwort, sondern eine Auskunft („in diesem Raum ist nichts") — bei einem
 * getrimmten Bestand ist sie falsch und zugleich eine Existenzaussage über Verborgenes.
 *
 * Eine echte Serverzahl kommt unverändert durch, die ehrliche Null eingeschlossen.
 */
export function spaceResultCount(serverCount: unknown): number | null {
  if (typeof serverCount !== "number" || !Number.isInteger(serverCount) || serverCount < 0) {
    return null;
  }
  return serverCount;
}
