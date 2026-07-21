// WP-D11: POST /api/capture/slides — PPTX-Bytes (base64, konsistent zum Objekt-Upload-Muster) →
// PNG-data-URLs je Folie. Auth + Import-Guard (ko.create) mit Auth VOR dem großen Parse (Muster
// WP-D1d); harte Grenzen (50 MB Eingabe, 30 Folien, 60 s — im Konverter); SERIALISIERUNG: genau
// EINE Konvertierung gleichzeitig, Überlast wird ehrlich mit 429 + Retry-Hinweis abgelehnt
// (LibreOffice ist speicherhungrig — eine Warteschlange voller Decks wäre ein Selbst-DoS).
// Ohne soffice (lokale Dev-Umgebung) antwortet die Route ehrlich 503. PII-freies Log: Dauer,
// Folienzahl, Eingabegröße — NIE Inhalte.
import type { FastifyPluginAsync } from "fastify";
import type { Guards } from "../http";
import { MAX_PPTX_BYTES, MAX_SLIDES, type SlideConverter } from "../slide-converter";

// 50 MB Nutzdaten → ~67 Mio. base64-Zeichen + JSON-Overhead.
export const SLIDES_BODY_LIMIT = 72 * 1024 * 1024; // 72 MiB

// Stack-sichere Base64-Grobprüfung (Zeichenklassen-Stern, keine Gruppen-Wiederholung).
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

export function slidesRoutes(converter: SlideConverter, guards: Guards): FastifyPluginAsync {
  // Modul-Zustand der Serialisierung: max. 1 laufende Konvertierung, keine Warteschlange.
  let running = false;

  return async (app) => {
    const requireAuthedBeforeParse = async (
      request: Parameters<Guards["requireUser"]>[0],
      reply: Parameters<Guards["requireUser"]>[1],
    ): Promise<void> => {
      await guards.requireUser(request, reply);
    };

    app.post<{ Body: { data?: string } }>(
      "/api/capture/slides",
      { bodyLimit: SLIDES_BODY_LIMIT, onRequest: requireAuthedBeforeParse },
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        if (!(await converter.available())) {
          reply.code(503).send({
            error: "SLIDES_UNAVAILABLE",
            message:
              "Die Folien-Ansicht ist auf diesem Server derzeit nicht verfügbar (kein Konverter installiert).",
          });
          return;
        }
        const data = request.body?.data;
        if (
          typeof data !== "string" ||
          data.length === 0 ||
          data.length % 4 !== 0 ||
          !BASE64_RE.test(data)
        ) {
          reply.code(400).send({
            error: "BAD_REQUEST",
            message: "data fehlt oder ist keine gültige Base64-Kodierung.",
          });
          return;
        }
        // Dekodierte Bytegrenze ARITHMETISCH prüfen, bevor irgendetwas materialisiert wird.
        const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
        const bytes = (data.length / 4) * 3 - padding;
        if (bytes > MAX_PPTX_BYTES) {
          reply.code(413).send({
            error: "PAYLOAD_TOO_LARGE",
            message: "Die Präsentation ist zu groß für die Folien-Konvertierung (max. 50 MB).",
          });
          return;
        }
        if (running) {
          reply.code(429).header("retry-after", "30").send({
            error: "CONVERSION_BUSY",
            message:
              "Es läuft gerade eine andere Folien-Konvertierung — bitte in einem Moment erneut versuchen.",
          });
          return;
        }
        running = true;
        const startedMs = Date.now();
        try {
          const result = await converter.convert(Buffer.from(data, "base64"));
          // PII-frei: nur Metriken (Dauer/Folien/Bytes), nie Datei-Inhalt oder -Name.
          request.log.info(
            {
              durationMs: Date.now() - startedMs,
              slides: result.pngs.length,
              truncated: result.truncated,
              inputBytes: bytes,
            },
            "slides-convert",
          );
          reply.code(200).send({
            slides: result.pngs.map((png) => `data:image/png;base64,${png.toString("base64")}`),
            slideCount: result.pngs.length,
            truncated: result.truncated,
            maxSlides: MAX_SLIDES,
          });
        } catch (error) {
          request.log.warn(
            {
              durationMs: Date.now() - startedMs,
              inputBytes: bytes,
              reason: error instanceof Error ? error.name : "unknown",
            },
            "slides-convert-failed",
          );
          reply.code(500).send({
            error: "SLIDES_FAILED",
            message:
              "Die Folien-Konvertierung ist fehlgeschlagen — der Text-Import bleibt davon unberührt.",
          });
        } finally {
          running = false;
        }
      },
    );
  };
}
