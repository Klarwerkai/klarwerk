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

export type AttachmentFailureReason = "upload" | "attach";

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
    } catch {
      // Kein Object → NICHT attachen (keine erfundene objectId, kein Halb-Anhang).
      failed.push({ name: item.name, reason: "upload" });
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

// i18n-Keys für den ehrlichen Recovery-/Status-Hinweis (Teilfehler). Zahlen/Dateinamen rendert die
// Komponente direkt. Kernaussage: KO ist offen gespeichert; fehlende Dateien später am KO ergänzen;
// Belege ersetzen die Validierung nicht.
export const ATTACHMENT_RECOVERY_KEYS = {
  title: "capture.attachFailedTitle",
  body: "capture.attachFailedBody",
  next: "capture.attachFailedNext",
} as const;
