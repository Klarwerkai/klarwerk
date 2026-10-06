// ================================================================================================
// R-0744 — DER QUALITÄTSBLICK AUF DAS WISSENSNETZ: JEDE ZAHL MIT IHREM NENNER.
// ================================================================================================
//
// Wortlaut R-0744: „… ein ausdrücklich zu wählender Qualitätsblick auf Konflikte, Lücken, veraltetes
// Wissen und Dubletten – jede Zahl mit ihrem Nenner und dem Alter des Bestands." Begründung der
// Quelle: „‚12 offene Konflikte' ist eine Drohung, ‚12 aus 340 Aussagen, Bestand drei Wochen alt' ist
// eine Information."
//
// DIESE DATEI RECHNET NUR, SIE HOLT NICHTS. Alle Eingänge kommen aus bestehenden, bereits
// sichtbarkeitsgefilterten Lesewegen (`/api/graph`, `/api/conflicts`, `/api/duplicates`,
// `/api/lifecycle/pending`, `/api/wissensnetz/luecken`). Gezählt wird ausschließlich, was im
// Graphen des Betrachters steht: ein Konflikt oder eine Dublette zählt nur für Objekte, deren Kennung
// in der Graphantwort steht. Ein Eintrag außerhalb dieser Menge kann die Zahl nicht erhöhen — er
// wäre sonst eine Auskunft über etwas, das der Betrachter nicht sieht.
//
// NICHT ERHOBEN HEISST NICHT NULL: fehlt ein Eingang (Abfrage läuft, scheitert oder ist nicht
// gewählt), ist die Zahl `null` — die Fläche sagt dann „nicht erhoben", nie „0 von N".
import type { Conflict, OverlapEntry, Sichtmetrik } from "../api/types";

/** Eine Quote: gezählt, Nenner, und was der Nenner zählt. `anzahl: null` = nicht erhoben. */
export interface Quote {
  anzahl: number | null;
  nenner: number | null;
}

export interface Qualitaetsblick {
  /** Objekte im Graphen mit mindestens einem nicht gelösten Konflikt — von allen Objekten im Graphen. */
  konflikte: Quote;
  /** Objekte ohne Schlagwort, also ohne Thema im Netz — von allen sichtbaren Objekten (Sichtmetrik). */
  luecken: Quote;
  /** Objekte im Graphen, für die eine Re-Validierung ansteht — von allen Objekten im Graphen. */
  veraltet: Quote;
  /** Objekte im Graphen in mindestens einer offenen Überschneidung — von allen Objekten im Graphen. */
  dubletten: Quote;
}

export interface QualitaetsEingaenge {
  /** Die Kennungen der Graphantwort (ungekürzt, nicht nur die gezeichneten). */
  graphIds: readonly string[];
  konflikte?: readonly Pick<Conflict, "koA" | "koB" | "status">[] | undefined;
  dubletten?: readonly Pick<OverlapEntry, "koA" | "koB" | "status">[] | undefined;
  anstehend?: readonly string[] | undefined;
  luecken?: Pick<Sichtmetrik, "objekteGesamt" | "ohneThema"> | undefined;
}

/** Wie viele der Graphobjekte in mindestens einem der Paare stehen. */
function beteiligte(
  ids: ReadonlySet<string>,
  paare: readonly { koA: string; koB: string }[],
): number {
  const getroffen = new Set<string>();
  for (const p of paare) {
    if (ids.has(p.koA)) {
      getroffen.add(p.koA);
    }
    if (ids.has(p.koB)) {
      getroffen.add(p.koB);
    }
  }
  return getroffen.size;
}

export function qualitaetsblick(e: QualitaetsEingaenge): Qualitaetsblick {
  const ids = new Set(e.graphIds);
  const nenner = ids.size;
  return {
    konflikte: {
      anzahl:
        e.konflikte === undefined
          ? null
          : beteiligte(
              ids,
              e.konflikte.filter((k) => k.status !== "geloest"),
            ),
      nenner,
    },
    luecken:
      e.luecken === undefined
        ? { anzahl: null, nenner: null }
        : { anzahl: e.luecken.ohneThema, nenner: e.luecken.objekteGesamt },
    veraltet: {
      anzahl:
        e.anstehend === undefined ? null : new Set(e.anstehend.filter((id) => ids.has(id))).size,
      nenner,
    },
    dubletten: {
      anzahl:
        e.dubletten === undefined
          ? null
          : beteiligte(
              ids,
              e.dubletten.filter((d) => d.status !== "geschlossen"),
            ),
      nenner,
    },
  };
}

/** Das Alter des Bestands: der jüngste Eintrag im Graphen und wie viele volle Tage das her ist. */
export interface Bestandsalter {
  /** ISO-Zeitpunkt des jüngsten `createdAt` — `null`, wenn kein Objekt einen lesbaren trägt. */
  juengster: string | null;
  tage: number | null;
}

const TAG_MS = 24 * 60 * 60 * 1000;

export function bestandsalter(
  objekte: readonly { id: string; createdAt?: string }[],
  graphIds: readonly string[],
  jetztMs: number,
): Bestandsalter {
  const ids = new Set(graphIds);
  let juengsterMs: number | null = null;
  let juengster: string | null = null;
  for (const o of objekte) {
    if (!ids.has(o.id) || !o.createdAt) {
      continue;
    }
    const ms = Date.parse(o.createdAt);
    if (Number.isNaN(ms)) {
      continue;
    }
    if (juengsterMs === null || ms > juengsterMs) {
      juengsterMs = ms;
      juengster = o.createdAt;
    }
  }
  return {
    juengster,
    tage: juengsterMs === null ? null : Math.max(0, Math.floor((jetztMs - juengsterMs) / TAG_MS)),
  };
}
