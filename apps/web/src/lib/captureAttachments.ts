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
export type AttachmentFailureReason = "upload" | "attach" | "too-large";

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

export async function attachOriginalDocument(
  koId: string,
  original: OriginalDocument,
  api: AttachmentUploadApi,
  cache: OriginalRefCache,
): Promise<{ attached: boolean; failure?: AttachmentFailure }> {
  let ref = cache.ref;
  if (!ref) {
    try {
      ref = await api.upload({
        name: original.name,
        mime: original.mime,
        data: original.data,
        kind: "document",
      });
      cache.ref = ref;
    } catch (error) {
      return {
        attached: false,
        failure: { name: original.name, reason: classifyUploadError(error) },
      };
    }
  }
  try {
    await api.attach(koId, {
      name: original.name,
      mime: original.mime,
      objectId: ref.id,
      ...(ref.size != null ? { size: ref.size } : {}),
    });
    return { attached: true };
  } catch {
    return { attached: false, failure: { name: original.name, reason: "attach" } };
  }
}

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

// Phase-A-Ergebnis je Anhang: hochgeladene Object-Ref ODER ehrlicher Teilfehler (kein halber Anhang).
interface UploadedAttachment {
  item: AttachmentUploadItem;
  ref?: UploadedObjectRef;
  failure?: AttachmentFailure;
}

// PHASE A (parallel, KEIN KO-Write): alle Anhänge gleichzeitig in den Object-Store laden. Promise.allSettled →
// ein unerwarteter Fehler eines Uploads lässt die übrigen NICHT im undefinierten Zustand; jeder Fehler wird
// als ehrlicher Teilfehler festgehalten (kein stilles Verschlucken).
async function uploadAttachmentObjects(
  items: readonly AttachmentUploadItem[],
  api: AttachmentUploadApi,
): Promise<UploadedAttachment[]> {
  const settled = await Promise.allSettled(
    items.map((item) =>
      api.upload({ name: item.name, mime: item.mime, data: item.data, kind: item.kind }),
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
): Promise<UploadedOriginal> {
  if (cache.ref) {
    return { doc: original, ref: cache.ref, uploaded: false };
  }
  try {
    const ref = await api.upload({
      name: original.name,
      mime: original.mime,
      data: original.data,
      kind: "document",
    });
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

export interface CaptureFinalizeInput {
  koId: string;
  attachments: readonly AttachmentUploadItem[];
  api: AttachmentUploadApi;
  // Original als Anhang mitführen (Ref-Cache über mehrere Queue-KOs).
  original?: { doc: OriginalDocument; cache: OriginalRefCache } | null;
  // Reiner KO-Write (add-source) des Datei-Imports; wirft → ehrlicher Teilfehler unter `name`.
  queueSource?: { name: string; run: () => Promise<void> } | null;
  // Gesammelte externe Quellen — INTERN seriell (attachPendingSources); läuft als EIN Phase-B-Schritt.
  pendingSources?: (() => Promise<{ attached: number; failed: string[] }>) | null;
  // Echte Stufen-Transition für die Fortschrittsanzeige: "uploading" (Phase A) → "linking" (Phase B).
  onPhase?: (phase: "uploading" | "linking") => void;
}

export async function finalizeCaptureSubmit(
  input: CaptureFinalizeInput,
): Promise<CaptureFinalizeResult> {
  const { koId, api } = input;

  // ---- PHASE A: NUR Uploads, parallel. Kein einziger KO-Write hier (sonst STALE_WRITE, s. o.). ----
  input.onPhase?.("uploading");
  const [uploadedAttachments, uploadedOriginal] = await Promise.all([
    uploadAttachmentObjects(input.attachments, api),
    input.original
      ? uploadOriginalObject(input.original.doc, api, input.original.cache)
      : Promise.resolve(null),
  ]);

  // ---- PHASE B: KO-Mutationen STRIKT SERIELL (await nacheinander) — nie zwei attach/add-source am
  //      selben KO gleichzeitig. So kann kein CAS-STALE_WRITE durch Selbst-Konkurrenz entstehen. ----
  input.onPhase?.("linking");
  const failed: AttachmentFailure[] = [];
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
  if (input.queueSource) {
    try {
      await input.queueSource.run();
    } catch {
      failed.push({ name: input.queueSource.name, reason: "attach" });
    }
  }
  if (input.pendingSources) {
    const sourceRes = await input.pendingSources();
    for (const name of sourceRes.failed) {
      failed.push({ name, reason: "attach" });
    }
  }
  return { attached, failed };
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
} as const;
