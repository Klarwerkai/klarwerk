// WP-D11: POST /api/capture/slides — PPTX-Bytes (base64, konsistent zum Objekt-Upload-Muster) →
// PNG-data-URLs je Folie. Harte Grenzen (50 MB Eingabe, 30 Folien, 60 s, Einzel-/Gesamt-PNG-Deckel
// — im Konverter); SERIALISIERUNG: genau EINE Konvertierung gleichzeitig, Überlast wird ehrlich
// mit 429 + Retry-Hinweis abgelehnt (LibreOffice ist speicherhungrig — eine Warteschlange voller
// Decks wäre ein Selbst-DoS). Ohne soffice (lokale Dev-Umgebung) antwortet die Route ehrlich 503.
// PII-freies Log: Dauer, Folienzahl, Eingabegröße — NIE Inhalte.
//
// WP-D11b (bens sammel16-Blocker 3): ALLES Abweisbare läuft in einem onRequest-Hook und damit VOR
// dem Parsen des bis zu 72-MiB-Bodys: Auth + ko.create, Betriebsschalter, Principal-Rate-Limit und
// der Konvertierungs-Slot.
// WP-SHIP7-FIX (bens sammel17-Fix 5): der Slot wird bereits im Hook ATOMAR GECLAIMT (synchron,
// kein await zwischen Prüfung und Claim) und request-lokal markiert — simultane Erstrequests
// parsen NICHT mehr alle parallel 72 MiB; genau einer parst, der Rest bekommt 429 ohne Parse.
// Freigabe auf ALLEN Pfaden über onResponse/onError (Parserfehler, Validierungsfehler, frühes
// Reply, Erfolg) — kein hängender Slot.
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { Guards } from "../http";
import { MAX_PPTX_BYTES, MAX_SLIDES, type SlideConverter } from "../slide-converter";

// 50 MB Nutzdaten → ~67 Mio. base64-Zeichen + JSON-Overhead.
export const SLIDES_BODY_LIMIT = 72 * 1024 * 1024; // 72 MiB

// WP-D11b (Blocker 3): Principal-Rate-Limit — höchstens N Konvertierungs-AUFRUFE je Nutzer je
// Fenster (auch abgewiesene zählen; die Route ist teuer, bevor sie überhaupt konvertiert).
export const SLIDES_RATE_LIMIT = 5;
export const SLIDES_RATE_WINDOW_MS = 60_000;
// WP-SHIP7-FIX (Fix 5): harte Kardinalitätsgrenze der Rate-Map — über der Grenze werden zuerst
// abgelaufene, dann die am längsten unbenutzten Einträge verdrängt (TTL + LRU-Verdrängung).
export const SLIDES_RATE_MAX_ENTRIES = 500;

// WP-REST18 (bens Fix 3): maximale Slot-Haltedauer — großzügig ÜBER der 60-s-Konverter-Deadline;
// danach gibt der Lease-Watchdog den Slot zwangsweise frei (Fastifys Abort-Erkennung ist laut
// eigener Doku nicht verlässlich; ohne Lease bliebe ein verwaister Slot bis zum Prozessneustart).
export const SLIDES_SLOT_LEASE_MS = 120_000;

// Stack-sichere Base64-Grobprüfung (Zeichenklassen-Stern, keine Gruppen-Wiederholung).
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

// WP-D11b (GELB b): eine PPTX ist ein ZIP — die ersten Bytes MÜSSEN die lokale ZIP-Signatur
// PK\x03\x04 sein. Alles andere wird abgelehnt, BEVOR der Konverter je startet.
const PPTX_ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

// WP-SHIP7-FIX (bens sammel17-Fix 4): Betriebsschalter mit DEFAULT AUS. Die Konverter-Fläche
// (LibreOffice/poppler parsen Fremddateien) ist nach einem normalen Deploy NICHT aktiv — der
// Default bleibt aus, bis der Konverter in einer echten credentialfreien, netz-/ressourcen-
// isolierten Grenze läuft (Infra-Arbeit). Nur ein EXPLIZITES KLARWERK_SLIDES_ENABLED=1|true
// schaltet die Route scharf; ohne/mit anderem Wert antwortet sie ehrlich 503 (gleicher Pfad wie
// „kein soffice installiert"). Pro Anfrage gelesen — der Betrieb kann ohne Neustart reagieren.
function slidesEnabled(): boolean {
  const flag = process.env.KLARWERK_SLIDES_ENABLED;
  return flag === "1" || flag === "true";
}

