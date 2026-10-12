// Weg 3 (GEHIRN §3/§9): semantische Vektoren fürs Wissen. Dieses Modul ist bewusst schlank und
// eigenständig (kennt weder knowledge-object noch reasoner) — genau wie conflicts. Es gibt das
// Interface, den deterministischen Stub und (AW-12) den internen Provider, dem der interne Weg
// hereingereicht wird; ein Cloud-Adapter ist bewusst nicht verdrahtet.
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

// AW-12: WAS für Vektoren das sind — getrennt gekennzeichnet, und zwar an der Version, die mit JEDEM
// Vektor gespeichert wird. `stub@…` ist der deterministische Testersatz (lexikalisch, kein Modell,
// KEIN Qualitätsbeleg); `intern:<modell>@…` sind Vektoren eines echten Embedding-Modells auf einem
// bestätigten internen Server. Erreichbarkeit ist keine Art: sie zeigt erst ein echter embed()-Aufruf.
export type EmbeddingArt = "stub" | "intern" | "unbekannt";

export function embeddingArt(embeddingVersion: string): EmbeddingArt {
  if (/^stub@\d+$/.test(embeddingVersion)) return "stub";
  if (/^intern:[^@\s]+@\d+$/.test(embeddingVersion)) return "intern";
  return "unbekannt";
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

// ── AW-12: Der interne Embedding-Provider ────────────────────────────────────────────────────────
// Dieses Modul spricht selbst nie über das Netz (Egress nur im Chokepoint `services/reasoner/src/
// model-client.ts`, `createLocalEmbeddingClientFromEnv`). Es bekommt den internen Weg hereingereicht
// und macht daraus einen Provider mit fester Version `intern:<modell>@<dim>`. Die Dimension ist
// Pflicht und wird an JEDEM Vektor geprüft: ein Modell, das andere Längen liefert, wirft, statt
// unvereinbare Vektoren in den Speicher zu mischen (GEHIRN §9.1).
export interface InternerEmbeddingWeg {
  readonly modell: string;
  einbetten(texte: readonly string[]): Promise<number[][]>;
}

export function internerEmbeddingProvider(
  weg: InternerEmbeddingWeg,
  dim: number,
): EmbeddingProvider {
  if (!Number.isInteger(dim) || dim <= 0) {
    throw new Error(`internerEmbeddingProvider: dim muss positive Ganzzahl sein, war ${dim}`);
  }
  const embeddingVersion = `intern:${weg.modell}@${dim}`;
  return {
    name: `intern:${weg.modell}`,
    embeddingVersion,
    dim,
    // Konfiguriert und intern — NICHT „erreichbar". Das belegt erst embed().
    isAvailable: () => true,
    embed: async (texts) => {
      const vectors = await weg.einbetten(texts);
      if (vectors.length !== texts.length) {
        throw new Error(`embed: ${vectors.length} Vektoren für ${texts.length} Texte`);
      }
      for (const vector of vectors) {
        if (vector.length !== dim) {
          throw new Error(`embed: Vektorlänge ${vector.length} ≠ dim ${dim} (${embeddingVersion})`);
        }
      }
      return { vectors, embeddingVersion, dim };
    },
  };
}

// Auswahl aus Env: `stub` (Vorgabe) liefert den Stub; `local` den internen Provider — aber NUR, wenn
// der interne Weg hereingereicht wurde (also eine bestätigte interne Adresse und ein Modell
// konfiguriert sind) UND `KLARWERK_EMBEDDING_DIM` die Dimension des Modells nennt. Fehlt eines davon,
// ehrlich `undefined`, nie still der Stub. `cloud` ist bewusst NICHT verdrahtet: ein externer
// Embedding-Anbieter gehört nicht zum internen Kernweg.
export function createEmbeddingProviderFromEnv(
  env: Record<string, string | undefined>,
  wege: { readonly lokal?: InternerEmbeddingWeg | undefined } = {},
): EmbeddingProvider | undefined {
  const mode = env.KLARWERK_EMBEDDING_PROVIDER ?? "stub";
  if (mode === "stub") {
    const dim = parsePositiveInt(env.KLARWERK_EMBEDDING_DIM) ?? STUB_DEFAULT_DIM;
    return stubEmbeddingProvider(dim);
  }
  if (mode === "local") {
    const dim = parsePositiveInt(env.KLARWERK_EMBEDDING_DIM);
    return wege.lokal && dim !== undefined ? internerEmbeddingProvider(wege.lokal, dim) : undefined;
  }
  return undefined;
}

function parsePositiveInt(raw: string | undefined): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}
