// B3: In-Memory-Vektor-Store mit Cosine-Nearest-Neighbor. Schmales Repo-Interface nach dem KoRepo-
// Muster (services/knowledge-object/src/repo.ts:29) — heute nur der In-Memory-Adapter; ein
// PgVectorEmbeddingStore (pgvector) folgt später und implementiert dasselbe Interface.
//
// Der Store ist der einzige Ort, der mehrere Vektoren nebeneinander hält — also der richtige Ort für
// die Homogenitäts-Guards (B5): eine Suche mischt nie Vektoren verschiedener embeddingVersion, und
// ein upsert mit fremder Version/Dimension wird abgewiesen statt still verfälscht.

export interface NearestHit {
  id: string;
  // Cosine-Ähnlichkeit in [-1, 1]; bei L2-normierten Vektoren = Skalarprodukt. Höher = ähnlicher.
  score: number;
}

export interface EmbeddingStore {
  // Legt den Vektor unter `id` ab bzw. überschreibt ihn. `embeddingVersion` wandert mit (B5).
  upsert(id: string, vector: readonly number[], embeddingVersion: string): Promise<void>;
  // Top-K nächste Nachbarn zur Anfrage — AUSSCHLIESSLICH unter Vektoren gleicher `embeddingVersion`.
  // `excludeId` (z. B. das gerade eingereichte KO) wird nie zurückgegeben.
  nearest(
    query: readonly number[],
    embeddingVersion: string,
    topK: number,
    excludeId?: string,
  ): Promise<NearestHit[]>;
  // GDPR Art. 17 (Kaskadenlöschung): entfernt den Vektor zu `id`. Fehlt der Eintrag, ist es ein
  // No-op (idempotent). Ändert die aktive Version/Dimension nicht — Löschen macht keinen Re-Index.
  delete(id: string): Promise<void>;
}

interface StoredVector {
  vector: number[];
  embeddingVersion: string;
}

function dot(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return sum;
}

function norm(v: readonly number[]): number {
  return Math.sqrt(dot(v, v));
}

// Cosine-Ähnlichkeit, robust gegen nicht-normierte Eingaben (der Stub liefert bereits normiert, aber
// der Store macht keine Annahme darüber). Nullvektor → 0 (definierte Kante, keine Division durch 0).
function cosine(a: readonly number[], b: readonly number[]): number {
  const denom = norm(a) * norm(b);
  return denom === 0 ? 0 : dot(a, b) / denom;
}

export class InMemoryEmbeddingStore implements EmbeddingStore {
  private readonly items = new Map<string, StoredVector>();
  // B5-Guard: die erste Ablage legt die aktive Version + Dimension fest; alles Weitere muss dazu
  // passen. So kann ein Store nie inkompatible Vektoren nebeneinander halten (GEHIRN §9.1). Ein
  // Versionswechsel ist ein bewusster Re-Index (neuer, homogener Store), kein stiller Schleicher.
  private active: { embeddingVersion: string; dim: number } | undefined;

  async upsert(id: string, vector: readonly number[], embeddingVersion: string): Promise<void> {
    if (this.active === undefined) {
      if (vector.length === 0) {
        throw new Error("upsert: Vektor darf nicht leer sein");
      }
      this.active = { embeddingVersion, dim: vector.length };
    } else {
      if (embeddingVersion !== this.active.embeddingVersion) {
        throw new Error(
          `upsert: embeddingVersion ${embeddingVersion} ≠ aktive ${this.active.embeddingVersion} — kein Mischen inkompatibler Vektoren (Versionswechsel = bewusster Re-Index).`,
        );
      }
      if (vector.length !== this.active.dim) {
        throw new Error(
          `upsert: Dimension ${vector.length} ≠ aktive ${this.active.dim} (Version ${embeddingVersion})`,
        );
      }
    }
    this.items.set(id, { vector: [...vector], embeddingVersion });
    return Promise.resolve();
  }

  async nearest(
    query: readonly number[],
    embeddingVersion: string,
    topK: number,
    excludeId?: string,
  ): Promise<NearestHit[]> {
    if (topK <= 0) {
      return [];
    }
    const hits: NearestHit[] = [];
    for (const [id, stored] of this.items) {
      // Harter Versions-Filter (B5): fremdversionierte Vektoren nie im selben Suchraum.
      if (stored.embeddingVersion !== embeddingVersion) {
        continue;
      }
      if (excludeId !== undefined && id === excludeId) {
        continue;
      }
      hits.push({ id, score: cosine(query, stored.vector) });
    }
    // Deterministische Ordnung: Score absteigend, bei Gleichstand id aufsteigend (stabil, reproduzierbar).
    hits.sort((x, y) => (y.score !== x.score ? y.score - x.score : x.id < y.id ? -1 : 1));
    return hits.slice(0, topK);
  }

  // GDPR Art. 17: Vektor zu `id` entfernen. Map.delete ist idempotent (unbekannte id → No-op, kein
  // Fehler). `active` bleibt bewusst unangetastet — ein leerer Store behält seine Versionszusage.
  async delete(id: string): Promise<void> {
    this.items.delete(id);
    return Promise.resolve();
  }
}
