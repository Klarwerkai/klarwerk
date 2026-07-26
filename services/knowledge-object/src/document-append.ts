// AUFTRAG-mega18 Block A — DIE INTERNE BELEGPFLICHT IST EINE EIGENE REGEL.
//
// ============================================================================================
// ZWEI REGELN, ZWEI ORTE, KEINE GEGENSEITIGE VERTRETUNG
// ============================================================================================
//
// Bis mega17 gab es in diesem Produkt nur EINE Stelle, die nach einem Anker fragte: die externe
// Stufenentscheidung (services/external-search/src/attach-policy.ts). Sie tat das aus ihrem eigenen
// Grund — eine Quelle OHNE Adresse ist von einem externen Treffer, dem jemand die Adresse
// weggenommen hat, nicht zu unterscheiden, also verlangt sie auf `blocked` und `search_on_click`
// einen Anker als positiven Beleg der internen Herkunft.
//
// Daraus ist stillschweigend etwas anderes geworden: wir haben die INTERNE BELEGPFLICHT dieses
// Workflows an die EXTERNE STUFENREGEL delegiert. Auf `search_attach` und `open` fragt niemand nach
// einem Anker, weil die Stufe dort gar nichts zu prüfen hat — und damit lief übernommener
// Dokumentinhalt auf zwei von vier Stufen ohne jeden Beleg durch. Dass die eine Regel die andere
// auf den beiden restriktiven Stufen zufällig miterledigt hat, war nie Absicht und ist kein Entwurf.
//
// DIE TRENNUNG, ausgeschrieben:
//
//   EXTERNE STUFENREGEL (attach-policy.ts, external-search)
//     Frage:     DARF eine externe Quelle an ein Wissensobjekt angehängt werden?
//     Zweck:     Egress-/Vertrauensgrenze des Betreibers. Wer darf Fremdes hereinholen?
//     Stellhebel: die Admin-Stufe (blocked · search_on_click · search_attach · open).
//     Ergebnis:  auf zwei Stufen erlaubend, auf zwei fail-closed.
//     UNANGETASTET. Diese Datei lockert dort nichts und ersetzt dort nichts.
//
//   INTERNE BELEGPFLICHT (diese Datei, knowledge-object)
//     Frage:     HÄNGT übernommener Dokumentinhalt an seinem Original?
//     Zweck:     der belegorientierte Kernvertrag des Produkts („Beweispflicht statt
//                Plausibilität"). Wer Text aus einem Dokument in ein Wissensobjekt übernimmt,
//                schuldet den Nachweis, WORAUS er ihn übernommen hat.
//     Stellhebel: KEINER. Es gibt keine Einstellung, die sie abschaltet.
//     Ergebnis:  auf JEDER Stufe gleich — ohne echten Original-Anker bricht die Übernahme ab.
//
// Die zweite Regel ist strenger als die erste und gilt zusätzlich zu ihr. Eine Übernahme muss
// BEIDE passieren: erst die Stufe (die Route beschafft die Tatsachen und entscheidet), dann die
// Belegpflicht (hier, im Service, mit bereits geprüften Fakten). Keine der beiden darf für die
// andere einstehen — das war der Fehler, den wir gerade beheben.
//
// Diese Datei ist bewusst REIN: keine HTTP-, keine DB-, keine Fastify-Kenntnis. Sie beantwortet
// genau zwei Fragen — „ist dieser Vorgang eindeutig benannt?" und „liegt ein echter Anker vor?".

import { type KoAppendOp, KoError } from "./types";

// --------------------------------------------------------------------------------------------
// 1. DIE OPERATIONS-KENNUNG (Idempotenz)
// --------------------------------------------------------------------------------------------
//
// WARUM DER AUFRUFER SIE BILDET. Der Aufrufer ist der einzige, der weiß, ob zwei eingehende
// Aufrufe DERSELBE fachliche Vorgang sind. Genau das ist die Frage, die Idempotenz beantworten
// muss: nach einem Netzfehler weiß der Client, dass er seinen EIGENEN Vorgang wiederholt — der
// Server könnte das aus dem Inhalt nur RATEN (zwei identische Übernahmen desselben Dokuments an
// dasselbe Objekt sind ein legitimer, wenn auch seltener Wunsch). Eine serverseitig aus dem Inhalt
// gehashte Kennung würde diesen legitimen Fall stillschweigend verschlucken.
//
// WARUM DAS KEIN ZWEITER `provider`-FEHLER IST (mega15 Block B). Dort war das Client-Feld die
// GRUNDLAGE EINER ENTSCHEIDUNG: der Server richtete seine Sperre danach aus, also konnte der
// Client die Sperre steuern. Hier trägt das Feld KEINE Autorität. Es ist ein Deduplizierungs-
// Schlüssel, ausschliesslich innerhalb EINES Wissensobjekts, und die schlimmste erreichbare Wirkung
// ist, dass ein Aufrufer seine EIGENE zweite Übernahme als Wiederholung der ersten quittiert
// bekommt statt sie erneut auszuführen. Kein Recht wird erweitert, keine Prüfung übersprungen: die
// Stufenentscheidung und die Belegpflicht laufen bei jedem Aufruf, VOR dem Nachschlagen der
// Kennung. Was der Server NICHT tut: der Kennung irgendeine Aussage über Herkunft, Berechtigung
// oder Echtheit entnehmen.
//
// WO SIE GEHALTEN WIRD. Am Wissensobjekt selbst (`appendOps`), nicht in einem Prozessspeicher.
// Damit ist die Idempotenz-Prüfung Teil DESSELBEN Read-Modify-Write, der die Operation vollzieht —
// sie kann also nicht zwischen Prüfung und Vollzug veralten (kein TOCTOU), sie übersteht einen
// Neustart, und sie gilt prozessübergreifend. Ein Prozessspeicher hätte alle drei Eigenschaften
// nicht.

