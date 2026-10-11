// JOB 1042 D3: der Befundtyp wird NICHT neu aus dem Paket-Index geholt (index.ts liegt ausserhalb
// der Lease) und auch nicht hier nachgebaut — er wird aus dem bereits oeffentlichen `CollectResult`
// abgeleitet. Eine Wahrheit, kein zweiter Typ, keine Scopeerweiterung.
import type {
  CollectResult,
  ConfluenceImportItem,
  ConfluenceSourceAdapter,
} from "../../confluence";
import {
  type KnowledgeObject,
  type KoService,
  type KoSource,
  confidentialityRank,
  normalizeConfidentiality,
  safeSourceUrl,
} from "../../knowledge-object";
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
  // R-0163 (Bens Befunde 1–3): der Anhangsabgleich der BEREITS IMPORTIERTEN Seiten unveränderter
  // Version. Nur bei einem schreibenden Lauf gesetzt, und nur, wenn eine Seite Anhangsdaten trug.
  // Eine Seite, deren Abgleich nicht vollständig gelang (Fehler oder unvollständige Liste), steht
  // in `unvollstaendigeSeiten`, zählt in `failed` und macht den Lauf damit unvollständig.
  anhangsabgleich?: {
    seiten: number;
    uebernommen: number;
    ersetzt: number;
    nachgezogen: number;
    fehlgeschlagen: number;
    // Nacharbeit 7: übernommene Anhänge mit noch fehlendem Beleg / in diesem Lauf nachgetragene.
    belegOffen: number;
    belegNachgetragen: number;
    unvollstaendigeSeiten: string[];
  };
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
  // R-0159 (Befund F2): WARUM der Lauf vor dem letzten Cursor endete — Frist, Zeitbudget oder
  // Größe, samt hostfreier Meldung aus dem Client. Bis hierher kam er bis `collectAll` und wurde
  // HIER verworfen; der gespeicherte Lauf stand dann auf PARTIAL ohne Grund. Nur gesetzt, wenn der
  // Adapter ihn geliefert hat; die bereits gelesenen Seiten bleiben davon unberührt.
  abbruch?: NonNullable<CollectResult["abbruch"]>;
  perPage: { ref: string; status: ImportPageStatus; note?: string }[];
  // confluence-import-rechte (Nacharbeit 6, Befund F3): Seiten, deren Leserkreis NICHT vollständig
  // gelesen werden konnte (Gruppenabruf abgebrochen oder über der technischen Grenze). Ihre Leser
  // sind eine Untermenge der in der Quelle Berechtigten. Fehlt das Feld, gab es keine solche Seite.
  leserUnvollstaendig?: number;
  // R-0162: der Löschabgleich dieses Laufs (s. `quellAbgleich`). Additiv.
  sourceSync?: SourceSyncSummary;
}

/** Nacharbeit 6 (Befund F3): trägt der Eintrag den Vermerk „Leserkreis unvollständig gelesen"? */
function traegtUnvollstaendigeLeser(item: ImportItem): boolean {
  const rechte = (item as ImportItem & { readonly quellrechte?: unknown }).quellrechte;
  return (
    rechte !== null &&
    typeof rechte === "object" &&
    (rechte as { leserUnvollstaendig?: unknown }).leserUnvollstaendig === true
  );
}

/**
 * Nacharbeit 19 (Ben, K1): trägt der Eintrag die Marke „Leser nicht ermittelt" (die Prüfung je
 * Konto endete an der Seitengrenze)? Ein solcher Eintrag darf KEINE Rechte setzen — weder als neuer
 * Kandidat noch im Rechteabgleich eines bestehenden Objekts.
 */
export function traegtNichtErmittelteLeser(item: unknown): boolean {
  const rechte = (item as { readonly quellrechte?: unknown } | null)?.quellrechte;
  return (
    rechte !== null &&
    typeof rechte === "object" &&
    (rechte as { leserNichtErmittelt?: unknown }).leserNichtErmittelt === true
  );
}

