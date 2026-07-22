import type { TxContext } from "../../db-tx";
import {
  type AiCheck,
  type EvidenceRecord,
  type KnowledgeObject,
  type KnowledgeType,
  KoError,
  type KoStatus,
  type KoVersionSnapshot,
} from "./types";

export interface KoFilter {
  type?: KnowledgeType;
  status?: KoStatus;
  category?: string;
  tag?: string;
}

// SCRUM-361 / AG-03 / FR-ASK-02 / NFR-PERF-03: datenquellennahe Kandidatenabfrage für Ask. Statt den
// gesamten Pool (`list()`) in den Speicher zu laden, liefert das Repository eine VORGEFILTERTE,
// auf `limit` begrenzte Kandidatenmenge: KOs, deren durchsuchbarer Text (Titel/Aussage/Tags/Kategorie)
// mindestens einen der (bereits tokenisierten) Inhalts-Terme enthält. `terms` sind Inhaltstoken der
// Frage (Stoppwörter entfernt) — die Auswahl bleibt damit konsistent zum Ranking aus SCRUM-360.
// Die feine Relevanz-/Status-/Trust-Sortierung übernimmt weiterhin der Reasoner (`selectCandidates`);
// dieser Prefilter ist bewusst grob (ODER-Treffer + Cap), bevorzugt aber bei Gleichstand validierte/
// vertrauenswürdigere KOs, damit relevante validierte Treffer unter dem Limit erhalten bleiben.
export interface KoCandidateQuery {
  terms: readonly string[];
  limit: number;
}

export interface KoRepo {
  insert(ko: KnowledgeObject): Promise<void>;
  findById(id: string): Promise<KnowledgeObject | undefined>;
  update(ko: KnowledgeObject): Promise<void>;
  // SCRUM-523 P.3 (WP-A2): optionaler, opaker TxContext (services/db-tx) — additiv, abwärtskompatibel.
  // Zweck: der Purge-Chokepoint (KoService.purgeKo) kann delete() UND audit.record() in DERSELBEN
  // echten DB-Transaktion laufen lassen (beide committen oder beide rollbacken). InMemoryKoRepo
  // ignoriert den Parameter (dort ist Atomarität trivial, kein I/O-Fenster).
  delete(id: string, tx?: TxContext): Promise<void>;
  list(filter: KoFilter): Promise<KnowledgeObject[]>;
  // WP-BILD-1g (bens sammel14-ROT): PROJEKTION für den Suchpfad — dieselbe Filterlogik wie list(),
  // aber OHNE bodyHtml (Pg: SELECT data - 'bodyHtml'; InMemory: Feld weggelassen). Die Suche
  // arbeitet über title/statement/captionTexts und traversiert nie megabyte-große Body-Strings.
  listForSearch(filter: KoFilter): Promise<KnowledgeObject[]>;
  // WP-BILD-1g/1h: schmaler Backfill des ABGELEITETEN captionTexts-Suchfelds (Legacy-KOs von vor
  // der Schreibregel). VERTRAG (bens sammel15-ROT 1): schreibt ATOMAR NUR, WENN DAS FELD FEHLT —
  // ein bereits gesetztes Feld (nebenläufiger revise/Voll-Write mit frischerem Scan) wird nie
  // überschrieben. Weiterhin ohne rowVersion-CAS, Versions-Snapshot oder Audit (Cache-Write).
  // WP-D11b (bens patches53-GELB): Rückgabe inserted — true, wenn DIESER Aufruf geschrieben hat
  // (Pg: rowCount). false heißt: das Feld war schon gesetzt (Race mit einem Voll-Write) — der
  // Aufrufer muss dann die AKTUELLEN Werte nachladen statt seinen alten Scan weiterzuverwenden.
  setCaptionTexts(id: string, captionTexts: string[]): Promise<boolean>;
  // SCRUM-361: begrenzte, vorgefilterte Kandidatenmenge für Ask (kein All-Pool-Load mehr).
  findCandidates(query: KoCandidateQuery): Promise<KnowledgeObject[]>;
  // WP-SUBMIT-ASYNC (Pedis R3): schmaler Feld-Patch des Hintergrund-Prüf-Status — patcht NUR
  // aiCheck (nie das restliche Objekt) auf einem EXISTIERENDEN, nicht getrashten KO. false = KO
  // fehlt/getrasht. Für das pending-Markieren beim Submit/Retry/Re-Enqueue.
  setAiCheck(id: string, aiCheck: AiCheck): Promise<boolean>;
  // WP-SUBMIT-ASYNC: BEDINGTER Abschluss-Patch (CAS-schonend wie setCaptionTexts): merged den
  // patch NUR, wenn der aktuelle Status noch "pending" ist — und patcht dabei ausschließlich das
  // aiCheck-Feld (ein nebenläufiger revise verliert nie Daten; requestedAt bleibt erhalten).
  // false = nicht mehr pending (bereits abgeschlossen/KO weg) — der Aufrufer loggt und lässt los.
  // WP-SHIP8-FINAL (bens Bedingung 2): optional zusätzlich an die INHALTSVERSION gebunden —
  // mit expectedKoVersion schreibt der Patch NUR, wenn der pending-Vermerk diese Version trägt
  // UND das KO noch auf ihr steht (ein zwischenzeitlicher revise macht den Lauf zum No-op;
  // stale-done ist damit unmöglich). Ohne Parameter: Bestandsverhalten (nur-pending-Bedingung).
  resolveAiCheck(
    id: string,
    patch: Omit<AiCheck, "requestedAt">,
    expectedKoVersion?: number,
  ): Promise<boolean>;
}

