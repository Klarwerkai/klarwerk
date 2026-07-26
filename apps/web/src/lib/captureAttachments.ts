// SCRUM-374 / AG-02-SESSION / FR-STR-02: Robuster, ehrlicher Anhang-Upload für Capture. Nach dem
// Speichern des Wissensobjekts werden Bilder/Dateien in den Object-Store gelegt und am KO referenziert.
// Bisher war das eine ungeschützte Schleife: EIN fehlgeschlagener Upload/Attach ließ die GESAMTE Mutation
// scheitern — der Nutzer sah nur einen Fehler, obwohl das KO bereits (offen) gespeichert war.
//
// Dieser DOM-freie Helfer entkoppelt „KO gespeichert" von „Anhang gespeichert": jede Datei wird EINZELN
// versucht; Teilfehler werden gesammelt (Dateiname + Grund) statt den ganzen Save zu kippen. Wichtig:
//  - Schlägt der Object-Upload fehl, wird NICHT attached (kein Fake-/Halb-Anhang, keine erfundene objectId).
//  - Nur nach erfolgreichem Upload wird die Objekt-Referenz als Anhang gesetzt.
//  - Evidence/Anhang bleibt Beleg — er verändert NIE Status/Trust/Validierung.
// Reine Ablauf-/Datenlogik mit injizierter API → testbar ohne DOM, ohne echten Object-Store, ohne Backend.

export type AttachmentKind = "image" | "document";

export interface AttachmentUploadItem {
  name: string;
  mime: string;
  data: string; // Original-Daten-URL (geht in den Object-Store, NICHT in den KO-Body)
  kind: AttachmentKind;
  thumbnail?: string; // kleine Vorschau (nur Bilder)
  // AUFTRAG-mega17 Block A-2: LOKALER Schlüssel dieses Anhangs. Er reist NICHT zum Server. Er ist
  // die Brücke zwischen „das Dokument, aus dem der Inhalt übernommen wurde" (beim Erfassen bekannt,
  // lange bevor ein Wissensobjekt existiert) und der ECHTEN objectId, die erst der Attach in Phase B
  // liefert. Quellenvermerke, die auf diesen Schlüssel zeigen, bekommen genau diese objectId als
  // ANKER — nicht mehr `undefined`, an dem sie auf der Vorgabestufe stumm scheiterten.
  anchorKey?: string;
}

// Vom Object-Store zurückgegebene Referenz (nur die hier benötigten Felder).
export interface UploadedObjectRef {
  id: string;
  size?: number;
}

// Injizierte API — im Produktivcode die echten Endpunkte, im Test Fakes.
export interface AttachmentUploadApi {
  upload(input: {
    name: string;
    mime: string;
    data: string;
    kind: AttachmentKind;
    // AUFTRAG-mega20 Block C: WOZU wird hochgeladen (s. services/object-store/src/types.ts).
    purpose?: "anchor" | "attachment" | "media" | "example";
  }): Promise<UploadedObjectRef>;
  attach(
    koId: string,
    attachment: {
      name: string;
      mime: string;
      objectId: string;
      thumbnail?: string;
      size?: number;
    },
  ): Promise<unknown>;
}

// WP-D2: „too-large" gesondert — der Nutzer soll wissen, dass die DATEI zu groß war (Limit), nicht
// dass „etwas schiefging". Der Text-Import bleibt davon unberührt.
// AUFTRAG-mega17 Block A-2: „provenance" gesondert — das ist KEIN Anhangsfehler. Der Inhalt ist im
// Wissensobjekt, der zugehörige HERKUNFTSVERMERK fehlt. Ein Produkt mit dem Satz „Beweispflicht statt
// Plausibilität" darf diesen Fall nicht als allgemeines „Anhang fehlgeschlagen" verkleiden.
// AUFTRAG-mega18 Block A-3: „unclear" gesondert — der dritte, bis mega17 gar nicht darstellbare
// Ausgang. Er bedeutet NICHT „fehlgeschlagen", sondern „der Server hat nicht geantwortet, es kann
// vollzogen sein oder nicht". Ihn als Fehler zu verkaufen wäre dieselbe Unwahrheit wie ihn als
// Erfolg zu verkaufen; beides hat mega17 an dieser Stelle getan.
export type AttachmentFailureReason = "upload" | "attach" | "too-large" | "provenance" | "unclear";

