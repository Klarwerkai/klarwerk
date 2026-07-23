import type { ConfluenceSourceAdapter } from "../../confluence";
import type { KoService } from "../../knowledge-object";
import {
  type ImportItem,
  type LibraryService,
  importSourceKey,
  isOpenReviewStatus,
} from "../../library-analytics";

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

// Höchste bereits importierte sourceVersion je provider+externalId (aus den KO-Herkunftsankern).
// NUR für die Import-Idempotenz (runConfluenceImport) — der IC-6a-STATUS-Abgleich nutzt die
// versions- und provider-bewussten Helfer weiter unten (WP-IC-PAKET-1b, bens ROT-2).
// WP-SHIP8-FIX (bens F3): DURCHGÄNGIG provider+externalId (importProviderKey) — eine Jira-Id, die
// zufällig einer Confluence-pageId gleicht, wird nie fälschlich als „bereits importiert" gewertet.
async function existingVersions(koService: KoService): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const ko of await koService.list()) {
    for (const s of ko.sources ?? []) {
      if (s.externalId) {
        const key = importSourceKey(s.provider, s.externalId);
        const v = s.sourceVersion ?? 0;
        out.set(key, Math.max(out.get(key) ?? 0, v));
      }
    }
  }
  return out;
}

// Bereits eingereihte, noch offene Kandidaten je (provider@externalId@version) — verhindert
// Doppel-Einreihung bei einem Re-Run, BEVOR ein Kandidat geprüft wurde (bens F3: provider-scoped,
// deckungsgleich mit openCandidateKey/dem Pg-Unique-Index).
// WP-SHIP8-CLOSE-3 (bens ROT-2): OFFEN heißt 'neu' ODER 'in_bearbeitung' (isOpenReviewStatus) —
// ein gerade geclaimter Kandidat blockiert die Doppel-Einreihung weiter.
async function pendingKeys(library: LibraryService): Promise<Set<string>> {
  const out = new Set<string>();
  for (const c of await library.listImportCandidates()) {
    if (isOpenReviewStatus(c.status) && c.item.externalId) {
      out.add(
        `${importSourceKey(c.item.provider, c.item.externalId)}@${c.item.sourceVersion ?? 1}`,
      );
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
// Provider mit zufällig gleicher externalId erzeugt KEINEN falschen Status.
// WP-NIGHT-FIX (bens F3-Rest): der Schlüssel kommt jetzt aus dem ZENTRALEN importSourceKey
// (Normalisierung trim+lowercase am Provider — "Confluence"/" confluence " sind derselbe Schlüssel).
// Damit zählen Anker OHNE Provider (Altdaten) wie überall sonst (Queue, acceptToKo, Pg-Backfill)
// als Confluence — die frühere Sonderregel „ohne Provider matcht nie" widersprach dem Backfill.
export function importStatusKey(provider: string | null | undefined, externalId: string): string {
  return importSourceKey(provider, externalId);
}

// WP-IC-PAKET-1c (bens ROT-3): EINE gemeinsame Normalisierung für ALLE drei Versions-Eingänge des
// Status-Abgleichs (Anker-, Kandidaten-, Quellversion). Nur eine POSITIVE SICHERE GANZZAHL gilt als
// explizite Version; alles andere — 0, negativ, gebrochen, NaN, Infinity, undefined, null, Fremdtyp —
// ist ehrlich "keine Version" (null) und kann damit NIE ein „Quelle neuer"-Signal erzeugen (bens
// Fehlfall: Anker sourceVersion=0 + Quelle v1 ergab vorher fälschlich sourceNewer).
export function normalizeSourceVersion(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
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
      noteVersion(
        out,
        importStatusKey(s.provider, s.externalId),
        normalizeSourceVersion(s.sourceVersion),
      );
    }
  }
  return out;
}

// Import-Status-Basis 2: OFFENE Kandidaten — MIT Version (bens ROT-2: offener Kandidat v1 + Quelle v2
// muss ein Kennzeichen UND „Quelle neuer" ergeben, nicht nur ersteres).
// WP-SHIP8-CLOSE-3 (bens ROT-2): OFFEN heißt 'neu' ODER 'in_bearbeitung' — die Statuskarte zeigt
// eine Quelle WÄHREND der laufenden Review-Aktion weiter als gekennzeichnet.
// WP-SHIP9-S1b (bens GELB, Trennung der Semantik): diese Basis speist NUR noch das EIGENE
// Kennzeichen „bereits zur Prüfung vorgemerkt" (alreadyQueued in importStatusFor), NIE mehr
// „bereits importiert". Der S1-Filter (Skip bei getrashtem Zielobjekt) ist damit ÜBERFLÜSSIG und
// bewusst entfernt: ein offener Kandidat ist unabhängig vom Papierkorb-/Purge-Zustand seines
// Ziels wahrhaftig „vorgemerkt" — der Queue-Schutz (nicht doppelt einreihbar) bleibt vollständig,
// nur die Bezeichnung ist ehrlich. Kein Tombstone nötig, der Hard-Purge-Fall löst sich von selbst.
export async function pendingCandidateVersions(
  library: LibraryService,
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  for (const c of await library.listImportCandidates()) {
    if (!isOpenReviewStatus(c.status) || !c.item.externalId) {
      continue;
    }
    noteVersion(
      out,
      importStatusKey(c.item.provider, c.item.externalId),
      normalizeSourceVersion(c.item.sourceVersion),
    );
  }
  return out;
}

// Import-Status einer Quell-Seite — PURE Ableitung. WP-SHIP9-S1b (bens GELB): die beiden Basen
// sind jetzt ZWEI GETRENNTE Kennzeichen. `alreadyImported` kommt AUSSCHLIESSLICH aus einem
// LEBENDEN KO-Herkunftsanker (importedAnchorVersions liest koService.list(), Papierkorb außen
// vor) — ein offener Kandidat allein macht NIEMALS mehr „bereits importiert". `alreadyQueued`
// heißt: ein OFFENER Kandidat (neu/in_bearbeitung) trägt denselben Status-Schlüssel — „bereits
// zur Prüfung vorgemerkt", auch wenn sein Zielobjekt getrasht oder hart gepurgt wurde (wahr,
// weil der Kandidat weiter in der Review-Queue liegt). `sourceNewer` NUR, wenn BEIDE Seiten eine
// EXPLIZITE Version haben (bens ROT-2: keine erfundene ?? 1/?? 0-Version mehr — fehlt eine Seite,
// KEIN Badge); verglichen wird gegen die höchste bekannte Version aus Anker UND offenen
// Kandidaten. Reine Anzeige, kein Update-Mechanismus (IC-6b offen).
export function importStatusFor(
  item: ImportItem,
  anchorVersions: ReadonlyMap<string, number | null>,
  pendingVersions: ReadonlyMap<string, number | null>,
): { alreadyImported: boolean; alreadyQueued: boolean; sourceNewer: boolean } {
  const id = item.externalId;
  if (!id) {
    return { alreadyImported: false, alreadyQueued: false, sourceNewer: false };
  }
  const key = importStatusKey(item.provider, id);
  const anchor = anchorVersions.get(key);
  const pending = pendingVersions.get(key);
  const alreadyImported = anchor !== undefined;
  const alreadyQueued = pending !== undefined;
  const itemVersion = normalizeSourceVersion(item.sourceVersion);
  const known = [anchor, pending].filter((v): v is number => typeof v === "number");
  const knownMax = known.length > 0 ? Math.max(...known) : null;
  const sourceNewer = itemVersion !== null && knownMax !== null && itemVersion > knownMax;
  return { alreadyImported, alreadyQueued, sourceNewer };
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
    // bens F3: In-Run-/Pending-/Bestands-Schlüssel sind provider-scoped (wie die Queue selbst).
    const runKey = item.externalId
      ? `${importSourceKey(item.provider, item.externalId)}@${version}`
      : null;
    if (runKey && queuedKeys.has(runKey)) {
      perPage.push({ ref, status: "skipped", note: "Dublette im selben Lauf (idempotent)" });
      continue;
    }
    const already = item.externalId
      ? seen.get(importSourceKey(item.provider, item.externalId))
      : undefined;
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

// Der Dedup-/Vergleichsschlüssel eines Items: provider@externalId@version (Anker, bens F3) bzw.
// Titel (ankerlos). Muss zur In-Run-Dedup passen, damit die Persist-Nachkorrektur die richtigen
// perPage-Einträge trifft.
function candidateKey(item: ImportItem): string {
  return item.externalId
    ? `${importSourceKey(item.provider, item.externalId)}@${item.sourceVersion ?? 1}`
    : `title:${item.title}`;
}