// Zeichensatz und Länge sind eng gefasst: eine Kennung ist ein Schlüssel, kein Freitextfeld. Sie
// landet im persistierten Objekt, also darf sie es nicht aufblähen und nichts enthalten, was in
// einer Anzeige oder einem Log als Steuerzeichen wirkt.
// AUFTRAG-mega20 Block A: exportiert, damit die ERZEUGUNGS-Kennung (document-create.ts) denselben
// Vertrag benutzt statt eine zweite, driftende Kopie zu halten. Der Zeichensatz ist damit an EINER
// Stelle definiert; wer ihn ändert, ändert ihn für beide Vorgangsarten sichtbar.
export const OPERATION_ID_PATTERN = /^[A-Za-z0-9_:.-]{8,120}$/;

/**
 * Prüft die Operations-Kennung defensiv (der Wert kommt vom Client). Ungültig ⇒ ehrlicher Fehler,
 * NIE ein stiller Ersatzwert: eine erfundene Kennung würde die Wiederholbarkeit lautlos aufheben
 * und damit genau die Zusage brechen, für die sie existiert.
 */
export function normalizeAppendOperationId(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!OPERATION_ID_PATTERN.test(value)) {
    throw new KoError(
      "INVALID_OPERATION_ID",
      "Ungültige Operations-Kennung — die Übernahme braucht einen wiederholbaren Vorgangsschlüssel.",
    );
  }
  return value;
}

// Wie viele abgeschlossene Vorgänge ein Wissensobjekt erinnert.
//
// EHRLICHE GRENZE, die hier stehen soll: die Erinnerung ist GEDECKELT. Eine Wiederholung, die erst
// nach mehr als DOCUMENT_APPEND_OP_MEMORY weiteren Übernahmen an DEMSELBEN Objekt eintrifft, wird
// nicht mehr als Wiederholung erkannt und würde ein zweites Mal ausgeführt. Das ist bewusst in Kauf
// genommen: Idempotenz existiert hier für den Wiederholversuch nach einem Netzfehler (Sekunden bis
// Minuten), nicht als unbegrenztes Vorgangsgedächtnis. Ein ungedeckeltes Feld würde das persistierte
// Objekt über die Lebenszeit unbegrenzt wachsen lassen — der teurere Fehler.
export const DOCUMENT_APPEND_OP_MEMORY = 24;

/** Hängt einen Vorgang an die Erinnerung und deckelt sie auf die jüngsten Einträge. */
export function rememberAppendOp(
  existing: readonly KoAppendOp[] | undefined,
  op: KoAppendOp,
): KoAppendOp[] {
  return [...(existing ?? []), op].slice(-DOCUMENT_APPEND_OP_MEMORY);
}

// --------------------------------------------------------------------------------------------
// 2. DIE BELEGPFLICHT
// --------------------------------------------------------------------------------------------

/**
 * Die Tatsachen, die der Aufrufer (die Route) beschafft hat, bevor die Belegpflicht urteilt.
 *
 * `anchorObjectId` ist NICHT das rohe Client-Feld. Es ist die Kennung eines Objekts, dessen
 * Existenz der Aufrufer im eigenen Objektspeicher NACHGESCHLAGEN hat — dieselbe Prüfung, die die
 * `attach`-Aktion für jeden Anhang macht (ko-routes.ts, `objects.metadata`). Der Server glaubt hier
 * nichts; er hat schon gesehen.
 */
export interface DocumentEvidenceFacts {
  readonly anchorObjectId: string | null | undefined;
}

/**
 * DER VERTRAG DER INTERNEN BELEGPFLICHT — eine Zeile Wirkung, und sie kennt die Stufe nicht.
 *
 * Beachte, was in dieser Signatur FEHLT: kein `stage`, keine `SourceReach`, kein `AttachDecision`.
 * Das ist keine Auslassung, das ist die Aussage. Diese Regel lässt sich nicht durch eine
 * erlaubende Stufe erweichen, weil sie die Stufe nicht sehen kann. Wer sie später doch von der
 * Stufe abhängig machen will, müsste diesen Parameter hinzufügen — und würde damit sichtbar genau
 * die Delegation wiederherstellen, die mega18 aufgelöst hat.
 *
 * Ohne echten Anker WIRFT die Funktion. Sie liefert kein „false", das ein Aufrufer versehentlich
 * ignorieren könnte, und keinen Ersatzwert. Das ist die Lehre aus `composeAppendToArticle`
 * (apps/web/src/lib/appendToArticle.ts, bis mega17): dort wurde JEDER Fehler des Anker-Schritts
 * geschluckt und mit `anchor = undefined` weitergemacht.
 */
export function requireDocumentEvidence(facts: DocumentEvidenceFacts): string {
  const anchor = typeof facts.anchorObjectId === "string" ? facts.anchorObjectId.trim() : "";
  if (anchor.length === 0) {
    throw new KoError(
      "MISSING_DOCUMENT_ANCHOR",
      "Übernommener Dokumentinhalt braucht sein Original als Beleg. Ohne gesichertes Originaldokument wird der Inhalt nicht übernommen — unabhängig von der eingestellten Stufe für externes Wissen.",
    );
  }
  return anchor;
}