// WP-D2: Upload-Fehler klassifizieren — 413 (Route-bodyLimit) oder die Objekt-/Anhang-Größenmeldungen
// des Servers gelten als „zu groß"; alles andere bleibt generisch „upload". Reines Ducktyping, damit
// der Helfer DOM- und API-Client-frei testbar bleibt.
export function classifyUploadError(error: unknown): "too-large" | "upload" {
  const status =
    error && typeof error === "object" && "status" in error
      ? Number((error as { status: unknown }).status)
      : Number.NaN;
  if (status === 413) {
    return "too-large";
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /zu groß|too large|body limit|larger than/i.test(message) ? "too-large" : "upload";
}

export interface AttachmentFailure {
  name: string;
  reason: AttachmentFailureReason;
}

export interface AttachmentUploadResult {
  // Wie viele Anhänge sind vollständig (Upload + Attach) gesichert?
  attached: number;
  // Welche Dateien konnten NICHT gesichert werden (mit Grund)?
  failed: AttachmentFailure[];
  hasFailures: boolean;
}

// Lädt alle Anhänge einzeln hoch und referenziert sie am KO. Kein Teilfehler kippt den Gesamt-Save.
export async function uploadAttachments(
  koId: string,
  items: readonly AttachmentUploadItem[],
  api: AttachmentUploadApi,
): Promise<AttachmentUploadResult> {
  let attached = 0;
  const failed: AttachmentFailure[] = [];
  for (const item of items) {
    let ref: UploadedObjectRef;
    try {
      ref = await api.upload({
        name: item.name,
        mime: item.mime,
        data: item.data,
        kind: item.kind,
      });
    } catch (error) {
      // Kein Object → NICHT attachen (keine erfundene objectId, kein Halb-Anhang).
      // WP-D2: „zu groß" wird vom generischen Upload-Fehler unterschieden (ehrliche Ursache).
      failed.push({ name: item.name, reason: classifyUploadError(error) });
      continue;
    }
    try {
      await api.attach(koId, {
        name: item.name,
        mime: item.mime,
        objectId: ref.id,
        ...(item.thumbnail ? { thumbnail: item.thumbnail } : {}),
        ...(ref.size != null ? { size: ref.size } : {}),
      });
      attached += 1;
    } catch {
      failed.push({ name: item.name, reason: "attach" });
    }
  }
  return { attached, failed, hasFailures: failed.length > 0 };
}

// WP-D2 („Original ist heilig"): die hochgeladene QUELLDATEI selbst als Anhang mitführen. Das Original
// wird höchstens EINMAL in den Object-Store geladen (cache — die Punkte-Queue erzeugt mehrere KOs, alle
// referenzieren dieselbe objectId); je Ziel-KO folgt nur noch der attach. Scheitert etwas, bleibt der
// Text-Import unberührt — der Fehler wird mit ehrlichem Grund (too-large/upload/attach) gemeldet.
export interface OriginalDocument {
  name: string;
  mime: string;
  data: string; // Original-Daten-URL
}

export interface OriginalRefCache {
  ref: UploadedObjectRef | null;
}

// AUFTRAG-mega18 Block A-3: `attachOriginalDocument` ist ENTFALLEN. Sie war der Griff „Original
// hochladen UND ans KO hängen" und wurde von BodyExtractPanel und AppendToArticleModal genutzt, um
// den Anker VOR den Belegen zu erzeugen — zwei Schreibvorgänge, zwischen denen ein Fehlschlag einen
// Teilzustand hinterließ, und mit einem Rückgabewert (`attached: false`), den beide Aufrufer
// ignorieren KONNTEN und im Fall von BodyExtractPanel auch ignoriert haben. Beide Wege laden das
// Original jetzt nur noch hoch (`endpoints.objects.upload`); das BINDEN ans Wissensobjekt macht die
// Verbund-Operation, gemeinsam mit Belegen und Inhalt, in EINEM Schreibvorgang.

// WP-D7b (Rot-Fix 1): ungefähre Byte-Größe einer Original-Daten-URL (data:...;base64,XXXX). base64 bläht
// ~4/3 auf; die reale Objektgröße ist BODY.length * 3/4 minus Padding. Nur für den ehrlichen Fortschritts-
// Text („… wird gesichert (3,2 MB) …") — keine exakte Bilanz nötig. Nicht-base64-URLs → 0 (kein Rätselraten).
export function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0 || !/;base64/i.test(dataUrl.slice(0, comma))) {
    return 0;
  }
  const body = dataUrl.slice(comma + 1);
  const padding = body.endsWith("==") ? 2 : body.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((body.length * 3) / 4) - padding);
}

