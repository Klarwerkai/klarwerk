import type { FastifyPluginAsync } from "fastify";
import { isValidConfidentiality } from "../../../knowledge-object";
import { type ObjectKind, type ObjectStore, decodeDataUrl } from "../../../object-store";
import { type Guards, sendError } from "../http";

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

// SCRUM-121: Objekt-/Attachment-Speicher. Upload liefert eine ObjectRef (nur Metadaten);
// das KO speichert die Referenz + kleine Vorschau statt des großen Originals.
export function objectRoutes(store: ObjectStore, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.post<{
      Body: {
        name: string;
        mime: string;
        data: string;
        kind?: ObjectKind;
        confidentiality?: string;
      };
    }>("/api/objects", { bodyLimit: OBJECTS_BODY_LIMIT }, async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      try {
        const { name, mime, data, kind, confidentiality } = request.body;
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
      if (!obj) {
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
      if (!obj) {
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
        .header("Cache-Control", "private, max-age=31536000, immutable")
        .code(200)
        .send(decoded.bytes);
    });
  };
}
