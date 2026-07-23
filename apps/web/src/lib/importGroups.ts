// WP-IC-4 (Schritt 4+5 des abgenommenen Cockpit-Flows): pure Logik der Gruppen-Freigabe und der
// ehrlichen Bilanz. DOM-frei und ohne Netz — im Node-Gate testbar; die Komponente (ImportGroups)
// rendert nur diese Zustände. iPad-Einfachheit: der Gruppen-Entscheid ist die VORGABE je Kandidat,
// Einzel-Overrides bleiben möglich; „bereits importiert" ist vorab abgewählt (Dedupe-Vorgabe).

// Flache Copy-Schlüssel — EINE Quelle für Komponente + Test (Muster CAPTURE_FILE_TEXT).
export const IMPORT_GROUPS_TEXT = {
  cta: "imp.groups.cta",
  grouping: "imp.groups.grouping",
  retry: "imp.groups.retry",
  noAi: "imp.groups.noAi",
  aiGrouped: "imp.groups.aiGrouped",
  groupCount: "imp.groups.groupCount",
  approve: "imp.groups.approve",
  exclude: "imp.groups.exclude",
  selectedCount: "imp.groups.selectedCount",
  catchall: "imp.groups.catchall",
  noTheme: "imp.groups.noTheme",
  hintImported: "imp.groups.hintImported",
  hintStale: "imp.groups.hintStale",
  hintShort: "imp.groups.hintShort",
  applyCta: "imp.groups.applyCta",
  applying: "imp.groups.applying",
  bilanzTitle: "imp.groups.bilanzTitle",
  bilanzImported: "imp.groups.bilanzImported",
  bilanzSkipped: "imp.groups.bilanzSkipped",
  bilanzExcluded: "imp.groups.bilanzExcluded",
  bilanzFailed: "imp.groups.bilanzFailed",
  bilanzReview: "imp.groups.bilanzReview",
  failNotFound: "imp.groups.failNotFound",
  // WP-SHIP7-FIX (Fix 3): ehrliche Teilbilanz — bereits eingereiht / nicht versucht / HTTP-Fehler
  // eines Batches + Wiederholen-Knopf für den nicht versuchten Rest.
  bilanzQueued: "imp.groups.bilanzQueued",
  bilanzNotAttempted: "imp.groups.bilanzNotAttempted",
  retryRest: "imp.groups.retryRest",
  failHttp: "imp.groups.failHttp",
  // WP-IC-6b (Versionierung): Quelle aktualisiert seit Import + separater Bilanz-Zähler.
  hintSourceNewer: "imp.groups.hintSourceNewer",
  bilanzUpdates: "imp.groups.bilanzUpdates",
  // WP-REST18 (bens Fix 2): handlungsfähiger SNAPSHOT_EXPIRED-Weg — klare Meldung + Neu gruppieren.
  expired: "imp.groups.expired",
  regroup: "imp.groups.regroup",
  // WP-SHIP9-S1 (bens W2-Auflage): spezifischer Grund am „Ohne KI gruppiert"-Badge, wenn die
  // Cloud-KI wegen vertraulicher Kandidaten ausgeschlossen war (fallbackReason "confidential").
  noAiReason: "imp.groups.noAiReason",
  reasonConfidential: "imp.groups.reason.confidential",
  // WP-SHIP9-S1b (bens GELB): eigener Zustand „bereits zur Prüfung vorgemerkt" (offener Kandidat,
  // getrennt von „bereits importiert") — Badge am Kandidaten + eigene Bilanz-Zeile.
  hintQueued: "imp.groups.hintQueued",
  bilanzSkippedQueued: "imp.groups.bilanzSkippedQueued",
} as const;

export interface GroupedCandidate {
  id: string;
  title: string;
  textCodec?: "decoded";
  alreadyImported: boolean;
  // WP-SHIP9-S1b: offener Kandidat — „bereits zur Prüfung vorgemerkt" (eigener Zustand, gleiche
  // Vorab-Abwahl wie bereits Importiertes: der Queue-Schutz bleibt, die Bezeichnung ist ehrlich).
  alreadyQueued?: boolean;
  // WP-IC-6b: Quelle neuer als der Import — wählbar als Aktualisierung (nicht vorab abgewählt).
  sourceNewer?: boolean;
  hints: string[]; // "already-imported" | "stale" | "short"
}

