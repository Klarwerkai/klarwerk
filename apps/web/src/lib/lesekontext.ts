// ================================================================================================
// N-0020 · UX-02 — DER LESEKONTEXT ÜBERLEBT DEN AUSFLUG IN DEN HERKUNFTSGRAPHEN.
// ================================================================================================
//
// DER BEFUND (N-0020, 05.09.2026, bestätigt 06.09. 01:42): Bibliothek → Bericht → „Mehr" →
// Herkunftskette → „Im Wissensgraph ansehen" → Browser-Zurück. Danach stand der Bericht wieder
// oben, „Mehr" war zu, die Herkunftskette auch — der Mensch musste seine Stelle neu suchen.
//
// WAS SCHON TRÄGT, und hier NICHT verdoppelt wird: Suchbegriff und gewählter Eintrag stehen seit
// JOB 3104 in der Adresse (`BibliothekFlaeche.tsx`, `q`/`eintrag`), und Browser-Zurück stellt die
// Adresse wieder her. Was die Adresse nicht trägt, ist die LESEPOSITION: der Rollstand der
// Lesespalte und welche Abschnitte hinter „Mehr" offen waren. Das sagt dieses Modul.
//
// WARUM `sessionStorage` UND NICHT DIE ADRESSE: ein Rollstand in der Adresse wäre ein Link, der
// beim Teilen jemanden mitten in einen Bericht wirft, und jedes Rollen schriebe den Verlauf. Die
// Wahl selbst bleibt allein in der Adresse (die Regel „ein Speicher je Aussage" aus JOB 3104):
// gespeichert wird hier nur, WO im gewählten Bericht gelesen wurde, nie WELCHER Bericht es ist.
//
// GEBUNDEN AN GENAU EINEN VERLAUFSEINTRAG: der Merker gilt nur für denselben Pfad, denselben
// Eintrag und — wo der Router ihn führt — denselben Verlaufsindex (`history.state.idx`, beim
// Ersetzen der Adresse unverändert). Er wird beim Wiederherstellen verbraucht. Wer den Bericht
// später auf einem anderen Weg öffnet, beginnt oben wie bisher.
const SCHLUESSEL = "kw.lesekontext";

interface Lesekontext {
  koId: string;
  pfad: string;
  idx: number | null;
  rollTop: number;
  abschnitte: string[];
}

function speicher(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function verlaufsIndex(): number | null {
  const stand = window.history.state as { idx?: unknown } | null;
  return typeof stand?.idx === "number" ? stand.idx : null;
}

/**
 * Der Bereich, der die Lesespalte rollt: breit die Spalte selbst (`overflow-y-auto`), schmal die
 * Inhaltsfläche der Seite. Gesucht wird ab der Lesefläche (`bib-lesen`) am Baum entlang — dieselbe
 * Vorsicht wie `rollbereich` in `BibliothekFlaeche.tsx`, kein fester Selektor auf fremde Dateien.
 */
export function lesespalteRollbereich(ausgang: Element | null): HTMLElement | null {
  let el = ausgang?.closest('[data-testid="bib-lesen"]')?.parentElement ?? null;
  while (el !== null) {
    const rollt = window.getComputedStyle(el).overflowY;
    if (rollt === "auto" || rollt === "scroll") {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

/** Beim Verlassen: Rollstand und offene Abschnitte des gelesenen Berichts, je Verlaufseintrag. */
export function lesekontextMerken(
  koId: string,
  ausgang: Element | null,
  abschnitte: Iterable<string>,
): void {
  const kontext: Lesekontext = {
    koId,
    pfad: window.location.pathname,
    idx: verlaufsIndex(),
    rollTop: lesespalteRollbereich(ausgang)?.scrollTop ?? 0,
    abschnitte: [...abschnitte],
  };
  try {
    speicher()?.setItem(SCHLUESSEL, JSON.stringify(kontext));
  } catch {
    // Voller oder gesperrter Speicher: dann beginnt der Bericht nach der Rückkehr oben, wie bisher.
  }
}

/** Der gemerkte Kontext — nur für denselben Eintrag an derselben Verlaufsstelle, sonst `null`. */
export function lesekontextLesen(koId: string): Lesekontext | null {
  let roh: string | null = null;
  try {
    roh = speicher()?.getItem(SCHLUESSEL) ?? null;
  } catch {
    return null;
  }
  if (roh === null) {
    return null;
  }
  let k: Partial<Lesekontext>;
  try {
    k = JSON.parse(roh) as Partial<Lesekontext>;
  } catch {
    return null;
  }
  const passt =
    k.koId === koId &&
    k.pfad === window.location.pathname &&
    (k.idx ?? null) === verlaufsIndex() &&
    typeof k.rollTop === "number" &&
    Array.isArray(k.abschnitte) &&
    k.abschnitte.every((s) => typeof s === "string");
  return passt ? (k as Lesekontext) : null;
}

/** Verbraucht den Merker — ein zweites Öffnen desselben Berichts beginnt wieder oben. */
export function lesekontextVergessen(): void {
  try {
    speicher()?.removeItem(SCHLUESSEL);
  } catch {
    // nichts zu tun
  }
}
