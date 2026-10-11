// AUFTRAG-mega20 Block A — DER WIEDERHOLSCHLÜSSEL DER ERSTANLAGE, auf der Client-Seite.
//
// ============================================================================================
// WARUM DAS EINE EIGENE DATEI IST UND NICHT ZWEI ZEILEN IN Capture.tsx
// ============================================================================================
//
// Der Schlüssel ist nur dann etwas wert, wenn er über die WIEDERHOLUNG HINWEG DERSELBE bleibt.
// Genau das ist die Stelle, an der ein „ist doch nur eine UUID" umkippt: wird er in der
// Mutationsfunktion erzeugt, bekommt jeder Klick einen neuen — und der Server sieht zwei
// verschiedene Vorgänge, wo der Nutzer einen wiederholt hat. Dann entsteht wieder ein zweites
// vollständiges Wissensobjekt, und die ganze serverseitige Adoptionsmechanik läuft ins Leere.
//
// Die Regeln stehen deshalb hier, an einer Stelle, mit ihrer Begründung — statt verstreut in einem
// 5000-Zeilen-Bildschirm.
//
// ============================================================================================
// WANN DER SCHLÜSSEL BLEIBT UND WANN ER FÄLLT
// ============================================================================================
//
// ER BLEIBT, solange der Ausgang des Vorgangs UNKLAR ist. Das ist der Fall, für den er existiert:
// Netzabbruch, Zeitüberschreitung, 5xx — der Server kann das Wissensobjekt angelegt haben oder
// nicht, und der Client kann es nicht wissen. Ein zweiter Versuch mit DEMSELBEN Schlüssel bekommt
// entweder das bereits angelegte Objekt (200) oder legt es jetzt an (201). Beides ist richtig,
// keines ist doppelt.
//
// ER FÄLLT bei einer EINDEUTIGEN Ablehnung (4xx außer 409). Dann hat der Server geantwortet und
// seine Antwort lautet: es ist nichts entstanden. Der Nutzer korrigiert daraufhin seine Eingabe,
// und der nächste Versuch ist ein NEUER Vorgang — mit einem neuen Schlüssel, damit er nicht an
// einem alten hängt.
//
// 409 (CREATE_ANCHOR_TAKEN) ist bewusst ausgenommen: er bedeutet, dass genau dieser Schlüssel schon
// zu einem Vorgang gehört. Ihn dann zu behalten wäre sinnlos, ihn stillschweigend fallen zu lassen
// aber gefährlich — deshalb wird er wie eine unklare Lage behandelt und der Nutzer sieht die
// ehrliche Meldung des Servers.
//
// ER FÄLLT AUCH bei Erfolg. Der Vorgang ist abgeschlossen; das nächste Erfassen ist ein anderes.
//
// ============================================================================================
// DIE FRÜHERE „EHRLICHE GRENZE" — AUFGEHOBEN IN mega21, MIT RÜCKWEG SEIT mega22
// ============================================================================================
//
// Bis mega20 stand hier: ändert der Nutzer den Inhalt nach einem unklaren Ausgang, liefert der
// Server unter demselben Schlüssel das ALTE Objekt. Das war die Semantik eines reinen
// Idempotenzschlüssels — und ein stiller Verlust der Änderung. Seit mega21 antwortet der Server
// darauf `IDEMPOTENCY_PAYLOAD_MISMATCH` statt still das Alte zu liefern.
//
// DAMIT WAR DIE HÄLFTE GETAN, und die zweite fehlte: der Client hielt JEDEN 409-Schlüssel fest, und
// die Oberfläche unterschied den Fehlercode nicht. Nach einem Abdruckkonflikt wiederholte deshalb
// jeder weitere Klick denselben 409 — eine Sackgasse, aus der nur ein Neuladen der Seite half.
// (Meine Aussage in mega21, die Oberfläche biete einen neuen Vorgang an, war im Code nicht belegt.)
//
// AUFTRAG-mega22 Block E: der 409 wird NACH FEHLERCODE behandelt, s. `createConflictOffersRestart`.