// WP-D7c (bens D7b-ROT-Fix): Der Submit muss ZWEI Phasen sauber trennen. Kostentreiber-Diagnose bleibt: die
// base64-Object-Uploads sind mehrere MB und sollen PARALLEL laufen. ABER die anschließenden KO-Mutationen
// (attach/add-source) sind KEINE unabhängigen Operationen: der Server (KnowledgeObjectService.addAttachment/
// addSource) liest jeweils das GANZE KO und schreibt per Compare-and-Set auf rowVersion OHNE Lock/Retry/Merge
// (services/knowledge-object/src/repo.ts). Überlappende Writer mit derselben gelesenen rowVersion → STALE_WRITE.
// Die D7b-Parallelisierung ALLER vier Zweige erzeugte damit SELBSTVERSCHULDETE Fehler an gültigen Teilops
// (Objekt hochgeladen, aber Attach scheitert → verwaistes Objekt + unnötiger Teilfehler). Kleinste sichere
// Lösung (KEIN Server-Umbau): Uploads parallel (Phase A), KO-Writes strikt seriell (Phase B).
export interface CaptureFinalizeResult {
  attached: number;
  failed: AttachmentFailure[];
}

// WP-D7d (bens D7c-ROT-Fix): Phase A braucht eine PARALLELITÄTSGRENZE. Ohne Pool schickte ein normaler
// Submit bis zu ~30 Anhänge à 30 MB (Admin-Limit, upload-limits.ts) GLEICHZEITIG als base64-JSON-Bodies
// (OBJECTS_BODY_LIMIT 30 MiB je POST) — ~1 GB gleichzeitiges Body-Parsing: Browser-/Proxy-/Node-Speicher-
// druck bis OOM-Kante. Ein kleiner fester Pool behält den Latenzgewinn (Überlappung) und deckelt die
// gleichzeitigen Transfers. Der ORIGINAL-Upload zählt MIT in dieses Limit (gemeinsamer Pool, nicht Pool+1).
export const UPLOAD_POOL_LIMIT = 3;

// Mini-Semaphore ohne neue Dependency: max. `limit` Tasks gleichzeitig, Rest wartet in FIFO-Reihenfolge.
// Fehler eines Tasks werden unverändert weitergereicht (die Fehlersemantik je Item bleibt beim Aufrufer).
type PooledRun = <T>(task: () => Promise<T>) => Promise<T>;

function createUploadPool(limit: number): PooledRun {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= limit) {
      await new Promise<void>((resolve) => {
        waiting.push(resolve);
      });
    }
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
}

// Phase-A-Ergebnis je Anhang: hochgeladene Object-Ref ODER ehrlicher Teilfehler (kein halber Anhang).
interface UploadedAttachment {
  item: AttachmentUploadItem;
  ref?: UploadedObjectRef;
  failure?: AttachmentFailure;
}

// PHASE A (parallel im Pool, KEIN KO-Write): Anhänge in den Object-Store laden — max. UPLOAD_POOL_LIMIT
// gleichzeitig. Promise.allSettled → ein unerwarteter Fehler eines Uploads lässt die übrigen NICHT im
// undefinierten Zustand; jeder Fehler wird als ehrlicher Teilfehler festgehalten (kein stilles Verschlucken).
// Die Ergebnis-Reihenfolge bleibt stabil zu `items` (Index-Zuordnung, unabhängig von der Pool-Reihenfolge).
async function uploadAttachmentObjects(
  items: readonly AttachmentUploadItem[],
  api: AttachmentUploadApi,
  pooled: PooledRun,
): Promise<UploadedAttachment[]> {
  const settled = await Promise.allSettled(
    items.map((item) =>
      pooled(() =>
        api.upload({
          name: item.name,
          mime: item.mime,
          data: item.data,
          kind: item.kind,
          // AUFTRAG-mega20 Block C: reine Anhänge — Bilder und mitgebrachte Dateien OHNE
          // übernommenen Inhalt. Ankerdokumente laufen nicht hier durch (sie sind bereits
          // gesichert und werden von der Verbund-Operation gebunden).
          purpose: "attachment",
        }),
      ),
    ),
  );
  return items.map((item, i) => {
    const outcome = settled[i];
    if (outcome && outcome.status === "fulfilled") {
      return { item, ref: outcome.value };
    }
    return {
      item,
      failure: { name: item.name, reason: classifyUploadError(outcome?.reason) },
    };
  });
}

