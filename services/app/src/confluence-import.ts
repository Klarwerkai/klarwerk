import type { ConfluenceSourceAdapter } from "../../confluence";
import type { KoService } from "../../knowledge-object";
import type { ImportItem, LibraryService } from "../../library-analytics";

// SCRUM-510 WP2: Orchestrierung des Space-Imports. Liest den GESAMTEN Space (paginiert), stellt jede
// Seite IDEMPOTENT als Review-Kandidaten in die bestehende Import-Queue (116/157) — REVIEW-INVARIANTE:
// KEINE stillen Auto-KOs, alles landet ausschließlich als Kandidat. Never block: eine fehlerhafte Seite
// wird als `failed` verbucht, der Lauf läuft weiter. Ehrliche Zusammenfassung je Seite.

export type ImportPageStatus = "imported" | "skipped" | "failed";

export interface ImportRunSummary {
  dryRun: boolean;
  found: number; // Seiten im Space GESEHEN (bei truncated: nur bis zum Cap, NICHT der ganze Space)
  imported: number; // NEUE Kandidaten (bei dryRun: würden eingereiht; sonst tatsächlich eingereiht)
  skipped: number; // idempotent übersprungen (unveränderte Version bereits im Bestand/Queue/diesem Lauf)
  failed: number; // Seiten, deren Verarbeitung scheiterte
  // SCRUM-510 (WP3): true, wenn der Space-Read am Seiten-Cap ABGESCHNITTEN wurde → der Lauf ist
  // UNVOLLSTÄNDIG. `found` zählt dann nur die gesehenen Seiten; es gibt weitere, ungelesene Seiten.
  // Ein Lauf mit truncated=true darf NIE als vollständiger Import gelesen werden.
  truncated: boolean;
  perPage: { ref: string; status: ImportPageStatus; note?: string }[];
}

export interface ConfluenceImportDeps {
  adapter: ConfluenceSourceAdapter;
  library: LibraryService;
  koService: KoService;
  dryRun: boolean;
  actor: string;
}

// Höchste bereits importierte sourceVersion je externalId (aus den KO-Herkunftsankern).
// NUR für die Import-Idempotenz (runConfluenceImport) — der IC-6a-STATUS-Abgleich nutzt die
// versions- und provider-bewussten Helfer weiter unten (WP-IC-PAKET-1b, bens ROT-2).
async function existingVersions(koService: KoService): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const ko of await koService.list()) {
    for (const s of ko.sources ?? []) {
      if (s.externalId) {
        const v = s.sourceVersion ?? 0;
        out.set(s.externalId, Math.max(out.get(s.externalId) ?? 0, v));
      }
    }
  }
  return out;
}

// Bereits eingereihte, noch offene Kandidaten je (externalId@version) — verhindert Doppel-Einreihung
// bei einem Re-Run, BEVOR ein Kandidat geprüft wurde.
async function pendingKeys(library: LibraryService): Promise<Set<string>> {
  const out = new Set<string>();
  for (const c of await library.listImportCandidates()) {
    if (c.status === "neu" && c.item.externalId) {
      out.add(`${c.item.externalId}@${c.item.sourceVersion ?? 1}`);
    }
  }
  return out;
}

// ---- WP-IC-PAKET-1b (bens ROT-2): IC-6a-Status-Abgleich, versions- und quellrobust ----
//
// STATUS-SCHLÜSSEL: provider + externalId. Vertragslage geprüft: KoSource trägt provider (buildSource
// schreibt item.provider — für Confluence immer "Confluence") und der Kandidat trägt item.provider.
// Der Quell-Scope (spaceKey/sourceScope) bleibt BEWUSST draußen: eine Confluence-Seite kann den Space
// wechseln (gleiche pageId) — Scope im Schlüssel würde sie fälschlich als „nicht importiert" zeigen.
// Damit gilt der explizite, getestete Vertrag: externalId ist EINDEUTIG JE PROVIDER; ein zweiter
// Provider mit zufällig gleicher externalId erzeugt KEINEN falschen Status. Anker OHNE provider
// (theoretische Altdaten) sind keinem Provider zuordenbar und werden ehrlich NICHT gematcht.
export function importStatusKey(provider: string | null | undefined, externalId: string): string {
  return `${provider ?? ""}::${externalId}`;
}

