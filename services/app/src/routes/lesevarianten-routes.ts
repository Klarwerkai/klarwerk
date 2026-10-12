// ================================================================================================
// JOB 3326 · LESEVARIANTE — DIE DREI ROUTEN (JOB 3363: die vierte).
// ================================================================================================
//
//   GET  /api/kos/:id/lesevariante/:lang   die VOLLE Variante EINES Objekts (Detailansicht)
//   GET  /api/lesevarianten?lang=de        die KURZE Übersicht (Titel/Kernaussage) für Listen
//   POST /api/admin/lesevarianten/laden    die Admin-Aktion „Übersetzungen für Paket laden"
//   GET  /api/library/import/candidates/:id/lesevariante/:lang   (JOB 3363) die LIVE aufgelöste
//        Variante eines noch NICHT angenommenen Kandidaten der Prüfkarte
//
// WARUM DIE ÜBERSICHT SCHMAL IST: Die Bibliotheksliste und die Prüfkarten brauchen Titel und
// Kernaussage, nicht den Fließtext. Läge der Text mit in der Übersicht, wüchse eine Listenantwort
// mit jedem übersetzten Objekt um einen ganzen Artikel — für eine Anzeige, die ihn gar nicht zeigt.
//
// WARUM DIE SICHTBARKEIT HIER GENAUSO GILT WIE AM WISSENSOBJEKT: Eine Lesevariante trägt Titel und
// Inhalt des Objekts, nur in einer anderen Sprache. Wäre sie leichter zu bekommen als das Original,
// wäre sie der Umweg um die Sichtbarkeitsregel. Beide Leserouten laufen deshalb über DIESELBE
// Entscheidung (`sichtbareFuer`/`darfSehen`, services/app/src/sichtbarkeit.ts) wie `GET /api/kos`
// und `GET /api/kos/:id` — es entsteht keine zweite Auslegung.
//
// WAS DIESE ROUTEN NICHT TUN: Sie ändern kein Wissensobjekt, legen keines an, und die Variante ist
// niemals Freigabegegenstand. Der Ladeweg ruft KEIN Modell (die Übersetzungen liegen als Datei im
// Auslieferungsstand) und erzeugt damit auch keine laufenden Kosten.
import type { FastifyPluginAsync } from "fastify";
import type { AuditService } from "../../../audit";
import type { KnowledgeObject, KoService } from "../../../knowledge-object";
import type { ImportCandidate } from "../../../library-analytics";
import type { Guards } from "../http";
import {
  type LesevariantenRepo,
  kandidatenLesevariante,
  ladeLesevarianten,
  lokalisierungsPaket,
  mitAenderungsauskunft,
} from "../lesevarianten";
import {
  type KandidatenRechtequelle,
  darfKandidatSehen,
  darfSehen,
  sichtbareFuer,
  sichtbarkeitsfilterFuer,
  sqlSichtbarkeitFuer,
} from "../sichtbarkeit";

/**
 * JOB 3363: der Zugang zum Kandidatenbestand, so schmal wie die Frage — EIN Kandidat zu EINER
 * Kennung. Es ist derselbe Bestand, den die Warteschlange liest (die Kompositionswurzel reicht
 * dieselbe Ablage-Instanz durch, s. `build-app.ts`); ein zweiter wäre ein zweiter Wahrheitsort
 * über denselben Kandidaten. Bewusst NICHT der ganze `CandidateRepo`: diese Routen dürfen an
 * Kandidaten nichts schreiben, und was sie nicht bekommen, können sie nicht aufrufen.
 */
export interface KandidatenZugriff {
  findById(id: string): Promise<ImportCandidate | undefined>;
}

export interface LesevariantenRoutesDeps {
  ko: KoService;
  lesevarianten: LesevariantenRepo;
  /** JOB 3363: der Kandidatenbestand der Prüfkarte — nur lesend, nur `findById`. */
  kandidaten: KandidatenZugriff;
  audit?: AuditService;
  /**
   * confluence-import-rechte (Nacharbeit 6, F1): dieselbe Sichtbarkeitsgrenze wie die
   * Warteschlange (`darfKandidatSehen`). Fehlt sie, bleibt ein Eintrag MIT Quellrechten verschlossen.
   */
  kandidatenRechte?: KandidatenRechtequelle;
}