// Durchsuchbarer Text eines KO für die grobe Kandidaten-Vorauswahl (kein Quelleninhalt wird verändert).
// WP-RETEST7 R5 (Pedis Befund: Fragen findet Fußnotentext nicht): die PERSISTIERTEN Bild-Fußnoten
// (captionTexts-Suchfeld, WP-BILD-1g) zählen additiv mit — KEIN bodyHtml-Scan; Altbestand ohne
// Feld matcht wie bisher (konvergiert über den bestehenden Such-Backfill).
export function koCandidateText(ko: KnowledgeObject): string {
  const captions = ko.captionTexts?.length ? ` ${ko.captionTexts.join(" ")}` : "";
  return `${ko.title} ${ko.statement} ${ko.tags.join(" ")} ${ko.category}${captions}`.toLowerCase();
}

// Anzahl der (distinct) Inhalts-Terme, die als Teilstring im KO-Text vorkommen. Teilstring ist bewusst
// breiter als die Token-Gleichheit des Reasoners → der Prefilter schließt nie einen KO aus, den
// `selectCandidates` behalten würde (sichere Obermenge), gatet aber irrelevante KOs (Score 0) aus.
export function koCandidateScore(ko: KnowledgeObject, terms: readonly string[]): number {
  const text = koCandidateText(ko);
  let score = 0;
  for (const term of terms) {
    if (term.length > 0 && text.includes(term)) {
      score += 1;
    }
  }
  return score;
}

function matches(ko: KnowledgeObject, filter: KoFilter): boolean {
  if (filter.type && ko.type !== filter.type) {
    return false;
  }
  if (filter.status && ko.status !== filter.status) {
    return false;
  }
  if (filter.category && ko.category !== filter.category) {
    return false;
  }
  if (filter.tag && !ko.tags.includes(filter.tag)) {
    return false;
  }
  return true;
}

export class InMemoryKoRepo implements KoRepo {
  private readonly items = new Map<string, KnowledgeObject>();

  insert(ko: KnowledgeObject): Promise<void> {
    // WP-SHIP8-CLOSE-4 (bens ROT-1B): Spiegel des partiellen Pg-Unique-Index
    // kos_import_candidate_uq — höchstens EIN KO je Import-Kandidat, INKLUSIVE Papierkorb
    // (getrashte KOs halten ihren Anker; der ROT-1C-Vertrag adoptiert sie statt neu anzulegen).
    // Synchron geprüft (kein await zwischen Prüfen und Set) — atomar wie der Index.
    if (ko.importCandidateId) {
      for (const existing of this.items.values()) {
        if (existing.importCandidateId === ko.importCandidateId && existing.id !== ko.id) {
          return Promise.reject(
            new KoError(
              "IMPORT_ANCHOR_TAKEN",
              "Für diesen Import-Kandidaten existiert bereits ein Wissensobjekt.",
            ),
          );
        }
      }
    }
    this.items.set(ko.id, ko);
    return Promise.resolve();
  }

  findById(id: string): Promise<KnowledgeObject | undefined> {
    return Promise.resolve(this.items.get(id));
  }

  // SCRUM-509 R3: optimistische Concurrency (Compare-and-Set auf rowVersion). Der Aufrufer übergibt das
  // KO, das er GELESEN hat (rowVersion = gelesener Stand); hat ein anderer Write zwischenzeitlich
  // geschrieben (gespeicherte rowVersion ≠ gelesene), scheitert der Write (STALE_WRITE) — kein
  // Überschreiben. Bei Erfolg wird rowVersion monoton erhöht.
  update(ko: KnowledgeObject): Promise<void> {
    const cur = this.items.get(ko.id);
    const expected = ko.rowVersion ?? 0;
    if (cur && (cur.rowVersion ?? 0) !== expected) {
      return Promise.reject(
        new KoError("STALE_WRITE", "Nebenläufige Änderung — bitte erneut lesen und anwenden."),
      );
    }
    this.items.set(ko.id, { ...ko, rowVersion: expected + 1 });
    return Promise.resolve();
  }