// Merkt je Schlüssel die höchste EXPLIZITE Version — oder null, wenn (nur) versionslose Einträge
// existieren (Legacy): null zählt für „bereits importiert", NIE für „Quelle neuer".
function noteVersion(out: Map<string, number | null>, key: string, version: number | null): void {
  const prev = out.get(key);
  if (prev === undefined || (version !== null && (prev === null || version > prev))) {
    out.set(key, version);
  }
}

// Import-Status-Basis 1: KO-Herkunftsanker (provider-scoped, explizite Version oder null).
export async function importedAnchorVersions(
  koService: KoService,
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  for (const ko of await koService.list()) {
    for (const s of ko.sources ?? []) {
      if (!s.externalId) {
        continue;
      }
      const version = typeof s.sourceVersion === "number" ? s.sourceVersion : null;
      noteVersion(out, importStatusKey(s.provider, s.externalId), version);
    }
  }
  return out;
}

// Import-Status-Basis 2: OFFENE Kandidaten — MIT Version (bens ROT-2: offener Kandidat v1 + Quelle v2
// muss „bereits importiert" UND „Quelle neuer" ergeben, nicht nur ersteres).
export async function pendingCandidateVersions(
  library: LibraryService,
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  for (const c of await library.listImportCandidates()) {
    if (c.status !== "neu" || !c.item.externalId) {
      continue;
    }
    const version = typeof c.item.sourceVersion === "number" ? c.item.sourceVersion : null;
    noteVersion(out, importStatusKey(c.item.provider, c.item.externalId), version);
  }
  return out;
}

// Import-Status einer Quell-Seite — PURE Ableitung. `alreadyImported`, wenn KO-Anker ODER offener
// Kandidat denselben Status-Schlüssel tragen. `sourceNewer` NUR, wenn BEIDE Seiten eine EXPLIZITE
// Version haben (bens ROT-2: keine erfundene ?? 1/?? 0-Version mehr — fehlt eine Seite, KEIN Badge);
// verglichen wird gegen die höchste bekannte Version aus Anker UND offenen Kandidaten. Die
// Quell-Referenz führt kein Änderungsdatum, wohl aber die Versionsnummer; reine Anzeige, kein
// Update-Mechanismus (IC-6b offen).
export function importStatusFor(
  item: ImportItem,
  anchorVersions: ReadonlyMap<string, number | null>,
  pendingVersions: ReadonlyMap<string, number | null>,
): { alreadyImported: boolean; sourceNewer: boolean } {
  const id = item.externalId;
  if (!id) {
    return { alreadyImported: false, sourceNewer: false };
  }
  const key = importStatusKey(item.provider, id);
  const anchor = anchorVersions.get(key);
  const pending = pendingVersions.get(key);
  const alreadyImported = anchor !== undefined || pending !== undefined;
  const itemVersion = typeof item.sourceVersion === "number" ? item.sourceVersion : null;
  const known = [anchor, pending].filter((v): v is number => typeof v === "number");
  const knownMax = known.length > 0 ? Math.max(...known) : null;
  const sourceNewer = itemVersion !== null && knownMax !== null && itemVersion > knownMax;
  return { alreadyImported, sourceNewer };
}