interface LadeBody {
  package?: unknown;
}

export function lesevariantenRoutes(
  deps: LesevariantenRoutesDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { ko, lesevarianten, kandidaten } = deps;
  return async (app) => {
    app.get<{ Params: { id: string; lang: string } }>(
      "/api/kos/:id/lesevariante/:lang",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const item = await ko.get(request.params.id);
        // Ein unsichtbares Objekt ist ein 404 — auch hier. Eine Antwort „Variante nicht vorhanden"
        // wäre bereits eine Existenzauskunft über das Objekt.
        if (!item || !darfSehen(user, item)) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Wissensobjekt nicht gefunden." });
          return;
        }
        const variante = await lesevarianten.get(item.id, request.params.lang);
        if (!variante) {
          reply.code(404).send({
            error: "NO_LESEVARIANTE",
            message: "Für dieses Objekt gibt es keine Lesevariante in dieser Sprache.",
          });
          return;
        }
        reply.code(200).send(mitAenderungsauskunft(variante, item));
      },
    );

    app.get<{ Querystring: { lang?: string } }>("/api/lesevarianten", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const lang = String(request.query.lang ?? "").trim();
      if (!lang) {
        reply.code(400).send({ error: "MISSING_LANG", message: "Sprache fehlt." });
        return;
      }
      const sichtbare = sichtbareFuer(user, await ko.list({}, sqlSichtbarkeitFuer(user)));
      const jeId = new Map<string, KnowledgeObject>(sichtbare.map((k) => [k.id, k]));
      const eintraege = (await lesevarianten.inSprache(lang))
        .map((variante) => {
          const objekt = jeId.get(variante.koId);
          if (!objekt) {
            return undefined;
          }
          const sicht = mitAenderungsauskunft(variante, objekt);
          // Bewusst OHNE `bodyHtml`: die Übersicht trägt genau das, was Listen und Prüfkarten
          // zeigen. Wer den Text braucht, holt ihn über die Route darüber.
          return {
            koId: sicht.koId,
            lang: sicht.lang,
            originalLanguage: sicht.originalLanguage,
            title: sicht.title,
            statement: sicht.statement,
            herkunft: sicht.herkunft,
            status: sicht.status,
            originalGeaendert: sicht.originalGeaendert,
            // Der fehlende Beleg reist MIT in die Liste: eine Kennzeichnung, die nur in der
            // Detailansicht steht, fehlt genau dort, wo man sie zuerst braucht.
            quellabgleich: sicht.quellabgleich,
            updatedAt: sicht.updatedAt,
            // Peter Nr. 20: Originalquelle und belegte Fassung reisen ebenso mit.
            originalquelle: sicht.originalquelle,
            fassung: sicht.fassung,
          };
        })
        .filter((e): e is NonNullable<typeof e> => e !== undefined);
      reply.code(200).send({ lang, eintraege });
    });

    // ============================================================================================
    // JOB 3363 — DIE PRÜFKARTE FRAGT ÜBER DEN ECHTEN KANDIDATEN, NICHT ÜBER DIE LIEFERUNG.
    // ============================================================================================
    //
    // EINGABE IST EINE KANDIDATEN-KENNUNG. Erst der Server holt daraus Provider und Quellkennung
    // und hält sie gegen die Lieferung. Eine Route, die `provider` und `externalId` vom Client
    // ENTGEGENNÄHME, wäre ein freier Lesezugang zum Übersetzungskatalog: wer die Seiten-Id einer
    // Confluence-Seite rät, bekäme ihren Text, ohne dass irgendetwas davon im Bestand steht.
    //
    // DIESELBE RECHTESCHWELLE WIE DIE WARTESCHLANGE. `GET /api/library/import/candidates`
    // (library-routes.ts) verlangt `ko.read` und filtert danach nicht weiter — die Queue ist eine
    // Prüffläche, kein KO-Bestand. Diese Route verlangt DASSELBE Recht und zeigt nichts, was die
    // Queue nicht zeigt: der Kandidatentext steht dort bereits, hier steht er übersetzt.
    // `tests/lesevariante-pruefkarte/kandidatenvariante-route.test.ts` (K6) hält beide Routen im
    // selben Fall gegeneinander.
    //
    // SIE SCHREIBT NICHTS. Kein Annehmen, kein Statuswechsel, kein Claim, keine Lease-Reparatur
    // (die Queue fährt sie beim Laden — hier wäre sie eine Nebenwirkung eines Lesevorgangs). K2
    // misst den Kandidaten nach dem Abruf: Status „neu", `koId` null.
    app.get<{ Params: { id: string; lang: string } }>(
      "/api/library/import/candidates/:id/lesevariante/:lang",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const gefunden = await kandidaten.findById(request.params.id);
        // confluence-import-rechte (Nacharbeit 6, F1): ein Kandidat, den die Quelle diesem Menschen
        // nicht zeigt, gilt hier als nicht vorhanden — wie in der Warteschlange.
        const traegtQuellrechte =
          gefunden !== undefined && Object.hasOwn(gefunden.item as object, "quellrechte");
        const sichtbar =
          gefunden === undefined
            ? false
            : deps.kandidatenRechte
              ? await darfKandidatSehen(user, gefunden, deps.kandidatenRechte)
              : !traegtQuellrechte;
        const kandidat = sichtbar ? gefunden : undefined;
        if (!kandidat) {
          // Kein Kandidat, keine Auskunft — auch keine über die Lieferung. Eine Antwort
          // „keine Variante" wäre hier bereits eine Existenzauskunft über die Kennung.
          reply.code(404).send({ error: "NOT_FOUND", message: "Kandidat nicht gefunden." });
          return;
        }
        const variante = kandidatenLesevariante(request.params.lang, kandidat.item, kandidat.item);
        if (!variante) {
          reply.code(404).send({
            error: "NO_LESEVARIANTE",
            message: "Für diesen Kandidaten gibt es keine Lesevariante in dieser Sprache.",
          });
          return;
        }
        // Feldweise wie die Übersicht darüber: was die Fläche zeigt, geht auf den Draht — und der
        // Datensatzschlüssel der Lieferung bleibt Werkstattwissen im Server.
        reply.code(200).send({
          lang: variante.lang,
          originalLanguage: variante.originalLanguage,
          title: variante.title,
          statement: variante.statement,
          bodyHtml: variante.bodyHtml,
          herkunft: variante.herkunft,
          status: variante.status,
          quellabgleich: variante.quellabgleich,
          originalquelle: variante.originalquelle,
          fassung: variante.fassung,
        });
      },
    );

    app.post<{ Body: LadeBody }>("/api/admin/lesevarianten/laden", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      const paket = lokalisierungsPaket(String(request.body?.package ?? ""));
      if (!paket) {
        reply.code(400).send({
          error: "UNKNOWN_PACKAGE",
          message: "Für dieses Paket liegt keine Übersetzungslieferung bei.",
        });
        return;
      }
      const bilanz = await ladeLesevarianten(
        {
          repo: lesevarianten,
          // UNGETRIMMT: das Zuordnen ist ein Admin-Vorgang über den ganzen Bestand. Was hier
          // zugeordnet wird, ist deshalb noch keine Anzeige — die Leserouten oben trimmen.
          kos: () => ko.list({}),
          // aufnahme:20260922:gesamt-leserechte (Ben, Nacharbeit 10): `users.manage` ersetzt kein
          // Space-Leserecht. Die Antwort zählt und nennt nur, was DIESER Admin sehen darf.
          sichtbar: sichtbarkeitsfilterFuer(user),
          ...(deps.audit ? { audit: deps.audit } : {}),
        },
        paket,
        user.id,
      );
      reply.code(200).send(bilanz);
    });

    // ============================================================================================
    // PETER NR. 20 (12.10.2026) — „ÜBERSETZUNGSWIDERSPRÜCHE MELDEN, KEINE AUTOMATISCHE FACHLICHE
    // FREIGABE".
    // ============================================================================================
    //
    // Wer liest, dass die Übersetzung etwas anderes sagt als das Original, meldet es HIER — mit
    // Bezug auf GENAU diese Übersetzung (Abdruck der Übersetzung) und GENAU dieses Original
    // (Abdruck, Version, Anker). Die Meldung ist ein Eintrag im Prüfprotokoll mit dem Objekt als
    // Ziel; die Herkunftskette des Objekts zeigt ihn (`koAuditEvents`, Ziel = KO-Kennung).
    //
    // WAS SIE NICHT TUT: Sie ändert weder das Wissensobjekt noch die Übersetzung, verschiebt keinen
    // Prüfstatus, löst keinen Konflikt aus und gibt nichts frei. Dasselbe Recht wie das Lesen
    // (`ko.read`) und dieselbe Sichtbarkeit (`darfSehen`): melden kann, wer die Übersetzung sehen
    // kann — und niemand sonst erfährt über diese Tür, ob es das Objekt gibt.
    app.post<{ Params: { id: string; lang: string }; Body: WiderspruchBody }>(
      "/api/kos/:id/lesevariante/:lang/widerspruch",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const item = await ko.get(request.params.id);
        if (!item || !darfSehen(user, item)) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Wissensobjekt nicht gefunden." });
          return;
        }
        const variante = await lesevarianten.get(item.id, request.params.lang);
        if (!variante) {
          reply.code(404).send({
            error: "NO_LESEVARIANTE",
            message: "Für dieses Objekt gibt es keine Lesevariante in dieser Sprache.",
          });
          return;
        }
        const begruendung = begruendungAus(request.body);
        if (!begruendung.ok) {
          reply.code(400).send(begruendung.fehler);
          return;
        }
        if (!deps.audit) {
          reply.code(503).send({
            error: "AUDIT_UNAVAILABLE",
            message: "Das Prüfprotokoll ist nicht verfügbar; die Meldung wurde nicht gespeichert.",
          });
          return;
        }
        const sicht = mitAenderungsauskunft(variante, item);
        const eintrag = await deps.audit.record({
          actor: user.id,
          action: WIDERSPRUCH_AKTION,
          target: item.id,
          // Bezug, keine Kopie: Abdrücke, Version und Anker — der übersetzte Text selbst geht NICHT
          // ins Protokoll (die Variante bleibt ausserhalb aller Wahrheitswege).
          payload: {
            gegenstand: "wissensobjekt",
            lang: sicht.lang,
            originalLanguage: sicht.originalLanguage,
            herkunft: sicht.herkunft,
            uebersetzungSha256: sicht.uebersetzungSha256,
            originalSha256: sicht.originalSha256,
            originalGeaendert: sicht.originalGeaendert,
            quellabgleich: sicht.quellabgleich,
            koVersion: item.version,
            fassung: sicht.fassung,
            originalquelle: sicht.originalquelle
              ? {
                  provider: sicht.originalquelle.provider,
                  kennung: sicht.originalquelle.kennung,
                  quellfassung: sicht.originalquelle.quellfassung,
                }
              : null,
            begruendung: begruendung.text,
          },
        });
        reply.code(201).send({
          gemeldet: true,
          gegenstand: "wissensobjekt",
          ziel: item.id,
          lang: sicht.lang,
          seq: eintrag.seq,
        });
      },
    );

    // Dasselbe für die Prüfkarte (JOB 3363): ein noch NICHT angenommener Kandidat. Ziel des
    // Protokolleintrags ist die Kandidaten-Kennung — es gibt kein Wissensobjekt, und es entsteht
    // auch keins. Der Kandidat bleibt, wie er ist (Status, `koId`). DIESELBE Sichtbarkeitsgrenze wie
    // der Abruf darüber (confluence-import-rechte, `darfKandidatSehen`): wer den Kandidaten nicht
    // sehen darf, kann ihn auch nicht beanstanden — und erfährt über diese Tür nicht, dass es ihn gibt.
    app.post<{ Params: { id: string; lang: string }; Body: WiderspruchBody }>(
      "/api/library/import/candidates/:id/lesevariante/:lang/widerspruch",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const gefunden = await kandidaten.findById(request.params.id);
        const traegtQuellrechte =
          gefunden !== undefined && Object.hasOwn(gefunden.item as object, "quellrechte");
        const sichtbar =
          gefunden === undefined
            ? false
            : deps.kandidatenRechte
              ? await darfKandidatSehen(user, gefunden, deps.kandidatenRechte)
              : !traegtQuellrechte;
        const kandidat = sichtbar ? gefunden : undefined;
        if (!kandidat) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Kandidat nicht gefunden." });
          return;
        }
        const variante = kandidatenLesevariante(request.params.lang, kandidat.item, kandidat.item);
        if (!variante) {
          reply.code(404).send({
            error: "NO_LESEVARIANTE",
            message: "Für diesen Kandidaten gibt es keine Lesevariante in dieser Sprache.",
          });
          return;
        }
        const begruendung = begruendungAus(request.body);
        if (!begruendung.ok) {
          reply.code(400).send(begruendung.fehler);
          return;
        }
        if (!deps.audit) {
          reply.code(503).send({
            error: "AUDIT_UNAVAILABLE",
            message: "Das Prüfprotokoll ist nicht verfügbar; die Meldung wurde nicht gespeichert.",
          });
          return;
        }
        const eintrag = await deps.audit.record({
          actor: user.id,
          action: WIDERSPRUCH_AKTION,
          target: kandidat.id,
          payload: {
            gegenstand: "kandidat",
            lang: variante.lang,
            originalLanguage: variante.originalLanguage,
            herkunft: variante.herkunft,
            quellabgleich: variante.quellabgleich,
            fassung: variante.fassung,
            originalquelle: {
              provider: variante.originalquelle.provider,
              kennung: variante.originalquelle.kennung,
              quellfassung: variante.originalquelle.quellfassung,
            },
            begruendung: begruendung.text,
          },
        });
        reply.code(201).send({
          gemeldet: true,
          gegenstand: "kandidat",
          ziel: kandidat.id,
          lang: variante.lang,
          seq: eintrag.seq,
        });
      },
    );
  };
}