// ================================================================================================
// R-0162 — ÄNDERUNGEN UND LÖSCHUNGEN NACHZIEHEN.
// ================================================================================================
//
// ÄNDERUNGEN liefen schon: eine höhere Quellversion wird erneut als Kandidat eingereiht, und das
// Annehmen revidiert das bestehende Objekt über den Anker (SCRUM-510 R4, acceptToKo).
//
// LÖSCHUNGEN blieben unbemerkt: eine aus der Quelle verschwundene Seite tauchte im Lauf einfach
// nicht mehr auf. Ab hier gilt diese Regel — vorläufig, bis eine fachliche Entscheidung eine
// andere Reaktion festlegt (s. docs/bestandsaufnahme-confluence-import.md, R-0162):
//
//   1. Geprüft wird NUR nach einem VOLLSTÄNDIGEN Lesen des Bereichs (nicht abgeschnitten, keine
//      gescheiterte Seite). Ein unvollständiger Lauf kann nicht wissen, was fehlt.
//   2. Kandidaten sind Anker DIESES Bereichs (Provider Confluence, gleicher Space), deren Seite im
//      Lauf nicht vorkam. Jede wird EINZELN bei der Quelle nachgefragt: nur eine 404 gilt als
//      gelöscht. Existiert die Seite noch (verschoben, anderer Bereich), wird sie als „außerhalb
//      des Bereichs" gemeldet und nicht vermerkt. Scheitert die Nachfrage: „nicht prüfbar".
//   3. Die Reaktion ist ein VERMERK am Herkunftsanker (`sourceRemovedAt`), protokolliert im
//      Audit. Das Wissensobjekt wird weder gelöscht noch revidiert noch herabgestuft — Wissen
//      verschwindet in Klara nie still, auch nicht, weil es in der Quelle verschwand.
//      ZUSAMMENFÜHRUNG (Nacharbeit 4): die maßgebliche Reaktion auf eine bestätigte Löschung ist
//      seither die des Abgleich-Auftrags (`reconcileRemovals`, Papierkorb, solange das Objekt keine
//      weitere Quelle trägt). Er läuft VOR diesem Abgleich; der Vermerk hier trifft deshalb nur
//      Objekte, die stehen geblieben sind.
//   4. Im Probelauf (dryRun) wird gemeldet, was vermerkt WÜRDE, und nichts geschrieben.
//   5. (Runde 3) „Gelöscht" heisst NUR: die Einzelnachfrage antwortete 404 (oder, seit der
//      Zusammenführung, ein ausdrücklicher Lösch-/Archivstatus — `adapter.isGoneAtSource`). Eine
//      Erfolgsantwort ohne brauchbare Seite wirft im Client (`getPageStateById`) und landet hier
//      als „nicht prüfbar" — ein unbekannter Zustand erzeugt nie einen Vermerk.
//   6. (Runde 3) Taucht eine vermerkte Seite wieder in der Bereichsliste auf, wird der Vermerk
//      aufgehoben — unabhängig von ihrer Version und auch nach einem unvollständigen Lesen (was
//      gelesen wurde, ist da). Der Rücklink wird damit wieder angeboten.

/** Höchstzahl der Einzelnachfragen je Lauf — ein Sicherheitsnetz gegen einen Abruf-Sturm. */
const MAX_LOESCHPRUEFUNGEN = 200;

export interface SourceSyncSummary {
  /** Wurde der Löschabgleich durchgeführt? */
  checked: boolean;
  /**
   * Warum nicht, falls nicht: die Quelle wurde nicht vollständig gelesen (`incomplete-read`), oder
   * der Adapter kann keine Löschungen nachfragen (`not-supported`, nur mit gescheitertem Nachzug).
   */
  reason?: "incomplete-read" | "not-supported";
  /** In der Quelle gelöscht (404 bestätigt): Quell-Id und die Wissensobjekte mit diesem Anker. */
  removed: { externalId: string; koIds: string[]; marked: boolean }[];
  /**
   * Runde 3: früher als gelöscht vermerkt, jetzt wieder in der Bereichsliste — der Vermerk wird
   * aufgehoben (`cleared`), auch ohne höhere Quellversion. Im Probelauf nur gemeldet.
   */
  restored: { externalId: string; koIds: string[]; cleared: boolean }[];
  /** Nicht mehr im Bereich, aber in der Quelle vorhanden — nicht vermerkt. */
  outsideScope: string[];
  /** Nachfrage gescheitert oder über der Höchstzahl — nicht vermerkt. */
  unchecked: string[];
  /**
   * R-0163 (Lauf 2): Seiten mit unveränderter Fassung, deren Anhänge sich geändert haben — die
   * Anhangsquellen am Objekt wurden angeglichen (`synced`; im Probelauf nur gemeldet).
   */
  attachmentsUpdated: {
    externalId: string;
    koId: string;
    added: string[];
    removed: string[];
    synced: boolean;
  }[];
  /**
   * R-0162/R-0549 (Lauf 3 R2): Seiten mit unveränderter Fassung, deren Leserestriktion in der
   * Quelle geändert wurde — Anker nachgezogen, Vertraulichkeit ggf. heraufgesetzt (`raisedTo`).
   */
  restrictionsUpdated: {
    externalId: string;
    koId: string;
    restrictionChanged: boolean;
    raisedTo: string | null;
    synced: boolean;
  }[];
  /**
   * Lauf 3 R2 (Bens B8): Seiten, deren Nachzug (Anhänge oder Restriktion) beim Schreiben scheiterte.
   * Nicht still: ein nicht leerer Wert macht den Lauf `PARTIAL` (`SOURCE_SYNC_INCOMPLETE`).
   */
  syncFailed: string[];
  /**
   * Lauf 3 R3 (Bens B9): gelesene Seiten, deren Anhangsliste NICHT vollständig übernommen werden
   * konnte (unbrauchbare Antwort, verworfene Einträge, Grenze der nachgeblätterten Seiten). Dort
   * entfernt die Annahme nichts — es können aber Anhänge fehlen. Eine Auskunft, kein Fehler des Laufs.
   */
  attachmentsIncomplete: string[];
}