// Phase-A-Ergebnis fürs Original (WP-D2 „Original ist heilig"): Ref-Cache lädt HÖCHSTENS EINMAL hoch (mehrere
// Queue-KOs teilen die objectId). `uploaded` = ob in DIESEM Aufruf real übertragen (für die ehrliche Byte-Anzeige).
interface UploadedOriginal {
  doc: OriginalDocument;
  ref?: UploadedObjectRef;
  failure?: AttachmentFailure;
  uploaded: boolean;
}

async function uploadOriginalObject(
  original: OriginalDocument,
  api: AttachmentUploadApi,
  cache: OriginalRefCache,
  pooled: PooledRun,
): Promise<UploadedOriginal> {
  if (cache.ref) {
    return { doc: original, ref: cache.ref, uploaded: false };
  }
  try {
    // WP-D7d: läuft im SELBEN Pool wie die Anhänge — das Original ist Pool-Teilnehmer, kein Pool+1.
    const ref = await pooled(() =>
      api.upload({
        name: original.name,
        mime: original.mime,
        data: original.data,
        kind: "document",
        // AUFTRAG-mega20 Block C: das Original der Datei-Warteschlange wird Beleg-Anker.
        purpose: "anchor",
      }),
    );
    cache.ref = ref;
    return { doc: original, ref, uploaded: true };
  } catch (error) {
    return {
      doc: original,
      failure: { name: original.name, reason: classifyUploadError(error) },
      uploaded: false,
    };
  }
}

// AUFTRAG-mega18 Block A-3: EIN Übernahme-Vorgang je Ankerdokument. Der Finalizer führt sie in
// Phase B SERIELL aus und wertet ihr Urteil aus — er kennt weder Endpunkte noch die Kennung, damit
// dieser Helfer DOM- und API-Client-frei testbar bleibt.
//
// Warum das nicht mehr in `pendingSources` mitläuft: eine Belegstelle aus einem DOKUMENT ist etwas
// anderes als eine externe Quelle aus dem Suchfeld. Sie gehört zu übernommenem Inhalt und untersteht
// deshalb der internen Belegpflicht (services/knowledge-object/src/document-append.ts), die die
// externe Stufenregel NICHT ersetzt und nicht ersetzen kann. Zwei Regeln, zwei Wege, zwei Meldungen.
export interface DocumentAppendJob {
  /** Name des Ankerdokuments — trägt die ehrliche Fehlermeldung. */
  name: string;
  /**
   * Vollzieht die Verbund-Operation. WIRFT NICHT: sie liefert ihr Urteil, damit der Finalizer
   * zwischen „abgelehnt (nichts geschrieben)" und „unklar (nichts anfassen)" unterscheiden kann.
   */
  run: () => Promise<{ committed: boolean; unclear: boolean }>;
}

