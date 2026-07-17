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
  found: number; // Seiten im Space gefunden
  imported: number; // NEUE Kandidaten (bei dryRun: würden eingereiht; sonst tatsächlich eingereiht)
  skipped: number; // idempotent übersprungen (unveränderte Version bereits im Bestand/Queue)
  failed: number; // Seiten, deren Verarbeitung scheiterte
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

export async function runConfluenceImport(deps: ConfluenceImportDeps): Promise<ImportRunSummary> {
  const { items, failed: collectFailed } = await deps.adapter.collectAll();
  const seen = await existingVersions(deps.koService);
  const pending = await pendingKeys(deps.library);

  const perPage: ImportRunSummary["perPage"] = [];
  const toQueue: ImportItem[] = [];
  for (const item of items) {
    const ref = item.externalId ?? item.title;
    const version = item.sourceVersion ?? 1;
    const already = item.externalId ? seen.get(item.externalId) : undefined;
    const isPending = item.externalId ? pending.has(`${item.externalId}@${version}`) : false;
    // Idempotent überspringen, wenn diese-oder-neuere Version schon importiert wurde ODER bereits als
    // offener Kandidat für exakt diese Version eingereiht ist. Eine HÖHERE Version → erneut einreihen
    // (der acceptToKo-Upsert übernimmt beim Annehmen den Re-Sync, R4).
    if ((already !== undefined && already >= version) || isPending) {
      perPage.push({ ref, status: "skipped", note: "unverändert (idempotent)" });
      continue;
    }
    perPage.push({ ref, status: "imported" });
    toQueue.push(item);
  }
  for (const f of collectFailed) {
    perPage.push({ ref: f.ref, status: "failed", note: f.error });
  }

  // dryRun: NICHTS schreiben (nur zählen/listen). Sonst: die neuen Items als Kandidaten einreihen.
  if (!deps.dryRun && toQueue.length > 0) {
    await deps.library.createImportCandidates(toQueue, deps.actor);
  }

  return {
    dryRun: deps.dryRun,
    found: items.length,
    imported: toQueue.length,
    skipped: items.length - toQueue.length,
    failed: collectFailed.length,
    perPage,
  };
}