function sendUnavailable(reply: FastifyReply): void {
  reply.code(503).send({
    error: "SLIDES_UNAVAILABLE",
    message:
      "Die Folien-Ansicht ist auf diesem Server derzeit nicht verfügbar (kein Konverter installiert).",
  });
}

// WP-SHIP7-FIX (Fix 5): eigenständiger, unit-testbarer Rate-Limiter mit harter Kardinalitätsgrenze.
// hit() zählt den Aufruf (true = abgewiesen); size() ist für den Kardinalitäts-Test exportiert.
export interface SlidesRateLimiter {
  hit(userId: string, nowMs: number): boolean;
  size(): number;
}

export function createSlidesRateLimiter(
  limit: number = SLIDES_RATE_LIMIT,
  windowMs: number = SLIDES_RATE_WINDOW_MS,
  maxEntries: number = SLIDES_RATE_MAX_ENTRIES,
): SlidesRateLimiter {
  // Map bewahrt die Einfügereihenfolge; per delete+set beim Zugriff wird sie zur LRU-Ordnung.
  const buckets = new Map<string, number[]>();
  const evict = (nowMs: number): void => {
    if (buckets.size < maxEntries) {
      return;
    }
    // 1) TTL: abgelaufene Einträge (kein Zeitstempel mehr im Fenster) entfernen.
    for (const [key, stamps] of buckets) {
      if (!stamps.some((t) => t > nowMs - windowMs)) {
        buckets.delete(key);
      }
    }
    // 2) LRU: reicht das nicht, fliegen die am längsten unbenutzten Einträge — die Map wächst
    // NIE über maxEntries (ein verdrängter Vielnutzer beginnt schlimmstenfalls frisch zu zählen).
    for (const key of buckets.keys()) {
      if (buckets.size < maxEntries) {
        break;
      }
      buckets.delete(key);
    }
  };
  return {
    hit(userId: string, nowMs: number): boolean {
      evict(nowMs);
      const stamps = (buckets.get(userId) ?? []).filter((t) => t > nowMs - windowMs);
      buckets.delete(userId); // delete+set → der Eintrag wandert ans LRU-Ende (zuletzt benutzt)
      if (stamps.length >= limit) {
        buckets.set(userId, stamps);
        return true;
      }
      stamps.push(nowMs);
      buckets.set(userId, stamps);
      return false;
    },
    size(): number {
      return buckets.size;
    },
  };
}

