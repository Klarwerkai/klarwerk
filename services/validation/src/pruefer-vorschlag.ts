// ================================================================================================
// R-0265 — PRÜFER-VORSCHLAG AUS DER HISTORIE.
// ================================================================================================
//
// „Das System schlägt vor, wer ein neues Wissensobjekt prüfen sollte — abgeleitet aus
// Autorenschaft, früheren Prüfungen und der Nähe im Wissensnetz." Der Marktblick verlangt
// ausdrücklich eine DETERMINISTISCHE Ableitung ohne Modell. Diese Datei ist genau das: eine reine
// Funktion über bereits beschaffte Zeilen. Sie lädt nichts, schreibt nichts und weist niemanden zu
// — die Zuweisung bleibt eine bewusste Handlung des Menschen (R-1084, `assign`).
//
// DREI SIGNALE, JEDES MIT BENANNTEM GEWICHT:
//   · `autorschaft` — die Person hat ein Objekt zum selben Thema verfasst (gleiche Kategorie oder
//                     gemeinsames Schlagwort).
//   · `pruefungen`  — die Person hat ein Objekt zum selben Thema schon bewertet.
//   · `netznaehe`   — die Person hat ein Objekt verfasst oder bewertet, das mit dem Zielobjekt
//                     über eine aktive Beziehung im Wissensnetz direkt verbunden ist. Ein neues,
//                     noch nicht gespeichertes Objekt hat keine Beziehungen; dann trägt dieses
//                     Signal schlicht nichts bei.
//
// JE SIGNAL ZÄHLEN HÖCHSTENS `DECKEL_JE_SIGNAL` Objekte. Sonst überstimmt eine Person mit fünfzig
// Beiträgen in einer Kategorie jede andere Herleitung, und der Vorschlag wäre nur noch eine
// Rangliste der Fleißigsten.
//
// WAS DIESE FUNKTION NICHT ENTSCHEIDET: welche Objekte der Fragende sehen darf. Der Aufrufer
// reicht ausschließlich den SICHTBAREN Bestand herein (Kompositionswurzel, `sichtbarkeit.ts`) —
// sonst verriete schon der Grund „hat zu diesem Thema geprüft" ein vertrauliches Objekt.

export type VorschlagsGrund = "autorschaft" | "pruefungen" | "netznaehe";

export const VORSCHLAG_GEWICHTE: Readonly<Record<VorschlagsGrund, number>> = {
  autorschaft: 2,
  pruefungen: 2,
  netznaehe: 3,
};

export const DECKEL_JE_SIGNAL = 3;
export const VORSCHLAG_STANDARD_ANZAHL = 5;

/** Die Felder eines Bestandsobjekts, die der Vorschlag braucht — und keines mehr. */
export interface VorschlagsObjekt {
  readonly id: string;
  readonly author: string;
  readonly category?: string | null | undefined;
  readonly tags?: readonly string[] | null | undefined;
}

export interface VorschlagsEingabe {
  /** Das Thema des Zielobjekts. Ohne Kategorie und ohne Schlagwort gibt es kein Themensignal. */
  readonly ziel: {
    readonly id?: string | undefined;
    readonly category?: string | null | undefined;
    readonly tags?: readonly string[] | null | undefined;
  };
  /** Wer NIE vorgeschlagen wird: der Autor und, falls verschieden, der Fragende. */
  readonly ausgeschlossen: readonly string[];
  /** Wer überhaupt in Frage kommt (dieselbe Personenliste wie die manuelle Auswahl). */
  readonly kandidaten: readonly string[];
  /** Der für den Fragenden SICHTBARE Bestand. */
  readonly bestand: readonly VorschlagsObjekt[];
  /** Bewertungen auf Objekten des Bestands (wer hat was geprüft). */
  readonly bewertungen: readonly { readonly koId: string; readonly userId: string }[];
  /** Objekte, die mit dem Ziel über eine aktive Beziehung direkt verbunden sind. */
  readonly nachbarn: ReadonlySet<string>;
  readonly anzahl?: number;
}