  // SCRUM-523 P.3 (WP-A3): konsistent zu PgKoRepo.delete — 0 gelöschte Zeilen (KO bereits weg,
  // wiederholter/konkurrierender Purge) wirft NOT_FOUND statt still zu no-op'en.
  delete(id: string, _tx?: TxContext): Promise<void> {
    if (!this.items.delete(id)) {
      return Promise.reject(new KoError("NOT_FOUND", "Wissensobjekt nicht gefunden."));
    }
    return Promise.resolve();
  }

  list(filter: KoFilter): Promise<KnowledgeObject[]> {
    return Promise.resolve([...this.items.values()].filter((ko) => matches(ko, filter)));
  }

  // WP-BILD-1g: Suchpfad-Projektion — bodyHtml wird weggelassen (analog zur Pg-Projektion).
  listForSearch(filter: KoFilter): Promise<KnowledgeObject[]> {
    return Promise.resolve(
      [...this.items.values()]
        .filter((ko) => matches(ko, filter))
        .map(({ bodyHtml: _omitted, ...rest }) => rest),
    );
  }

  // WP-BILD-1g/1h: Cache-Write des abgeleiteten Suchfelds — ATOMAR NUR-WENN-FELD-FEHLT (analog
  // zur bedingten Pg-Query): ein bereits gesetztes Feld (z. B. von einem nebenläufigen revise mit
  // frischerem Scan) wird NIE überschrieben; der Voll-Write gewinnt immer. Kein Versions-/Audit-Pfad.
  setCaptionTexts(id: string, captionTexts: string[]): Promise<boolean> {
    const ko = this.items.get(id);
    if (ko && ko.captionTexts === undefined) {
      this.items.set(id, { ...ko, captionTexts: [...captionTexts] });
      return Promise.resolve(true);
    }
    // patches53-GELB: nicht geschrieben (Feld gesetzt oder KO weg) — der Aufrufer lädt nach.
    return Promise.resolve(false);
  }

  // WP-SUBMIT-ASYNC: schmaler Feld-Patch (nur aiCheck) auf einem existierenden, nicht getrashten KO.
  setAiCheck(id: string, aiCheck: AiCheck): Promise<boolean> {
    const ko = this.items.get(id);
    if (!ko || ko.deletedAt) {
      return Promise.resolve(false);
    }
    this.items.set(id, { ...ko, aiCheck: { ...aiCheck } });
    return Promise.resolve(true);
  }

  // WP-SUBMIT-ASYNC: bedingter Abschluss — NUR wenn noch pending; merged in das bestehende aiCheck
  // (requestedAt bleibt), patcht sonst NICHTS am Objekt (revise-Änderungen bleiben unangetastet).
  // WP-SHIP8-FINAL (bens Bedingung 2): mit expectedKoVersion zusätzlich versionsgebunden — der
  // Vermerk muss die erwartete Version tragen UND das KO muss noch auf ihr stehen (revise dazwischen
  // → false, der alte Lauf ist ein No-op; stale-done unmöglich).
  resolveAiCheck(
    id: string,
    patch: Omit<AiCheck, "requestedAt">,
    expectedKoVersion?: number,
  ): Promise<boolean> {
    const ko = this.items.get(id);
    if (!ko || ko.deletedAt || ko.aiCheck?.status !== "pending") {
      return Promise.resolve(false);
    }
    if (
      expectedKoVersion !== undefined &&
      (ko.aiCheck.koVersion !== expectedKoVersion || ko.version !== expectedKoVersion)
    ) {
      return Promise.resolve(false);
    }
    this.items.set(id, { ...ko, aiCheck: { ...ko.aiCheck, ...patch } });
    return Promise.resolve(true);
  }