// ============================================================================================
// AUFTRAG-mega22 Block E — WELCHER 409 EINEN NEUEN VORGANG RECHTFERTIGT, UND WELCHER NICHT
// ============================================================================================
//
// Alle drei Codes bedeuten „dieser Schlüssel gehört bereits zu einem Vorgang". Sie bedeuten NICHT
// dasselbe, und genau diese Gleichsetzung war der Mangel:
//
//   · IDEMPOTENCY_PAYLOAD_MISMATCH — unter diesem Vorgang steht ein ANDERER Inhalt. Der Nutzer hat
//     etwas geändert; sein neuer Inhalt ist ein NEUER Vorgang und braucht einen neuen Schlüssel.
//   · CREATE_ANCHOR_TAKEN — die Kennung gehört einem anderen Eigentümer. Nach mega22 Block G kann
//     das nur noch eine Altzeile ohne Vorgangs-Datensatz sein; erreichbar bleibt es und der einzig
//     sinnvolle Ausweg ist ebenfalls ein neuer Schlüssel.
//   · CREATE_REPAIR_REQUIRED — DORT WARTET EIN OBJEKT AUF PRÜFUNG. Ein neuer Vorgang legte ein
//     ZWEITES an und liesse das erste, unvollständig belegte, zurück — niemand suchte es dann noch.
//     Dieser Schlüssel wird NICHT ersetzt, weder still noch auf Knopfdruck. Der Nutzer bekommt die
//     Meldung des Servers (sie nennt die Objektkennung) und muss den Zustand klären lassen.
//
// UND ES GESCHIEHT NICHT HINTER SEINEM RÜCKEN. Der Schlüssel wird bei 409 weiterhin NICHT
// automatisch fallen gelassen (s. `createOperationIsSettled`) — die Oberfläche BIETET eine sichtbare
// Handlung an, und der Nutzer löst sie aus. Ein stiller Ersatz wäre die gefährlichere Variante: er
// verwandelte einen erkannten Konflikt in eine zweite Anlage, ohne dass jemand zugestimmt hätte.

/** Ein frischer Vorgangsschlüssel. Form und Zeichensatz passen zum Serververtrag (8–120 Zeichen). */
export function newCreateOperationId(): string {
  return `create-${crypto.randomUUID()}`;
}

/**
 * Darf der Schlüssel nach diesem Fehlschlag FALLEN GELASSEN werden?
 *
 * Nur wenn der Server EINDEUTIG geantwortet hat, dass nichts entstanden ist. Im Zweifel — und
 * „Zweifel" heißt hier: alles, was kein klares 4xx ist — bleibt er stehen. Die falsche Richtung
 * wäre teuer: ein zu früh weggeworfener Schlüssel erzeugt beim nächsten Klick ein zweites
 * Wissensobjekt, ein zu lange gehaltener höchstens eine überflüssige Adoption.
 */
export function createOperationIsSettled(status: number | undefined): boolean {
  if (status === undefined) {
    return false; // Netzfehler, Abbruch, keine Antwort — der Ausgang ist unbekannt.
  }
  if (status === 409) {
    return false; // Der Schlüssel gehört bereits zu einem Vorgang (s. oben).
  }
  return status >= 400 && status < 500;
}

/** Die Fehlercodes, für die ein NEUER Vorgang der richtige Ausweg ist. */
const NEUSTART_ERLAUBT = new Set(["IDEMPOTENCY_PAYLOAD_MISMATCH", "CREATE_ANCHOR_TAKEN"]);

/**
 * AUFTRAG-mega22 Block E — DARF DIE OBERFLÄCHE NACH DIESEM FEHLER „NEUEN VORGANG BEGINNEN" ANBIETEN?
 *
 * Nur bei einem 409 mit einem der beiden Codes oben. Alles andere ist `false`, und zwar
 * FAIL-CLOSED: ein unbekannter Code führt NICHT zum Angebot. Ein Angebot, das an der falschen
 * Stelle steht, ist teurer als ein fehlendes — es lässt im Fall `CREATE_REPAIR_REQUIRED` ein
 * unvollständig belegtes Wissensobjekt zurück, das danach niemand mehr sucht.
 */
export function createConflictOffersRestart(
  status: number | undefined,
  code: string | undefined,
): boolean {
  return status === 409 && code !== undefined && NEUSTART_ERLAUBT.has(code);
}

