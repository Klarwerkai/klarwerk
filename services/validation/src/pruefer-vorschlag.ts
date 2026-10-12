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
// R-1655 — DAS VIERTE SIGNAL, `schnell`: „KLARWERK lernt, welche Personen welche Themen typischerweise
// schnell validieren." Je Person zählt der MEDIAN ihrer Prüfdauern zu Objekten DIESES Themas (von
// der Zuweisung — ohne Zuweisung von der Anlage des Objekts — bis zur Bewertung). Gestuft nach
// `SCHNELL_STUFEN`: wer typischerweise binnen eines Tages prüft, bekommt am meisten. Eine einzelne
// langsame Prüfung kippt den Median nicht. Wer zum Thema nie geprüft hat, hat keine Dauer und
// bekommt hier nichts — gelernt wird nur aus tatsächlichen Prüfungen.
//
// JE SIGNAL ZÄHLEN HÖCHSTENS `DECKEL_JE_SIGNAL` Objekte. Sonst überstimmt eine Person mit fünfzig
// Beiträgen in einer Kategorie jede andere Herleitung, und der Vorschlag wäre nur noch eine
// Rangliste der Fleißigsten.
//
// WAS DIESE FUNKTION NICHT ENTSCHEIDET: welche Objekte der Fragende sehen darf. Der Aufrufer
// reicht ausschließlich den SICHTBAREN Bestand herein (Kompositionswurzel, `sichtbarkeit.ts`) —
// sonst verriete schon der Grund „hat zu diesem Thema geprüft" ein vertrauliches Objekt.

export type VorschlagsGrund = "autorschaft" | "pruefungen" | "netznaehe" | "schnell";

/** Median-Prüfdauer in Stunden → Punkte. Erste passende Stufe gilt; darüber hinaus 0. */
export interface SchnellStufe {
  readonly bisStunden: number;
  readonly punkte: number;
}
export const SCHNELL_STUFEN: readonly SchnellStufe[] = [
  { bisStunden: 24, punkte: 3 },
  { bisStunden: 72, punkte: 2 },
  { bisStunden: 168, punkte: 1 },
];

function schnellPunkte(medianStunden: number): number {
  return SCHNELL_STUFEN.find((s) => medianStunden <= s.bisStunden)?.punkte ?? 0;
}

function median(werte: readonly number[]): number {
  const sortiert = [...werte].sort((a, b) => a - b);
  const mitte = Math.floor(sortiert.length / 2);
  return sortiert.length % 2 === 1
    ? (sortiert[mitte] ?? 0)
    : ((sortiert[mitte - 1] ?? 0) + (sortiert[mitte] ?? 0)) / 2;
}

/** Die drei gezählten Signale; `schnell` wird gestuft (`SCHNELL_STUFEN`), nicht gezählt. */
type ZaehlGrund = Exclude<VorschlagsGrund, "schnell">;

export const VORSCHLAG_GEWICHTE: Readonly<Record<ZaehlGrund, number>> = {
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
  /** R-1655: Prüfdauern (Stunden) je Bewertung; gezählt werden nur die zu Objekten des Themas. */
  readonly latenzen?: readonly {
    readonly koId: string;
    readonly userId: string;
    readonly stunden: number;
  }[];
  readonly anzahl?: number;
}

export interface PrueferVorschlag {
  readonly userId: string;
  readonly punkte: number;
  /** In fester Reihenfolge `autorschaft`, `pruefungen`, `netznaehe`, `schnell`; nur die tragenden. */
  readonly gruende: readonly VorschlagsGrund[];
  /** R-1655: Median der Prüfdauer zum Thema in Stunden — nur, wenn die Person dazu geprüft hat. */
  readonly medianStunden?: number;
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
  const treffer = new Map<string, Record<ZaehlGrund, Set<string>>>();
  const vermerke = (userId: string, grund: ZaehlGrund, koId: string): void => {
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

  // R-1655: Prüfdauern je Person, nur zu Objekten des Themas.
  const dauern = new Map<string, number[]>();
  for (const l of eingabe.latenzen ?? []) {
    if (themaIds.has(l.koId) && kandidaten.has(l.userId) && Number.isFinite(l.stunden)) {
      const bisher = dauern.get(l.userId) ?? [];
      bisher.push(Math.max(0, l.stunden));
      dauern.set(l.userId, bisher);
    }
  }

  const reihenfolge: readonly ZaehlGrund[] = ["autorschaft", "pruefungen", "netznaehe"];
  const vorschlaege: PrueferVorschlag[] = [];
  for (const userId of new Set([...treffer.keys(), ...dauern.keys()])) {
    const signale = treffer.get(userId);
    let punkte = 0;
    const gruende: VorschlagsGrund[] = [];
    for (const grund of reihenfolge) {
      const zahl = Math.min(signale?.[grund].size ?? 0, DECKEL_JE_SIGNAL);
      if (zahl > 0) {
        punkte += zahl * VORSCHLAG_GEWICHTE[grund];
        gruende.push(grund);
      }
    }
    const eigeneDauern = dauern.get(userId);
    const medianStunden = eigeneDauern ? median(eigeneDauern) : undefined;
    const tempo = medianStunden === undefined ? 0 : schnellPunkte(medianStunden);
    if (tempo > 0) {
      punkte += tempo;
      gruende.push("schnell");
    }
    if (punkte > 0) {
      vorschlaege.push(
        medianStunden === undefined
          ? { userId, punkte, gruende }
          : { userId, punkte, gruende, medianStunden: Math.round(medianStunden * 10) / 10 },
      );
    }
  }
  // Deterministisch: höchste Punktzahl zuerst, bei Gleichstand nach Kennung.
  vorschlaege.sort((a, b) => b.punkte - a.punkte || a.userId.localeCompare(b.userId));
  return vorschlaege.slice(0, Math.max(0, eingabe.anzahl ?? VORSCHLAG_STANDARD_ANZAHL));
}
