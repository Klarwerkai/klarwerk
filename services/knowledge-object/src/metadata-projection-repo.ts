import type { TxContext } from "../../db-tx";
import {
  type KoMetadataProjection,
  METADATA_REVISION_NONE,
  metadataTextsEqual,
} from "./metadata-projection";

// ================================================================================================
// G27 WELLE 1 / S2 — DIE PERSISTENZ DER METADATENPROJEKTION (Vertrag + In-Memory-Adapter)
// ================================================================================================
//
// NICHT append-only, und das ist der ganze Unterschied zur Content Projection: hier gibt es GENAU
// EINE Zeile je Objekt, die den aktuellen Stand trägt. Die Unveränderlichkeit, die die
// Inhaltsprojektion aus ihrem Versionsschlüssel bezieht, liegt hier woanders — im AUDIT, das jede
// wirksame Änderung mit Vorher/Nachher festhält (KW-ARCH-G27, Abschnitt 4).
//
// DER GANZE VERTRAG STECKT IN `upsert`. Sie ist die einzige Schreiboperation und beantwortet in
// EINEM Schritt beide Fragen, die S2 stellt:
//   · Hat sich fachlich etwas geändert? (`changed`)
//   · Welche Revision gilt jetzt?        (`projection.metadataRevision`)
// Die Idempotenz ist damit keine Disziplin des Aufrufers, sondern eine Eigenschaft des Speichers:
// derselbe fachliche Stand ein zweites Mal geschrieben lässt die Revision stehen. Ein Aufrufer, der
// die Revision selbst hochzählte, könnte genau das nicht garantieren.

export interface KoMetadataProjectionUpsert {
  koId: string;
  categoryText: string;
  tagText: string;
  at: string;
}

export interface KoMetadataProjectionResult {
  /** Der Stand, der NACH dem Aufruf gilt. */
  projection: KoMetadataProjection;
  /** Der Stand DAVOR — `undefined`, wenn es noch keine Zeile gab. Quelle des Audit-„vorher". */
  previous: KoMetadataProjection | undefined;
  /** Hat DIESER Aufruf fachlich etwas geändert (und damit die Revision erhöht)? */
  changed: boolean;
}

export interface KoMetadataProjectionRepo {
  /**
   * Schreibt den aktuellen Metadatenstand. IDEMPOTENT: sind `categoryText` und `tagText` bereits
   * genau so gespeichert, bleibt die Zeile unangetastet, `metadata_revision` klettert NICHT und
   * `changed` ist false. Andernfalls klettert die Revision GENAU EINMAL.
   */
  // JOB 2704 D1 (R2-35): optionaler, opaker TxContext (Muster `KoRepo.delete(id, tx)`) — der
  // Pg-Adapter schreibt dann auf dem Transaktionsclient von mutateKoTx; InMemory ignoriert ihn.
  upsert(input: KoMetadataProjectionUpsert, tx?: TxContext): Promise<KoMetadataProjectionResult>;
  find(koId: string, tx?: TxContext): Promise<KoMetadataProjection | undefined>;
  /** Mehrfach-Nachschlag für die Zusammensetzung des Effective Search Document (kein N+1). */
  findMany(koIds: readonly string[]): Promise<KoMetadataProjection[]>;
  /** Entfernt die Zeile eines Objekts — ausschliesslich fuer die harte Endloeschung/Ruecknahme. */
  remove(koId: string): Promise<void>;
  /** Zaehler fuer Backfill-/Rebuild-Bilanzen (keine Inhalte). */
  count(): Promise<number>;
}

export class InMemoryKoMetadataProjectionRepo implements KoMetadataProjectionRepo {
  private readonly items = new Map<string, KoMetadataProjection>();

  upsert(input: KoMetadataProjectionUpsert): Promise<KoMetadataProjectionResult> {
    const previous = this.items.get(input.koId);
    if (previous && metadataTextsEqual(previous, input)) {
      // Fachlich dieselbe Aussage: keine Revision, kein neuer Zeitstempel. Eine Zeile, die sich bei
      // jedem Wiederholungsaufruf „berührt" anfühlte, wäre kein idempotenter Speicher.
      return Promise.resolve({
        projection: { ...previous },
        previous: { ...previous },
        changed: false,
      });
    }
    const projection: KoMetadataProjection = {
      koId: input.koId,
      categoryText: input.categoryText,
      tagText: input.tagText,
      metadataRevision: (previous?.metadataRevision ?? METADATA_REVISION_NONE) + 1,
      updatedAt: input.at,
    };
    this.items.set(input.koId, projection);
    return Promise.resolve({
      projection: { ...projection },
      previous: previous ? { ...previous } : undefined,
      changed: true,
    });
  }

  find(koId: string): Promise<KoMetadataProjection | undefined> {
    const found = this.items.get(koId);
    return Promise.resolve(found ? { ...found } : undefined);
  }

  findMany(koIds: readonly string[]): Promise<KoMetadataProjection[]> {
    const out: KoMetadataProjection[] = [];
    for (const koId of new Set(koIds)) {
      const found = this.items.get(koId);
      if (found) {
        out.push({ ...found });
      }
    }
    return Promise.resolve(out);
  }

  remove(koId: string): Promise<void> {
    this.items.delete(koId);
    return Promise.resolve();
  }

  count(): Promise<number> {
    return Promise.resolve(this.items.size);
  }
}
