// ================================================================================================
// R-0082 / R-0477 (aufnahme:20260922:gesamt-wissen-metadaten) — DIE ANLAGEN EINES WISSENSOBJEKTS.
// ================================================================================================
//
// Spiegel der Lese- und Normalregel aus `services/knowledge-object/src/asset.ts`: `assets` ist die
// kanonische Liste, `asset` die erste Anlage (Altbestand trägt nur `asset`). Die Fläche liest
// Anlagen ausschliesslich über `anlagenVon` — Facette, Matrix und Leseansicht sehen dieselbe Liste.
//
// EINGABE: mehrere Anlagen stehen in EINEM Textfeld, getrennt durch Semikolon oder Zeilenumbruch;
// ein Semikolon IN einer Kennung wird als `\;` geschrieben (Escape-Regel unten). Ein Komma trennt
// bewusst NICHT — Anlagenkennungen tragen Kommas („Linie 4, Station 2").

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

// ------------------------------------------------------------------------------------------------
// DIE ESCAPE-REGEL — damit jede vorhandene Kennung Öffnen und Speichern UNVERÄNDERT übersteht.
// ------------------------------------------------------------------------------------------------
//
// Der Server erlaubt Semikolons in einer Kennung („Linie;Station"). Ohne Maskierung würde das Feld
// sie beim Wiederöffnen als ZWEI Anlagen lesen und beim Speichern die Zuordnung zerlegen. Deshalb:
//   · `\;` steht für ein Semikolon IN der Kennung, `\\` für einen Backslash;
//   · ein Backslash vor jedem anderen Zeichen bleibt ein gewöhnlicher Backslash („A\B" bleibt so);
//   · ein unmaskiertes Semikolon oder ein Zeilenumbruch trennt zwei Anlagen.
// `anlagenAlsEingabe` maskiert genau diese zwei Zeichen, `anlagenAusEingabe` hebt sie wieder auf —
// für jede Liste gilt: anlagenAusEingabe(anlagenAlsEingabe(liste)) === liste (in Normalform).

/** Das Eingabefeld → Anlagenliste (Trenner: unmaskiertes Semikolon oder Zeilenumbruch). */
export function anlagenAusEingabe(text: string): string[] {
  const teile: string[] = [];
  let aktuell = "";
  for (let i = 0; i < text.length; i += 1) {
    const zeichen = text[i] as string;
    const folgt = text[i + 1];
    if (zeichen === "\\" && (folgt === ";" || folgt === "\\")) {
      aktuell += folgt;
      i += 1;
    } else if (zeichen === ";" || zeichen === "\n") {
      teile.push(aktuell);
      aktuell = "";
    } else {
      aktuell += zeichen;
    }
  }
  teile.push(aktuell);
  return normalisiereAnlagen(teile);
}

/** Anlagenliste → Text für das Eingabefeld (Semikolon und Backslash maskiert). */
export function anlagenAlsEingabe(liste: readonly string[]): string {
  return liste.map((anlage) => anlage.replace(/[\\;]/g, (zeichen) => `\\${zeichen}`)).join("; ");
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