/** Was der Nachzug unveränderter Seiten ergibt — ein Teil von `SourceSyncSummary`. */
type Nachzug = Pick<
  SourceSyncSummary,
  "attachmentsUpdated" | "restrictionsUpdated" | "syncFailed" | "attachmentsIncomplete"
>;

function istConfluenceAnbieter(provider: string | null | undefined): boolean {
  // Anker ohne Provider (Altbestand) zählen wie überall als Confluence (importSourceKey).
  const p = (provider ?? "").trim().toLowerCase();
  return p === "" || p === "confluence";
}

/** Runde 3: Anker mit Löschvermerk, deren Seite in diesem Lauf wieder gelesen wurde. */
async function wiederDa(
  deps: ConfluenceImportDeps,
  gesehen: ReadonlySet<string>,
): Promise<SourceSyncSummary["restored"]> {
  const treffer = new Map<string, { provider: string | null; koIds: string[] }>();
  for (const ko of await deps.koService.list()) {
    for (const s of ko.sources ?? []) {
      if (
        !s.externalId ||
        !s.sourceRemovedAt ||
        !istConfluenceAnbieter(s.provider) ||
        !gesehen.has(s.externalId)
      ) {
        continue;
      }
      const eintrag = treffer.get(s.externalId) ?? { provider: s.provider ?? null, koIds: [] };
      if (!eintrag.koIds.includes(ko.id)) {
        eintrag.koIds.push(ko.id);
      }
      treffer.set(s.externalId, eintrag);
    }
  }
  const out: SourceSyncSummary["restored"] = [];
  for (const [externalId, { provider, koIds }] of treffer) {
    let cleared = false;
    if (!deps.dryRun) {
      for (const koId of koIds) {
        const neu = await deps.koService.clearSourceRemoved(
          koId,
          { provider, externalId },
          deps.actor,
        );
        cleared = cleared || neu;
      }
    }
    out.push({ externalId, koIds, cleared });
  }
  return out;
}

/**
 * R-0163 (Lauf 2) und R-0162/R-0549 (Lauf 3 R2): unveränderte Seiten nachziehen — ihre Anhänge und
 * ihre Leserestriktion. Braucht kein vollständiges Lesen des Bereichs — jede gelesene Seite spricht
 * für sich; ob ihre Anhangsliste vollständig ist, trägt das Item selbst
 * (`sourceAttachmentsIncomplete`). Scheitert der Nachzug einer Seite, bricht der Lauf nicht ab, aber
 * die Seite steht in `syncFailed` (Bens B8) — nicht still.
 */