// ============================================================================================
// R-0020 — DER WIEDERHOLSCHLÜSSEL DER ENTWURFSANLAGE, AN SEINE NUTZLAST GEBUNDEN.
// ============================================================================================
//
// Das Einreichen oben hält seinen Schlüssel über den ganzen Vorgang und bietet bei einem
// Abdruckkonflikt sichtbar einen Neustart an. Die ENTWURFSANLAGE (`POST /api/drafts`, Formularweg
// und Ganzdokument-Weg der Erfassung) hat keinen solchen Rückweg auf der Fläche — und braucht ihn
// auch nicht: ein Entwurf ist ein Zwischenstand, kein geprüftes Objekt.
//
// DIE REGEL: derselbe Inhalt ⇒ derselbe Schlüssel. Ging die Antwort auf die erste Anlage verloren
// und schickt der zweite Druck DIESELBE Nutzlast, bekommt er denselben Schlüssel, und der Server
// liefert den schon angelegten Entwurf zurück (200) statt einen zweiten anzulegen. Das gilt auch
// für zwei Wege, die dieselbe Nutzlast GLEICHZEITIG schicken.
//
// HAT DER MENSCH ZWISCHEN DEN VERSUCHEN ETWAS GEÄNDERT — bis zur entscheidung:14ce8681 war das ein
// neuer Schlüssel und, falls der erste trotz verlorener Antwort entstanden war, ein zweiter
// Entwurf. Seit Pedis Entscheidung (30.09.2026, Option A) gilt: es gibt immer nur EINEN Eintrag.
// Solange der erste Vorgang UNKLAR ist, behält auch der geänderte Inhalt dessen Schlüssel
// (`anlageVorgangWiederholen`) und reist mit `fortschreiben`; der Server schreibt denselben
// Entwurf mit dem neuen Inhalt fort — oder legt ihn jetzt an, wenn der erste nie angekommen war.

/** Ein Schlüssel und der Inhalt, für den er vergeben wurde. */
export interface AnlageVorgang {
  readonly id: string;
  readonly abdruck: string;
}

/**
 * Der Schlüssel für GENAU diesen Inhalt: der bisherige, wenn er für denselben Abdruck vergeben
 * wurde, sonst ein frischer. Rein — die Ablage des Vorgangs (Ref) bleibt beim Aufrufer.
 */
export function anlageVorgangFuer(bisher: AnlageVorgang | null, abdruck: string): AnlageVorgang {
  if (bisher && bisher.abdruck === abdruck) {
    return bisher;
  }
  return { id: anlageKennung(), abdruck };
}

/**
 * entscheidung:14ce8681 — DER SCHLÜSSEL FÜR DEN NÄCHSTEN VERSUCH, wenn `offen` ein UNKLAR
 * gebliebener Vorgang ist (Antwort verloren, 5xx). Er bleibt derselbe, auch bei geändertem Inhalt;
 * `fortschreiben` ist dann gesetzt, und der Server schreibt denselben Entwurf fort. Ohne offenen
 * Vorgang ist es eine Erstspeicherung mit frischem Schlüssel.
 */
export function anlageVorgangWiederholen(
  offen: AnlageVorgang | null,
  abdruck: string,
): { vorgang: AnlageVorgang; fortschreiben: boolean } {
  if (!offen) {
    return { vorgang: anlageVorgangFuer(null, abdruck), fortschreiben: false };
  }
  return { vorgang: { id: offen.id, abdruck }, fortschreiben: true };
}

/**
 * Die Kennung eines Anlagevorgangs. `crypto.randomUUID` gibt es nur in einem SICHEREN Kontext
 * (https oder localhost); das Speichern eines Entwurfs lief bis hierher auch ohne ihn — etwa auf
 * einer Insel unter `http://<LAN-Adresse>`. Damit der neue Schlüssel dort nicht jedes Speichern
 * scheitern lässt, fällt er auf `crypto.getRandomValues` zurück (in jedem Kontext vorhanden).
 */
function anlageKennung(): string {
  if (typeof crypto.randomUUID === "function") {
    return newCreateOperationId();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `create-${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
