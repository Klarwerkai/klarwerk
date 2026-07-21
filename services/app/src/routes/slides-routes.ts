// WP-D11: POST /api/capture/slides — PPTX-Bytes (base64, konsistent zum Objekt-Upload-Muster) →
// PNG-data-URLs je Folie. Harte Grenzen (50 MB Eingabe, 30 Folien, 60 s, Einzel-/Gesamt-PNG-Deckel
// — im Konverter); SERIALISIERUNG: genau EINE Konvertierung gleichzeitig, Überlast wird ehrlich
// mit 429 + Retry-Hinweis abgelehnt (LibreOffice ist speicherhungrig — eine Warteschlange voller
// Decks wäre ein Selbst-DoS). Ohne soffice (lokale Dev-Umgebung) antwortet die Route ehrlich 503.
// PII-freies Log: Dauer, Folienzahl, Eingabegröße — NIE Inhalte.
//
// WP-D11b (bens sammel16-Blocker 3): ALLES Abweisbare läuft in einem onRequest-Hook und damit VOR
// dem Parsen des bis zu 72-MiB-Bodys: Auth + ko.create, Betriebsschalter, Principal-Rate-Limit und
// die Busy-VOR-Abweisung. Der Busy-Check im Hook ist nur eine Vor-Abweisung — der eigentliche
// Slot-Claim bleibt atomar im Handler (kein TOCTOU: der Handler prüft erneut und claimt synchron).
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { Guards } from "../http";
import { MAX_PPTX_BYTES, MAX_SLIDES, type SlideConverter } from "../slide-converter";

// 50 MB Nutzdaten → ~67 Mio. base64-Zeichen + JSON-Overhead.
export const SLIDES_BODY_LIMIT = 72 * 1024 * 1024; // 72 MiB

// WP-D11b (Blocker 3): Principal-Rate-Limit — höchstens N Konvertierungs-AUFRUFE je Nutzer je
// Fenster (auch abgewiesene zählen; die Route ist teuer, bevor sie überhaupt konvertiert).
export const SLIDES_RATE_LIMIT = 5;
export const SLIDES_RATE_WINDOW_MS = 60_000;

// Stack-sichere Base64-Grobprüfung (Zeichenklassen-Stern, keine Gruppen-Wiederholung).
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

// WP-D11b (GELB b): eine PPTX ist ein ZIP — die ersten Bytes MÜSSEN die lokale ZIP-Signatur
// PK\x03\x04 sein. Alles andere wird abgelehnt, BEVOR der Konverter je startet.
const PPTX_ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

// WP-D11b (Blocker 1): Betriebsschalter. Default AN; KLARWERK_SLIDES_ENABLED=0|false schaltet die
// Konvertierung ab (z. B. bis die Infra-Isolation der Konverter steht) — ehrlicher 503 auf dem
// GLEICHEN Pfad wie „kein soffice installiert". Pro Anfrage gelesen, damit der Betrieb ohne
// Neustart-Zwang reagieren kann.
function slidesEnabled(): boolean {
  const flag = process.env.KLARWERK_SLIDES_ENABLED;
  return flag !== "0" && flag !== "false";
}

function sendUnavailable(reply: FastifyReply): void {
  reply.code(503).send({
    error: "SLIDES_UNAVAILABLE",
    message:
      "Die Folien-Ansicht ist auf diesem Server derzeit nicht verfügbar (kein Konverter installiert).",
  });
}

export function slidesRoutes(converter: SlideConverter, guards: Guards): FastifyPluginAsync {
  // Modul-Zustand der Serialisierung: max. 1 laufende Konvertierung, keine Warteschlange.
  let running = false;
  // Rate-Limit-Zustand: Nutzer-Id → Zeitstempel der Aufrufe im Fenster (mit Aufräumen: je Zugriff
  // wird der eigene Eintrag beschnitten/entfernt; ab 500 Nutzern zusätzlich ein voller Sweep).
  const rateBuckets = new Map<string, number[]>();

  const rateLimited = (userId: string, nowMs: number): boolean => {
    if (rateBuckets.size > 500) {
      for (const [key, stamps] of rateBuckets) {
        const fresh = stamps.filter((t) => t > nowMs - SLIDES_RATE_WINDOW_MS);
        if (fresh.length === 0) {
          rateBuckets.delete(key);
        } else {
          rateBuckets.set(key, fresh);
        }
      }
    }
    const stamps = (rateBuckets.get(userId) ?? []).filter((t) => t > nowMs - SLIDES_RATE_WINDOW_MS);
    if (stamps.length >= SLIDES_RATE_LIMIT) {
      rateBuckets.set(userId, stamps);
      return true;
    }
    stamps.push(nowMs);
    rateBuckets.set(userId, stamps);
    return false;
  };

  return async (app) => {
    app.post<{ Body: { data?: string } }>(
      "/api/capture/slides",
      {
        bodyLimit: SLIDES_BODY_LIMIT,
        // Blocker 3: der komplette Abweisungs-Pfad VOR dem Body-Parsing (onRequest läuft vor jedem
        // Content-Type-Parser). Reihenfolge: Auth/Recht → Betriebsschalter → Rate-Limit → Busy.
        // Bewusst INLINE in den Routen-Optionen, damit der RBAC-Scanner (routeGuardAudit) die
        // requirePermission-Verdrahtung dieser Route im Routen-Block sieht.
        onRequest: async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
          const user = await guards.requirePermission("ko.create", request, reply);
          if (!user) {
            return;
          }
          if (!slidesEnabled()) {
            sendUnavailable(reply);
            return;
          }
          if (rateLimited(user.id, Date.now())) {
            reply
              .code(429)
              .header("retry-after", String(Math.ceil(SLIDES_RATE_WINDOW_MS / 1000)))
              .send({
                error: "RATE_LIMITED",
                message:
                  "Zu viele Folien-Konvertierungen in kurzer Zeit — bitte eine Minute warten und erneut versuchen.",
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
        },
      },
      async (request, reply) => {
        if (!(await converter.available())) {
          sendUnavailable(reply);
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
        // GELB b: ZIP-Signatur der ersten Bytes prüfen — kein PK\x03\x04 → 400 OHNE Konverter-Start.
        const head = Buffer.from(data.slice(0, 8), "base64");
        if (head.length < 4 || !head.subarray(0, 4).equals(PPTX_ZIP_MAGIC)) {
          reply.code(400).send({
            error: "BAD_REQUEST",
            message: "data ist keine PPTX-Datei (ZIP-Signatur fehlt).",
          });
          return;
        }
        // Atomarer Slot-Claim (der Hook war nur Vor-Abweisung — hier zählt der synchrone Re-Check).
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
          // PII-frei: nur Metriken (Dauer/Folien/Bytes/Verwerfungen), nie Datei-Inhalt oder -Name.
          request.log.info(
            {
              durationMs: Date.now() - startedMs,
              slides: result.pngs.length,
              truncated: result.truncated,
              droppedOversize: result.droppedOversize,
              droppedByBudget: result.droppedByBudget,
              inputBytes: bytes,
            },
            "slides-convert",
          );
          reply.code(200).send({
            slides: result.pngs.map((png) => `data:image/png;base64,${png.toString("base64")}`),
            slideCount: result.pngs.length,
            // WP-D11b (Blocker 2): ehrliche Zähler der Ausgabe-Deckelung.
            converted: result.pngs.length,
            droppedOversize: result.droppedOversize,
            droppedByBudget: result.droppedByBudget,
            truncated: result.truncated,
            truncatedByBudget: result.truncatedByBudget,
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
