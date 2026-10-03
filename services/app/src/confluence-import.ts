// JOB 1042 D3: der Befundtyp wird NICHT neu aus dem Paket-Index geholt (index.ts liegt ausserhalb
// der Lease) und auch nicht hier nachgebaut — er wird aus dem bereits oeffentlichen `CollectResult`
// abgeleitet. Eine Wahrheit, kein zweiter Typ, keine Scopeerweiterung.
import type { CollectResult, ConfluenceSourceAdapter } from "../../confluence";
import type { KnowledgeObject, KoService, KoSource } from "../../knowledge-object";
import {
  type ImportCandidate,
  type ImportItem,
  type LibraryService,
  importSourceKey,
  isOpenReviewStatus,
} from "../../library-analytics";

// SCRUM-510 WP2: Orchestrierung des Space-Imports. Liest den GESAMTEN Space (paginiert), stellt jede
// Seite IDEMPOTENT als Review-Kandidaten in die bestehende Import-Queue (116/157) — REVIEW-INVARIANTE:
// KEINE stillen Auto-KOs, alles landet ausschließlich als Kandidat. Never block: eine fehlerhafte Seite
// wird als `failed` verbucht, der Lauf läuft weiter. Ehrliche Zusammenfassung je Seite.

// R-0162: "removed" = die Seite ist in der Quelle gelöscht und das Wissensobjekt wurde in den
// Papierkorb gelegt (bzw. würde es im Probelauf); "kept" = in der Quelle gelöscht, das Objekt
// bleibt aber, weil es weitere Quellen trägt oder zwischenzeitlich überarbeitet wurde.
export type ImportPageStatus = "imported" | "skipped" | "failed" | "removed" | "kept";

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
  // JOB 1042 D3: der Hierarchie-Befund des Sammellaufs, unverändert vom Adapter durchgereicht.
  // Er ist eine AUSKUNFT über die Elternketten der Quelle und beeinflusst keine der Zahlen
  // darüber — die fail-closed Regel für mangelhafte Ketten ist eine offene Ownerentscheidung
  // (Vollurteil zu D2, Korrekturpflicht 1). Bis sie getroffen ist, wird gemeldet, nicht gesperrt.
  //
  // WARUM ER BIS HIERHER REIST: Ein Befund, den nur der Adapter kennt, hilft niemandem. Dies ist
  // die Station, die ein Mensch nach einem Importlauf liest — der Urteilspunkt „SERVERINTERN,
  // Verluststelle gefunden, Zielwirkung offen" schliesst sich erst hier.
  hierarchie?: NonNullable<CollectResult["hierarchie"]>;
  // R-0162 (Abgleich): in der Quelle gelöschte Seiten, deren Wissensobjekt in den Papierkorb
  // gelegt wurde (bei dryRun: gelegt WÜRDE). Wiederherstellbar über den Papierkorb.
  removed: number;
  // R-0162: in der Quelle gelöscht, Objekt bleibt BEWUSST — es trägt weitere Quellen.
  removalKept: number;
  // R-0162 (Nacharbeit, bens Befund 4): OFFENE Importkandidaten einer in der Quelle gelöschten
  // Seite, die abgelehnt wurden (bei dryRun: abgelehnt WÜRDEN) — sonst entstünde aus dem
  // gespeicherten Item beim späteren Annehmen doch noch ein Wissensobjekt.
  candidatesRejected: number;
  // R-0162: Löschungen, die NICHT nachgezogen werden konnten — Gegenprobe gescheitert oder das
  // Objekt wurde zwischenzeitlich überarbeitet (STALE_WRITE). Je Seite in perPage; der Lauf ist
  // dann nicht vollständig (PARTIAL).
  removalOpen: number;
  // R-0162: false, wenn der Löschabgleich gar nicht lief — bei einem abgeschnittenen Lauf
  // (truncated) ist „fehlt in der Liste" kein Beleg für eine Löschung.
  removalChecked: boolean;
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
  const { items, failed: collectFailed, truncated, hierarchie } = await deps.adapter.collectAll();
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

  // R-0162: Änderungen laufen oben über die höhere sourceVersion (neuer Kandidat → Re-Sync beim
  // Annehmen). Löschungen zieht der folgende Abgleich nach — nur bei VOLLSTÄNDIG gelesenem Space
  // und nur mit bekanntem Space: ohne ihn wäre jeder fremde oder scopelose Anker ein „Fehlender".
  const removal =
    truncated || !deps.adapter.sourceScope
      ? {
          removed: 0,
          removalKept: 0,
          candidatesRejected: 0,
          removalOpen: 0,
          removalChecked: false,
        }
      : await reconcileRemovals(deps, items, collectFailed, perPage);

  return {
    dryRun: deps.dryRun,
    found: items.length,
    imported,
    // Alles Gesehene, das NICHT (real) importiert wurde: In-Run-/Idempotenz-Skips + Parallelkonflikte.
    skipped: items.length - imported,
    failed: collectFailed.length,
    truncated,
    // JOB 1042 D3: unveraendert durchgereicht — nur gesetzt, wenn der Adapter ihn geliefert hat.
    ...(hierarchie ? { hierarchie } : {}),
    ...removal,
    perPage,
  };
}