export interface PrueferVorschlag {
  readonly userId: string;
  readonly punkte: number;
  /** In fester Reihenfolge `autorschaft`, `pruefungen`, `netznaehe`; nur die tragenden. */
  readonly gruende: readonly VorschlagsGrund[];
}

function normiert(wert: string | null | undefined): string {
  return (wert ?? "").trim().toLocaleLowerCase("de");
}

function schlagwortMenge(tags: readonly string[] | null | undefined): Set<string> {
  return new Set((tags ?? []).map(normiert).filter((t) => t.length > 0));
}

/** Ob ein Bestandsobjekt zum selben Thema gehört wie das Ziel. */
function gleichesThema(
  objekt: VorschlagsObjekt,
  zielKategorie: string,
  zielTags: ReadonlySet<string>,
): boolean {
  if (zielKategorie.length > 0 && normiert(objekt.category) === zielKategorie) {
    return true;
  }
  for (const t of schlagwortMenge(objekt.tags)) {
    if (zielTags.has(t)) {
      return true;
    }
  }
  return false;
}

export function prueferVorschlag(eingabe: VorschlagsEingabe): PrueferVorschlag[] {
  const kandidaten = new Set(eingabe.kandidaten);
  for (const id of eingabe.ausgeschlossen) {
    kandidaten.delete(id);
  }
  const zielKategorie = normiert(eingabe.ziel.category);
  const zielTags = schlagwortMenge(eingabe.ziel.tags);

  const themaIds = new Set<string>();
  const nahIds = new Set<string>();
  const autorVon = new Map<string, string>();
  for (const objekt of eingabe.bestand) {
    if (objekt.id === eingabe.ziel.id) {
      continue;
    }
    autorVon.set(objekt.id, objekt.author);
    if (gleichesThema(objekt, zielKategorie, zielTags)) {
      themaIds.add(objekt.id);
    }
    if (eingabe.nachbarn.has(objekt.id)) {
      nahIds.add(objekt.id);
    }
  }

  // Je Person und Signal die Menge der tragenden Objekte — eine Menge, damit dieselbe Person auf
  // demselben Objekt nicht doppelt zählt.
  const treffer = new Map<string, Record<VorschlagsGrund, Set<string>>>();
  const vermerke = (userId: string, grund: VorschlagsGrund, koId: string): void => {
    if (!kandidaten.has(userId)) {
      return;
    }
    const eintrag = treffer.get(userId) ?? {
      autorschaft: new Set<string>(),
      pruefungen: new Set<string>(),
      netznaehe: new Set<string>(),
    };
    eintrag[grund].add(koId);
    treffer.set(userId, eintrag);
  };

  for (const koId of themaIds) {
    vermerke(autorVon.get(koId) ?? "", "autorschaft", koId);
  }
  for (const koId of nahIds) {
    vermerke(autorVon.get(koId) ?? "", "netznaehe", koId);
  }
  for (const b of eingabe.bewertungen) {
    if (themaIds.has(b.koId)) {
      vermerke(b.userId, "pruefungen", b.koId);
    }
    if (nahIds.has(b.koId)) {
      vermerke(b.userId, "netznaehe", b.koId);
    }
  }

  const reihenfolge: readonly VorschlagsGrund[] = ["autorschaft", "pruefungen", "netznaehe"];
  const vorschlaege: PrueferVorschlag[] = [];
  for (const [userId, signale] of treffer) {
    let punkte = 0;
    const gruende: VorschlagsGrund[] = [];
    for (const grund of reihenfolge) {
      const zahl = Math.min(signale[grund].size, DECKEL_JE_SIGNAL);
      if (zahl > 0) {
        punkte += zahl * VORSCHLAG_GEWICHTE[grund];
        gruende.push(grund);
      }
    }
    if (punkte > 0) {
      vorschlaege.push({ userId, punkte, gruende });
    }
  }
  // Deterministisch: höchste Punktzahl zuerst, bei Gleichstand nach Kennung.
  vorschlaege.sort((a, b) => b.punkte - a.punkte || a.userId.localeCompare(b.userId));
  return vorschlaege.slice(0, Math.max(0, eingabe.anzahl ?? VORSCHLAG_STANDARD_ANZAHL));
}
