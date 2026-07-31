import type { FastifyPluginAsync } from "fastify";
import { isValidConfidentiality } from "../../../knowledge-object";
import {
  type ObjectKind,
  type ObjectPurpose,
  type ObjectRef,
  type ObjectStore,
  decodeDataUrl,
} from "../../../object-store";
import { type Guards, type SessionUser, sendError } from "../http";
import {
  type AnhangQuellen,
  type AnhangUrteil,
  type SichtbarkeitsFakten,
  beurteileAnhang,
} from "../sichtbarkeit";

// AUFTRAG-mega20 Block C: die erlaubten Zwecke als LAUFZEIT-Prüfung. Der Typ allein hilft an einer
// HTTP-Grenze nichts — dort kommt eine beliebige Zeichenkette an, und sie in den Vertrag zu casten
// hieße, dem Client den Lebenszyklus schreiben zu lassen.
const OBJECT_PURPOSES: ReadonlySet<string> = new Set<ObjectPurpose>([
  "anchor",
  "attachment",
  "media",
  "example",
  "unknown",
]);

function isObjectPurpose(value: string): value is ObjectPurpose {
  return OBJECT_PURPOSES.has(value);
}

// SCRUM-503 (ben-Nacht-1): Stored XSS über nutzerbestimmtes MIME. Der Object-Store speichert das
// beim Upload gelieferte `mime` verbatim; die /raw-Auslieferung setzte es 1:1 als Content-Type OHNE
// Content-Disposition → `text/html`/SVG wurde INLINE auf dem App-Origin gerendert → Script-Ausführung
// in der Admin-Session. Fix: nur eine Allowlist gefahrloser Bild-Typen darf inline mit ihrem echten
// Typ ausgeliefert werden (der `<img src>`-Editor-Fall); ALLES andere → application/octet-stream +
// Content-Disposition: attachment. Zusätzlich X-Content-Type-Options: nosniff (kein MIME-Sniffing).
// SVG bewusst NICHT in der Inline-Allowlist (kann Skripte tragen) → attachment.
const SAFE_INLINE_IMAGE_MIMES: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

// Dateiname für den Content-Disposition-Header entschärfen (Header-Injection/Steuerzeichen raus).
function safeAttachmentName(name: unknown): string {
  const base = typeof name === "string" ? name : "download";
  const cleaned = base.replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned.length > 0 ? cleaned.slice(0, 120) : "download";
}

// WP-D2 („Original ist heilig"): expliziter Route-bodyLimit statt des globalen 1-MiB-Fastify-Defaults
// (Muster CHECK_TEXT_BODY_LIMIT). Der Upload reist als JSON-Data-URL (Base64 ≈ Datei × 1,37) — der
// globale Default deckelte reale Dateien auf ~700 KB und ließ jedes normale Nutzer-PDF/DOCX mit 413
// scheitern, BEVOR MAX_OBJECT_BYTES überhaupt greifen konnte. 30 MiB umhüllt die 30-MB-Data-URL-
// Obergrenze des Object-Store plus JSON-Envelope; darüber → kontrolliertes 413.
export const OBJECTS_BODY_LIMIT = 30 * 1024 * 1024; // 30 MiB

