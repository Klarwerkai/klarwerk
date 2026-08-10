import type { TxContext } from "../../db-tx";
import { hashEntry, verifyChain } from "./chain";
import type { AuditEntry } from "./types";

// SCRUM-523 P.3 (WP-A2): append/last nehmen einen OPTIONALEN, opaken TxContext (services/db-tx) an —
// additiv, abwärtskompatibel (bestehende Aufrufer ohne tx unverändert). Zweck: der Purge-Chokepoint in
// knowledge-object (repo.delete + audit.record) kann beide Schritte in DERSELBEN echten DB-Transaktion
// laufen lassen, ohne dass dieses Interface einen Pg-Typ führt — InMemoryAuditRepo ignoriert den
// Parameter einfach (dort ist Atomarität trivial).
// FR-AUD-02: nur Anhängen — bewusst KEINE update/delete-Methoden.
export interface AuditRepo {
  append(entry: AuditEntry, tx?: TxContext): Promise<void>;
  // WP-SHIP8-CLOSE-6 (bens ROT-1): PERSISTENZGESTÜTZTES exactly-once-Anhängen über die stabile
  // entry.eventId — Pg: partieller Unique-Index + ON CONFLICT DO NOTHING; InMemory: synchroner
  // Set-Guard (kein await zwischen Prüfen und Anhängen). Rückgabe true = DIESER Aufruf hat
  // geschrieben; false = der Beleg existierte bereits (idempotenter No-op, kein Fehler).
  appendOnce(entry: AuditEntry, tx?: TxContext): Promise<boolean>;
  all(): Promise<AuditEntry[]>;
  last(tx?: TxContext): Promise<AuditEntry | undefined>;
  /**
   * W3-B (KW-W3-19): DER PUNKTZUGRIFF ueber die Sequenz — der EINZIGE zugelassene Leseweg fuer
   * eine `validationDecisionRef`.
   *
   * Warum er eigens im Vertrag steht, obwohl `all()` dasselbe finden koennte: `all()` laedt die
   * ganze Kette und waere damit genau die „spaetere Suche", die KW-W3-19 verbietet. Der Unterschied
   * ist nicht Geschwindigkeit, sondern Bedeutung — wer sucht, kann auch etwas Passendes finden, das
   * nicht gemeint war.
   *
   * Auf PostgreSQL ist das ein Primaerschluesselzugriff (`seq integer PRIMARY KEY`); es braucht
   * weder einen Index noch eine Migration.
   *
   * WARUM OPTIONAL — UND WAS DAS KOSTET. Beide PRODUKTIVEN Ablagen (InMemory und Pg) bieten die
   * Methode verbindlich an; optional ist sie nur im Interface. Grund ist eine Scope-Grenze, keine
   * fachliche Abwaegung: es gibt handgeschriebene Test-Doubles in `tests/**`, die `AuditRepo`
   * selbst implementieren, und diese Dateien liegen ausserhalb des Schreibbereichs von Auftrag 67.
   * Eine Pflichtmethode haette den Build dort gebrochen.
   *
   * DER PREIS IST EHRLICH ZU NENNEN: ein Aufrufer, der nur das Interface kennt, muss die Abwesenheit
   * behandeln. Der Vertrag ist damit schwaecher als er sein sollte — die Ausleitung zur
   * Pflichtmethode gehoert in dieselbe Welle, die die zwei Test-Doubles nachzieht.
   */
  findBySeq?(seq: number, tx?: TxContext): Promise<AuditEntry | undefined>;
}

// ================================================================================================
// W3-B (KW-W3-19) — DIE REFERENZ UND IHRE PRUEFUNG
// ================================================================================================

/** Die kanonische Referenz: Sequenz UND Hash, nie nur eine der beiden. */
export interface ValidationDecisionRef {
  readonly auditSeq: number;
  readonly auditHash: string;
}

