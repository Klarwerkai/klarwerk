// ================================================================================================
// R-0082 / R-0477 (aufnahme:20260922:gesamt-wissen-metadaten) — DIE ANLAGEN EINES WISSENSOBJEKTS.
// ================================================================================================
//
// Spiegel der Lese- und Normalregel aus `services/knowledge-object/src/asset.ts`: `assets` ist die
// kanonische Liste, `asset` die erste Anlage (Altbestand trägt nur `asset`). Die Fläche liest
// Anlagen ausschliesslich über `anlagenVon` — Facette, Matrix und Leseansicht sehen dieselbe Liste.
//
// EINGABE: mehrere Anlagen stehen in EINEM Textfeld, getrennt durch Semikolon oder Zeilenumbruch.
// Ein Komma trennt bewusst NICHT — Anlagenkennungen tragen Kommas („Linie 4, Station 2").

/** Dieselbe Normalform wie am Server (`normalizeAsset`): NFC, Leerraum einfach, getrimmt. */
export function normalisiereAnlage(wert: unknown): string | null {
  if (typeof wert !== "string") {
    return null;
  }
  const normal = wert.normalize("NFC").replace(/\s+/g, " ").trim();
  return normal.length > 0 ? normal : null;
}

/** Eine Liste in Normalform — ohne leere und doppelte Einträge, Reihenfolge der Eingabe. */
export function normalisiereAnlagen(werte: readonly unknown[]): string[] {
  const liste: string[] = [];
  for (const wert of werte) {
    const anlage = normalisiereAnlage(wert);
    if (anlage !== null && !liste.includes(anlage)) {
      liste.push(anlage);
    }
  }
  return liste;
}

/** Die Anlagen eines Objekts: die Liste, sonst die Einzelzuordnung aus `asset`, sonst keine. */
export function anlagenVon(ko: { asset?: string | null; assets?: readonly string[] }): string[] {
  if (Array.isArray(ko.assets)) {
    return normalisiereAnlagen(ko.assets);
  }
  const einzeln = normalisiereAnlage(ko.asset);
  return einzeln === null ? [] : [einzeln];
}

/** Das Eingabefeld → Anlagenliste (Trenner: Semikolon oder Zeilenumbruch). */
export function anlagenAusEingabe(text: string): string[] {
  return normalisiereAnlagen(text.split(/[;\n]/));
}

/** Anlagenliste → Text für das Eingabefeld. */
export function anlagenAlsEingabe(liste: readonly string[]): string {
  return liste.join("; ");
}

/**
 * Die Felder, mit denen ein Entwurf oder eine Anlage die Anlagen schickt: die Liste und —
 * für Leser, die nur eine Anlage kennen — ihre erste als `asset`.
 */
export function anlagenNutzlast(text: string): { asset: string | null; assets: string[] } {
  const assets = anlagenAusEingabe(text);
  return { asset: assets[0] ?? null, assets };
}

// ------------------------------------------------------------------------------------------------
// R-0477 — DIE ZUORDNUNG ALS MATRIX
// ------------------------------------------------------------------------------------------------

export interface AnlagenMatrix<T> {
  /** Spalten: alle Anlagen der übergebenen Objekte, alphabetisch. */
  anlagen: string[];
  /** Zeilen: nur Objekte mit mindestens einer Anlage, in Eingabereihenfolge. */
  zeilen: { eintrag: T; anlagen: ReadonlySet<string> }[];
  /** Je Anlage: an wie vielen Objekten sie hängt. */
  anzahlJeAnlage: ReadonlyMap<string, number>;
}

/**
 * Baut die Anlagen×Wissensobjekt-Matrix aus GENAU den übergebenen Objekten. Die Sichtbarkeit wird
 * hier nicht entschieden: der Aufrufer reicht nur, was der Server diesem Menschen bereits
 * herausgegeben hat (die Trefferliste der Bibliothek).
 */
export function anlagenMatrix<T>(
  eintraege: readonly T[],
  koVon: (eintrag: T) => { asset?: string | null; assets?: readonly string[] },
): AnlagenMatrix<T> {
  const anzahl = new Map<string, number>();
  const zeilen: { eintrag: T; anlagen: ReadonlySet<string> }[] = [];
  for (const eintrag of eintraege) {
    const anlagen = anlagenVon(koVon(eintrag));
    if (anlagen.length === 0) {
      continue;
    }
    zeilen.push({ eintrag, anlagen: new Set(anlagen) });
    for (const anlage of anlagen) {
      anzahl.set(anlage, (anzahl.get(anlage) ?? 0) + 1);
    }
  }
  const anlagen = [...anzahl.keys()].sort((a, b) => a.localeCompare(b));
  return { anlagen, zeilen, anzahlJeAnlage: anzahl };
}
