// Weg 3 (GEHIRN §3/§9): semantische Vektoren fürs Wissen. Dieses Modul ist bewusst schlank und
// eigenständig (kennt weder knowledge-object noch reasoner) — genau wie conflicts. In-Insel-/Cloud-
// Adapter kommen später; jetzt existieren nur Interface + deterministischer Stub + In-Memory-Store.
//
// B1: Das Provider-Interface. Vorbild ist ModelClient (services/reasoner/src/provider-model.ts:24)
// — ein Datenobjekt + eine Methode — plus isAvailable() wie am ReasonerProvider (provider.ts:19).

export interface EmbeddingResult {
  // Ein Vektor je Eingabetext, in Eingabereihenfolge; jeder Vektor hat exakt die Länge `dim`.
  vectors: number[][];
  // Modell + Version + Dimension (z. B. "stub@256"). Garant gegen stilles Mischen inkompatibler
  // Vektoren (GEHIRN §9.1): jeder erzeugte Vektor trägt die Version genau seines Erzeugers.
  embeddingVersion: string;
  dim: number;
}

export interface EmbeddingProvider {
  // Anzeigename (kein Secret), analog ModelClient.name.
  readonly name: string;
  // KONSTANT je Provider — nicht pro Aufruf konfigurierbar. Wird bei jeder Persistenz mitgeschrieben.
  readonly embeddingVersion: string;
  readonly dim: number;
  // Ehrlich: false, wenn der Provider nicht einsatzbereit ist (analog ReasonerProvider.isAvailable).
  isAvailable(): boolean;
  // Bettet mehrere Texte ein. Wirft, wenn ein erzeugter Vektor nicht `dim` lang ist (Guard, B5).
  embed(texts: readonly string[]): Promise<EmbeddingResult>;
}

// ── B2: Deterministischer Stub-Adapter ──────────────────────────────────────────────────────────
// Pendant zum DeterministicProvider des Reasoners (provider.ts:466): immer verfügbar, ohne Netz,
// ohne Schlüssel. Gleicher Text → identischer Vektor; ähnlicher Wortschatz → höhere Cosine-Nähe.
// Damit ist die gesamte Kette (embed → speichern → Nachbarsuche → Vorfilter) deterministisch testbar,
// bevor pgvector oder ein Cloud-Key existieren.

// FNV-1a-32-Bit-Hash über die UTF-16-Codeeinheiten eines Tokens. Deterministisch, ohne Math.random.
function hashToken(token: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i += 1) {
    h ^= token.charCodeAt(i);
    // FNV-Primzahl 16777619, in 32-Bit-Arithmetik gehalten.
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// Zerlegt Text in einfache alphanumerische Tokens (kleingeschrieben). Rein lexikalisch — der Stub
// braucht keine Sprache, nur Determinismus.
function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

// Bag-of-words → Vektor fester Länge `dim`: jedes Token erhöht deterministisch einen Bucket
// (Vorzeichen aus einem zweiten Hash-Bit, damit sich Tokens nicht nur addieren). Danach L2-normiert,
// damit Cosine-Ähnlichkeit sinnvoll und die Vektorlänge ≈ 1 ist.
function embedText(text: string, dim: number): number[] {
  const vector = new Array<number>(dim).fill(0);
  for (const token of tokenize(text)) {
    const h = hashToken(token);
    const bucket = h % dim;
    const sign = (h & 0x100) === 0 ? 1 : -1;
    // bucket liegt in [0, dim) → Zugriff ist sicher; ?? 0 nur wegen noUncheckedIndexedAccess.
    vector[bucket] = (vector[bucket] ?? 0) + sign;
  }
  let norm = 0;
  for (const value of vector) {
    norm += value * value;
  }
  norm = Math.sqrt(norm);
  if (norm === 0) {
    // Leerer/tokenloser Text: Nullvektor bleibt Nullvektor (definierte, deterministische Kante).
    return vector;
  }
  for (let i = 0; i < dim; i += 1) {
    vector[i] = (vector[i] ?? 0) / norm;
  }
  return vector;
}

export const STUB_DEFAULT_DIM = 256;

// Erzeugt einen deterministischen Stub-Provider. `embeddingVersion` = "stub@<dim>" — konstant, wandert
// mit jedem Vektor in den Store (B5-Guard). Der dim-Guard in embed() wirft nie für den Stub selbst
// (embedText liefert immer `dim`), schützt aber den Vertrag für künftige, echte Provider.
export function stubEmbeddingProvider(dim: number = STUB_DEFAULT_DIM): EmbeddingProvider {
  if (!Number.isInteger(dim) || dim <= 0) {
    throw new Error(`stubEmbeddingProvider: dim muss positive Ganzzahl sein, war ${dim}`);
  }
  const embeddingVersion = `stub@${dim}`;
  return {
    name: "stub",
    embeddingVersion,
    dim,
    isAvailable: () => true,
    embed: async (texts) => {
      const vectors = texts.map((text) => {
        const vector = embedText(text, dim);
        if (vector.length !== dim) {
          throw new Error(`embed: Vektorlänge ${vector.length} ≠ dim ${dim}`);
        }
        return vector;
      });
      return { vectors, embeddingVersion, dim };
    },
  };
}

// August-Auswahl aus Env: v1 liefert nur den Stub (Default) oder ehrlich `undefined` — kein stiller
// Fake. Cloud/Insel sind bewusst NICHT verdrahtet (kommen später), nur die Auswahllogik steht.
// Muster: honest-undefined wie createLocalClientFromEnv (services/reasoner/src/model-client.ts:227).
export function createEmbeddingProviderFromEnv(
  env: Record<string, string | undefined>,
): EmbeddingProvider | undefined {
  const mode = env.KLARWERK_EMBEDDING_PROVIDER ?? "stub";
  if (mode === "stub") {
    const dim = parsePositiveInt(env.KLARWERK_EMBEDDING_DIM) ?? STUB_DEFAULT_DIM;
    return stubEmbeddingProvider(dim);
  }
  // "cloud" / "local": HTTP-Client existiert noch nicht → ehrlich undefined statt Fake.
  return undefined;
}

function parsePositiveInt(raw: string | undefined): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}