// ================================================================================================
// AUFTRAG-mega74 BLOCK C — G4: DIE KOPFZEILE, DIE EINE SPERRE EIN JAHR ÜBERLEBTE.
// ================================================================================================
//
// Hier stand `Cache-Control: private, max-age=31536000, immutable` — ein Jahr, unveränderlich. Wer
// einen Anhang einmal geholt hatte, behielt ihn ein Jahr im Browser, auch nachdem das tragende
// Objekt gesperrt wurde. Bei einem ausgeschiedenen Mitarbeiter ist das genau der Fall, den ein
// Zugriffsschutz verhindern soll: der Serverentzug wirkt, die Kopie im Browser nicht.
//
// DER SCHNITT, begründet:
//   · VERTRAULICH → `no-store`. Kein Zwischenspeicher, nirgends, auch nicht auf der Platte. Für
//     ein vertrauliches Original ist das die einzige Zusage, die trägt.
//   · SONST → eine kurze Frist statt eines Jahres, und NIE `immutable`. `immutable` sagt dem
//     Browser „frag nie wieder nach" — damit ist jede spätere Höherstufung wirkungslos, solange
//     die Frist läuft. Fünf Minuten halten den Bildaufbau einer Seite zusammen (der eigentliche
//     Nutzen), lassen eine Stufenänderung aber spätestens nach fünf Minuten durchgreifen.
//
// WAS ES KOSTET, ehrlich: Objekt-Ids sind stabil und nicht inhaltsgehasht, deshalb war die
// Ein-Jahres-Zusage ohnehin nur für unveränderliche Bytes gedacht. Der reale Preis ist eine
// Revalidierung je Bild nach fünf Minuten statt keiner — bei einem Wissensobjekt mit vielen
// Bildern also ein Satz bedingter Anfragen pro Sitzung, die bei unverändertem Inhalt mit 304
// beantwortet werden. Für Vertrauliches entfällt der Zwischenspeicher ganz; dort wird bewusst
// Ladezeit gegen Entziehbarkeit getauscht.
const CACHE_UNVERTRAULICH = "private, max-age=300";
const CACHE_VERTRAULICH = "no-store";