/**
 * DIE ERLAUBTEN ENTSCHEIDUNGSEREIGNISSE — benannt, nicht geraten.
 *
 * `ValidationService` schreibt fuenf verschiedene Auditereignisse, aber nur DREI davon sind eine
 * Entscheidung ueber ein Wissensobjekt. `validation.defaultNeeded.set` ist eine Admin-Einstellung
 * (Ziel: "settings") und `ko.assigned` eine Zuweisung — beide sagen nichts darueber, ob etwas
 * geprueft wurde. Ohne diese benannte Menge waere `WRONG_EVENT_TYPE` nicht pruefbar, sondern
 * Geschmack (Preflight 64 §2).
 */
export const VALIDATION_DECISION_ACTIONS: readonly string[] = [
  "ko.rated",
  "ko.admin-validated",
  "ko.returned-to-author",
];

/**
 * Die Zustaende aus KW-W3-19. `REDACTED` steht bewusst NICHT hier: die Redaktion ist eine
 * Sichtbarkeitsentscheidung des LESERS, keine Eigenschaft des Belegs — sie kommt am Leseweg dazu.
 */
export type ValidationDecisionRefState =
  | "OK"
  | "MISSING"
  | "HASH_MISMATCH"
  | "WRONG_EVENT_TYPE"
  | "WRONG_SUBJECT";

/** Worauf sich die Entscheidung beziehen MUSS, damit sie diesen Snapshot deckt. */
export interface ValidationDecisionSubject {
  readonly koId: string;
  readonly koVersion: number;
}

/**
 * DER LESEABLAUF AUS KW-W3-19, ZEILE 24-31 — in genau dieser Reihenfolge.
 *
 * 1. Eintrag ueber `auditSeq` laden (der Aufrufer tut das mit `findBySeq`);
 * 2. den GELADENEN Hash exakt gegen `auditHash` pruefen;
 * 3. die Kettenpruefung zusaetzlich anwenden (`verifyChain`, unveraendert vorhanden).
 *
 * DIE REIHENFOLGE IST DIE AUSSAGE. Der Hash wird VOR Action und Subject geprueft: ist der Eintrag
 * manipuliert, sind seine Felder keine Grundlage mehr fuer irgendeine weitere Aussage. Eine
 * Pruefung, die zuerst „falscher Ereignistyp" meldete, wuerde einem gefaelschten Eintrag glauben.
 *
 * ZUSAETZLICH wird geprueft, dass der geladene Eintrag WIRKLICH der adressierte ist
 * (`entry.seq === ref.auditSeq`). Ohne diese Zeile koennte ein Versatz in der Ablage unbemerkt
 * bleiben, und die Referenz zeigte auf etwas anderes als behauptet.
 */