export async function runConfluenceImport(deps: ConfluenceImportDeps): Promise<ImportRunSummary> {
  const { items, failed: collectFailed, truncated } = await deps.adapter.collectAll();
  const seen = await existingVersions(deps.koService);
  const pending = await pendingKeys(deps.library);

  const perPage: ImportRunSummary["perPage"] = [];
  const toQueue: ImportItem[] = [];
  // Parallel zu toQueue: der perPage-Index jedes eingereihten Items — für die ehrliche Nachkorrektur,
  // falls createImportCandidates (Parallelkonflikt / ON CONFLICT) weniger persistiert als eingereiht.
  const toQueuePerPageIdx: number[] = [];
  // SCRUM-510 (WP3): IN-RUN-Dedup. Dieselbe (externalId@version) darf innerhalb EINES Laufs nicht zweimal
  // eingereiht werden (die Quelle kann dieselbe Seite doppelt liefern; seen/pending kennen die gerade erst
  // in diesem Lauf eingereihten Items noch nicht). Der DB-UNIQUE-Index ist der atomare Backstop dahinter.
  const queuedKeys = new Set<string>();
  for (const item of items) {
    const ref = item.externalId ?? item.title;
    const version = item.sourceVersion ?? 1;
    const runKey = item.externalId ? `${item.externalId}@${version}` : null;
    if (runKey && queuedKeys.has(runKey)) {
      perPage.push({ ref, status: "skipped", note: "Dublette im selben Lauf (idempotent)" });
      continue;
    }
    const already = item.externalId ? seen.get(item.externalId) : undefined;
    const isPending = runKey ? pending.has(runKey) : false;
    // Idempotent überspringen, wenn diese-oder-neuere Version schon importiert wurde ODER bereits als
    // offener Kandidat für exakt diese Version eingereiht ist. Eine HÖHERE Version → erneut einreihen
    // (der acceptToKo-Upsert übernimmt beim Annehmen den Re-Sync, R4).
    if ((already !== undefined && already >= version) || isPending) {
      perPage.push({ ref, status: "skipped", note: "unverändert (idempotent)" });
      continue;
    }
    if (runKey) {
      queuedKeys.add(runKey);
    }
    toQueuePerPageIdx.push(perPage.length);
    perPage.push({ ref, status: "imported" });
    toQueue.push(item);
  }
  for (const f of collectFailed) {
    perPage.push({ ref: f.ref, status: "failed", note: f.error });
  }

  // SCRUM-510 (WP2-Batch3): EHRLICHE ZÄHLUNG. dryRun schreibt nichts → „würde einreihen" = toQueue.
  // Sonst zählt NUR, was createImportCandidates TATSÄCHLICH persistiert hat (insertIfAbsent liefert die
  // eingereihten Kandidaten zurück). Bei einem Parallelkonflikt (ON CONFLICT DO NOTHING) wird eine
  // eingereihte Seite NICHT persistiert → sie zählt NICHT als importiert (nie mehr toQueue.length blind).
  let imported = toQueue.length;
  if (!deps.dryRun && toQueue.length > 0) {
    const persisted = await deps.library.createImportCandidates(toQueue, deps.actor);
    imported = persisted.length;
    // perPage ehrlich nachziehen: eingereihte, aber nicht persistierte Seiten → skipped (Parallelkonflikt).
    const persistedKeys = new Set(persisted.map((c) => candidateKey(c.item)));
    for (let i = 0; i < toQueue.length; i++) {
      const candItem = toQueue[i];
      if (candItem && !persistedKeys.has(candidateKey(candItem))) {
        const idx = toQueuePerPageIdx[i];
        const entry = idx !== undefined ? perPage[idx] : undefined;
        if (entry) {
          entry.status = "skipped";
          entry.note = "Parallelkonflikt (bereits eingereiht)";
        }
      }
    }
  }

  return {
    dryRun: deps.dryRun,
    found: items.length,
    imported,
    // Alles Gesehene, das NICHT (real) importiert wurde: In-Run-/Idempotenz-Skips + Parallelkonflikte.
    skipped: items.length - imported,
    failed: collectFailed.length,
    truncated,
    perPage,
  };
}

// Der Dedup-/Vergleichsschlüssel eines Items: externalId@version (Anker) bzw. Titel (ankerlos). Muss zur
// In-Run-Dedup passen, damit die Persist-Nachkorrektur die richtigen perPage-Einträge trifft.
function candidateKey(item: ImportItem): string {
  return item.externalId ? `${item.externalId}@${item.sourceVersion ?? 1}` : `title:${item.title}`;
}