async function nachzug(
  deps: ConfluenceImportDeps,
  unveraendert: readonly ConfluenceImportItem[],
): Promise<Nachzug> {
  const out: Nachzug = {
    attachmentsUpdated: [],
    restrictionsUpdated: [],
    syncFailed: [],
    attachmentsIncomplete: [],
  };
  if (unveraendert.length === 0) {
    return out;
  }
  // Vorfilter aus EINEM Bestandslesen: nur Seiten, deren gelieferte Anhänge oder Restriktion vom
  // Stand am Objekt abweichen, gehen in die (je Seite teurere) Angleichung.
  const anhaenge = new Map<string, Set<string>>();
  const anker = new Map<string, { restriktion: string | null; stufe: string }>();
  for (const ko of await deps.koService.list()) {
    for (const s of ko.sources ?? []) {
      if (s.attachmentOf && s.attachment) {
        const key = importSourceKey(s.provider, s.attachmentOf);
        const set = anhaenge.get(key) ?? new Set<string>();
        set.add(
          anhangsSignatur(
            s.attachment.externalId,
            s.label,
            s.attachment.mime,
            s.attachment.size,
            s.url ?? null,
          ),
        );
        anhaenge.set(key, set);
      } else if (s.externalId) {
        anker.set(importSourceKey(s.provider, s.externalId), {
          restriktion: restriktionsForm(s.readRestriction),
          stufe: normalizeConfidentiality(ko.confidentiality),
        });
      }
    }
  }
  for (const item of unveraendert) {
    if (!item.externalId) {
      continue;
    }
    const key = importSourceKey(item.provider, item.externalId);
    const alt = anhaenge.get(key) ?? new Set<string>();
    const neu = new Set(
      (item.sourceAttachments ?? []).map((a) =>
        // Lauf 3 R2 (Bens B4): die Abrufadresse gehört zur Signatur — in derselben Form, in der sie
        // am Objekt steht (`safeSourceUrl`), sonst erreicht eine geänderte Adresse den Abgleich nie.
        anhangsSignatur(a.externalId, a.name, a.mime, a.size, safeSourceUrl(a.url)),
      ),
    );
    const anhangAbweichend =
      [...neu].some((sig) => !alt.has(sig)) ||
      (item.sourceAttachmentsIncomplete !== true && [...alt].some((sig) => !neu.has(sig)));
    const stand = anker.get(key);
    const restriktionAbweichend =
      stand !== undefined &&
      (stand.restriktion !== restriktionsForm(item.sourceReadRestriction) ||
        (item.confidentiality !== undefined &&
          confidentialityRank(item.confidentiality) >
            confidentialityRank(normalizeConfidentiality(stand.stufe))));
    if (anhangAbweichend) {
      try {
        const r = await deps.library.syncImportAttachments(item, deps.actor, {
          dryRun: deps.dryRun,
        });
        if (r) {
          out.attachmentsUpdated.push({ externalId: item.externalId, ...r, synced: !deps.dryRun });
        }
      } catch {
        out.syncFailed.push(item.externalId);
      }
    }
    if (restriktionAbweichend) {
      try {
        const r = await deps.library.syncImportRestriction(item, deps.actor, {
          dryRun: deps.dryRun,
        });
        if (r) {
          out.restrictionsUpdated.push({
            externalId: item.externalId,
            ...r,
            synced: !deps.dryRun,
          });
        }
      } catch {
        if (!out.syncFailed.includes(item.externalId)) {
          out.syncFailed.push(item.externalId);
        }
      }
    }
  }
  return out;
}

function restriktionsForm(r: { groups: string[]; users: string[] } | undefined): string | null {
  return r && (r.groups.length > 0 || r.users.length > 0)
    ? JSON.stringify([[...new Set(r.groups)].sort(), [...new Set(r.users)].sort()])
    : null;
}

function anhangsSignatur(
  externalId: string,
  name: string,
  mime: string | undefined,
  size: number | undefined,
  url: string | null,
): string {
  return JSON.stringify([externalId.trim(), name.trim(), mime ?? null, size ?? null, url]);
}

/**
 * Nacharbeit 6: die Antwort der Quelle auf die Einzelnachfrage zu EINER Seite in diesem Lauf —
 * `geloescht`/`vorhanden` aus `isGoneAtSource`, `unklar`, wenn die Nachfrage warf. Je Quell-Id.
 */
type QuellAntwort = "geloescht" | "vorhanden" | "unklar";
type QuellAuskunft = Map<string, QuellAntwort>;