/** Der Protokollcode der Meldung — `audit.action.lesevariante_widerspruch` beschriftet ihn. */
export const WIDERSPRUCH_AKTION = "lesevariante.widerspruch";

/** Obergrenze der Begründung: eine Meldung ist ein Hinweis, kein zweiter Artikel. */
export const WIDERSPRUCH_MAX_ZEICHEN = 2000;

interface WiderspruchBody {
  begruendung?: unknown;
}

type Begruendung =
  | { ok: true; text: string }
  | { ok: false; fehler: { error: string; message: string } };

/** Ohne Begründung keine Meldung — sonst wüsste niemand, WAS der Widerspruch ist. */
function begruendungAus(body: WiderspruchBody | undefined): Begruendung {
  const roh = body?.begruendung;
  const text = typeof roh === "string" ? roh.trim() : "";
  if (text.length === 0) {
    return {
      ok: false,
      fehler: { error: "MISSING_REASON", message: "Bitte beschreiben, was sich widerspricht." },
    };
  }
  if (text.length > WIDERSPRUCH_MAX_ZEICHEN) {
    return {
      ok: false,
      fehler: {
        error: "REASON_TOO_LONG",
        message: `Die Begründung ist länger als ${WIDERSPRUCH_MAX_ZEICHEN} Zeichen.`,
      },
    };
  }
  return { ok: true, text };
}