export interface CaptureFinalizeInput {
  koId: string;
  attachments: readonly AttachmentUploadItem[];
  api: AttachmentUploadApi;
  /**
   * AUFTRAG-mega18 Block A-3: die Übernahme-Vorgänge des Dokumentinhalts. Sie laufen in Phase B
   * VOR den restlichen Quellen und STRIKT SERIELL — jeder ist selbst ein einziger Serveraufruf mit
   * einem einzigen Compare-and-Set, also kann hier auch nichts mehr gegen sich selbst verlieren.
   */
  documentAppends?: readonly DocumentAppendJob[] | null;
  // Original als Anhang mitführen (Ref-Cache über mehrere Queue-KOs).
  original?: { doc: OriginalDocument; cache: OriginalRefCache } | null;
  // Reiner KO-Write (add-source) des Datei-Imports; wirft → ehrlicher Teilfehler unter `name`.
  queueSource?: { name: string; run: () => Promise<void> } | null;
  // Gesammelte externe Quellen — INTERN seriell (attachPendingSources); läuft als EIN Phase-B-Schritt.
  // AUFTRAG-mega17 Block A-2: der Rückruf bekommt die in Phase B ENTSTANDENEN Anker (lokaler
  // anchorKey → echte objectId des am KO liegenden Anhangs). Er läuft NACH den Anhängen, also ist
  // die Karte zu diesem Zeitpunkt vollständig — genau die Reihenfolge, die der Haupt-Dateiimport
  // schon einhält („erst das Original ans Ziel-KO, dann die Quelle mit dessen echter objectId").
  pendingSources?:
    | ((
        anchors: ReadonlyMap<string, string>,
      ) => Promise<{ attached: number; failed: string[]; unanchored: string[] }>)
    | null;
  // Echte Stufen-Transition für die Fortschrittsanzeige: "uploading" (Phase A) → "linking" (Phase B).
  onPhase?: (phase: "uploading" | "linking") => void;
}

export async function finalizeCaptureSubmit(
  input: CaptureFinalizeInput,
): Promise<CaptureFinalizeResult> {
  const { koId, api } = input;

  // ---- PHASE A: NUR Uploads, parallel im gemeinsamen Pool (max. UPLOAD_POOL_LIMIT gleichzeitig, Original
  //      inklusive). Kein einziger KO-Write hier (sonst STALE_WRITE, s. o.). ----
  input.onPhase?.("uploading");
  const pooled = createUploadPool(UPLOAD_POOL_LIMIT);
  const [uploadedAttachments, uploadedOriginal] = await Promise.all([
    uploadAttachmentObjects(input.attachments, api, pooled),
    input.original
      ? uploadOriginalObject(input.original.doc, api, input.original.cache, pooled)
      : Promise.resolve(null),
  ]);

  // ---- PHASE B: KO-Mutationen STRIKT SERIELL (await nacheinander) — nie zwei attach/add-source am
  //      selben KO gleichzeitig. So kann kein CAS-STALE_WRITE durch Selbst-Konkurrenz entstehen. ----
  input.onPhase?.("linking");
  const failed: AttachmentFailure[] = [];
  // AUFTRAG-mega17 Block A-2: lokaler anchorKey → ECHTE objectId. Ein Eintrag entsteht NUR nach
  // erfolgreichem Attach — ein hochgeladenes, aber nicht am KO hängendes Objekt ist kein Anker
  // (genau das prüft die Route gegen die eigene Anhangsliste, ko-routes.ts:622-627).
  const anchors = new Map<string, string>();
  let attached = 0;
  for (const up of uploadedAttachments) {
    if (up.failure) {
      failed.push(up.failure);
      continue;
    }
    if (!up.ref) {
      continue;
    }
    try {
      await api.attach(koId, {
        name: up.item.name,
        mime: up.item.mime,
        objectId: up.ref.id,
        ...(up.item.thumbnail ? { thumbnail: up.item.thumbnail } : {}),
        ...(up.ref.size != null ? { size: up.ref.size } : {}),
      });
      attached += 1;
      if (up.item.anchorKey) {
        anchors.set(up.item.anchorKey, up.ref.id);
      }
    } catch {
      failed.push({ name: up.item.name, reason: "attach" });
    }
  }
  if (uploadedOriginal) {
    if (uploadedOriginal.failure) {
      failed.push(uploadedOriginal.failure);
    } else if (uploadedOriginal.ref) {
      try {
        await api.attach(koId, {
          name: uploadedOriginal.doc.name,
          mime: uploadedOriginal.doc.mime,
          objectId: uploadedOriginal.ref.id,
          ...(uploadedOriginal.ref.size != null ? { size: uploadedOriginal.ref.size } : {}),
        });
        attached += 1;
      } catch {
        failed.push({ name: uploadedOriginal.doc.name, reason: "attach" });
      }
    }
  }
  // AUFTRAG-mega18 Block A-3: die Übernahme-Vorgänge. Ein Fehlschlag ist ein HERKUNFTS-Befund
  // („provenance"), kein Anhangsfehler — der Nutzer muss wissen, dass es um den Beleg zum
  // übernommenen Inhalt geht. Ein UNKLARER Ausgang wird ebenso gemeldet und NICHTS zurückgenommen:
  // blindes Kompensieren nach unklarem Ausgang ist abgeschafft (bens Auflage).
  for (const job of input.documentAppends ?? []) {
    try {
      const verdict = await job.run();
      if (!verdict.committed) {
        failed.push({ name: job.name, reason: verdict.unclear ? "unclear" : "provenance" });
      }
    } catch {
      failed.push({ name: job.name, reason: "provenance" });
    }
  }
  if (input.queueSource) {
    try {
      await input.queueSource.run();
    } catch {
      failed.push({ name: input.queueSource.name, reason: "attach" });
    }
  }
  if (input.pendingSources) {
    const sourceRes = await input.pendingSources(anchors);
    for (const name of sourceRes.failed) {
      failed.push({ name, reason: "attach" });
    }
    // AUFTRAG-mega17 Block A-2: getrennt gemeldet, weil es etwas anderes bedeutet — der Inhalt steht
    // im Wissensobjekt, sein Beleg nicht. Der Nutzer muss das WISSEN, nicht raten.
    for (const name of sourceRes.unanchored) {
      failed.push({ name, reason: "provenance" });
    }
  }
  return { attached, failed };
}