// ---- R-0162: LÖSCHUNGEN DER QUELLE BEIM NÄCHSTEN ABGLEICH NACHZIEHEN ----
//
// KANDIDAT: ein lebender KO-Herkunftsanker dieses Providers UND dieses Space, dessen externalId der
// vollständige Lauf nicht mehr gesehen hat (weder als Item noch als fehlgeschlagene Seite).
// GEGENPROBE: die Quelle wird je Id gefragt (adapter.isGoneAtSource) — fehlt die Seite nur in der
// Liste, liefert sie aber je Id noch, bleibt alles, wie es ist. Scheitert die Gegenprobe, wird
// nichts geändert und die Seite als offen gemeldet.
// WIRKUNG: das Wissensobjekt wandert in den PAPIERKORB (forceTrash, nie Endlöschung, mit
// expectedVersion) — wiederherstellbar, auditiert über ko.deleted. Trägt das Objekt weitere
// Quellen, bleibt es stehen ("kept"): es hat dann noch eine Grundlage außerhalb dieser Seite.
// OFFENE KANDIDATEN (Nacharbeit, bens Befund 4): auch ein noch nicht angenommener Kandidat dieses
// Providers und Space zählt — sein gespeichertes Item würde beim Annehmen sonst ohne erneuten
// Quellenabgleich zum Wissensobjekt. Nach bestätigter Löschung wird ein Kandidat im Status "neu"
// über den regulären Review-Weg ABGELEHNT (reviewedBy = Akteur des Laufs, Audit
// import.candidate-reject); ein gerade bearbeiteter ("in_bearbeitung") bleibt unberührt und offen.
// dryRun schreibt nichts und meldet nur, was nachgezogen würde.
async function reconcileRemovals(
  deps: ConfluenceImportDeps,
  items: readonly ImportItem[],
  collectFailed: CollectResult["failed"],
  perPage: ImportRunSummary["perPage"],
): Promise<{
  removed: number;
  removalKept: number;
  candidatesRejected: number;
  removalOpen: number;
  removalChecked: true;
}> {
  const provider = deps.adapter.source;
  const scope = deps.adapter.sourceScope;
  // Der Schlüssel eines Ankers, der zu DIESEM Lauf gehört (Provider + Space), sonst null.
  const ownAnchorKey = (
    anchorProvider: string | null | undefined,
    externalId: string | undefined,
    anchorScope: string | undefined,
  ): string | null => {
    if (!externalId || anchorScope !== scope) {
      return null;
    }
    const key = importSourceKey(anchorProvider, externalId);
    return key === importSourceKey(provider, externalId) ? key : null;
  };
  const ownKey = (s: KoSource): string | null => ownAnchorKey(s.provider, s.externalId, s.spaceKey);
  const seenKeys = new Set<string>();
  for (const item of items) {
    if (item.externalId) {
      seenKeys.add(importSourceKey(item.provider ?? provider, item.externalId));
    }
  }
  for (const f of collectFailed) {
    seenKeys.add(importSourceKey(provider, f.ref));
  }

  // Je fehlender Seite die betroffenen Objekte (ein Anker kann — etwa nach einer Zusammenführung —
  // an mehr als einem Objekt hängen).
  type Fehlend = { externalId: string; kos: KnowledgeObject[]; candidates: ImportCandidate[] };
  const missing = new Map<string, Fehlend>();
  const eintrag = (key: string, externalId: string): Fehlend => {
    const vorhanden = missing.get(key);
    if (vorhanden) {
      return vorhanden;
    }
    const neu: Fehlend = { externalId, kos: [], candidates: [] };
    missing.set(key, neu);
    return neu;
  };
  for (const ko of await deps.koService.list()) {
    for (const s of ko.sources ?? []) {
      const key = ownKey(s);
      if (!key || !s.externalId || seenKeys.has(key)) {
        continue;
      }
      const entry = eintrag(key, s.externalId);
      if (!entry.kos.includes(ko)) {
        entry.kos.push(ko);
      }
    }
  }
  for (const c of await deps.library.listImportCandidates()) {
    if (!isOpenReviewStatus(c.status) || !c.item.externalId) {
      continue;
    }
    const key = ownAnchorKey(c.item.provider, c.item.externalId, c.item.sourceScope);
    if (!key || seenKeys.has(key)) {
      continue;
    }
    eintrag(key, c.item.externalId).candidates.push(c);
  }

  let removed = 0;
  let removalKept = 0;
  let candidatesRejected = 0;
  let removalOpen = 0;
  const goneKeys = new Set<string>();
  const checks: Fehlend[] = [];
  for (const [key, entry] of missing) {
    let gone: boolean;
    try {
      gone = await deps.adapter.isGoneAtSource(entry.externalId);
    } catch (err) {
      removalOpen += 1;
      perPage.push({
        ref: entry.externalId,
        status: "failed",
        note: `Löschprüfung nicht möglich (${err instanceof Error ? err.name : "unknown"}) — nichts geändert`,
      });
      continue;
    }
    if (gone) {
      goneKeys.add(key);
      checks.push(entry);
    }
  }

  // Offene Kandidaten gelöschter Seiten: ablehnen, damit kein späteres Annehmen sie übernimmt.
  for (const { externalId, candidates } of checks) {
    for (const c of candidates) {
      if (c.status !== "neu") {
        removalOpen += 1;
        perPage.push({
          ref: externalId,
          status: "failed",
          note: "in der Quelle gelöscht — Importkandidat wird gerade bearbeitet, nicht abgelehnt",
        });
        continue;
      }
      if (deps.dryRun) {
        candidatesRejected += 1;
        perPage.push({
          ref: externalId,
          status: "removed",
          note: "in der Quelle gelöscht — offener Importkandidat würde abgelehnt",
        });
        continue;
      }
      try {
        await deps.library.reviewImportCandidate(c.id, "reject", deps.actor);
        candidatesRejected += 1;
        perPage.push({
          ref: externalId,
          status: "removed",
          note: "in der Quelle gelöscht — offener Importkandidat abgelehnt",
        });
      } catch (err) {
        removalOpen += 1;
        perPage.push({
          ref: externalId,
          status: "failed",
          note: `in der Quelle gelöscht — Importkandidat nicht abgelehnt (${err instanceof Error ? err.name : "unknown"})`,
        });
      }
    }
  }

  // Ein Objekt mit mehreren gelöschten Ankern wird genau einmal behandelt.
  const handled = new Set<string>();
  for (const { externalId, kos } of checks) {
    for (const ko of kos) {
      if (handled.has(ko.id)) {
        continue;
      }
      handled.add(ko.id);
      const weitereQuellen = (ko.sources ?? []).some((s) => {
        const key = ownKey(s);
        return !key || !goneKeys.has(key);
      });
      if (weitereQuellen) {
        removalKept += 1;
        perPage.push({
          ref: externalId,
          status: "kept",
          note: "in der Quelle gelöscht — Wissensobjekt trägt weitere Quellen und bleibt",
        });
        continue;
      }
      if (deps.dryRun) {
        removed += 1;
        perPage.push({
          ref: externalId,
          status: "removed",
          note: "in der Quelle gelöscht — würde in den Papierkorb gelegt",
        });
        continue;
      }
      try {
        await deps.koService.delete(ko.id, deps.actor, {
          forceTrash: true,
          expectedVersion: ko.version,
        });
        removed += 1;
        perPage.push({
          ref: externalId,
          status: "removed",
          note: "in der Quelle gelöscht — Wissensobjekt in den Papierkorb gelegt",
        });
      } catch (err) {
        removalOpen += 1;
        perPage.push({
          ref: externalId,
          status: "kept",
          note: `in der Quelle gelöscht — nicht nachgezogen (${err instanceof Error ? err.name : "unknown"})`,
        });
      }
    }
  }
  return { removed, removalKept, candidatesRejected, removalOpen, removalChecked: true };
}

// Der Dedup-/Vergleichsschlüssel eines Items: provider@externalId@version (Anker, bens F3) bzw.
// Titel (ankerlos). Muss zur In-Run-Dedup passen, damit die Persist-Nachkorrektur die richtigen
// perPage-Einträge trifft.
function candidateKey(item: ImportItem): string {
  return item.externalId
    ? `${importSourceKey(item.provider, item.externalId)}@${item.sourceVersion ?? 1}`
    : `title:${item.title}`;
}