export interface ImportGroup {
  title: string;
  ids: string[];
  kind?: "catchall" | "no-theme";
}

// Vorgabe: alles freigegeben AUSSER bereits Importiertem und bereits Vorgemerktem (Dedupe- bzw.
// Queue-Schutz-Vorgabe; Override bleibt möglich — WP-SHIP9-S1b: der vorgemerkte Zustand ist vom
// importierten getrennt, verhält sich in der Vorgabe aber gleich: nicht doppelt einreihen).
// WP-IC-6b: AUSNAHME — ist die Quelle seit dem Import aktualisiert (sourceNewer), ist der Kandidat
// als „Aktualisierung importieren" WÄHLBAR und startet ausgewählt (kein unveränderte-Dublette-Fall).
export function initialSelection(candidates: readonly GroupedCandidate[]): Record<string, boolean> {
  const selection: Record<string, boolean> = {};
  for (const candidate of candidates) {
    selection[candidate.id] =
      (!candidate.alreadyImported && candidate.alreadyQueued !== true) ||
      candidate.sourceNewer === true;
  }
  return selection;
}

// Gruppen-Entscheid (Freigeben/Ausschließen) setzt die Vorgabe ALLER Kandidaten der Gruppe —
// spätere Einzel-Overrides bleiben unbenommen (sie ändern nur den einen Eintrag).
export function applyGroupToggle(
  selection: Readonly<Record<string, boolean>>,
  group: ImportGroup,
  on: boolean,
): Record<string, boolean> {
  const next = { ...selection };
  for (const id of group.ids) {
    if (id in next) {
      next[id] = on;
    }
  }
  return next;
}

export function toggleCandidate(
  selection: Readonly<Record<string, boolean>>,
  id: string,
): Record<string, boolean> {
  return { ...selection, [id]: !(selection[id] ?? false) };
}

export function selectionCounts(selection: Readonly<Record<string, boolean>>): {
  selected: number;
  total: number;
} {
  const values = Object.values(selection);
  return { selected: values.filter(Boolean).length, total: values.length };
}

export function includedIds(selection: Readonly<Record<string, boolean>>): string[] {
  return Object.entries(selection)
    .filter(([, on]) => on)
    .map(([id]) => id);
}

// Markierte Gruppen (Auffanggruppe/Ohne Thema) lokalisiert die UI selbst (DE/EN/NL) — der
// Server-Titel ist nur der DE/EN-Fallbackwert.
export function groupLabelKey(group: ImportGroup): string | null {
  if (group.kind === "catchall") {
    return IMPORT_GROUPS_TEXT.catchall;
  }
  if (group.kind === "no-theme") {
    return IMPORT_GROUPS_TEXT.noTheme;
  }
  return null;
}

// WP-SHIP9-S1 (bens W2-Auflage, Muster aiCheckFailureReasonKey): Ursache → i18n-Key für den
// Grund-Zusatz am „Ohne KI gruppiert"-Badge. NUR "confidential" bekommt einen spezifischen Text;
// no-model/model-timeout/model-error bleiben bewusst bei der bisherigen Darstellung (bens T9).
export function noAiReasonKey(fallbackReason: string | undefined): string | null {
  if (fallbackReason === "confidential") {
    return IMPORT_GROUPS_TEXT.reasonConfidential;
  }
  return null;
}

export function hintLabelKey(hint: string): string | null {
  if (hint === "already-imported") {
    return IMPORT_GROUPS_TEXT.hintImported;
  }
  if (hint === "stale") {
    return IMPORT_GROUPS_TEXT.hintStale;
  }
  if (hint === "short") {
    return IMPORT_GROUPS_TEXT.hintShort;
  }
  return null;
}

// Übernahme in Batches — ehrlicher Fortschritt „x von y" statt eines undurchsichtigen Sammelcalls.
export const APPLY_BATCH_SIZE = 10;

export function buildBatches(ids: readonly string[], size: number = APPLY_BATCH_SIZE): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    batches.push([...ids.slice(i, i + size)]);
  }
  return batches;
}