// WP-D7d (bens Härtung 1b): die im UI angezeigte Anhang-Grenze (Admin-Einstellung maxAttachments) wird
// clientseitig VOR dem Upload wirklich durchgesetzt — bisher konnte die Auswahl beliebig viele Dateien
// aufnehmen und erst der Server lehnte ab. Pure Deckelung: nimmt so viele Neuzugänge, wie noch Plätze frei
// sind (Reihenfolge der Auswahl bleibt), und meldet ehrlich, wie viele NICHT akzeptiert wurden.
// WP-D7e (bens ROT-Fix): `reservedCount` reserviert Plätze für SPÄTERE Anhänge desselben Submits — konkret
// das Original des Datei-Imports (D2 „Original ist heilig"): ohne Reservierung füllt eine 8er-Auswahl am
// 8er-Limit alle Plätze, und der Original-Attach wird serverseitig als neunter abgelehnt (Original fehlt am
// KO, verwaistes Object, Teilfehler erst nach dem Submit).
export function capAttachmentSelection<T>(
  files: readonly T[],
  currentCount: number,
  maxAttachments: number,
  reservedCount = 0,
): { accepted: T[]; dropped: number } {
  const slots = Math.max(0, maxAttachments - currentCount - reservedCount);
  return {
    accepted: files.slice(0, slots),
    dropped: Math.max(0, files.length - slots),
  };
}

// i18n-Keys für den ehrlichen Recovery-/Status-Hinweis (Teilfehler). Zahlen/Dateinamen rendert die
// Komponente direkt. Kernaussage: KO ist offen gespeichert; fehlende Dateien später am KO ergänzen;
// Belege ersetzen die Validierung nicht.
export const ATTACHMENT_RECOVERY_KEYS = {
  title: "capture.attachFailedTitle",
  body: "capture.attachFailedBody",
  next: "capture.attachFailedNext",
  // WP-D2: Zusatzzeile, wenn mindestens ein Anhang an der Größen-Grenze scheiterte.
  tooLarge: "capture.attachTooLarge",
  // AUFTRAG-mega17 Block A-2: Zusatzzeile, wenn ein HERKUNFTSVERMERK nicht gesetzt werden konnte.
  // Sie benennt, was wirklich fehlt (der Beleg zum übernommenen Inhalt), nicht „ein Anhang".
  provenance: "capture.sourceMissingBody",
  provenanceNext: "capture.sourceMissingNext",
  // AUFTRAG-mega18 Block A-3: Zusatzzeile für den UNKLAREN Ausgang eines Übernahme-Vorgangs. Sie
  // behauptet NICHTS über den Bestand und fordert zum Nachsehen auf — die einzige ehrliche Auskunft,
  // wenn der Server nicht geantwortet hat.
  unclear: "capture.appendUnclearBody",
} as const;