async function quellAbgleich(
  deps: ConfluenceImportDeps,
  gesehen: ReadonlySet<string>,
  vollstaendig: boolean,
  nachgezogen: Nachzug,
  // Nacharbeit 6: die Antworten, die der R-0162-Abgleich in DIESEM Lauf schon erfragt hat.
  schonErfragt: ReadonlyMap<string, QuellAntwort> = new Map(),
): Promise<SourceSyncSummary | undefined> {
  // Runde 3: ein Adapter ohne Einzelnachfrage oder ohne Bereich (Attrappen, künftige Quellen)
  // kann GAR NICHT abgleichen — dieser Weg trägt dann keinen Abgleich, statt einen
  // „unvollständigen" zu behaupten. Der echte Confluence-Adapter kann beides.
  const adapter = deps.adapter as Partial<ConfluenceSourceAdapter>;
  const scope = adapter.sourceScope;
  // Zusammenführung mit R-0162 (main, `confluence-import-abgleich`): die Einzelnachfrage ist die
  // strenge Gegenprobe `isGoneAtSource` — NUR 404 oder ein ausdrücklicher Lösch-/Archivstatus heißt
  // „gelöscht"; eine unbrauchbare 2xx-Antwort WIRFT (→ `unchecked`). `fetchItem`/`getPageById`
  // werten eine solche Antwort seit main als „nicht vorhanden" und taugen dafür nicht mehr.
  if (typeof adapter.isGoneAtSource !== "function" || !scope) {
    // Lauf 3 R2 (Bens B8): ein gescheiterter Nachzug wird auch hier nicht verschluckt — dann trägt
    // der Lauf einen Abgleich, der ausdrücklich keiner über Löschungen ist.
    return nachgezogen.syncFailed.length > 0
      ? {
          checked: false,
          reason: "not-supported",
          removed: [],
          outsideScope: [],
          unchecked: [],
          restored: [],
          ...nachgezogen,
        }
      : undefined;
  }
  // Runde 3: wieder aufgetauchte Seiten zuerst — das braucht weder ein vollständiges Lesen noch
  // eine Einzelnachfrage, nur die Bereichsliste dieses Laufs.
  const restored = await wiederDa(deps, gesehen);
  const leer = { removed: [], outsideScope: [], unchecked: [], restored, ...nachgezogen };
  if (!vollstaendig) {
    return { checked: false, reason: "incomplete-read", ...leer };
  }
  // Anker dieses Bereichs, deren Seite im Lauf fehlte (bereits vermerkte zählen nicht erneut).
  const fehlend = new Map<string, { provider: string | null; koIds: string[] }>();
  for (const ko of await deps.koService.list()) {
    for (const s of ko.sources ?? []) {
      if (
        !s.externalId ||
        s.sourceRemovedAt ||
        s.spaceKey !== scope ||
        !istConfluenceAnbieter(s.provider) ||
        gesehen.has(s.externalId)
      ) {
        continue;
      }
      const eintrag = fehlend.get(s.externalId) ?? { provider: s.provider ?? null, koIds: [] };
      if (!eintrag.koIds.includes(ko.id)) {
        eintrag.koIds.push(ko.id);
      }
      fehlend.set(s.externalId, eintrag);
    }
  }
  const summary: SourceSyncSummary = {
    checked: true,
    removed: [],
    outsideScope: [],
    unchecked: [],
    restored,
    ...nachgezogen,
  };
  const at = new Date().toISOString();
  let nachfragen = 0;
  for (const [externalId, { provider, koIds }] of fehlend) {
    // Nacharbeit 6: hat der R-0162-Abgleich dieselbe Seite in diesem Lauf schon erfragt, gilt
    // seine Antwort — eine zweite Einzelnachfrage hätte nur dieselbe Antwort mit doppelter Last.
    const schon = schonErfragt.get(externalId);
    let nochDa: boolean;
    if (schon !== undefined) {
      if (schon === "unklar") {
        summary.unchecked.push(externalId);
        continue;
      }
      nochDa = schon === "vorhanden";
    } else {
      if (nachfragen >= MAX_LOESCHPRUEFUNGEN) {
        summary.unchecked.push(externalId);
        continue;
      }
      nachfragen += 1;
      try {
        nochDa = !(await adapter.isGoneAtSource(externalId));
      } catch {
        summary.unchecked.push(externalId);
        continue;
      }
    }
    if (nochDa) {
      summary.outsideScope.push(externalId);
      continue;
    }
    let marked = false;
    if (!deps.dryRun) {
      for (const koId of koIds) {
        const neu = await deps.koService.markSourceRemoved(
          koId,
          { provider, externalId },
          at,
          deps.actor,
        );
        marked = marked || neu;
      }
    }
    summary.removed.push({ externalId, koIds, marked });
  }
  return summary;
}

export interface ConfluenceImportDeps {
  adapter: ConfluenceSourceAdapter;
  library: LibraryService;
  koService: KoService;
  dryRun: boolean;
  actor: string;
  /**
   * R-0142 (Lauf 5): der Lauf, in dessen Namen eingereiht wird. Gesetzt bindet jeder Kandidat an
   * ihn (Quellrevision + Ordnung); die spätere Entscheidung schreibt die Elementreferenz.
   */
  importId?: string;
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
  const {
    items,
    failed: collectFailed,
    truncated,
    hierarchie,
    abbruch,
  } = await deps.adapter.collectAll();
  const seen = await existingVersions(deps.koService);
  const pending = await pendingKeys(deps.library);

