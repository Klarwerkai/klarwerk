import type { TxContext } from "../../db-tx";
import { hashEntryFuerVersion, verifyChain } from "./chain";
import type { AuditEntry, AuditFilter, AuditSeitenFilter } from "./types";

// produkt:20261009:admin-audit-verstaendlich — DIE REGEL DES SEITENWEGS, als Erweiterung der einen
// Filterregel unten: `actor`/`action`/`target` exakt wie `auditFilterTrifft`, dazu `actions` (ODER;
// eine leere Liste heißt „kein Filter") und der Zeitraum über `at`. `at` ist ein ISO-Zeitpunkt in
// UTC (`toISOString()`), deshalb genügt der Zeichenkettenvergleich — dieselbe Ordnung wie in SQL
// (`at text`). Speicherablage, Dienst-Rückfall und `repo-pg.ts` meinen damit dieselbe Menge.
export function auditSeiteTrifft(entry: AuditEntry, filter: AuditSeitenFilter): boolean {
  return (
    auditFilterTrifft(entry, filter) &&
    (!filter.actions || filter.actions.length === 0 || filter.actions.includes(entry.action)) &&
    (!filter.from || entry.at >= filter.from) &&
    (!filter.to || entry.at < filter.to)
  );
}

// JOB 2698 D1 (Review-Befund R2-32): DIE EINE FILTERREGEL des Protokolls — leer/fehlend heißt „kein
// Filter", gesetzt heißt exakte Gleichheit (Groß-/Kleinschreibung zählt). Sie stand bis 2698 nur in
// `AuditService.list` (nach dem Vollscan, in Node). Jetzt steht sie HIER, damit die Speicherablage,
// der Rückfall im Dienst und die SQL-Fassung (`repo-pg.ts`, `AUDIT_FIND_BY_SQL`) dieselbe Menge
// meinen — die Gleichheit beider Wege ist in tests/audit/job2698-*.test.ts gemessen, nicht angenommen.
export function auditFilterTrifft(entry: AuditEntry, filter: AuditFilter): boolean {
  return (
    (!filter.actor || entry.actor === filter.actor) &&
    (!filter.action || entry.action === filter.action) &&
    (!filter.target || entry.target === filter.target)
  );
}

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
  /**
   * Aufnahme gesamt-auditprotokoll (Lauf 3) — VORGÄNGER LESEN UND ANHÄNGEN ALS EIN SCHRITT.
   *
   * `record`/`recordOnce` lasen bisher `last()` und schrieben danach `append()`. Zwei gleichzeitige
   * Schreiber sahen denselben Vorgänger und vergaben dieselbe `seq`: im Speicher zerbrach die Kette,
   * auf PostgreSQL scheiterte der zweite an `audit_pkey` (500, und bei der Erstanlage ein Objekt ohne
   * `ko.created`). Hier bekommt `build` den Vorgänger erst, wenn niemand anderes mehr dazwischen
   * anhängen kann — im Speicher synchron, auf PostgreSQL unter einer transaktionsgebundenen Sperre,
   * die bis zum Ende der Transaktion gehalten wird (auch über Instanzen hinweg).
   *
   * Trägt der gebaute Eintrag eine `eventId`, gilt der Vertrag von `appendOnce` (`written: false`
   * statt eines zweiten Eintrags). OPTIONAL aus demselben Grund wie `findBy`: handgeschriebene
   * Test-Doubles implementieren nur `append`/`last`; fehlt die Methode, bleibt es beim alten Weg.
   */
  appendNext?(
    build: (last: AuditEntry | undefined) => AuditEntry,
    tx?: TxContext,
  ): Promise<{ entry: AuditEntry; written: boolean }>;
  all(): Promise<AuditEntry[]>;
  last(tx?: TxContext): Promise<AuditEntry | undefined>;
  /**
   * JOB 2698 D1 (R2-32): DER GEFILTERTE LESEWEG — liefert genau die Einträge, die `all()` plus
   * `auditFilterTrifft` liefern würde, in derselben Reihenfolge (aufsteigend nach `seq`), ohne das
   * ganze Protokoll zu laden. Auf PostgreSQL ein `WHERE` über den Index `(action, target)`.
   *
   * OPTIONAL aus demselben Grund wie `findBySeq`: handgeschriebene Test-Doubles in `tests/**`
   * implementieren dieses Interface; eine Pflichtmethode bräche sie. Beide produktiven Ablagen
   * bieten die Methode an; fehlt sie, fällt `AuditService.list` auf den alten Vollscan zurück —
   * derselbe Vertrag, nur teurer.
   */
  findBy?(filter: AuditFilter): Promise<AuditEntry[]>;
  /** JOB 2698 D1: „gibt es mindestens einen Eintrag?" — ein EXISTS, kein Laden. */
  existsBy?(filter: AuditFilter): Promise<boolean>;
  /**
   * produkt:20261009:admin-audit-verstaendlich — DER SEITENWEG: höchstens `limit` Einträge, die
   * `auditSeiteTrifft` erfüllen und `seq < before` haben (fehlt `before`: keine Grenze), absteigend
   * nach `seq`. Auf PostgreSQL ein `ORDER BY seq DESC LIMIT` über den Primärschlüssel.
   *
   * OPTIONAL aus demselben Grund wie `findBy`: fehlt sie, fällt `AuditService.page` auf `all()` plus
   * dieselbe Regel zurück — derselbe Vertrag, nur teurer.
   */
  findPage?(
    filter: AuditSeitenFilter,
    before: number | undefined,
    limit: number,
  ): Promise<AuditEntry[]>;
  /**
   * produkt:20261009:admin-audit-verstaendlich — die Einträge, die zu einer der Kennungen einen
   * Namen GESPEICHERT haben: `actor` in `ids` mit `payload.actorName`, oder `target` in `ids` mit
   * `payload.targetName`. Aufsteigend nach `seq`. Grundlage dafür, dass eine Seite gelöschte Konten
   * weiter mit dem Namen benennt, den die Kette selbst kennt — ohne die ganze Kette zu laden.
   */
  findNamensbelege?(ids: readonly string[]): Promise<AuditEntry[]>;
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
  // JOB 557 D8: die Rückgabe zur Nacharbeit ist EINE Entscheidung, die unter ZWEI Namen auftritt —
  // je nachdem, wer wirklich zuständig ist (`services/validation/src/service.ts`,
  // `returnToResponsible`). Beide gehören deshalb hierher.
  //
  // `ko.returned-to-author` steht ausdrücklich WEITER hier, und das ist keine Nachlässigkeit,
  // sondern die Lesbarkeit des Bestands: jedes vor D8 geschriebene Ereignis trägt diesen Namen,
  // und jede damals festgehaltene `validationDecisionRef` zeigt darauf. Würde er hier entfernt,
  // kippten sämtliche Altentscheidungen auf `WRONG_EVENT_TYPE` — eine Rückdatierung von
  // Ungültigkeit auf Belege, an denen niemand etwas verändert hat.
  "ko.returned-to-author",
  "ko.returned-to-owner",
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
  // JOB 498 D8 — DIE DRITTE HASHSTELLE, und die einzige INNERHALB einer Sicherheitsprüfung.
  //
  // Sie muss dieselbe zentrale Versionswahl benutzen wie `verifyChain` und `inspectChain`. Täte sie
  // es nicht, wäre der Schaden asymmetrisch und still: ein V2-Eintrag würde gegen V1 nachgerechnet,
  // der Vergleich schlüge fehl, und eine GÜLTIGE Validierungsentscheidung erschiene als
  // `HASH_MISMATCH` — die Referenz verlöre ihre Deckung, ohne dass irgendetwas manipuliert wäre.
  // `undefined` (unbekannte Version) ist nie gleich einem gespeicherten Hash und fällt fail-closed.
  const eigenhash = hashEntryFuerVersion(entry);
  if (entry.hash !== ref.auditHash || eigenhash !== entry.hash || !verifyChain(kette)) {
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

/** Friert ein Objekt samt aller verschachtelten Objekte und Listen ein. */
function tiefEingefroren<T>(wert: T): T {
  if (wert && typeof wert === "object" && !Object.isFrozen(wert)) {
    for (const kind of Object.values(wert)) {
      tiefEingefroren(kind);
    }
    Object.freeze(wert);
  }
  return wert;
}

export class InMemoryAuditRepo implements AuditRepo {
  private readonly entries: AuditEntry[] = [];
  // WP-SHIP8-CLOSE-6 (bens ROT-1): Spiegel des partiellen Pg-Unique-Index audit_event_id_uq.
  private readonly eventIds = new Set<string>();
  // W3-B: Spiegel des PostgreSQL-Primaerschluessels `seq`. Er macht `findBySeq` zu einem echten
  // Punktzugriff — dieselbe Zusage in beiden Ablagen, nicht nur dasselbe Ergebnis.
  private readonly bySeq = new Map<number, AuditEntry>();

  // Aufnahme gesamt-auditprotokoll (Lauf 3): der Spiegel des Primärschlüssels gilt auch beim
  // SCHREIBEN. PostgreSQL weist eine zweite Zeile mit derselben `seq` ab; hier wurde sie bisher
  // angehängt, und die Kette zerbrach (zwei Einträge mit derselben `seq`, `linkageBreaks=1`).
  //
  // Lauf 5 (BEN-L5-B1): gespeichert wird eine EIGENE, TIEF eingefrorene Kopie. Vorher fror nur das
  // äußere Objekt ein; `payload` blieb die Referenz des Aufrufers und wurde bei jedem Lesen
  // herausgegeben — `payload.verdict = …` oder `delete read.payload.verdict` änderte den
  // gespeicherten Eintrag. Jetzt ändert eine Änderung am Eingabeobjekt nichts mehr, und jeder
  // Änderungs- oder Löschversuch an einem gelesenen Eintrag wird verweigert (TypeError).
  //
  // Runde 3 (BEN-L5-B1, Date): die Kopie ist eine JSON-Kopie, nicht `structuredClone`. Ein `Date`
  // (ebenso Map/Set) blieb sonst ein Objekt mit innerem Zustand, den `Object.freeze` nicht schützt —
  // `read.payload.zeit.setUTCFullYear(2000)` änderte den gespeicherten Eintrag. Die JSON-Kopie
  // speichert genau das, was auch PostgreSQL (`jsonb`) speichert und was der Hash abdeckt
  // (`canonicalJson` hat die Wertsemantik von `JSON.stringify`): ein Datum als ISO-Zeichenkette.
  private anhaengen(entry: AuditEntry): AuditEntry {
    if (this.bySeq.has(entry.seq)) {
      throw new Error(`AUDIT_SEQ_BELEGT: seq ${entry.seq} ist bereits vergeben.`);
    }
    const gespeichert = tiefEingefroren(JSON.parse(JSON.stringify(entry)) as AuditEntry);
    if (gespeichert.eventId) {
      this.eventIds.add(gespeichert.eventId);
    }
    this.entries.push(gespeichert);
    this.bySeq.set(gespeichert.seq, gespeichert);
    return gespeichert;
  }

  append(entry: AuditEntry, _tx?: TxContext): Promise<void> {
    try {
      this.anhaengen(entry);
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // Auftrag gesamt-dubletten-rueckzug (Runde 2, BEN-R3-1): nimmt den LETZTEN Eintrag zurück, wenn
  // er die Nummer `seq` trägt — die Rückstellung eines gescheiterten Vorgangs ohne Datenbank
  // (services/app/src/speicher-vorgang.ts), in PostgreSQL übernimmt das ROLLBACK. Nur am Ende der
  // Kette: ein Eintrag mitten darin liesse `prevHash` des Nachfolgers ins Leere zeigen. Steht
  // `seq` nicht am Ende, wirft die Methode und ändert nichts.
  verwerfen(seq: number): void {
    const letzter = this.entries.at(-1);
    if (!letzter || letzter.seq !== seq) {
      throw new Error(`Audit-Eintrag ${seq} ist nicht der letzte — Rückstellung abgelehnt.`);
    }
    this.entries.pop();
    this.bySeq.delete(seq);
    if (letzter.eventId) {
      this.eventIds.delete(letzter.eventId);
    }
  }

  // Synchron geprüft UND vermerkt — zwei parallele Nachzüge, die beide einen leeren Read sahen,
  // schreiben trotzdem exakt EINEN Eintrag (der zweite Aufruf ist ein ehrlicher No-op).
  appendOnce(entry: AuditEntry, _tx?: TxContext): Promise<boolean> {
    if (entry.eventId && this.eventIds.has(entry.eventId)) {
      return Promise.resolve(false);
    }
    try {
      this.anhaengen(entry);
      return Promise.resolve(true);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // Lauf 3: Vorgänger lesen, Eintrag bauen und anhängen ohne ein `await` dazwischen — kein zweiter
  // Schreiber kann denselben Vorgänger sehen.
  //
  // Lauf 5 (Nacharbeit 2): geschrieben wird über die EIGENEN Methoden `append`/`appendOnce` dieser
  // Instanz, nicht an ihnen vorbei. Wer sie ersetzt oder beobachtet (Messhüllen in Tests, der
  // Rücknahme-Weg mit seinem Kontext), sieht damit jeden Eintrag — vorher lief `appendNext` direkt
  // in `anhaengen`, und ein Beleg im Rücknahme-Vorgang blieb für eine solche Hülle unsichtbar. Beide
  // Methoden hängen synchron an; zwischen dem Lesen des Vorgängers und dem Anhängen liegt weiterhin
  // kein `await`. Zurückgegeben wird die gespeicherte (eingefrorene) Fassung.
  appendNext(
    build: (last: AuditEntry | undefined) => AuditEntry,
    tx?: TxContext,
  ): Promise<{ entry: AuditEntry; written: boolean }> {
    try {
      const entry = build(this.entries[this.entries.length - 1]);
      const schreiben = entry.eventId
        ? this.appendOnce(entry, tx)
        : this.append(entry, tx).then(() => true);
      return schreiben.then((written) => ({
        entry: written ? (this.bySeq.get(entry.seq) ?? entry) : entry,
        written,
      }));
    } catch (err) {
      return Promise.reject(err);
    }
  }

  all(): Promise<AuditEntry[]> {
    return Promise.resolve([...this.entries]);
  }

  // JOB 2698 D1: dieselbe Regel wie der Dienst-Rückfall und die SQL-Fassung — `entries` liegt in
  // Anhängereihenfolge, also aufsteigend nach `seq`, genau wie `ORDER BY seq`.
  findBy(filter: AuditFilter): Promise<AuditEntry[]> {
    return Promise.resolve(this.entries.filter((e) => auditFilterTrifft(e, filter)));
  }

  existsBy(filter: AuditFilter): Promise<boolean> {
    return Promise.resolve(this.entries.some((e) => auditFilterTrifft(e, filter)));
  }

  // produkt:20261009:admin-audit-verstaendlich: rückwärts vom Ende der Kette — dieselbe Reihenfolge
  // wie `ORDER BY seq DESC`, und es wird nur so weit gelesen, wie die Seite reicht.
  findPage(
    filter: AuditSeitenFilter,
    before: number | undefined,
    limit: number,
  ): Promise<AuditEntry[]> {
    const seite: AuditEntry[] = [];
    for (let i = this.entries.length - 1; i >= 0 && seite.length < limit; i--) {
      const e = this.entries[i] as AuditEntry;
      if ((before === undefined || e.seq < before) && auditSeiteTrifft(e, filter)) {
        seite.push(e);
      }
    }
    return Promise.resolve(seite);
  }

  findNamensbelege(ids: readonly string[]): Promise<AuditEntry[]> {
    const gesucht = new Set(ids);
    return Promise.resolve(
      this.entries.filter(
        (e) =>
          (gesucht.has(e.actor) && e.payload.actorName !== undefined) ||
          (gesucht.has(e.target) && e.payload.targetName !== undefined),
      ),
    );
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