  // SCRUM-361: vorgefilterte, begrenzte Kandidatenmenge. ODER-Treffer über die Inhalts-Terme,
  // sortiert nach (Term-Trefferzahl ↓, validiert zuerst, Trust ↓) und auf `limit` gedeckelt — so
  // bleiben relevante validierte Treffer auch bei vielen Kandidaten unter dem Limit erhalten.
  //
  // SCRUM-491 (ben-Re-Review, Scope-Ehrlichkeit): Dies ist der TEST-/DEV-Adapter und ist NICHT
  // quell-seitig gedeckelt — er scort den (kleinen) In-Memory-Bestand VOLLSTÄNDIG und schneidet erst
  // danach auf `limit`. Der einzige aktuell implementierte quell-gedeckelte Adapter ist PgKoRepo
  // (hartes SQL LIMIT, quell-seitig, s. repo-pg.ts). Geplante weitere Adapter (pgvector,
  // sqlite-vec/Insel) sind NOCH NICHT implementiert und müssten den Top-K-Quell-Vertrag selbst
  // erfüllen, wenn gebaut. Nicht für einen echten Live-Bestand verwenden — bei großem Bestand würde
  // hier der Full-Scan teuer.
  findCandidates(query: KoCandidateQuery): Promise<KnowledgeObject[]> {
    const terms = query.terms.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0);
    if (terms.length === 0) {
      return Promise.resolve([]);
    }
    const limit = Math.max(0, Math.floor(query.limit));
    const ranked = [...this.items.values()]
      .map((ko) => ({ ko, score: koCandidateScore(ko, terms) }))
      .filter((x) => x.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          Number(b.ko.status === "validiert") - Number(a.ko.status === "validiert") ||
          b.ko.trust - a.ko.trust,
      )
      .slice(0, limit)
      .map((x) => x.ko);
    return Promise.resolve(ranked);
  }
}

// SCRUM-159: Persistenz der KO-Version-Snapshots. Append-only; ein bereits gespeicherter
// (koId, version) wird NIE überschrieben (frühere Versionen bleiben unveränderlich).
export interface KoVersionRepo {
  append(snapshot: KoVersionSnapshot): Promise<void>;
  listByKo(koId: string): Promise<KoVersionSnapshot[]>;
  // SCRUM-507 R3: entfernt einen (koId, version)-Snapshot — AUSSCHLIESSLICH für den kompensierenden
  // Rollback eines noch nicht committeten Mehrschritt-Mutations (mutateKoTx). Im Normalbetrieb bleibt
  // die Versionshistorie append-only; kein Live-Pfad ruft remove für eine committete Version auf.
  remove(koId: string, version: number): Promise<void>;
}

export class InMemoryKoVersionRepo implements KoVersionRepo {
  // koId → version → Snapshot. Map bewahrt Reihenfolge; vorhandene Version wird nicht ersetzt.
  private readonly items = new Map<string, Map<number, KoVersionSnapshot>>();

  append(snapshot: KoVersionSnapshot): Promise<void> {
    const byVersion = this.items.get(snapshot.koId) ?? new Map<number, KoVersionSnapshot>();
    if (!byVersion.has(snapshot.version)) {
      byVersion.set(snapshot.version, snapshot);
    }
    this.items.set(snapshot.koId, byVersion);
    return Promise.resolve();
  }

  listByKo(koId: string): Promise<KoVersionSnapshot[]> {
    const byVersion = this.items.get(koId);
    const list = byVersion ? [...byVersion.values()] : [];
    return Promise.resolve(list.sort((a, b) => a.version - b.version));
  }

  // SCRUM-507 R3: Kompensation eines Rollback (s. Interface). No-op, wenn (koId, version) fehlt.
  remove(koId: string, version: number): Promise<void> {
    this.items.get(koId)?.delete(version);
    return Promise.resolve();
  }
}

// SCRUM-160: Evidence-Records separat vom KO-JSON. Append-only; vorhandene Evidence-ID wird
// nicht überschrieben. Damit bleiben Quellen-/Anhang-Nachweise stabil referenzierbar.
export interface EvidenceRepo {
  append(record: EvidenceRecord): Promise<void>;
  listByKo(koId: string): Promise<EvidenceRecord[]>;
  // SCRUM-169: KO-übergreifende, read-only Sicht (jüngste zuerst) für den QM-Evidence-Index.
  recent(limit: number): Promise<EvidenceRecord[]>;
}

export class InMemoryEvidenceRepo implements EvidenceRepo {
  private readonly items = new Map<string, EvidenceRecord>();

  append(record: EvidenceRecord): Promise<void> {
    if (!this.items.has(record.id)) {
      this.items.set(record.id, record);
    }
    return Promise.resolve();
  }

  listByKo(koId: string): Promise<EvidenceRecord[]> {
    const records = [...this.items.values()]
      .filter((record) => record.koId === koId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    return Promise.resolve(records);
  }

  recent(limit: number): Promise<EvidenceRecord[]> {
    const records = [...this.items.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
      .slice(0, Math.max(0, limit));
    return Promise.resolve(records);
  }
}