  const perPage: ImportRunSummary["perPage"] = [];
  const toQueue: ImportItem[] = [];
  // Parallel zu toQueue: der perPage-Index jedes eingereihten Items — für die ehrliche Nachkorrektur,
  // falls createImportCandidates (Parallelkonflikt / ON CONFLICT) weniger persistiert als eingereiht.
  const toQueuePerPageIdx: number[] = [];
  // R-0163 (Lauf 2): bereits importierte Seiten in GENAU der Ankerfassung — ihre Anhänge werden
  // nach dem Einreihen angeglichen (`anhangsAbgleich`).
  const unveraendert: ConfluenceImportItem[] = [];
  // SCRUM-510 (WP3): IN-RUN-Dedup. Dieselbe (externalId@version) darf innerhalb EINES Laufs nicht zweimal
  // eingereiht werden (die Quelle kann dieselbe Seite doppelt liefern; seen/pending kennen die gerade erst
  // in diesem Lauf eingereihten Items noch nicht). Der DB-UNIQUE-Index ist der atomare Backstop dahinter.
  const queuedKeys = new Set<string>();
  // R-0163: bereits importierte Seiten unveränderter Version — sie gehen nicht in die Queue, ihre
  // Anhänge werden aber abgeglichen (s. unten). Offene Kandidaten gehören nicht dazu: deren Anhänge
  // kommen mit der Annahme.
  const abzugleichen: { item: ImportItem; perPageIdx: number }[] = [];
  // confluence-import-rechte (Ben, Nacharbeit 6, Befund F2): ALLE übersprungenen Seiten —
  // bereits importierte UND offen vorgemerkte — bekommen ihre frisch erhobenen Leserechte
  // nachgezogen. Confluence zählt die Seitenversion bei einer reinen Rechteänderung nicht hoch.
  const rechteAbzugleichen: { item: ImportItem; perPageIdx: number }[] = [];
  // Nacharbeit 6 (Befund F3): Seiten, deren Leserkreis nicht vollständig gelesen werden konnte.
  let leserUnvollstaendig = 0;
  // Seiten, deren Leserechte nicht abgeglichen bzw. nicht ermittelt wurden (je perPage-Index).
  const rechteGescheitert = new Set<number>();
  for (const item of items) {
    if (traegtUnvollstaendigeLeser(item)) {
      leserUnvollstaendig += 1;
    }
    const ref = item.externalId ?? item.title;
    // Nacharbeit 19 (Ben, K1): eine Seite, deren Leser NICHT ermittelt wurden, wird weder
    // eingereiht noch abgeglichen — sonst ersetzte eine nicht geprüfte, leere Liste die
    // gespeicherten Leser. Der bisherige Stand bleibt, die Seite zählt als gescheitert.
    if (traegtNichtErmittelteLeser(item)) {
      rechteGescheitert.add(perPage.length);
      perPage.push({
        ref,
        status: "failed",
        note: "Leserechte nicht ermittelt — nichts übernommen, der bisherige Stand bleibt.",
      });
      continue;
    }
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
      if (!isPending) {
        abzugleichen.push({ item, perPageIdx: perPage.length });
      }
      rechteAbzugleichen.push({ item, perPageIdx: perPage.length });
      perPage.push({ ref, status: "skipped", note: "unverändert (idempotent)" });
      if (already === version) {
        unveraendert.push(item);
      }
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
    // R-0163 (Ben, Nacharbeit 2): `collectAll` liefert die Seiten OHNE Anhangsliste — so bleibt die
    // Erkundung ohne Anhangsabrufe. Was hier wirklich eingereiht wird, bekommt seine Anhänge vorher,
    // je Seite nacheinander; sonst endete die Annahme ohne Anhang und ohne Anhangsaudit. Ein
    // Adapter ohne `withAttachments` (Fixture-Doppel) reiht unverändert ein. `dryRun` liest nichts nach.
    if (typeof deps.adapter.withAttachments === "function") {
      for (let i = 0; i < toQueue.length; i++) {
        const item = toQueue[i];
        if (item) {
          toQueue[i] = await deps.adapter.withAttachments(item);
        }
      }
    }
    // R-0142 (Lauf 5): die Kandidaten tragen die Kennung dieses Laufs (`laufbindung.ts`).
    const persisted = await deps.library.createImportCandidates(
      toQueue,
      deps.actor,
      undefined,
      deps.importId ? { lauf: { importId: deps.importId } } : {},
    );
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

  // ==============================================================================================
  // confluence-import-rechte (Ben, Nacharbeit 6, Befund F2) — DER RECHTEABGLEICH UNVERÄNDERTER SEITEN.
  // ==============================================================================================
  //
  // Eine Seite gleicher Version geht nicht erneut in die Queue — ihre Leserechte können sich
  // trotzdem geändert haben. `gleicheQuellrechteFuerAnkerAb` zieht sie am lebenden Objekt über den
  // geschützten Abgleich nach (`setQuellrechte`, Aktualitätsschutz) und an offenen Kandidaten
  // derselben Version. Scheitert das, ist die Seite NICHT abgeglichen — sie zählt als gescheitert,
  // und der Lauf sagt es, statt „unverändert" zu melden (der alte, womöglich offenere Stand bleibt).
  if (
    !deps.dryRun &&
    rechteAbzugleichen.length > 0 &&
    typeof deps.library.gleicheQuellrechteFuerAnkerAb === "function"
  ) {
    for (const { item, perPageIdx } of rechteAbzugleichen) {
      try {
        await deps.library.gleicheQuellrechteFuerAnkerAb(item, deps.actor);
      } catch {
        rechteGescheitert.add(perPageIdx);
        const entry = perPage[perPageIdx];
        if (entry) {
          entry.status = "failed";
          entry.note = "Leserechte nicht abgeglichen — der Lauf ist unvollständig.";
        }
      }
    }
  }

  // ==============================================================================================
  // R-0163 — DER ANHANGSABGLEICH BEREITS IMPORTIERTER SEITEN (Bens Befunde 1–3).
  // ==============================================================================================
  //
  // Eine Seite gleicher Version geht nicht erneut in die Queue — ihre Anhänge können sich trotzdem
  // geändert haben: ein neuer Anhang, eine neue Anhangsversion, oder nur ein neuer Abrufweg. Hier
  // wird je solcher Seite die Anhangsliste gelesen und am lebenden Wissensobjekt abgeglichen
  // (`LibraryService.gleicheAnhaengeFuerAnkerAb`). Nichts wird entfernt. Gelingt der Abgleich nicht
  // vollständig (Speicher-/Downloadfehler, unvollständige Liste), wird die Seite mit Grund als
  // `failed` geführt — der Lauf ist dann unvollständig und sagt es, statt „unverändert" zu melden.
  // `dryRun` liest nichts nach; ein Adapter ohne `withAttachments` (Fixture-Doppel) gleicht nicht ab.
  let anhangsabgleich: ImportRunSummary["anhangsabgleich"];
  let abgleichUnvollstaendig = 0;
  if (
    !deps.dryRun &&
    abzugleichen.length > 0 &&
    typeof deps.adapter.withAttachments === "function" &&
    typeof deps.library.gleicheAnhaengeFuerAnkerAb === "function"
  ) {
    const bilanz: NonNullable<ImportRunSummary["anhangsabgleich"]> = {
      seiten: 0,
      uebernommen: 0,
      ersetzt: 0,
      nachgezogen: 0,
      fehlgeschlagen: 0,
      belegOffen: 0,
      belegNachgetragen: 0,
      unvollstaendigeSeiten: [],
    };
    for (const { item, perPageIdx } of abzugleichen) {
      const entry = perPage[perPageIdx];
      let abgleich: Awaited<ReturnType<LibraryService["gleicheAnhaengeFuerAnkerAb"]>> | null;
      try {
        const mitAnhaengen = await deps.adapter.withAttachments(item);
        abgleich = await deps.library.gleicheAnhaengeFuerAnkerAb(mitAnhaengen, deps.actor);
      } catch {
        abgleich = null; // der Abgleich selbst ist gescheitert — die Seite ist nicht abgeglichen
      }
      if (abgleich === undefined) {
        continue; // keine Anhangsdaten oder kein lebendes Wissensobjekt — nichts abzugleichen
      }
      bilanz.seiten += 1;
      if (abgleich) {
        bilanz.uebernommen += abgleich.uebernommen;
        bilanz.ersetzt += abgleich.ersetzt;
        bilanz.nachgezogen += abgleich.nachgezogen;
        bilanz.fehlgeschlagen += abgleich.fehlgeschlagen;
        bilanz.belegOffen += abgleich.belegOffen;
        bilanz.belegNachgetragen += abgleich.belegNachgetragen;
      }
      if (
        abgleich === null ||
        abgleich.fehlgeschlagen > 0 ||
        abgleich.belegOffen > 0 ||
        abgleich.listeUnvollstaendig
      ) {
        // Nacharbeit 6: eine Seite, deren Rechteabgleich schon gescheitert ist, zählt nur einmal.
        if (!rechteGescheitert.has(perPageIdx)) {
          abgleichUnvollstaendig += 1;
        }
        bilanz.unvollstaendigeSeiten.push(item.externalId ?? item.title);
        if (entry) {
          entry.status = "failed";
          entry.note = anhangsNotiz(abgleich);
        }
        continue;
      }
      const geaendert =
        abgleich.uebernommen + abgleich.ersetzt + abgleich.nachgezogen + abgleich.belegNachgetragen;
      if (entry && geaendert > 0) {
        const belegZusatz =
          abgleich.belegNachgetragen > 0
            ? `, ${abgleich.belegNachgetragen} Beleg(e) nachgetragen`
            : "";
        entry.note = `Anhänge abgeglichen: ${abgleich.uebernommen} neu, ${abgleich.ersetzt} ersetzt, ${abgleich.nachgezogen} Abrufweg nachgezogen${belegZusatz}`;
      }
    }
    anhangsabgleich = bilanz;
  }

  // R-0162: Änderungen laufen oben über die höhere sourceVersion (neuer Kandidat → Re-Sync beim
  // Annehmen). Löschungen zieht der folgende Abgleich nach — nur bei VOLLSTÄNDIG gelesenem Space
  // und nur mit bekanntem Space: ohne ihn wäre jeder fremde oder scopelose Anker ein „Fehlender".
  // Nacharbeit 6: was dieser Abgleich je Seite bei der Quelle erfragt hat, merkt sich
  // `quellAuskunft` — der Quellabgleich danach fragt dieselbe Seite nicht ein zweites Mal.
  const quellAuskunft: QuellAuskunft = new Map();
  const removal =
    truncated || !deps.adapter.sourceScope
      ? {
          removed: 0,
          removalKept: 0,
          candidatesRejected: 0,
          removalOpen: 0,
          removalChecked: false,
        }
      : await reconcileRemovals(deps, items, collectFailed, perPage, quellAuskunft);

  // ZUSAMMENFÜHRUNG (Nacharbeit 4): die maßgebliche Reaktion auf eine bestätigte Löschung ist die
  // des Abgleich-Auftrags oben (Papierkorb, solange das Objekt keine weitere Quelle trägt). DANACH
  // läuft der Quellabgleich dieser Lieferung: er liest nur noch AKTIVE Objekte, vermerkt also nur
  // dort `sourceRemovedAt`, wo das Objekt stehen geblieben ist — damit sein Rücklink nichts mehr
  // verspricht (R-0131) —, hebt Vermerke wieder auf (Wiederauftauchen) und zieht Anhänge und
  // Leserestriktion unveränderter Seiten nach (s. `quellAbgleich`, `nachzug`).
  const sourceSync = await quellAbgleich(
    deps,
    new Set(items.map((i) => i.externalId).filter((id): id is string => !!id)),
    !truncated && collectFailed.length === 0,
    {
      ...(await nachzug(deps, unveraendert)),
      // Lauf 5 (Bens B9-Rest): der übernommene Zustand zählt, nicht das rohe Adapter-Item — auch
      // eine erst an der Eingangsgrenze entstandene Marke steht im Lauf.
      attachmentsIncomplete: items
        .filter((i) => deps.library.importAttachmentsIncomplete(i))
        .map((i) => i.externalId)
        .filter((id): id is string => !!id),
    },
    quellAuskunft,
  );

  return {
    dryRun: deps.dryRun,
    found: items.length,
    imported,
    // Alles Gesehene, das NICHT (real) importiert wurde: In-Run-/Idempotenz-Skips + Parallelkonflikte.
    // R-0163: eine Seite mit unvollständigem Anhangsabgleich zählt nicht mehr als übersprungen,
    // sondern als gescheitert.
    skipped: items.length - imported - abgleichUnvollstaendig - rechteGescheitert.size,
    failed: collectFailed.length + abgleichUnvollstaendig + rechteGescheitert.size,
    // Nacharbeit 6 (Befund F3): nur gesetzt, wenn es solche Seiten gibt — eine fehlende Angabe
    // heißt „alle Leserkreise vollständig gelesen".
    ...(leserUnvollstaendig > 0 ? { leserUnvollstaendig } : {}),
    truncated,
    // JOB 1042 D3: unveraendert durchgereicht — nur gesetzt, wenn der Adapter ihn geliefert hat.
    ...(hierarchie ? { hierarchie } : {}),
    ...(anhangsabgleich ? { anhangsabgleich } : {}),
    // R-0159 (F2): unverändert durchgereicht — nur gesetzt, wenn der Adapter ihn geliefert hat.
    ...(abbruch ? { abbruch } : {}),
    ...removal,
    perPage,
    ...(sourceSync ? { sourceSync } : {}),
  };
}

// R-0163: der verständliche Grund einer unvollständig abgeglichenen Seite — ohne Dateinamen und
// ohne Adresse, nur Zahlen und die Zusage, dass der Bestand bleibt.
function anhangsNotiz(
  abgleich: Awaited<ReturnType<LibraryService["gleicheAnhaengeFuerAnkerAb"]>> | null,
): string {
  if (!abgleich) {
    return "Anhangsabgleich gescheitert — vorhandene Anhänge bleiben unverändert erhalten";
  }
  const teile: string[] = [];
  if (abgleich.fehlgeschlagen > 0) {
    teile.push(`${abgleich.fehlgeschlagen} Anhang/Anhänge nicht übernommen`);
  }
  if (abgleich.belegOffen > 0) {
    // Nacharbeit 7: der Anhang IST übernommen — nur sein Beleg fehlt noch und wird nachgetragen.
    teile.push(`${abgleich.belegOffen} Beleg(e) zu übernommenen Anhängen offen`);
  }
  if (abgleich.listeUnvollstaendig) {
    teile.push("Anhangsliste der Quelle unvollständig");
  }
  return `Anhangsabgleich unvollständig (${teile.join(", ")}) — vorhandene Anhänge bleiben erhalten`;
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
  // Nacharbeit 6: nimmt je erfragter Seite die Antwort auf (s. `QuellAuskunft`).
  quellAuskunft?: QuellAuskunft,
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
      quellAuskunft?.set(entry.externalId, gone ? "geloescht" : "vorhanden");
    } catch (err) {
      quellAuskunft?.set(entry.externalId, "unklar");
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