export interface ApplyBatchResult {
  imported: number;
  updates: number; // WP-IC-6b: davon Aktualisierungen (Teilmenge von imported)
  alreadyQueued: number; // idempotenter No-op des Servers (Kandidat war schon eingereiht)
  failed: { id: string; reason: string }[];
  notFound: string[];
}

// WP-SHIP7-FIX (Fix 3): expliziter Lauf-Zustand der Übernahme — attempted/transportFailed werden
// je Batch fortgeschrieben; daraus leitet sich die ehrliche Teilbilanz (inkl. „nicht versucht") ab.
export interface ApplyRunState {
  results: ApplyBatchResult[]; // Antworten der ERFOLGREICH übertragenen Batches
  attempted: string[]; // alle Ids, deren Batch abgeschickt wurde (inkl. HTTP-Fehlschlag)
  transportFailed: string[]; // Ids des Batches, dessen HTTP-Aufruf scheiterte (Zustand unbekannt)
}

export const EMPTY_APPLY_RUN: ApplyRunState = { results: [], attempted: [], transportFailed: [] };

export interface ImportBilanz {
  imported: number;
  updates: number; // WP-IC-6b: davon Aktualisierungen — informative TEILMENGE von imported
  alreadyQueued: number; // WP-SHIP7-FIX: No-op des Servers — NICHT als importiert gezählt
  skippedAlreadyImported: number; // vorab abgewählt, weil bereits importiert (Dedupe-Vorgabe)
  // WP-SHIP9-S1b: vorab abgewählt, weil bereits zur Prüfung vorgemerkt (offener Kandidat) —
  // ehrlich getrennt von „bereits importiert".
  skippedAlreadyQueued: number;
  excluded: number; // bewusst ausgeschlossen (Gruppe/Einzel)
  failed: { id: string; reason: string }[]; // inkl. not-found und http-error (PII-frei)
  notAttempted: string[]; // nach einem Batch-Fehler nie versucht — Wiederholen möglich
}

// EHRLICHE Bilanz: übernommen/bereits eingereiht kommen aus den Server-Antworten; übersprungen/
// ausgeschlossen aus dem lokalen Auswahl-Zustand; Fehlschläge je Id mit PII-freiem Grund
// (not-found vom Server, http-error für den gescheiterten Batch); der nicht versuchte Rest wird
// explizit ausgewiesen. INVARIANTE (als Test gepinnt): alle Kandidaten der Gruppierung ==
// importiert + bereits eingereiht + übersprungen (importiert/vorgemerkt) + ausgeschlossen +
// fehlgeschlagen + nicht versucht.
export function aggregateBilanz(
  candidates: readonly GroupedCandidate[],
  selection: Readonly<Record<string, boolean>>,
  run: ApplyRunState,
): ImportBilanz {
  let skippedAlreadyImported = 0;
  let skippedAlreadyQueued = 0;
  let excluded = 0;
  for (const candidate of candidates) {
    if (selection[candidate.id] !== true) {
      if (candidate.alreadyImported) {
        skippedAlreadyImported += 1;
      } else if (candidate.alreadyQueued === true) {
        skippedAlreadyQueued += 1;
      } else {
        excluded += 1;
      }
    }
  }
  const failed: { id: string; reason: string }[] = [];
  let imported = 0;
  let updates = 0;
  let alreadyQueued = 0;
  for (const batch of run.results) {
    imported += batch.imported;
    updates += batch.updates;
    alreadyQueued += batch.alreadyQueued;
    failed.push(...batch.failed);
    failed.push(...batch.notFound.map((id) => ({ id, reason: "not-found" })));
  }
  // HTTP-Fehler eines Batches: Zustand serverseitig unbekannt → ehrlich als fehlgeschlagen.
  failed.push(...run.transportFailed.map((id) => ({ id, reason: "http-error" })));
  const attempted = new Set(run.attempted);
  const notAttempted = includedIds(selection).filter((id) => !attempted.has(id));
  return {
    imported,
    updates,
    alreadyQueued,
    skippedAlreadyImported,
    skippedAlreadyQueued,
    excluded,
    failed,
    notAttempted,
  };
}
