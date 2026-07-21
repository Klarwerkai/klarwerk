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

// WP-REST18 (bens Fix 3): maximale Slot-Haltedauer — danach löst der Lease-Watchdog den Zwangs-
// Abbruch aus (Fastifys Abort-Erkennung ist laut eigener Doku nicht verlässlich; ohne Lease bliebe
// ein verwaister Slot bis zum Prozessneustart).
// WP-SHIP8-FIX (bens F5, ZEITFENSTER ehrlich erklärt): die Lease zählt AB DEM CLAIM im onRequest-
// Hook — sie muss also Upload + Body-Parse + Konverter-Lauf ZUSAMMEN abdecken. Der Konverter
// selbst ist auf 60 s gedeckelt, aber ein langsamer 72-MiB-Upload kann davor mehrere Minuten
// brauchen. Deshalb großzügige 300 s (Upload+Parse+Konverter < Lease); die Lease ist NICHT der
// primäre Timeout (das bleiben Konverter-Deadline und Client-Timeout), sondern die letzte
// Verteidigung gegen einen verwaisten Slot — und seit F5 gibt sie NIE mehr frei, solange der
// zugehörige Konverter-Job noch läuft (erst Abbruch, dann Settlement, dann Freigabe).
export const SLIDES_SLOT_LEASE_MS = 300_000;

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
  // Erkennung selbst als nicht verlässlich — hält ein Request den Slot länger als die Lease,
  // greift der Watchdog ein, statt bis zum Prozessneustart zu blockieren.
  // WP-SHIP8-FIX (bens F5, ECHTE CANCELLATION): der Watchdog gibt den Slot NICHT mehr einfach
  // frei (das erlaubte zwei PARALLELE LibreOffice-Läufe — genau das, was die Serialisierung
  // verhindern soll). Stattdessen: (1) ABBRUCH auslösen — AbortSignal an den Konverter-Lauf
  // (Prozessgruppen-SIGKILL wie beim 60-s-Timeout) bzw. Socket-Close, wenn der Request noch im
  // Upload/Body-Parse hängt; (2) auf das SETTLEMENT des Job-Promise WARTEN; (3) ERST DANN Slot
  // frei + Warn-Log. Es gibt keinen Freigabepfad unter einem noch aktiven Konverter.
  let leaseTimer: NodeJS.Timeout | null = null;
  let leaseHolder: FastifyRequest | null = null;
  // Zustand des EINEN laufenden Jobs (Single-Slot-Invariante): das Abort-Steuer des Halters und —
  // sobald der Handler den Konverter gestartet hat — dessen Promise (null = noch im Upload/Parse).
  let abortCtl: AbortController | null = null;
  let activeJob: Promise<unknown> | null = null;

  // Aufräumer des Socket-Close-Wächters des AKTUELLEN Halters (Single-Slot-Invariante).
  let socketCloseCleanup: (() => void) | null = null;

  // Sofort-Freigabe OHNE Settle-Warten — NUR von releaseSlot (nach dem Settlement) gerufen.
  const releaseNow = (request: FastifyRequest): boolean => {
    if (!slotHolder.has(request)) {
      return false;
    }
    slotHolder.delete(request);
    running = false;
    if (leaseTimer !== null) {
      clearTimeout(leaseTimer);
      leaseTimer = null;
    }
    leaseHolder = null;
    socketCloseCleanup?.();
    socketCloseCleanup = null;
    return true;
  };

  // WP-SAMMEL21-FIX (bens Fix 2, ROT): DIE EINE gemeinsame Release-Routine ALLER Freigabepfade
  // (onRequestAbort, onResponse, onError UND Lease-Watchdog). Die Settle-Pflicht aus F5 gilt
  // überall: läuft noch ein Konverter-Job, wird ZUERST das AbortSignal ausgelöst (Prozessgruppen-
  // SIGKILL-Weg) und das SETTLEMENT abgewartet — KEIN Pfad setzt running=false unter einem
  // aktiven convert(). Vorher riss der Client-90-s-Abort über onRequestAbort den Slot frei,
  // während LibreOffice weiterlief — zwei parallele Konverter waren möglich.
  // Rückgabe true = DIESER Aufruf hat freigegeben (für das Watchdog-Warn-Log).
  const releaseSlot = async (request: FastifyRequest): Promise<boolean> => {
    if (!slotHolder.has(request)) {
      return false;
    }
    const job = activeJob;
    if (job !== null) {
      abortCtl?.abort();
      try {
        await job;
      } catch {
        // Der Abbruchfehler ist der erwartete Ausgang.
      }
    }
    // Idempotent: hat ein konkurrierender Freigabepfad nach dem Settlement schon freigegeben,
    // ist nichts mehr zu tun (kein Doppel-Release).
    return releaseNow(request);
  };

  const expireLease = async (holder: FastifyRequest): Promise<void> => {
    if (leaseHolder !== holder || !slotHolder.has(holder)) {
      return;
    }
    // Hängt der Request noch im Upload/Body-Parse (kein Job), beendet der Socket-Close den
    // Parse — onRequestAbort läuft dann durch DIESELBE Release-Routine. Ein danach doch noch
    // startender Handler sieht das abgefeuerte Signal und bricht sofort ab.
    abortCtl?.abort();
    if (activeJob === null) {
      holder.raw.destroy();
    }
    const released = await releaseSlot(holder);
    if (released) {
      // PII-frei: keine Nutzer-/Inhaltsdaten — nur der Fakt der Zwangsfreigabe nach Abbruch.
      process.stderr.write(
        `[KLARWERK] Folien-Slot nach ${SLIDES_SLOT_LEASE_MS} ms Lease abgebrochen und nach Job-Ende zwangsweise freigegeben.\n`,
      );
    }
  };

  const claimSlot = (request: FastifyRequest): void => {
    running = true;
    slotHolder.add(request);
    leaseHolder = request;
    abortCtl = new AbortController();
    activeJob = null;
    // WP-SAMMEL21-FIX (bens Fix 2): Fastifys onRequestAbort ist dokumentiert UNZUVERLÄSSIG —
    // bei bereits komplett empfangenem Body (Client bricht WÄHREND des convert() ab, genau der
    // 90-s-Client-Timeout) feuert es hier nachweislich NICHT; der Slot hinge dann bis zum
    // Lease-Watchdog. Der rohe TCP-Socket-Close ist das verlässliche Signal: er läuft durch
    // DIESELBE settle-pflichtige Release-Routine (Abbruch → Settlement → frei). Nach einer
    // regulären Antwort ist der Slot längst frei → der Close-Wächter ist dann ein No-op;
    // releaseNow räumt den Listener auf (keine Ansammlung auf Keep-Alive-Sockets).
    const rawSocket = request.raw.socket;
    if (rawSocket) {
      const onSocketClose = (): void => {
        void releaseSlot(request);
      };
      rawSocket.once("close", onSocketClose);
      socketCloseCleanup = () => rawSocket.removeListener("close", onSocketClose);
    } else {
      socketCloseCleanup = null;
    }
    leaseTimer = setTimeout(() => {
      leaseTimer = null;
      void expireLease(request);
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
    // WP-SAMMEL21-FIX (bens Fix 2): über die GEMEINSAME Release-Routine — bei aktivem Konverter
    // erst Abbruch + Settlement, dann Freigabe (nie zwei Konverter parallel).
    // Plugin-Scope = nur diese Route.
    app.addHook("onRequestAbort", async (request) => {
      await releaseSlot(request);
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
          await releaseSlot(request);
        },
        onError: async (request: FastifyRequest): Promise<void> => {
          await releaseSlot(request);
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
        // WP-SHIP8-FIX (bens F5): das Abort-Signal des Slot-Claims begleitet den Konverter-Lauf
        // (Lease-Ablauf → Prozessgruppen-SIGKILL), und das Job-Promise wird registriert, damit der
        // Lease-Watchdog auf sein SETTLEMENT warten kann, bevor er den Slot je freigibt.
        const signal = slotHolder.has(request) ? abortCtl?.signal : undefined;
        const job = converter.convert(Buffer.from(data, "base64"), signal ? { signal } : {});
        activeJob = job;
        try {
          const result = await job;
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
          // Nur den EIGENEN Job austragen (ein neuer Claim könnte bereits einen neuen registriert haben).
          if (activeJob === job) {
            activeJob = null;
          }
        }
      },
    );
  };
}