// SCRUM-121: Objekt-/Attachment-Speicher. Upload liefert eine ObjectRef (nur Metadaten);
// das KO speichert die Referenz + kleine Vorschau statt des großen Originals.
//
// AUFTRAG-mega76 BLOCK A: `traeger` war OPTIONAL und ist jetzt PFLICHT. Der alte Kommentar nannte
// das „KEIN stiller Rückfall, sondern der Weg für Aufrufer ohne Wissensobjekt-Bestand" — genau das
// war der Fehler: fehlte der Zugang, antwortete `urteile` mit `{ sichtbar: true }`, also mit einem
// bedingungslosen Ja für JEDEN Anhang. Ein Schutz, den der Aufrufer weglassen kann, ist keiner.
// Pflichtparameter ohne Umbau möglich: einziger Aufrufer ist die Kompositionswurzel
// (build-app.ts:1045).
export function objectRoutes(
  store: ObjectStore,
  guards: Guards,
  quellen: AnhangQuellen,
): FastifyPluginAsync {
  // Die EINE Torwache dieser Datei. Sie beantwortet „darf dieser Mensch diesen Anhang sehen"
  // ausschliesslich über das Prädikat aus Block A — keine zweite Auslegung hier.
  async function urteile(
    user: SessionUser,
    objectId: string,
    ref: ObjectRef,
  ): Promise<AnhangUrteil> {
    // `ObjectRef.confidentiality` ist bewusst ein roher String (object-store bleibt von
    // knowledge-object entkoppelt, types.ts:94). Hier, an der Modulgrenze, wird er EINMAL geprüft;
    // ein unbekannter Wert wird nicht geraten, sondern fällt weg.
    const eigen: SichtbarkeitsFakten = {
      confidentiality: isValidConfidentiality(ref.confidentiality) ? ref.confidentiality : null,
      // Der Hochladende ist für das ungebundene Objekt das, was der Autor für ein Wissensobjekt
      // ist: die Person, die es erzeugt hat. `lifecycle.owner` kommt serverseitig aus der
      // Anmeldung (object-routes POST), nie aus dem Body — er ist damit belastbar.
      author: ref.lifecycle?.owner ?? null,
    };
    // mega76 A, zweite Linie unter dem Pflichtparameter: ein Aufrufer, den der Compiler nicht
    // sieht (JavaScript, `as never`, ein aus JSON gebautes Deps-Objekt), bekommt ein NEIN — nicht
    // das alte bedingungslose Ja.
    if (typeof quellen?.kos !== "function") {
      return { sichtbar: false, vertraulich: true };
    }
    return beurteileAnhang(user, objectId, eigen, quellen);
  }

  return async (app) => {
    app.post<{
      Body: {
        name: string;
        mime: string;
        data: string;
        kind?: ObjectKind;
        confidentiality?: string;
        // AUFTRAG-mega20 Block C: WOZU wird hochgeladen (s. object-store/src/types.ts).
        purpose?: string;
        draftId?: string;
      };
    }>("/api/objects", { bodyLimit: OBJECTS_BODY_LIMIT }, async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      try {
        const { name, mime, data, kind, confidentiality, purpose, draftId } = request.body;
        // AUFTRAG-mega20 Block C: der Zweck wird gegen die bekannte Liste geprüft und NIE geraten.
        // Ein unbekannter Wert wird zu „unknown" — also zur KONSERVATIVSTEN Einstufung, nicht zu
        // der, die der Client vielleicht gemeint hat. `owner` kommt aus der ANMELDUNG, nie aus dem
        // Body: er ist eine Herkunftsangabe, und eine erfundene Herkunft wäre schlechter als keine.
        const purposeField =
          typeof purpose === "string" && isObjectPurpose(purpose) ? { purpose } : {};
        // SCRUM-521 (WP1): Vertraulichkeit beim Upload persistieren — nur wenn es ein bekannter Level
        // ist. Ungültig/fehlend → nicht setzen; der Medien-Egress behandelt das Objekt dann fail-safe
        // als vertraulich (kein externer Transkriptions-Egress). Der Client kann so nur beim Upload
        // eine Einstufung setzen, nie nachträglich beim Analyse-Request herabstufen.
        const confidentialityField =
          typeof confidentiality === "string" && isValidConfidentiality(confidentiality)
            ? { confidentiality }
            : {};
        reply.code(201).send(
          await store.put({
            name,
            mime,
            data,
            ...(kind ? { kind } : {}),
            ...confidentialityField,
            ...purposeField,
            owner: user.id,
            ...(typeof draftId === "string" && draftId.trim() ? { draftId: draftId.trim() } : {}),
          }),
        );
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.get<{ Params: { id: string } }>("/api/objects/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const obj = await store.read(request.params.id);
      // mega74 C: dieselbe Form wie am Wissensobjekt — nicht sichtbar sieht aus wie nicht
      // vorhanden. Ein 403 würde die Existenz des Anhangs bestätigen.
      if (!obj || !(await urteile(user, request.params.id, obj.ref)).sichtbar) {
        reply.code(404).send({ error: "NOT_FOUND", message: "Objekt nicht gefunden." });
        return;
      }
      reply.code(200).send(obj);
    });

    // SCRUM-45/46/48 (KW-STR): rohe Bytes für <img src="/api/objects/:id/raw"> im Editor-Body.
    app.get<{ Params: { id: string } }>("/api/objects/:id/raw", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const obj = await store.read(request.params.id);
      const urteil = obj
        ? await urteile(user, request.params.id, obj.ref)
        : { sichtbar: false, vertraulich: true };
      if (!obj || !urteil.sichtbar) {
        reply.code(404).send({ error: "NOT_FOUND", message: "Objekt nicht gefunden." });
        return;
      }
      const decoded = decodeDataUrl(obj.data);
      if (!decoded) {
        reply.code(415).send({ error: "UNSUPPORTED", message: "Kein dekodierbares Objekt." });
        return;
      }
      // SCRUM-503: Content-Type NICHT aus dem nutzerkontrollierten `mime` durchreichen. Nur eine
      // Allowlist gefahrloser Bild-Typen wird inline mit echtem Typ ausgeliefert; alles andere wird
      // neutralisiert (octet-stream + attachment), sodass kein `text/html`/SVG inline auf dem
      // App-Origin rendert. nosniff verhindert MIME-Sniffing auf octet-stream.
      const claimedMime = obj.ref.mime || decoded.mime;
      const isSafeInlineImage = SAFE_INLINE_IMAGE_MIMES.has(claimedMime);
      reply
        .header("Content-Type", isSafeInlineImage ? claimedMime : "application/octet-stream")
        .header("X-Content-Type-Options", "nosniff")
        .header(
          "Content-Disposition",
          isSafeInlineImage
            ? "inline"
            : `attachment; filename="${safeAttachmentName(obj.ref.name)}"`,
        )
        // AUFTRAG-mega74 BLOCK C (G4): siehe die Begründung am Kopf der Datei. Die Stufe kommt aus
        // dem GESPEICHERTEN Objekt, nie aus der Anfrage.
        .header("Cache-Control", urteil.vertraulich ? CACHE_VERTRAULICH : CACHE_UNVERTRAULICH)
        .code(200)
        .send(decoded.bytes);
    });
  };
}