export function pruefeValidationDecisionRef(
  entry: AuditEntry | undefined,
  ref: ValidationDecisionRef,
  subject: ValidationDecisionSubject,
  kette: readonly AuditEntry[],
): ValidationDecisionRefState {
  if (!entry || entry.seq !== ref.auditSeq) {
    return "MISSING";
  }
  // ============================================================================================
  // BEN-70 ROT-1 — DER SELBSTHASH IST NICHT DIE KETTE.
  // ============================================================================================
  //
  // Bis Freeze 67 prueften wir nur `hashEntry(entry) === entry.hash`. Das beweist, dass DIESE
  // Zeile nicht angefasst wurde — es beweist NICHT, dass sie noch an derselben Geschichte haengt.
  // BEN hat genau das vorgefuehrt: Vorgaenger manipuliert, Ziel unversehrt, Ergebnis `OK`.
  // KW-W3-19 sagt es woertlich: „Der Hash ersetzt nicht die Pruefung der Auditkette."
  //
  // DIE KETTE IST DESHALB PFLICHTPARAMETER, nicht Option. Ein Aufrufer, der sie weglassen
  // koennte, wuerde genau die Luecke wieder oeffnen, die dieser Fix schliesst — und ein blosses
  // `bool ketteGeprueft` waere zu billig zu faelschen. Der Aufrufer muss die Kette VORLEGEN.
  //
  // WARUM DAS KEIN VERBOTENER SUCHWEG IST: gesucht wird nichts. Der Eintrag ist ueber `findBySeq`
  // bereits adressiert; die Kette dient allein der Integritaetspruefung, die KW-W3-19 Schritt 3
  // ausdruecklich verlangt.
  const inKette = kette.some((k) => k.seq === entry.seq && k.hash === entry.hash);
  if (!inKette) {
    // Ein Eintrag, der in der vorgelegten Kette gar nicht vorkommt, ist fuer diesen Leser nicht
    // belegt — dieselbe Aussage wie ein fehlender Eintrag.
    return "MISSING";
  }
  if (entry.hash !== ref.auditHash || hashEntry(entry) !== entry.hash || !verifyChain(kette)) {
    // Gebrochene Kette faellt bewusst auf HASH_MISMATCH und nicht auf einen neuen Zustand:
    // KW-W3-19 legt die Zustandsmenge fest, und was hier kaputt ist, IST die Hashbindung —
    // nur eine Ebene hoeher als die einzelne Zeile.
    return "HASH_MISMATCH";
  }
  if (!VALIDATION_DECISION_ACTIONS.includes(entry.action)) {
    return "WRONG_EVENT_TYPE";
  }
  if (entry.target !== subject.koId) {
    return "WRONG_SUBJECT";
  }
  // Die gepruefte KO-Version reist im Payload mit (die Entscheidungsstellen schreiben sie dort).
  // Fehlt sie oder weicht sie ab, deckt die Entscheidung diesen Stand nicht.
  const koVersion = entry.payload.koVersion;
  if (typeof koVersion !== "number" || koVersion !== subject.koVersion) {
    return "WRONG_SUBJECT";
  }
  return "OK";
}

export class InMemoryAuditRepo implements AuditRepo {
  private readonly entries: AuditEntry[] = [];
  // WP-SHIP8-CLOSE-6 (bens ROT-1): Spiegel des partiellen Pg-Unique-Index audit_event_id_uq.
  private readonly eventIds = new Set<string>();
  // W3-B: Spiegel des PostgreSQL-Primaerschluessels `seq`. Er macht `findBySeq` zu einem echten
  // Punktzugriff — dieselbe Zusage in beiden Ablagen, nicht nur dasselbe Ergebnis.
  private readonly bySeq = new Map<number, AuditEntry>();

  append(entry: AuditEntry, _tx?: TxContext): Promise<void> {
    if (entry.eventId) {
      this.eventIds.add(entry.eventId);
    }
    this.entries.push(Object.freeze(entry));
    this.bySeq.set(entry.seq, entry);
    return Promise.resolve();
  }

  // Synchron geprüft UND vermerkt — zwei parallele Nachzüge, die beide einen leeren Read sahen,
  // schreiben trotzdem exakt EINEN Eintrag (der zweite Aufruf ist ein ehrlicher No-op).
  appendOnce(entry: AuditEntry, _tx?: TxContext): Promise<boolean> {
    if (entry.eventId && this.eventIds.has(entry.eventId)) {
      return Promise.resolve(false);
    }
    if (entry.eventId) {
      this.eventIds.add(entry.eventId);
    }
    this.entries.push(Object.freeze(entry));
    this.bySeq.set(entry.seq, entry);
    return Promise.resolve(true);
  }

  all(): Promise<AuditEntry[]> {
    return Promise.resolve([...this.entries]);
  }

  last(_tx?: TxContext): Promise<AuditEntry | undefined> {
    return Promise.resolve(this.entries[this.entries.length - 1]);
  }

  /**
   * Punktzugriff ueber den EIGENEN Index, nicht ueber einen Durchlauf von `all()`. Der Unterschied
   * ist nicht Geschwindigkeit: ein Suchweg koennte einen „passenden" Eintrag finden, ein
   * Schluesselzugriff findet den adressierten oder gar keinen.
   */
  findBySeq(seq: number, _tx?: TxContext): Promise<AuditEntry | undefined> {
    return Promise.resolve(this.bySeq.get(seq));
  }
}
