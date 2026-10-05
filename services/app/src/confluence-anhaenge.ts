// ================================================================================================
// R-0163 — DER ÜBERNAHMEWEG FÜR ANHÄNGE UND BILDER EINER CONFLUENCE-SEITE.
// ================================================================================================
//
// `LibraryService` entscheidet, WELCHE Anhänge an WELCHES Wissensobjekt gehören
// (`uebernimmAnhaenge`); hier, in der Kompositionswurzel, kommen Quelle, Objektspeicher und
// Wissensobjekt zusammen — dieselbe Rollenverteilung wie beim Kantenbestand oder der
// Dublettenregel. Der Weg je Anhang ist derselbe wie beim Hochladen von Hand:
// Objektspeicher (`purpose: "attachment"`, Hochladender = Annehmender) → `addAttachment`.
//
// DIESELBEN GRENZEN WIE DIE ANHANGSROUTE (`ko-routes.ts`, `attach`): die geltenden Upload-Grenzen
// (Anzahl je Objekt, Größe der gespeicherten Daten-URL). Was eine Grenze reißt, wird nicht
// übernommen und zählt als fehlgeschlagen — nie still abgeschnitten.

import type { ConfluenceSourceAdapter } from "../../confluence";
import {
  DEFAULT_UPLOAD_LIMITS,
  type KoService,
  type UploadLimitsRepo,
} from "../../knowledge-object";
import type { LibraryServiceDeps } from "../../library-analytics";
import type { ObjectStore } from "../../object-store";

type AnhangsUebernahme = NonNullable<LibraryServiceDeps["anhaenge"]>;

export interface ConfluenceAnhangsDeps {
  ko: Pick<KoService, "get" | "addAttachment" | "updateAttachment">;
  objects: Pick<ObjectStore, "put">;
  uploadLimits: Pick<UploadLimitsRepo, "get">;
  // Je Auftrag neu gebaut: ohne Schalter oder ohne Zugangsdaten gibt es keinen Adapter — dann wird
  // nichts übernommen und alles als fehlgeschlagen gezählt.
  makeAdapter: () => Pick<ConfluenceSourceAdapter, "fetchAttachment"> | undefined;
}

const UNBESTIMMT = "application/octet-stream";

type Anhang = Parameters<AnhangsUebernahme>[0]["anhaenge"][number];

export function confluenceAnhangsUebernahme(deps: ConfluenceAnhangsDeps): AnhangsUebernahme {
  return async (auftrag) => {
    const alle = auftrag.anhaenge.length + auftrag.ersetzen.length;
    // Nur Confluence-Einträge: ein Abrufweg einer anderen Quelle ist hier nicht auflösbar.
    if ((auftrag.provider ?? "").trim().toLowerCase() !== "confluence") {
      return { uebernommen: 0, ersetzt: 0, fehlgeschlagen: alle };
    }
    const adapter = deps.makeAdapter();
    const ko = adapter ? await deps.ko.get(auftrag.koId) : undefined;
    if (!adapter || !ko) {
      return { uebernommen: 0, ersetzt: 0, fehlgeschlagen: alle };
    }
    const limits = (await deps.uploadLimits.get()) ?? DEFAULT_UPLOAD_LIMITS;

    // Bytes holen und ablegen — gemeinsam für neue und ersetzte Anhänge. `undefined` = eine
    // Grenze ist gerissen (leer, zu groß); ein Fehler (Netz, Speicher) wirft.
    const lege = async (anhang: Anhang) => {
      const { bytes, mime } = await adapter.fetchAttachment(anhang.abruf);
      const typ = anhang.mime !== UNBESTIMMT ? anhang.mime : (mime ?? UNBESTIMMT);
      const data = `data:${typ};base64,${bytes.toString("base64")}`;
      if (bytes.byteLength === 0 || data.length > limits.maxAttachmentBytes) {
        return undefined;
      }
      const ref = await deps.objects.put({
        name: anhang.name,
        mime: typ,
        data,
        purpose: "attachment",
        owner: auftrag.actor,
        // Der Anhang erbt die Stufe seines Objekts.
        ...(auftrag.confidentiality ? { confidentiality: auftrag.confidentiality } : {}),
      });
      return { ref, typ };
    };
    // Die Quellidentität am Anhang: daran ordnet der nächste Abgleich zu (nicht am Namen).
    const quelle = (anhang: Anhang) => ({
      provider: "confluence",
      externalId: anhang.externalId,
      abruf: anhang.abruf,
      ...(anhang.sourceVersion !== undefined ? { sourceVersion: anhang.sourceVersion } : {}),
    });

    // Neue Quellversion: Inhalt am SELBEN Eintrag tauschen. Scheitert Download oder Ablage, bleibt
    // der alte Inhalt samt alter Herkunft stehen — der Fall zählt als fehlgeschlagen.
    let ersetzt = 0;
    for (const { attachmentId, anhang } of auftrag.ersetzen) {
      try {
        const abgelegt = await lege(anhang);
        if (!abgelegt) {
          continue;
        }
        await deps.ko.updateAttachment(auftrag.koId, attachmentId, auftrag.actor, {
          objectId: abgelegt.ref.id,
          size: abgelegt.ref.size,
          mime: abgelegt.typ,
          quelle: quelle(anhang),
        });
        ersetzt += 1;
      } catch {
        // Zählt unten als fehlgeschlagen; der Grund verlässt diese Stelle nicht (keine URL, kein Name).
      }
    }

    let belegt = ko.attachments?.length ?? 0;
    let uebernommen = 0;
    for (const anhang of auftrag.anhaenge) {
      if (belegt >= limits.maxAttachments) {
        continue;
      }
      try {
        const abgelegt = await lege(anhang);
        if (!abgelegt) {
          continue;
        }
        await deps.ko.addAttachment(auftrag.koId, auftrag.actor, {
          name: anhang.name,
          mime: abgelegt.typ,
          objectId: abgelegt.ref.id,
          // Maßgeblich ist die gespeicherte Größe — wie in der Anhangsroute.
          size: abgelegt.ref.size,
          quelle: quelle(anhang),
        });
        belegt += 1;
        uebernommen += 1;
      } catch {
        // Zählt unten als fehlgeschlagen; der Grund verlässt diese Stelle nicht (keine URL, kein Name).
      }
    }
    return { uebernommen, ersetzt, fehlgeschlagen: alle - uebernommen - ersetzt };
  };
}