export function slidesRoutes(converter: SlideConverter, guards: Guards): FastifyPluginAsync {
  // Modul-Zustand der Serialisierung: max. 1 laufende Konvertierung, keine Warteschlange.
  let running = false;
  // WP-SHIP7-FIX (Fix 5): welcher Request hält den Slot? Request-lokal markiert, damit die
  // Freigabe (onResponse/onError/onRequestAbort) NUR vom Halter kommt — abgewiesene Requests
  // geben nie frei.
  const slotHolder = new WeakSet<FastifyRequest>();
  const limiter = createSlidesRateLimiter();
  // WP-REST18 (bens Fix 3, Watchdog): begrenzter Slot-Lease. Fastify dokumentiert die Abort-
  // Erkennung selbst als nicht verlässlich — hält ein Request den Slot länger als die Lease
  // (großzügig ÜBER der 60-s-Konverter-Deadline), gibt der Timer ihn mit PII-freiem Warn-Log
  // frei, statt bis zum Prozessneustart zu blockieren.
  let leaseTimer: NodeJS.Timeout | null = null;
  let leaseHolder: FastifyRequest | null = null;

  const releaseSlot = (request: FastifyRequest): void => {
    if (slotHolder.has(request)) {
      slotHolder.delete(request);
      running = false;
      if (leaseTimer !== null) {
        clearTimeout(leaseTimer);
        leaseTimer = null;
      }
      leaseHolder = null;
    }
  };

  const claimSlot = (request: FastifyRequest): void => {
    running = true;
    slotHolder.add(request);
    leaseHolder = request;
    leaseTimer = setTimeout(() => {
      leaseTimer = null;
      const holder = leaseHolder;
      if (holder !== null && slotHolder.has(holder)) {
        slotHolder.delete(holder);
        leaseHolder = null;
        running = false;
        // PII-frei: keine Nutzer-/Inhaltsdaten — nur der Fakt der Zwangsfreigabe.
        process.stderr.write(
          `[KLARWERK] Folien-Slot nach ${SLIDES_SLOT_LEASE_MS} ms Lease zwangsweise freigegeben (Abort nicht erkannt?).\n`,
        );
      }
    }, SLIDES_SLOT_LEASE_MS);
    leaseTimer.unref?.();
  };

  return async (app) => {
    // WP-RETEST7 R8 (Pedis Spinner-Befund): LEICHTER Verfügbarkeits-Check VOR dem großen Upload.
    // Der Client fragt zuerst hier an und zeigt bei disabled/ohne Konverter SOFORT die ehrliche
    // Meldung — ohne die 72-MiB-POST überhaupt zu senden. Auth wie die Konvertierungs-Route.
    app.get("/api/capture/slides/availability", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send({ available: slidesEnabled() && (await converter.available()) });
    });

    // WP-REST18 (bens Fix 3, ROT): bricht der Client ab, während der 72-MiB-Body geparst wird
    // (oder der Handler läuft), feuert KEIN onResponse — der Slot bliebe bis zum Prozessneustart
    // belegt. onRequestAbort gibt ihn frei (nur der Halter; abgewiesene Requests sind No-ops).
    // Plugin-Scope = nur diese Route.
    app.addHook("onRequestAbort", async (request) => {
      releaseSlot(request);
    });

    app.post<{ Body: { data?: string } }>(
      "/api/capture/slides",
      {
        bodyLimit: SLIDES_BODY_LIMIT,
        // Blocker 3 + Fix 5: der komplette Abweisungs-Pfad UND der atomare Slot-Claim laufen VOR
        // dem Body-Parsing (onRequest läuft vor jedem Content-Type-Parser). Reihenfolge:
        // Auth/Recht → Betriebsschalter → Rate-Limit → Abort-Kurzschluss → Slot-Claim (synchron
        // nach dem letzten await — zwei Requests können den Slot nie beide nehmen). Bewusst
        // INLINE in den Routen-Optionen, damit der RBAC-Scanner (routeGuardAudit) die
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
          if (limiter.hit(user.id, Date.now())) {
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
          // WP-REST18 (Fix 3): ein Request, dessen Verbindung WÄHREND des asynchronen Auth-Await
          // abgerissen ist, darf NICHT nachträglich claimen (das onRequestAbort-Ereignis wäre
          // schon verpufft, bevor er Halter wurde). Kurzschluss: kein Claim, kein Parse — die
          // Antwort verpufft bewusst am toten Socket.
          if (request.raw.aborted || request.raw.destroyed) {
            reply.code(408).send({ error: "CLIENT_ABORTED", message: "Verbindung abgebrochen." });
            return;
          }
          // Fix 5: ATOMARER Slot-Claim — Prüfung und Claim synchron (kein await dazwischen).
          // Der zweite Request im Fenster bekommt 429, OHNE dass sein 72-MiB-Body geparst wird.
          if (running) {
            reply.code(429).header("retry-after", "30").send({
              error: "CONVERSION_BUSY",
              message:
                "Es läuft gerade eine andere Folien-Konvertierung — bitte in einem Moment erneut versuchen.",
            });
            return;
          }
          claimSlot(request);
        },
        // Fix 5: Freigabe auf ALLEN Pfaden — onResponse feuert nach JEDER gesendeten Antwort
        // (Erfolg, Validierungsfehler, Parserfehler/413, 500); onError ist der Gürtel dazu;
        // onRequestAbort (oben, Plugin-Scope) deckt den Client-Abbruch ohne Antwort ab.
        // Doppel-Freigabe ist durch die request-lokale Markierung ausgeschlossen.
        onResponse: async (request: FastifyRequest): Promise<void> => {
          releaseSlot(request);
        },
        onError: async (request: FastifyRequest): Promise<void> => {
          releaseSlot(request);
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
        // Der Slot gehört diesem Request (im Hook geclaimt); Freigabe übernimmt onResponse.
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
        }
      },
    );
  };
}
